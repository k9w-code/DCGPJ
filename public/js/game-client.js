// game-client.js
const socket = io();

// === 通信の受け皿 (Handlers) を優先的に登録 ===
// これにより、接続完了直後にデータが届いてもこぼさず受け取れます。

socket.on('game_state', (state) => {
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: STATE RECEIVED';
    signal.style.background = 'rgba(0,255,0,0.8)';
  }
  console.log('📥 [CLIENT] game_state received:', state ? `Phase: ${state.phase}, Turn: ${state.turnNumber}` : 'NULL');
  if (!state) return;
  
  // === 緊急防護: フェーズ移行時にオーバーレイが残らないようにする ===
  if (state.phase !== 'mulligan' && state.phase !== 'waiting_mulligan') {
    const mulliganOverlay = document.getElementById('mulligan-overlay');
    if (mulliganOverlay && mulliganOverlay.style.display !== 'none') {
      mulliganOverlay.style.display = 'none';
      console.log('🛡️ [CLIENT] Emergency Mulligan Hide');
    }
  }

  // グローバル変数に強制同期
  window.gameState = state;
  if (typeof window.updateUI === 'function') {
    console.log('🎨 [CLIENT] Starting updateUI...');
    window.updateUI();
  }
});

socket.on('mulligan_phase', (data) => {
  console.log('📥 [CLIENT] mulligan_phase received');
  if (window.audioManager) window.audioManager.playBGM('game');
  if (typeof showMulligan === 'function') {
    showMulligan(data.hand, () => {
      socket.emit('mulligan_decision', { doMulligan: false });
    }, () => {
      socket.emit('mulligan_decision', { doMulligan: true });
    });
  }
});

socket.on('error_msg', (data) => {
  console.error('❌ [CLIENT] Game error:', data.message);
  if (window.audioManager) window.audioManager.playSE('error');
});

// === セッション復帰 / 接続管理 (Connection) ===

function requestSessionRestore() {
  const signal = document.getElementById('debug-signal');
  const sessionId = sessionStorage.getItem('sessionId');
  if (sessionId) {
    console.log('🔌 [CLIENT] Requesting session restore for:', sessionId.slice(0, 8));
    socket.emit('restore_session', { sessionId });
    if (signal) {
      signal.textContent = 'STATUS: REQUESTING...';
      signal.style.background = 'rgba(0,191,255,0.8)';
    }
  } else {
    console.warn('⚠️ [CLIENT] No sessionId found in sessionStorage');
    if (signal) {
      signal.textContent = 'STATUS: NO SESSION ID (Back to Lobby)';
      signal.style.background = 'rgba(0,0,0,0.8)';
    }
  }
}

socket.on('session_restored', (data) => {
  console.log('🔌 [CLIENT] Session restored successfully');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: AUTHORIZED (Waiting Data)';
    signal.style.background = 'rgba(147,112,219,0.8)';
  }
});

socket.on('session_invalid', () => {
  console.error('❌ [CLIENT] Session invalid');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: INVALID SESSION';
    signal.style.background = 'rgba(128,0,128,0.8)';
  }
});

socket.on('connect', () => {
  console.log('🔌 [CLIENT] Socket connected via event');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: CONNECTED';
    signal.style.background = 'rgba(255,165,0,0.8)';
  }
  requestSessionRestore();
});

// 即時接続済みの場合のガードレール
if (socket.connected) {
  console.log('🔌 [CLIENT] Socket ALREADY connected, proceeding immediately');
  requestSessionRestore();
}

// === 以下、ユーティリティとイベントハンドラ ===

function getInternalCoords(clientX, clientY) {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    const scale = rect.width / 1920;
    return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale
    };
}

let isDragging = false;
let isDraggingAttack = false;
let dragSource = null;
let dragGhost = null;
let attackerPos = null;
let pendingShieldAttack = null;

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
  const state = window.gameState;
  
  if (isDragging && dragSource && dragSource.type === 'hand') {
    const slot = elements.find(el => el.classList.contains('board-slot') && !el.classList.contains('opponent'));
    if (slot) {
      const row = slot.dataset.row;
      const lane = parseInt(slot.dataset.lane);
      socket.emit('game_action', { action: 'play_card', handIndex: dragSource.index, targetRow: row, targetLane: lane });
    }
  }
  
  if (isDraggingAttack && dragSource && dragSource.type === 'unit' && state) {
    const targetEl = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields');
    if (targetEl) {
      const targetType = targetEl.id === 'opp-shields' ? 'shield' : 'unit';
      if (targetType === 'shield') {
         const allDestroyed = state.opponent.totalShieldDurability <= 0;
         pendingShieldAttack = { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: allDestroyed ? 'direct' : 'shield' } };
         const modal = document.getElementById('shield-confirm-overlay');
         if (modal) {
           modal.querySelector('h2').textContent = allDestroyed ? 'Direct Attack?' : 'Shield Break?';
           modal.style.display = 'flex';
         }
      } else {
        socket.emit('game_action', { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: 'unit', row: targetEl.dataset.row, lane: parseInt(targetEl.dataset.lane) } });
      }
    }
  }

  if (dragGhost) { dragGhost.remove(); dragGhost = null; }
  const svg = document.getElementById('attack-arrow-svg');
  if (svg) svg.style.display = 'none';
  isDragging = false;
  isDraggingAttack = false;
  dragSource = null;
  if (typeof window.updateUI === 'function') window.updateUI();
}

window.handleCardPointerDown = function(e, index) {
  const state = window.gameState;
  if (!state || state.currentPlayerId !== state.me.id) return;
  isDragging = true;
  dragSource = { type: 'hand', index };
  const original = e.currentTarget;
  dragGhost = original.cloneNode(true);
  dragGhost.classList.add('drag-ghost');
  dragGhost.style.position = 'fixed';
  dragGhost.style.pointerEvents = 'none';
  dragGhost.style.zIndex = '1000';
  document.body.appendChild(dragGhost);
  e.preventDefault();
};

window.handleSlotClick = function(type, row, lane, e) {
  const state = window.gameState;
  if (!state || state.currentPlayerId !== state.me.id) return;
  if (type === 'unit_pointerdown') {
    const unit = state.me.board[row][lane];
    if (!unit || !unit.canAttack) return;
    isDraggingAttack = true;
    dragSource = { type: 'unit', row, lane };
    const rect = e.currentTarget.getBoundingClientRect();
    attackerPos = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
    e.preventDefault();
  }
};

function initInteractions() {
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  
  const endBtn = document.getElementById('btn-end-turn');
  if (endBtn) {
    endBtn.onclick = () => {
      const state = window.gameState;
      if (!state || state.currentPlayerId !== state.me.id) return;
      socket.emit('game_action', { action: 'end_turn' });
    };
  }

  document.getElementById('btn-shield-confirm')?.addEventListener('click', () => {
    if (pendingShieldAttack) socket.emit('game_action', pendingShieldAttack);
    pendingShieldAttack = null;
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });

  document.getElementById('btn-shield-cancel')?.addEventListener('click', () => {
    pendingShieldAttack = null;
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });
}

function showMulligan(hand, onKeep, onRedraw) {
  const overlay = document.getElementById('mulligan-overlay');
  const container = document.getElementById('mulligan-cards');
  if (!overlay || !container) return;
  container.innerHTML = '';
  hand.forEach(card => {
    const el = document.createElement('div');
    el.className = 'hand-card';
    const bgImage = (typeof window.getCardImagePath === 'function') 
      ? window.getCardImagePath(card) 
      : `/assets/images/cards/neutral/${card.artId || card.id}.webp`;
    el.style.backgroundImage = `url('${bgImage}')`;
    el.innerHTML = `<div class="card-overlay"><div class="cost-gem">${card.cost}</div></div>`;
    if (typeof attachCardDetailEvent === 'function') attachCardDetailEvent(el, card);
    container.appendChild(el);
  });
  overlay.style.display = 'flex';
  
  const setupBtn = (id, callback) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.replaceWith(newBtn);
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.style.display = 'none';
      if (callback) callback();
    });
  };
  setupBtn('btn-mulligan-keep', onKeep);
  setupBtn('btn-mulligan-redraw', onRedraw);
}

// 最後に初期化を実行
initInteractions();
