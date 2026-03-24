// game-client.js - ゲーム画面のクライアント通信ロジック（3レーン×前後列対応）
'use strict';

const socket = io();

// BGM再生
if (window.audioManager) {
  window.audioManager.playBGM('game');
}

const sessionId = sessionStorage.getItem('sessionId');
let gameState = null;
let selectedCardIndex = null;
let selectedAttacker = null; // { row, lane }
let keywordMap = {};

// マスタデータ取得
async function loadMasterData() {
  try {
    const res = await fetch('/api/keywords');
    keywordMap = await res.json();
    console.log('✅ キーワードマスタ取得完了');
  } catch (err) {
    console.error('❌ キーワードマスタ取得エラー:', err);
  }
}
loadMasterData();

if (sessionId) {
  socket.emit('restore_session', { sessionId });
} else {
  alert('セッションが見つかりません。ロビーに戻ります。');
  window.location.href = '/';
}

socket.on('session_invalid', () => {
  alert('セッションが無効です。ロビーに戻ります。');
  window.location.href = '/';
});

socket.on('session_restored', (data) => console.log('✅ セッション復帰:', data));

socket.on('mulligan_phase', (data) => {
  console.log('==> EVENT mulligan_phase received', data);
  try {
    showMulligan(data.hand,
      () => socket.emit('mulligan_decision', { doMulligan: false }),
      () => socket.emit('mulligan_decision', { doMulligan: true })
    );
  } catch (e) {
    console.error('❌ Error in showMulligan:', e);
  }
});

let turnOrderShown = false;

socket.on('game_state', (state) => {
  console.log('==> EVENT game_state received', state);
  
  // 先攻・後攻演出 (第1ターンの開始時に一度だけ表示)
  if (!turnOrderShown && state.turnNumber === 1 && state.phase === 'battle') {
    if (window.showTurnOrder) {
      window.showTurnOrder(state.currentPlayerId === state.me.id);
    }
    turnOrderShown = true;
  }

  gameState = state;
  selectedCardIndex = null;
  selectedAttacker = null;
  try {
    updateUI();
  } catch (e) {
    console.error('❌ Error in updateUI:', e);
  }
});

socket.on('waiting_mulligan', () => {});

socket.on('action_error', (data) => {
  console.warn('❌ アクションエラー:', data.message);
  if (window.audioManager) window.audioManager.playSE('error');
  
  const logContent = document.getElementById('log-content');
  const el = document.createElement('div');
  el.className = 'log-entry important';
  el.style.color = 'var(--danger)';
  el.textContent = `❌ ${data.message}`;
  logContent.appendChild(el);
  logContent.scrollTop = logContent.scrollHeight;
});

socket.on('player_disconnected', () => {
  alert('対戦相手が切断しました');
  window.location.href = '/';
});

// インタラクション管理
let dragGhost = null;
let isDragging = false;
let dragSource = null; // { type, index, row, lane }

function initInteractions() {
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

let isDraggingAttack = false;
let attackerPos = null; // { x, y }

function onPointerMove(e) {
  if (isDragging && dragGhost) {
    dragGhost.style.left = `${e.clientX - 90}px`;
    dragGhost.style.top = `${e.clientY - 126}px`;
    dragGhost.style.transform = 'scale(1.1) rotate(2deg)';

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const slot = elements.find(el => el.classList.contains('board-slot') && el.classList.contains('can-place'));
    document.querySelectorAll('.board-slot.can-place').forEach(s => s.style.boxShadow = '');
    if (slot) slot.style.boxShadow = '0 0 30px #3b82f6, inset 0 0 20px #3b82f6';
  }

  if (isDraggingAttack && attackerPos) {
    const svg = document.getElementById('attack-arrow-svg');
    const line = document.getElementById('attack-arrow-line');
    if (svg && line) {
      svg.style.display = 'block';
      line.setAttribute('x1', attackerPos.x);
      line.setAttribute('y1', attackerPos.y);
      line.setAttribute('x2', e.clientX);
      line.setAttribute('y2', e.clientY);
    }
    
    // ターゲットのハイライト
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const target = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields');
    document.querySelectorAll('.board-slot').forEach(s => s.style.outline = '');
    document.getElementById('opp-shields').style.outline = '';
    
    if (target) {
        target.style.outline = '3px solid #ef4444';
    }
  }
}

function onPointerUp(e) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY);

  if (isDragging) {
    isDragging = false;
    const slot = elements.find(el => el.classList.contains('board-slot') && el.classList.contains('can-place'));
    if (slot && dragSource && dragSource.type === 'hand') {
      const row = slot.dataset.row;
      const lane = parseInt(slot.dataset.lane);
      socket.emit('game_action', { action: 'play_card', handIndex: dragSource.index, targetRow: row, targetLane: lane });
      if (window.audioManager) window.audioManager.playSE('playCard');
      selectedCardIndex = null; // 配置成功時はリセット
    }
    if (dragGhost) { 
        dragGhost.remove(); 
        dragGhost = null; 
        // もし大きく動かしていたらリセットするなどの処理も可能だが、
        // 現状はクリック時の pointerdown での状態トグルを優先するため、
        // ここでの一律リセットは避ける。
    }
  }

  if (isDraggingAttack) {
    isDraggingAttack = false;
    document.getElementById('attack-arrow-svg').style.display = 'none';
    
    const target = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields');
    if (target && dragSource && dragSource.type === 'unit') {
      const { row, lane } = dragSource;
      if (target.id === 'opp-shields') {
          const allDestroyed = gameState.opponent.totalShieldDurability <= 0;
          socket.emit('game_action', { action: 'attack', attackerRow: row, attackerLane: lane, targetInfo: { type: allDestroyed ? 'direct' : 'shield' } });
          if (window.audioManager) window.audioManager.playSE('attack');
          selectedAttacker = null; // 攻撃成功時はリセット
      } else if (target.classList.contains('opponent')) {
          const targetRow = target.dataset.row; 
          const targetLane = parseInt(target.dataset.lane);
          socket.emit('game_action', { action: 'attack', attackerRow: row, attackerLane: lane, targetInfo: { type: 'unit', row: targetRow, lane: targetLane } });
          if (window.audioManager) window.audioManager.playSE('attack');
          selectedAttacker = null; // 攻撃成功時はリセット
      }
    }
    document.querySelectorAll('.board-slot').forEach(s => s.style.outline = '');
    document.getElementById('opp-shields').style.outline = '';
  }

  document.querySelectorAll('.hand-card').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.board-slot').forEach(s => s.style.boxShadow = '');
  selectedCardIndex = null;
  selectedAttacker = null;
  updateUI();
}

// ユニットのドラッグ開始
function handleUnitPointerDown(e, row, lane) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  if (row !== 'player') return;
  
  const unit = gameState.me.board.front[lane] || gameState.me.board.back[lane];
  if (!unit || !unit.canAttack) return;

  // 選択状態を更新（クリック対応）
  if (selectedAttacker && selectedAttacker.row === row && selectedAttacker.lane === lane) {
    selectedAttacker = null;
  } else {
    selectedAttacker = { row, lane };
    selectedCardIndex = null;
  }
  updateUI();

  isDraggingAttack = true;
  dragSource = { type: 'unit', row, lane };
  const rect = e.currentTarget.getBoundingClientRect();
  attackerPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  
  e.preventDefault();
}

// ハンドカードのドラッグ開始
function handleCardPointerDown(e, index) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  
  // 選択状態を更新（クリック対応）
  if (selectedCardIndex === index) {
    selectedCardIndex = null;
  } else {
    selectedCardIndex = index;
    selectedAttacker = null;
  }
  updateUI();

  isDragging = true;
  dragSource = { type: 'hand', index };
  
  const original = e.currentTarget;
  original.classList.add('dragging');

  // ゴースト作成
  dragGhost = original.cloneNode(true);
  dragGhost.classList.add('drag-ghost');
  dragGhost.style.left = `${e.clientX - 90}px`;
  dragGhost.style.top = `${e.clientY - 126}px`;
  document.body.appendChild(dragGhost);
  
  e.preventDefault();
}

function updateUI() {
  if (!gameState) return;
  try {
    if (gameState.phase === 'game_over' && gameState.winner) {
      if (window.audioManager) {
        window.audioManager.stopBGM();
        window.audioManager.playBGM(gameState.winner === gameState.me.id ? 'victory' : 'defeat');
      }
      showResult(gameState.winner === gameState.me.id);
    }
  
    renderPlayerInfo(gameState);
    renderBoard(gameState, 
      selectedCardIndex !== null ? gameState.me.hand[selectedCardIndex] : null,
      selectedAttacker,
      handleSlotClick
    );
    renderHand(gameState, null, handleCardPointerDown); // clickの代わりにpointerdownを渡す
    renderLogs(gameState.logs || []);
    renderTurnInfo(gameState);
    updateShieldAttackUI();
  } catch (e) {
    console.error('❌ updateUI execution failed!', e);
  }
}

initInteractions();

// 設定メニュー制御
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
if (settingsBtn && settingsOverlay) {
  settingsBtn.onclick = () => {
    settingsOverlay.style.display = 'flex';
  };
}

// 投了ボタン
const btnSurrender = document.getElementById('btn-surrender');
if (btnSurrender) {
  btnSurrender.onclick = () => {
    if (confirm('本当に投了しますか？')) {
      socket.emit('game_action', { action: 'surrender' });
      settingsOverlay.style.display = 'none';
    }
  };
}

function updateShieldAttackUI() {
  const opponentShields = document.getElementById('opp-shields');
  if (!opponentShields) return;

  opponentShields.style.cursor = '';
  opponentShields.style.outline = '';
  opponentShields.classList.remove('target-highlight');
  opponentShields.onclick = null;
  
  if (!selectedAttacker || !gameState) return;
  if (gameState.currentPlayerId !== gameState.me.id) return;
  
  const { row, lane } = selectedAttacker;
  
  // 挑発チェック (クライアント側の簡易判定を強化)
  const isTaunt = (u) => u && (u.keywords || []).some(k => k.startsWith('taunt'));
  const hasTaunt = gameState.opponent.board.front.some(isTaunt);

  if (!hasTaunt) {
    opponentShields.style.cursor = 'pointer';
    opponentShields.classList.add('target-highlight');
    opponentShields.onclick = () => {
      const allDestroyed = gameState.opponent.totalShieldDurability <= 0;
      socket.emit('game_action', {
        action: 'attack',
        attackerRow: row,
        attackerLane: lane,
        targetInfo: { type: allDestroyed ? 'direct' : 'shield' },
      });
      if (window.audioManager) window.audioManager.playSE('attack');
      selectedAttacker = null;
      updateUI();
    };
  }
}

// ハンドラ
function handleCardClick(index) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  
  if (selectedCardIndex === index) {
    selectedCardIndex = null;
    selectedAttacker = null;
  } else {
    selectedCardIndex = index;
    selectedAttacker = null;
    
    const card = gameState.me.hand[index];
    if (card.type === 'spell') {
      const needsTarget = ['damage', 'destroy', 'freeze', 'drain', 'buff_attack', 'buff_hp', 'grant_barrier'].includes(card.abilityEffect);
      if (!needsTarget) {
        socket.emit('game_action', { action: 'play_card', handIndex: index, targetRow: null, targetLane: null });
        if (window.audioManager) window.audioManager.playSE('playCard');
        selectedCardIndex = null;
        updateUI();
        return;
      }
    }
  }
  updateUI();
}

function handleSlotClick(type, row, lane, e) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  
  if (type === 'unit_pointerdown') {
    handleUnitPointerDown(e, row, lane);
    return;
  }
  
  // クリック時の旧来のロジック（後方互換）
  switch (type) {
    case 'place_unit':
      if (selectedCardIndex === null) return;
      socket.emit('game_action', { action: 'play_card', handIndex: selectedCardIndex, targetRow: row, targetLane: lane });
      selectedCardIndex = null;
      updateUI();
      break;
    case 'select_attacker':
      if (selectedAttacker && selectedAttacker.row === row && selectedAttacker.lane === lane) {
        selectedAttacker = null;
      } else {
        selectedAttacker = { row, lane };
        selectedCardIndex = null;
      }
      updateUI();
      break;
    case 'attack_unit':
      if (!selectedAttacker) return;
      socket.emit('game_action', { action: 'attack', attackerRow: selectedAttacker.row, attackerLane: selectedAttacker.lane, targetInfo: { type: 'unit', row, lane } });
      if (window.audioManager) window.audioManager.playSE('attack');
      selectedAttacker = null;
      break;
    case 'attack_spell':
      if (selectedCardIndex === null) return;
      socket.emit('game_action', { action: 'play_card', handIndex: selectedCardIndex, targetRow: row, targetLane: lane });
      if (window.audioManager) window.audioManager.playSE('playCard'); // Assuming spell play also uses 'playCard' sound
      selectedCardIndex = null;
      break;
  }
}

// イベント
document.getElementById('btn-end-turn').addEventListener('click', () => {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  socket.emit('game_action', { action: 'end_turn' });
  if (window.audioManager) window.audioManager.playSE('endTurn');
  selectedCardIndex = null;
  selectedAttacker = null;
});

let pendingRaiseColor = null;

document.querySelectorAll('.crystal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
    
    const color = btn.dataset.color;
    
    // すでに選択中なら解除、そうでなければ選択
    if (pendingRaiseColor === color) {
      pendingRaiseColor = null;
      btn.classList.remove('selected');
      document.getElementById('btn-confirm-raise').style.display = 'none';
    } else {
      // 他の選択を解除
      document.querySelectorAll('.crystal-btn').forEach(b => b.classList.remove('selected'));
      
      pendingRaiseColor = color;
      btn.classList.add('selected');
      document.getElementById('btn-confirm-raise').style.display = 'block';
      if (window.audioManager) window.audioManager.playSE('click');
    }
  });
});

document.getElementById('btn-confirm-raise').addEventListener('click', () => {
  if (!gameState || !pendingRaiseColor || gameState.currentPlayerId !== gameState.me.id) return;
  
  socket.emit('game_action', { action: 'raise_tribe', color: pendingRaiseColor });
  if (window.audioManager) window.audioManager.playSE('levelUp');
  
  // リセット
  pendingRaiseColor = null;
  document.querySelectorAll('.crystal-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-confirm-raise').style.display = 'none';
});

// スペル対象: 相手ユニット
document.getElementById('opponent-board')?.addEventListener('click', (e) => {
  if (selectedCardIndex === null || !gameState) return;
  const card = gameState.me.hand[selectedCardIndex];
  if (!card || card.type !== 'spell') return;
  const slot = e.target.closest('.board-slot');
  if (!slot || !slot.dataset.row) return;
  const row = slot.dataset.row;
  const lane = parseInt(slot.dataset.lane, 10);
  if (gameState.opponent.board[row][lane]) handleSlotClick('attack_spell', row, lane);
});

// スペル対象: 味方ユニット
document.getElementById('player-board')?.addEventListener('click', (e) => {
  if (selectedCardIndex === null || !gameState) return;
  const card = gameState.me.hand[selectedCardIndex];
  if (!card || card.type !== 'spell') return;
  if (!['buff_attack', 'buff_hp', 'grant_barrier', 'heal'].includes(card.abilityEffect)) return;
  const slot = e.target.closest('.board-slot');
  if (!slot || !slot.dataset.row) return;
  const row = slot.dataset.row;
  const lane = parseInt(slot.dataset.lane, 10);
  if (gameState.me.board[row][lane]) {
    socket.emit('game_action', { action: 'play_card', handIndex: selectedCardIndex, targetRow: row, targetLane: lane });
    selectedCardIndex = null;
  }
});
