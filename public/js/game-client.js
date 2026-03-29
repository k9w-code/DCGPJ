// game-client.js
const socket = io();

// ゲーム状態
let gameState = null;
let selectedCardIndex = null;
let selectedAttacker = null;

// ドラッグ＆ドロップ用
let isDragging = false;
let isDraggingAttack = false;
let dragSource = null;
let dragGhost = null;
let attackerPos = null;
let pendingShieldAttack = null;
let previousGameState = null;

// 初期化
function initInteractions() {
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

socket.on('connect', () => {
  const sessionId = sessionStorage.getItem('sessionId');
  if (sessionId) socket.emit('restore_session', { sessionId });
});

socket.on('session_restored', (data) => {
  if (window.audioManager) window.audioManager.playBGM('game');
});

socket.on('session_invalid', () => {
  window.location.href = '/';
});

function triggerShieldBreakEffect() {
  console.log('💥 triggerShieldBreakEffect called');
  const overlay = document.getElementById('shield-break-overlay');
  if (!overlay) {
    console.warn('⚠️ shield-break-overlay not found');
    return;
  }
  if (window.audioManager) window.audioManager.playSE('shieldBreak');
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 2000);
}

socket.on('game_state', (state) => {
  if (!state) return;
  
  // シールド破壊演出のチェック
  if (previousGameState && state.opponent && previousGameState.opponent) {
    if (state.opponent.shieldsDestroyed > previousGameState.opponent.shieldsDestroyed) {
      triggerShieldBreakEffect();
    }
  }

  gameState = state;
  updateUI();
  previousGameState = JSON.parse(JSON.stringify(state));
});

socket.on('mulligan_phase', (data) => {
  if (window.audioManager) window.audioManager.playBGM('game');
  showMulligan(data.hand, () => {
    socket.emit('mulligan_decision', { doMulligan: false });
  }, () => {
    socket.emit('mulligan_decision', { doMulligan: true });
  });
});

socket.on('error_msg', (data) => {
  console.error('❌ Game error:', data.message);
  if (window.audioManager) window.audioManager.playSE('error');
});

function getInternalCoords(clientX, clientY) {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    const scale = rect.width / 1920;
    return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale
    };
}

function isValidTarget(target) {
    if (!dragSource || !gameState) return false;
    if (dragSource.type === 'unit') {
        const opponent = gameState.opponent;
        const tauntUnits = [];
        for (let l = 0; l < 3; l++) {
          const u = opponent.board.front[l];
          if (u && (u.keywords || []).includes('taunt')) tauntUnits.push({ row: 'front', lane: l });
        }
        if (tauntUnits.length > 0) {
          if (target.type !== 'unit') return false;
          return tauntUnits.some(t => t.row === target.row && t.lane === target.lane);
        }
        return true;
    }
    return true;
}

function onPointerMove(e) {
  if (isDragging && dragGhost) {
    dragGhost.style.left = `${e.clientX - 90}px`;
    dragGhost.style.top = `${e.clientY - 126}px`;
  }
  if (isDraggingAttack && attackerPos) {
    const coords = getInternalCoords(e.clientX, e.clientY);
    const svg = document.getElementById('attack-arrow-svg');
    const line = document.getElementById('attack-arrow-line');
    if (svg && line) {
      svg.style.display = 'block';
      line.setAttribute('x1', attackerPos.x); line.setAttribute('y1', attackerPos.y);
      line.setAttribute('x2', coords.x); line.setAttribute('y2', coords.y);
    }
  }
}

function onPointerUp(e) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  if (isDragging && dragSource && dragSource.type === 'hand') {
    const slot = elements.find(el => el.classList.contains('board-slot') && !el.classList.contains('opponent'));
    if (slot) {
      const row = slot.dataset.row;
      const lane = parseInt(slot.dataset.lane);
      socket.emit('game_action', { action: 'play_card', handIndex: dragSource.index, targetRow: row, targetLane: lane });
      selectedCardIndex = null;
    }
  }
  if (isDraggingAttack && dragSource && dragSource.type === 'unit') {
    const targetEl = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields');
    if (targetEl) {
      const targetType = targetEl.id === 'opp-shields' ? 'shield' : 'unit';
      const targetData = {
        type: targetType,
        row: targetEl.dataset?.row,
        lane: targetEl.dataset?.lane ? parseInt(targetEl.dataset.lane) : undefined,
      };
      if (isValidTarget(targetData)) {
        if (targetType === 'shield') {
          const allDestroyed = gameState.opponent.totalShieldDurability <= 0;
          pendingShieldAttack = { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: allDestroyed ? 'direct' : 'shield' } };
          const modal = document.getElementById('shield-confirm-overlay');
          if (modal) {
              modal.querySelector('h2').textContent = allDestroyed ? 'Direct Attack?' : 'Shield Break?';
              modal.querySelector('p').textContent = allDestroyed ? '相手プレイヤーに直接攻撃しますか？' : '相手のシールドを攻撃しますか？';
              modal.style.display = 'flex';
          }
        } else {
          socket.emit('game_action', { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: 'unit', row: targetData.row, lane: targetData.lane } });
        }
      }
    }
  }
  
  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  const svg = document.getElementById('attack-arrow-svg');
  if (svg) svg.style.display = 'none';
  isDragging = false;
  isDraggingAttack = false;
  dragSource = null;
  updateUI();
}

function handleUnitPointerDown(e, row, lane) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  const unit = gameState.me.board[row][lane];
  if (!unit || !unit.canAttack) return;
  selectedAttacker = { row, lane };
  isDraggingAttack = true;
  dragSource = { type: 'unit', row, lane };
  const rect = e.currentTarget.getBoundingClientRect();
  attackerPos = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
  e.preventDefault();
}

function handleCardPointerDown(e, index) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  selectedCardIndex = index;
  isDragging = true;
  dragSource = { type: 'hand', index };
  const original = e.currentTarget;
  dragGhost = original.cloneNode(true);
  dragGhost.classList.add('drag-ghost');
  dragGhost.style.position = 'fixed';
  dragGhost.style.pointerEvents = 'none';
  dragGhost.style.zIndex = '1000';
  dragGhost.style.transform = 'none'; // 手札の傾きをリセット
  dragGhost.style.transition = 'none';
  document.body.appendChild(dragGhost);
  e.preventDefault();
}

function handleSlotClick(type, row, lane, e) {
  if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
  if (type === 'unit_pointerdown') { handleUnitPointerDown(e, row, lane); return; }
}

function updateShieldAttackUI() {
    const opponentShields = document.getElementById('opp-shields');
    if (!opponentShields || !selectedAttacker || !gameState) return;
    opponentShields.onclick = (e) => {
        const allDestroyed = gameState.opponent.totalShieldDurability <= 0;
        pendingShieldAttack = { action: 'attack', attackerRow: selectedAttacker.row, attackerLane: selectedAttacker.lane, targetInfo: { type: allDestroyed ? 'direct' : 'shield' } };
        document.getElementById('shield-confirm-overlay').style.display = 'flex';
        e.stopPropagation();
    };
}

function updateUnitActionUI() {
    const panel = document.getElementById('unit-actions-panel');
    const btn = document.getElementById('btn-activate-ability');
    if (!panel || !btn || !selectedAttacker || !gameState) return;
    const { row, lane } = selectedAttacker;
    const unit = gameState.me.board[row][lane];
    if (!unit || unit.hasActed) { panel.style.display = 'none'; return; }
    const activateIdx = (unit.abilities || []).findIndex(a => a.trigger === 'activate');
    if (activateIdx !== -1) {
        panel.style.display = 'block';
        btn.onclick = () => {
            socket.emit('game_action', { action: 'activate_ability', unitRow: row, unitLane: lane, abilityIndex: activateIdx });
            selectedAttacker = null; updateUI();
        };
    } else { panel.style.display = 'none'; }
}

function updateUI() {
  console.log('🔄 updateUI called', gameState);
  if (!gameState || !gameState.me) {
    console.warn('⚠️ updateUI skipped: gameState or gameState.me is missing');
    return;
  }
  try {
    console.log('Rendering PlayerInfo...');
    renderPlayerInfo(gameState);
    
    console.log('Rendering Board...');
    renderBoard(gameState, selectedCardIndex !== null ? gameState.me.hand[selectedCardIndex] : null, selectedAttacker, handleSlotClick);
    
    console.log('Rendering Hand...');
    renderHand(gameState, selectedCardIndex, handleCardPointerDown);
    
    console.log('Rendering Logs & Turn Info...');
    renderLogs(gameState.logs || []);
    renderTurnInfo(gameState);
    
    updateShieldAttackUI();
    updateUnitActionUI();
    console.log('✅ updateUI completed');
  } catch (e) { console.error('❌ updateUI failed!', e); }
}

const btnEndTurn = document.getElementById('btn-end-turn');
if (btnEndTurn) btnEndTurn.onclick = () => {
    if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
    socket.emit('game_action', { action: 'end_turn' });
    selectedCardIndex = null; selectedAttacker = null;
};

let pendingCrystalColor = null;
document.querySelectorAll('.crystal-btn').forEach(btn => {
  btn.onclick = () => {
    if (!gameState || gameState.currentPlayerId !== gameState.me.id) return;
    const color = btn.dataset.color;
    pendingCrystalColor = color;
    document.getElementById('crystal-confirm-msg').textContent = `${color.toUpperCase()} の神族レベルを上げますか？`;
    document.getElementById('crystal-confirm-popup').style.display = 'flex';
  };
});

document.getElementById('btn-crystal-confirm')?.addEventListener('click', () => {
    if (pendingCrystalColor) {
        socket.emit('game_action', { action: 'raise_tribe', color: pendingCrystalColor });
    }
    pendingCrystalColor = null;
    document.getElementById('crystal-confirm-popup').style.display = 'none';
});

document.getElementById('btn-crystal-cancel')?.addEventListener('click', () => {
    pendingCrystalColor = null;
    document.getElementById('crystal-confirm-popup').style.display = 'none';
});

document.getElementById('btn-shield-confirm')?.addEventListener('click', () => {
  if (pendingShieldAttack) socket.emit('game_action', pendingShieldAttack);
  pendingShieldAttack = null; selectedAttacker = null;
  document.getElementById('shield-confirm-overlay').style.display = 'none';
  updateUI();
});

document.getElementById('btn-shield-cancel')?.addEventListener('click', () => {
  pendingShieldAttack = null;
  document.getElementById('shield-confirm-overlay').style.display = 'none';
});

function showMulligan(hand, onKeep, onRedraw) {
  const overlay = document.getElementById('mulligan-overlay');
  const container = document.getElementById('mulligan-cards');
  if (!overlay || !container) return;

  container.innerHTML = '';
  hand.forEach(card => {
    const el = document.createElement('div');
    el.className = 'hand-card';
    const folder = card.color === 'neutral' ? 'rainbow' : (card.color || 'neutral');
    const bgImage = `/assets/images/cards/${folder}/${card.artId || card.id}.webp`;
    el.style.backgroundImage = `url('${bgImage}')`;
    
    el.innerHTML = `
      <div class="card-overlay">
        <div class="cost-gem">${card.cost}</div>
      </div>
    `;
    // カード詳細表示を有効化
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(el, card);
    }
    container.appendChild(el);
  });

  overlay.style.display = 'flex';

  const btnKeep = document.getElementById('btn-mulligan-keep');
  const btnRedraw = document.getElementById('btn-mulligan-redraw');

  if (btnKeep) {
    btnKeep.replaceWith(btnKeep.cloneNode(true)); // 既存のイベントをクリア
    const newBtn = document.getElementById('btn-mulligan-keep');
    newBtn.addEventListener('click', (e) => {
      console.log('👆 Mulligan: Keep clicked. Socket connected:', socket.connected);
      e.preventDefault();
      overlay.style.display = 'none';
      if (typeof onKeep === 'function') onKeep();
    });
  }
  if (btnRedraw) {
    btnRedraw.replaceWith(btnRedraw.cloneNode(true)); // 既存のイベントをクリア
    const newBtn = document.getElementById('btn-mulligan-redraw');
    newBtn.addEventListener('click', (e) => {
      console.log('👆 Mulligan: Redraw clicked. Socket connected:', socket.connected);
      e.preventDefault();
      overlay.style.display = 'none';
      if (typeof onRedraw === 'function') onRedraw();
    });
  }
}

initInteractions();
