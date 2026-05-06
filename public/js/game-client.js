// game-client.js
const socket = io();

// \u30b9\u30da\u30eb\u306e\u4f7f\u7528\u53ef\u5426\u30c1\u30a7\u30c3\u30af
function canPlaySpell(card) {
  if (!card || card.type !== 'spell') return true;
  if (!card.abilities || card.abilities.length === 0) return true;
  
  const state = window.gameState;
  if (!state) return true;

  const opponent = state.opponent;
  const player = state.me;

  // \u5168\u3066\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u3092\u30c1\u30a7\u30c3\u30af\u3057\u3001\u4e00\u3064\u3067\u3082\u5bfe\u8c61\u304c\u5fc5\u8981\u306a\u3082\u306e\u304c\u3042\u308c\u3070\u30c1\u30a7\u30c3\u30af
  for (const ability of card.abilities) {
    const target = ability.target || '';
    if (target.includes('enemy_unit')) {
      // \u6575\u30e6\u30cb\u30c3\u30c8\u304c\u5fc5\u8981\u306a\u5834\u5408
      let hasEnemy = false;
      const board = opponent.board || [];
      for (const row of ['front', 'back']) {
        if (board[row] && board[row].some(u => u !== null)) hasEnemy = true;
      }
      if (!hasEnemy) return false;
    }
    // \u5fc5\u8981\u306b\u5fdc\u3058\u3066\u4ed6\u306e\u30bf\u30fc\u30b2\u30c3\u30c8\uff08\u81ea\u5206\u306e\u30e6\u30cb\u30c3\u30c8\u306a\u3069\uff09\u3082\u8ffd\u52a0\u53ef\u80fd
  }
  return true;
}

function showWarning(message) {
  // \u7c21\u6613\u7684\u306a\u30a2\u30e9\u30fc\u30c8\u8868\u793a\uff08\u65e2\u5b58\u306eUI\u306b\u5408\u308f\u305b\u3066\u8abf\u6574\u53ef\u80fd\uff09
  const toast = document.createElement('div');
  toast.className = 'vfx-toast-warning';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:rgba(220,38,38,0.9); color:white; padding:15px 40px; border-radius:30px; z-index:100000; font-weight:bold; box-shadow:0 0 20px rgba(0,0,0,0.5); pointer-events:none; animation: toast-in-out 2s forwards;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
  if (window.audioManager) window.audioManager.playSE('error');
}


// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
// \u30b5\u30fc\u30d0\u30fc\u304b\u3089\u30ad\u30fc\u30ef\u30fc\u30c9\u306e\u5b9a\u7fa9\uff08\u8aac\u660e\u6587\u306a\u3069\uff09\u3092\u53d6\u5f97\u3057 \u30ec\u30f3\u30c0\u30e9\u30fc\u306b\u63d0\u4f9b\u3057\u307e\u3059 
fetch('/api/keywords')
  .then(res => res.json())
  .then(data => {
    window.keywordMap = data;
    console.log('   [CLIENT] Keyword map loaded:', Object.keys(data).length, 'keywords found.');
  })
  .catch(err => console.error('   [CLIENT] Keyword map load failed:', err));

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
fetch('/api/cards')
  .then(res => res.json())
  .then(data => {
    window.allCards = data;
    console.log('   [CLIENT] All cards loaded:', data.length, 'cards found.');
  })
  .catch(err => console.error('   [CLIENT] Cards load failed:', err));

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
// \u3053\u308c\u306b\u3088\u308a \u63a5\u7d9a\u5b8c\u4e86\u76f4\u5f8c\u306b\u30c7\u30fc\u30bf\u304c\u5c4a\u3044\u3066\u3082\u3053\u307c\u3055\u305a\u53d7\u3051\u53d6\u308c\u307e\u3059 

socket.on('game_state', (state) => {
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: STATE RECEIVED';
    signal.style.background = 'rgba(0,255,0,0.8)';
  }
  console.log('   [CLIENT] game_state received:', state ? `Phase: ${state.phase}, Turn: ${state.turnNumber}` : 'NULL');
  if (!state) return;
  
  window.gameState = state;
  window.pendingAction = false; // \u901a\u4fe1\u5b8c\u4e86\u306b\u3064\u304d\u30ed\u30c3\u30af\u89e3\u9664

  const tryUpdate = () => {
    if (typeof window.updateUI === 'function') {
      window.updateUI();
      console.log('   [CLIENT] UI Updated');
    } else {
      console.warn('   [CLIENT] updateUI not ready, retrying in 100ms...');
      setTimeout(tryUpdate, 100);
    }
  };
  tryUpdate();

  // === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
  if (state.phase !== 'mulligan' && state.phase !== 'waiting_mulligan') {
    const mulliganOverlay = document.getElementById('mulligan-overlay');
    if (mulliganOverlay && mulliganOverlay.style.display !== 'none') {
      mulliganOverlay.style.display = 'none';
    }
  }
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
// \u6839\u672c\u539f\u56e0: onPointerUp   updateUI() \u304cDOM\u3092\u518d\u69cb\u7bc9\u3059\u308b\u305f\u3081 
// \u540c\u4e00\u8981\u7d20\u3067\u306emousedown/mouseup\u30da\u30a2\u304c\u6210\u7acb\u305b\u305a click \u30a4\u30d9\u30f3\u30c8\u304c\u751f\u6210\u3055\u308c\u306a\u3044 
// \u89e3\u6c7a\u7b56: pointerdown\uff08\u30ad\u30e3\u30d7\u30c1\u30e3\u30d5\u30a7\u30fc\u30ba\uff09\u3067\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u3092\u5373\u5ea7\u306b\u51e6\u7406\u3059\u308b 
document.addEventListener('pointerdown', function(e) {
  const state = window.gameState;
  if (!state || state.phase !== 'targeting') return;
  if (state.currentPlayerId !== state.me.id) return;
  
  // \u53f3\u30af\u30ea\u30c3\u30af(1\u4ee5\u4e0a)\u306f\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u3068\u3057\u3066\u6271\u308f\u305a 
  // \u30ab\u30fc\u30c9\u8a73\u7d30\uff08contextmenu\uff09\u306a\u3069\u306e\u30c7\u30d5\u30a9\u30eb\u30c8\u6319\u52d5\u3092\u512a\u5148\u3055\u305b\u308b
  if (e.button !== 0) return;

  // \u30af\u30ea\u30c3\u30af\u3055\u308c\u305f\u8981\u7d20\u304b\u3089 can-target \u30b9\u30ed\u30c3\u30c8\u3092\u63a2\u3059
  const slot = e.target.closest('.board-slot.can-target');
  if (!slot) return;

  const row = slot.dataset.row;
  const lane = parseInt(slot.dataset.lane);
  
  console.log(`   [CLIENT] Targeting pointerdown: row=${row}, lane=${lane}`);
  
  const sourceInfo = state.pendingAbilitySource;
  if (sourceInfo && (sourceInfo.targetId === 'empty_slot' || sourceInfo.effect === 'summon_token')) {
    const unitAtSlot = state.me.board[row] && state.me.board[row][lane];
    if (unitAtSlot) {
      console.warn('   [CLIENT] Slot is occupied, ignoring.');
      return;
    }
  }
  
  console.log(`   [CLIENT] Emitting select_target: row=${row}, lane=${lane}`);
  window.pendingAction = true;
  socket.emit('game_action', { action: 'select_target', targetRow: row, targetLane: lane });
  
  // \u5f8c\u7d9a\u306e\u30a4\u30d9\u30f3\u30c8\uff08pointermove, pointerup, click\uff09\u3092\u5168\u3066\u6b62\u3081\u308b
  e.stopPropagation();
  e.preventDefault();
}, true); // true = \u30ad\u30e3\u30d7\u30c1\u30e3\u30d5\u30a7\u30fc\u30ba\uff08\u6700\u512a\u5148\uff09

socket.on('mulligan_phase', (data) => {
  console.log('   [CLIENT] mulligan_phase received');
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
  console.error('  [CLIENT] Game error:', data.message);
  if (window.audioManager) window.audioManager.playSE('error');
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===

function requestSessionRestore() {
  const signal = document.getElementById('debug-signal');
  const sessionId = sessionStorage.getItem('sessionId');
  if (sessionId) {
    console.log('   [CLIENT] Requesting session restore for:', sessionId.slice(0, 8));
    socket.emit('restore_session', { sessionId });
    if (signal) {
      signal.textContent = 'STATUS: REQUESTING...';
      signal.style.background = 'rgba(0,191,255,0.8)';
    }
  } else {
    console.warn('   [CLIENT] No sessionId found in sessionStorage');
    if (signal) {
      signal.textContent = 'STATUS: NO SESSION ID (Back to Lobby)';
      signal.style.background = 'rgba(0,0,0,0.8)';
    }
  }
}

socket.on('session_restored', (data) => {
  console.log('   [CLIENT] Session restored successfully');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: AUTHORIZED (Waiting Data)';
    signal.style.background = 'rgba(147,112,219,0.8)';
  }
});

socket.on('session_invalid', () => {
  console.error('  [CLIENT] Session invalid');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: INVALID SESSION';
    signal.style.background = 'rgba(128,0,128,0.8)';
  }
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
const manualHtml = `
<div class="manual-section">
  <h3>1. \u57fa\u672c\u30eb\u30fc\u30eb (Basic Rules)</h3>
  <p>\u672c\u30b2\u30fc\u30e0\u306f<b>3\u3064\u306e\u30ec\u30fc\u30f3</b>\u3068<b>2\u3064\u306e\u5217\uff08\u524d\u5217\u30fb\u5f8c\u5217\uff09</b>\u3067\u69cb\u6210\u3055\u308c\u308b\u76e4\u9762\u3067\u6226\u3046\u5bfe\u6226\u578b\u30ab\u30fc\u30c9\u30b2\u30fc\u30e0\u3067\u3059 </p>
  <div class="rule-box">
    <b>\u52dd\u5229\u6761\u4ef6:</b><br>
    \u30fb\u76f8\u624b\u306e\u5168\u30b7\u30fc\u30eb\u30c9\u3092\u7834\u58ca\u3057 \u672c\u4f53\u3078\u306e<b>\u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af</b>\u3092\u6210\u529f\u3055\u305b\u308b <br>
    \u30fb\u76f8\u624b\u306e\u5c71\u672d\u304c0\u679a\u306b\u306a\u308a \u30c9\u30ed\u30fc\u3067\u304d\u306a\u304f\u306a\u308b\uff08\u30c7\u30c3\u30ad\u30a2\u30a6\u30c8\uff09 
  </div>
</div>

<div class="manual-section">
  <h3>2. \u30ea\u30bd\u30fc\u30b9\u7ba1\u7406 (Resources)</h3>
  <p><b>SP (\u7075\u529b):</b> \u30ab\u30fc\u30c9\u306e\u30d7\u30ec\u30a4\u3084\u795e\u65cf\u30ec\u30d9\u30eb\u4e0a\u3052\u306b\u4f7f\u7528 \u6bce\u30bf\u30fc\u30f3\u958b\u59cb\u6642\u306b <b>3 SP</b>\uff08\u5f8c\u653b1\u30bf\u30fc\u30f3\u76ee\u306f4\uff09\u7372\u5f97\u3057\u307e\u3059 </p>
  <p><b>\u795e\u65cf\u30ec\u30d9\u30eb:</b> \u8d64\u30fb\u9752\u30fb\u7dd1\u30fb\u767d\u30fb\u9ed2\u306e5\u5c5e\u6027 \u30ab\u30fc\u30c9\u3092\u51fa\u3059\u306b\u306f \u305d\u306e\u8272\u306e\u30ec\u30d9\u30eb\u304c<b>\u30ab\u30fc\u30c9\u306e\u30b3\u30b9\u30c8\u4ee5\u4e0a</b>\u3067\u3042\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059 </p>
  <div class="rule-box">
    <b>\u30ec\u30d9\u30eb\u4e0a\u3052:</b> 1 SP \u6d88\u8cbb\u3057\u3066 \u5c5e\u6027\u30ec\u30d9\u30eb\u3092 1 \u4e0a\u3052\u3089\u308c\u307e\u3059\uff08\u6700\u5927Lv.9\uff09 \u30ec\u30d9\u30eb\u306f\u6d88\u8cbb\u3055\u308c\u305a \u4e00\u5ea6\u4e0a\u3052\u308c\u3070\u30bf\u30fc\u30f3\u306e\u9593\u305a\u3063\u3068\u6709\u52b9\u3067\u3059 
  </div>
</div>

<div class="manual-section">
  <h3>3. \u914d\u7f6e\u3068\u30ac\u30fc\u30c9 (Lanes & Rows)</h3>
  <p>\u30e6\u30cb\u30c3\u30c8\u306f3\u3064\u306e\u30ec\u30fc\u30f3\u306e\u3044\u305a\u308c\u304b\u306e\u524d\u5217\u307e\u305f\u306f\u5f8c\u5217\u306b\u914d\u7f6e\u3057\u307e\u3059 </p>
  <div class="rule-box">
    <b>\u30ac\u30fc\u30c9\u306e\u4ed5\u7d44\u307f:</b> \u540c\u30ec\u30fc\u30f3\u306e<b>\u524d\u5217\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u308b\u5834\u5408 \u76f8\u624b\u306f\u305d\u306e\u30ec\u30fc\u30f3\u306e\u5f8c\u5217\u3084\u30b7\u30fc\u30eb\u30c9\u3092\u653b\u6483\u3067\u304d\u307e\u305b\u3093</b> \u524d\u5217\u306f\u5f37\u529b\u306a\u9632\u58c1\u3068\u306a\u308a\u307e\u3059 <br>
     \u524d\u5217\u30fb\u5f8c\u5217\u306e\u4e21\u65b9\u304c\u7a7a\u306e\u30ec\u30fc\u30f3\u3067\u306e\u307f \u76f8\u624b\u306f\u30b7\u30fc\u30eb\u30c9\u3092\u653b\u6483\u53ef\u80fd\u3067\u3059 
  </div>
</div>

<div class="manual-section">
  <h3>4. \u6226\u95d8\u30eb\u30fc\u30eb (Combat)</h3>
  <p>\u653b\u6483\u5074\u304c\u30c0\u30e1\u30fc\u30b8\u3092\u4e0e\u3048\u308b\u3068\u540c\u6642\u306b \u9632\u5fa1\u5074\u3082\u653b\u6483\u529b\u5206\u306e\u30c0\u30e1\u30fc\u30b8\u3092 \u53cd\u6483 \u3068\u3057\u3066\u4e0e\u3048\u307e\u3059 HP\u304c0\u306b\u306a\u3063\u305f\u30e6\u30cb\u30c3\u30c8\u306f\u7834\u58ca\u3055\u308c\u307e\u3059 </p>
  <p><b>\u9023\u6483 (Double Strike):</b> \u653b\u6483\u6642\u306b2\u56de\u30c0\u30e1\u30fc\u30b8 1\u6483\u76ee\u3067\u6575\u3092\u5012\u305b\u3070\u53cd\u6483\u3092\u53d7\u3051\u305a\u7121\u50b7\u3067\u52dd\u5229\u3067\u304d\u307e\u3059 </p>
</div>

<div class="manual-section">
  <h3>5. \u80fd\u529b\u30ad\u30fc\u30ef\u30fc\u30c9 (Keywords)</h3>
  <ul style="list-style: none; padding: 0; line-height: 1.6;" id="help-keyword-list">
    <li> \u30c7\u30fc\u30bf\u3092\u8aad\u307f\u8fbc\u3093\u3067\u3044\u307e\u3059...</li>
  </ul>
</div>
`;

function showGameManual() {
  const overlay = document.getElementById('help-overlay');
  const content = document.getElementById('help-content');
  const settingsOverlay = document.getElementById('settings-overlay');
  
  if (overlay && content) {
    // \u8a2d\u5b9a\u753b\u9762\u304c\u958b\u3044\u3066\u3044\u308c\u3070\u9589\u3058\u308b
    if (settingsOverlay) settingsOverlay.style.display = 'none';
    
    content.innerHTML = manualHtml;

    // \u30ad\u30fc\u30ef\u30fc\u30c9\u4e00\u89a7\u3092\u52d5\u7684\u751f\u6210
    const kwList = document.getElementById('help-keyword-list');
    if (kwList && window.keywordMap) {
      let kwHtml = '';
      Object.values(window.keywordMap).forEach(kw => {
         if (kw.name && kw.description) {
            kwHtml += `<li style="margin-bottom: 6px;"><b> ${kw.name} </b>: ${kw.description}</li>`;
         }
      });
      kwList.innerHTML = kwHtml;
    }

    overlay.style.display = 'flex';
    if (window.audioManager) window.audioManager.playSE('click');
  }
}

// \u30d8\u30eb\u30d7\u6a5f\u80fd\u306e\u521d\u671f\u5316
function initHelpManual() {
  const btnHelp = document.getElementById('btn-show-help');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const helpOverlay = document.getElementById('help-overlay');

  if (btnHelp) btnHelp.addEventListener('click', showGameManual);
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => {
    if (helpOverlay) helpOverlay.style.display = 'none';
  });
  
  if (helpOverlay) {
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay) {
        helpOverlay.style.display = 'none';
      }
    });
  }
}

// \u30b9\u30af\u30ea\u30d7\u30c8\u8aad\u307f\u8fbc\u307f\u6642\u306b\u5b9f\u884c
initHelpManual();

socket.on('connect', () => {
  console.log('   [CLIENT] Socket connected via event');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: CONNECTED';
    signal.style.background = 'rgba(255,165,0,0.8)';
  }
  requestSessionRestore();
});

// \u5373\u6642\u63a5\u7d9a\u6e08\u307f\u306e\u5834\u5408\u306e\u30ac\u30fc\u30c9\u30ec\u30fc\u30eb
if (socket.connected) {
  console.log('   [CLIENT] Socket ALREADY connected, proceeding immediately');
  requestSessionRestore();
}

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===

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
let dragStartPos = null; // \u8aa4\u7206\u9632\u6b62\u7528\uff1a\u30c9\u30e9\u30c3\u30b0\u958b\u59cb\u5730\u70b9
const DRAG_THRESHOLD = 50; // 50px\u4ee5\u4e0a\u52d5\u304b\u3055\u306a\u3044\u3068\u30d7\u30ec\u30a4\u3055\u308c\u306a\u3044
let attackerPos = null;
let pendingShieldAttack = null;
let selectedTribeColor = null; // \u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u78ba\u8a8d\u7528

function onPointerMove(e) {
  if (isDragging && dragGhost) {
    dragGhost.style.left = `${e.clientX - 90}px`;
    dragGhost.style.top = `${e.clientY - 126}px`;

    // \u30ab\u30fc\u30c9\u30c9\u30e9\u30c3\u30b0\u4e2d\uff08\u30b9\u30da\u30eb or \u30e6\u30cb\u30c3\u30c8\u5171\u901a\uff09\u306e\u30db\u30d0\u30fc\u8868\u793a
    const state = window.gameState;
    if (state && dragSource && dragSource.type === 'hand') {
      const card = state.me.hand[dragSource.index];
      const coords = getInternalCoords(e.clientX, e.clientY);
      const svg = document.getElementById('attack-arrow-svg');
      const line = document.getElementById('attack-arrow-line');
      const cardRect = document.querySelector(`[data-index="${dragSource.index}"]`)?.getBoundingClientRect();

      // \u30bf\u30fc\u30b2\u30c3\u30c8\u5019\u88dc\u306e\u7279\u5b9a\uff08\u5168\u30ab\u30fc\u30c9\u5171\u901a\uff09
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetSlot = elements.find(el => el.classList.contains('board-slot'));
      
      // \u5168\u30b9\u30ed\u30c3\u30c8\u306e\u30db\u30d0\u30fc\u89e3\u9664
      document.querySelectorAll('.board-slot').forEach(s => s.classList.remove('is-hovered'));
      if (targetSlot) targetSlot.classList.add('is-hovered');

      // \u30b9\u30da\u30eb\u306e\u5834\u5408\u306e\u307f\u77e2\u5370\u3092\u8868\u793a
      if (card && card.type === 'spell' && svg && line && cardRect) {
        svg.style.display = 'block';
        const start = getInternalCoords(cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 2);
        let targetX = coords.x;
        let targetY = coords.y;

        if (targetSlot) {
          const rect = targetSlot.getBoundingClientRect();
          const center = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
          targetX = center.x;
          targetY = center.y;
        }

        // \u66f2\u7dda(Quadratic Bezier)\u306e\u63cf\u753b
        const cpX = (start.x + targetX) / 2;
        const cpY = (start.y + targetY) / 2 - 100; // \u5c11\u3057\u4e0a\u306b\u81a8\u3089\u307e\u305b\u308b
        line.setAttribute('d', `M ${start.x} ${start.y} Q ${cpX} ${cpY} ${targetX} ${targetY}`);
      }
    }
  }

  if (isDraggingAttack && attackerPos) {
    const coords = getInternalCoords(e.clientX, e.clientY);
    const svg = document.getElementById('attack-arrow-svg');
    const line = document.getElementById('attack-arrow-line');
    if (svg && line) {
      svg.style.display = 'block';
      let targetX = coords.x;
      let targetY = coords.y;

      // \u30bf\u30fc\u30b2\u30c3\u30c8\u3078\u306e\u30b9\u30ca\u30c3\u30d7\u51e6\u7406
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetSlot = elements.find(el => el.classList.contains('can-attack'));
      const targetShield = elements.find(el => el.id === 'opp-shields');
      
      const snapTarget = targetSlot || targetShield;
      if (snapTarget) {
        const rect = snapTarget.getBoundingClientRect();
        const center = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
        targetX = center.x;
        targetY = center.y;
        snapTarget.classList.add('is-locked-on');
      } else {
        // \u30ed\u30c3\u30af\u30aa\u30f3\u89e3\u9664
        document.querySelectorAll('.is-locked-on').forEach(el => el.classList.remove('is-locked-on'));
      }

      // \u66f2\u7dda(Quadratic Bezier)\u306e\u63cf\u753b
      const cpX = (attackerPos.x + targetX) / 2;
      const cpY = (attackerPos.y + targetY) / 2 - 150; // \u5c11\u3057\u4e0a\u306b\u81a8\u3089\u307e\u305b\u308b
      line.setAttribute('d', `M ${attackerPos.x} ${attackerPos.y} Q ${cpX} ${cpY} ${targetX} ${targetY}`);
    }
  }
}

function onPointerUp(e) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const state = window.gameState;
  
  // \u30db\u30d0\u30fc\u5f37\u8abf\u306e\u5168\u89e3\u9664
  document.querySelectorAll('.is-hovered').forEach(el => el.classList.remove('is-hovered'));

  if (isDragging && dragSource && dragSource.type === 'hand') {
    // \u8aa4\u7206\u9632\u6b62\uff1a\u79fb\u52d5\u8ddd\u96e2\u30c1\u30a7\u30c3\u30af
    const dist = dragStartPos ? Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y) : 0;
    
    if (dist < DRAG_THRESHOLD) {
      console.log('    [CLIENT] Drag cancelled: Under threshold', dist);
    } else {
      const card = state.me.hand[dragSource.index];
      const isSpell = card && card.type === 'spell';

      // \u30b9\u30da\u30eb\u306e\u5bfe\u8c61\u30c1\u30a7\u30c3\u30af\uff08\u5bfe\u8c61\u304c\u3044\u306a\u3044\u5834\u5408\u306f\u8b66\u544a\u3092\u51fa\u3057\u3066\u4e2d\u65ad\uff09
      if (isSpell && card.abilities) {
        let hasValidTarget = true;
        for (const ability of card.abilities) {
          if (!ability.target) continue;
          if (ability.target.includes('self_unit')) {
            const hasMyUnit = Object.values(state.me.board).some(row => row.some(u => u !== null));
            if (!hasMyUnit) hasValidTarget = false;
          } else if (ability.target.includes('enemy_unit')) {
            const hasEnemyUnit = Object.values(state.opponent.board).some(row => row.some(u => u !== null));
            if (!hasEnemyUnit) hasValidTarget = false;
          }
        }

        if (!hasValidTarget) {
            console.warn('   [CLIENT] No valid targets for this spell');
            if (window.audioManager) window.audioManager.playSE('error');
            
            // ドラッグ状態を解除してから戻る
            if (dragGhost) { dragGhost.remove(); dragGhost = null; }
            const svg = document.getElementById('attack-arrow-svg');
            if (svg) svg.style.display = 'none';
            isDragging = false;
            dragSource = null;
            dragStartPos = null;
            if (typeof window.updateUI === 'function') window.updateUI();

            alert('\u9069\u5207\u306a\u5bfe\u8c61\u304c\u3044\u307e\u305b\u3093');
            return;
        }
      }

      // \u30b9\u30da\u30eb\u306a\u3089\u76f8\u624b\u306e\u76e4\u9762\u3082\u5bfe\u8c61\u306b\u53d6\u308c\u308b\u3088\u3046\u306b\u3059\u308b
      const slot = elements.find(el => el.classList.contains('board-slot') && (isSpell || !el.classList.contains('opponent')));
      
      if (slot) {
        const row = slot.dataset.row;
        const lane = parseInt(slot.dataset.lane);
        window.pendingAction = true;
        socket.emit('game_action', { action: 'play_card', handIndex: dragSource.index, targetRow: row, targetLane: lane });
      }
    }
  }
  
  if (isDraggingAttack && dragSource && dragSource.type === 'unit' && state) {
    const targetEl = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields' || el.classList.contains('is-locked-on'));
    if (targetEl && state.opponent) {
      // \u30ed\u30c3\u30af\u30aa\u30f3\u3055\u308c\u3066\u3044\u308b\u8981\u7d20 \u307e\u305f\u306fID/\u30af\u30e9\u30b9\u3067\u7279\u5b9a
      const isShieldTarget = targetEl.id === 'opp-shields' || (targetEl.parentElement && targetEl.parentElement.id === 'opp-shields');
      const targetType = isShieldTarget ? 'shield' : 'unit';
      
      if (targetType === 'shield') {
         const allDestroyed = (state.opponent.totalShieldDurability || 0) <= 0;
         pendingShieldAttack = { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: allDestroyed ? 'direct' : 'shield' } };
         const modal = document.getElementById('shield-confirm-overlay');
         if (modal) {
           modal.querySelector('h2').textContent = allDestroyed ? 'Direct Attack?' : 'Shield Break?';
           modal.style.display = 'flex';
         }
      } else {
        const row = targetEl.dataset.row;
        const lane = targetEl.dataset.lane;
        if (row !== undefined && lane !== undefined) {
          socket.emit('game_action', { action: 'attack', attackerRow: dragSource.row, attackerLane: dragSource.lane, targetInfo: { type: 'unit', row: row, lane: parseInt(lane) } });
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
  dragStartPos = null;
  window.selectedCard = null; // \u63b4\u3093\u3067\u3044\u308b\u30ab\u30fc\u30c9\u60c5\u5831\u3092\u30af\u30ea\u30a2
  if (typeof window.updateUI === 'function') window.updateUI();
}

window.handleCardPointerDown = function(e, index) {
  // \u53f3\u30af\u30ea\u30c3\u30af\u7b49\uff08\u30c9\u30e9\u30c3\u30b0\u4ee5\u5916\uff09\u306e\u6642\u306f\u30c9\u30e9\u30c3\u30b0\u51e6\u7406\u3092\u884c\u308f\u305a\u305d\u306e\u307e\u307e\u901a\u3059
  if (e.button !== 0) return;

  const state = window.gameState;
  // \u8aa4\u64cd\u4f5c\u30ac\u30fc\u30c9: \u81ea\u5206\u306e\u756a\u3067\u306a\u3044 \u307e\u305f\u306f\u5f85\u6a5f\u30d5\u30a7\u30fc\u30ba\u4ee5\u5916\u306f\u5165\u529b\u3092\u7121\u8996
  if (!state || state.currentPlayerId !== state.me.id || state.phase !== 'main') {
    console.warn('    [CLIENT] Action blocked: Not your turn or in targeting phase');
    return;
  }
  if (window.pendingAction) return;

  const card = state.me.hand[index];
  window.selectedCard = card; // \u30ec\u30f3\u30c0\u30e9\u30fc\u306b\u63b4\u3093\u3067\u3044\u308b\u30ab\u30fc\u30c9\u3092\u4f1d\u3048\u308b
  isDragging = true;
  dragSource = { type: 'hand', index };
  dragStartPos = { x: e.clientX, y: e.clientY };
  if (typeof window.updateUI === 'function') window.updateUI(); // \u914d\u7f6e\u53ef\u80fd\u30de\u30b9\u3092\u5149\u3089\u305b\u308b

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
  // \u901a\u4fe1\u4e2d\u304b\u3064\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u4e2d\u4ee5\u5916\u306a\u3089\u5165\u529b\u3092\u30ac\u30fc\u30c9
  if (window.pendingAction && state.phase !== 'targeting') return;

  // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba\u4e2d\u306f pointerdown\u30ad\u30e3\u30d7\u30c1\u30e3\u3067\u51e6\u7406\u3059\u308b\u305f\u3081
  // \u3053\u3053\u3067\u306f\u5168\u3066\u306e\u64cd\u4f5c\u3092\u30d6\u30ed\u30c3\u30af\u3057\u3066\u4f55\u3082\u3057\u306a\u3044
  if (state.phase === 'targeting') {
      return;
  }

  // \u4ee5\u4e0b\u306f targeting \u30d5\u30a7\u30fc\u30ba\u4ee5\u5916\uff08\u901a\u5e38\u6642\uff09\u306e\u51e6\u7406
  if (type === 'unit_pointerdown') {
    // \u53f3\u30af\u30ea\u30c3\u30af\u306a\u3069\uff08\u5de6\u30af\u30ea\u30c3\u30af\u4ee5\u5916\uff09\u306e\u5834\u5408\u306f\u30c9\u30e9\u30c3\u30b0\u3092\u958b\u59cb\u305b\u305a\u8a73\u7d30\u8868\u793a\u7b49\u306e\u5225\u51e6\u7406\u306b\u8b72\u308b
    if (e.button !== 0) return;

    const unit = state.me.board[row][lane];
    if (!unit || !unit.canAttack) return;
    isDraggingAttack = true;
    dragSource = { type: 'unit', row, lane };
    const rect = e.currentTarget.getBoundingClientRect();
    attackerPos = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
    e.preventDefault();
  } else if (type === 'place_unit') {
    // \u624b\u672d\u306e\u30ab\u30fc\u30c9\u3092\u4f7f\u7528/\u914d\u7f6e\u3059\u308b\u51e6\u7406
    if (window.selectedCardIndex !== null) {
      const card = window.gameState.me.hand[window.selectedCardIndex];
      if (!canPlaySpell(card)) {
        showWarning('\u6709\u52b9\u306a\u5bfe\u8c61\u304c\u3044\u307e\u305b\u3093');
        window.selectedCardIndex = null;
        if (typeof window.updateUI === 'function') window.updateUI();
        return;
      }
      socket.emit('game_action', { 
        action: 'play_card', 
        handIndex: window.selectedCardIndex, 
        targetRow: row, 
        targetLane: lane 
      });
      // \u4f7f\u7528\u5f8c\u306f\u9078\u629e\u89e3\u9664\uff08\u5fc5\u8981\u306b\u5fdc\u3058\u3066 Renderer \u5074\u3068\u540c\u671f\uff09
      window.selectedCardIndex = null;
      if (typeof window.updateUI === 'function') window.updateUI();
    }
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
    isDraggingAttack = false;
    dragSource = null;
    if (typeof window.updateUI === 'function') window.updateUI();
    if (typeof window.updateUI === 'function') window.updateUI();
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });

  document.getElementById('btn-shield-cancel')?.addEventListener('click', () => {
    pendingShieldAttack = null;
    isDraggingAttack = false;
    dragSource = null;
    if (typeof window.updateUI === 'function') window.updateUI();
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });

  // --- \u8a2d\u5b9a\u30d1\u30cd\u30eb ---
  const settingsBtn = document.getElementById('settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsBtn && settingsOverlay) {
    settingsBtn.onclick = () => {
      settingsOverlay.style.display = 'flex';
      if (window.audioManager) window.audioManager.playSE('select');
    };
  }

  // --- \u97f3\u91cf\u30b9\u30e9\u30a4\u30c0\u30fc ---
  const sliderBGM = document.getElementById('slider-bgm');
  const sliderSE = document.getElementById('slider-se');
  if (sliderBGM) {
    sliderBGM.oninput = (e) => {
      if (window.audioManager) window.audioManager.updateBGMVolume(e.target.value);
    };
  }
  if (sliderSE) {
    sliderSE.oninput = (e) => {
      if (window.audioManager) window.audioManager.updateSEVolume(e.target.value);
    };
  }

  // --- BGM \u9078\u629e ---
  const selectBGM = document.getElementById('select-bgm');
  if (selectBGM) {
    selectBGM.onchange = (e) => {
      if (window.audioManager) window.audioManager.playBGM(e.target.value, true);
    };
  }

  // --- \u6295\u4e86 ---
  document.getElementById('btn-surrender')?.addEventListener('click', () => {
    if (confirm('\u672c\u5f53\u306b\u6295\u4e86\u3057\u307e\u3059\u304b\uff1f')) {
      socket.emit('game_action', { action: 'surrender' });
      if (settingsOverlay) settingsOverlay.style.display = 'none';
    }
  });

  // --- \u30ea\u30b6\u30eb\u30c8\u753b\u9762\u30a2\u30af\u30b7\u30e7\u30f3 ---
  document.getElementById('btn-result-back')?.addEventListener('click', () => {
    // \u30bb\u30c3\u30b7\u30e7\u30f3\u3092\u30af\u30ea\u30a2\u3057\u3066\u30ed\u30d3\u30fc\u306b\u623b\u308b
    sessionStorage.removeItem('sessionId');
    window.location.href = '/';
  });

  // --- \u795e\u65cf\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7 ---
  const crystalConfirm = document.getElementById('crystal-confirm-popup');
  document.querySelectorAll('.crystal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const state = window.gameState;
      if (!state) return;
      
      // SP\u4e0d\u8db3\u30c1\u30a7\u30c3\u30af
      if (!state.me || (state.me.sp || 0) <= 0) {
        console.warn('   SP\u4e0d\u8db3\uff1a\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u3067\u304d\u307e\u305b\u3093');
        if (window.audioManager) window.audioManager.playSE('error');
        return;
      }

      selectedTribeColor = e.target.dataset.color;
      
      // \u30a2\u30a4\u30b3\u30f3\u306e\u53cd\u6620
      const confirmIcon = document.getElementById('confirm-tribe-icon');
      if (confirmIcon) {
        confirmIcon.style.backgroundImage = `url('/assets/images/icon/divine/${selectedTribeColor}.png')`;
      }

      if (crystalConfirm) {
        crystalConfirm.style.display = 'block';
      }
      if (window.audioManager) window.audioManager.playSE('click');
    });
  });

  document.getElementById('btn-crystal-confirm')?.addEventListener('click', () => {
    if (selectedTribeColor) {
      socket.emit('game_action', { action: 'raise_tribe', color: selectedTribeColor });
      if (window.audioManager) window.audioManager.playSE('levelUp');
    }
    if (crystalConfirm) crystalConfirm.style.display = 'none';
    selectedTribeColor = null;
  });

  document.getElementById('btn-crystal-cancel')?.addEventListener('click', () => {
    if (crystalConfirm) crystalConfirm.style.display = 'none';
    selectedTribeColor = null;
    if (window.audioManager) window.audioManager.playSE('click');
  });

  // --- \u80fd\u529b\u767a\u52d5 ---
  document.getElementById('btn-activate-ability')?.addEventListener('click', () => {
    // \u9078\u629e\u4e2d\u306e\u30e6\u30cb\u30c3\u30c8\u60c5\u5831\u3092\u53d6\u5f97 (\u73fe\u5728\u306f\u30c9\u30e9\u30c3\u30b0\u30bd\u30fc\u30b9\u3084selectedCardIndex\u304b\u3089\u63a8\u6e2c)
    // \u3053\u3053\u3067\u306f\u30b0\u30ed\u30fc\u30d0\u30eb\u306a\u9078\u629e\u72b6\u614b\u304b\u3089\u767a\u52d5\u3055\u305b\u308b\u30b7\u30f3\u30d7\u30eb\u306a\u5b9f\u88c5\u306b\u3057\u307e\u3059
    console.log('  \u80fd\u529b\u767a\u52d5\uff1a\u73fe\u5728\u306f\u76f4\u63a5\u653b\u6483\u30c9\u30e9\u30c3\u30b0\u3067\u5bfe\u5fdc\u3057\u3066\u3044\u307e\u3059\u304c \u30dc\u30bf\u30f3\u3082\u6709\u52b9\u5316');
    const state = window.gameState;
    if (!state) return;
    // ... \u9069\u6642\u62e1\u5f35\u53ef\u80fd\u306a\u3088\u3046\u306b\u69cb\u9020\u3092\u7528\u610f ...
    socket.emit('game_action', { action: 'activate_ability', unitRow: 'front', unitLane: 0, abilityIndex: 0 }); 
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

// \u7834\u68c4\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u9001\u4fe1
window.emitDiscardCards = function(cardIndices) {
  console.log('    [CLIENT] Emitting discard_cards:', cardIndices);
  socket.emit('game_action', { 
    action: 'discard_cards', 
    cardIndices: cardIndices 
  });
  if (window.audioManager) window.audioManager.playSE('click');
};

// \u6700\u5f8c\u306b\u521d\u671f\u5316\u3092\u5b9f\u884c

  // --- \u30b7\u30fc\u30eb\u30c9\u30d6\u30ec\u30a4\u30af\u6f14\u51fa\u306e\u7d9a\u884c ---
  const sbOverlay = document.getElementById('shield-break-overlay');
  if (sbOverlay) {
    sbOverlay.addEventListener('click', () => {
      sbOverlay.style.display = 'none';
      socket.emit('game_action', { action: 'resolve_shield_break' });
      if (window.audioManager) window.audioManager.playSE('click');
    });
  }

initInteractions();
