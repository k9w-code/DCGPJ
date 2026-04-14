// game-client.js
const socket = io();

// === マスタデータの自動取得 (Keywords) ===
// サーバーからキーワードの定義（説明文など）を取得し、レンダラーに提供します。
fetch('/api/keywords')
  .then(res => res.json())
  .then(data => {
    window.keywordMap = data;
    console.log('📚 [CLIENT] Keyword map loaded:', Object.keys(data).length, 'keywords found.');
  })
  .catch(err => console.error('📚 [CLIENT] Keyword map load failed:', err));

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
  
  window.gameState = state;
  window.pendingAction = false; // 通信完了につきロック解除

  const tryUpdate = () => {
    if (typeof window.updateUI === 'function') {
      window.updateUI();
      console.log('🎨 [CLIENT] UI Updated');
    } else {
      console.warn('🎨 [CLIENT] updateUI not ready, retrying in 100ms...');
      setTimeout(tryUpdate, 100);
    }
  };
  tryUpdate();

  // === 緊急防護: フェーズ移行時にオーバーレイが残らないようにする ===
  if (state.phase !== 'mulligan' && state.phase !== 'waiting_mulligan') {
    const mulliganOverlay = document.getElementById('mulligan-overlay');
    if (mulliganOverlay && mulliganOverlay.style.display !== 'none') {
      mulliganOverlay.style.display = 'none';
    }
  }
});

// === ターゲット選択: pointerdown で即座に処理 ===
// 根本原因: onPointerUp → updateUI() がDOMを再構築するため、
// 同一要素でのmousedown/mouseupペアが成立せず click イベントが生成されない。
// 解決策: pointerdown（キャプチャフェーズ）でターゲット選択を即座に処理する。
document.addEventListener('pointerdown', function(e) {
  const state = window.gameState;
  if (!state || state.phase !== 'targeting') return;
  if (state.currentPlayerId !== state.me.id) return;
  
  // 右クリック(1以上)はターゲット選択として扱わず、
  // カード詳細（contextmenu）などのデフォルト挙動を優先させる
  if (e.button !== 0) return;

  // クリックされた要素から can-target スロットを探す
  const slot = e.target.closest('.board-slot.can-target');
  if (!slot) return;

  const row = slot.dataset.row;
  const lane = parseInt(slot.dataset.lane);
  
  console.log(`🎯 [CLIENT] Targeting pointerdown: row=${row}, lane=${lane}`);
  
  const sourceInfo = state.pendingAbilitySource;
  if (sourceInfo && (sourceInfo.targetId === 'empty_slot' || sourceInfo.effect === 'summon_token')) {
    const unitAtSlot = state.me.board[row] && state.me.board[row][lane];
    if (unitAtSlot) {
      console.warn('⚠️ [CLIENT] Slot is occupied, ignoring.');
      return;
    }
  }
  
  console.log(`🎯 [CLIENT] Emitting select_target: row=${row}, lane=${lane}`);
  window.pendingAction = true;
  socket.emit('game_action', { action: 'select_target', targetRow: row, targetLane: lane });
  
  // 後続のイベント（pointermove, pointerup, click）を全て止める
  e.stopPropagation();
  e.preventDefault();
}, true); // true = キャプチャフェーズ（最優先）

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

// === HELP MODAL / MANUAL LOGIC ===
const manualHtml = `
<div class="manual-section">
  <h3>1. 基本ルール (Basic Rules)</h3>
  <p>本ゲームは<b>3つのレーン</b>と<b>2つの列（前列・後列）</b>で構成される盤面で戦う対戦型カードゲームです。</p>
  <div class="rule-box">
    <b>勝利条件:</b><br>
    ・相手の全シールドを破壊し、本体への<b>ダイレクトアタック</b>を成功させる。<br>
    ・相手の山札が0枚になり、ドローできなくなる（デッキアウト）。
  </div>
</div>

<div class="manual-section">
  <h3>2. リソース管理 (Resources)</h3>
  <p><b>SP (灵力):</b> カードのプレイや神族レベル上げに使用。毎ターン開始時に <b>3 SP</b>（後攻1ターン目は4）獲得します。</p>
  <p><b>神族レベル:</b> 赤・青・緑・白・黒の5属性。カードを出すには、その色のレベルが<b>カードのコスト以上</b>である必要があります。</p>
  <div class="rule-box">
    <b>レベル上げ:</b> 1 SP 消費して 属性レベルを 1 上げられます（最大Lv.9）。レベルは消費されず、一度上げればターンの間ずっと有効です。
  </div>
</div>

<div class="manual-section">
  <h3>3. 配置とガード (Lanes & Rows)</h3>
  <p>ユニットは3つのレーンのいずれかの前列または後列に配置します。</p>
  <div class="rule-box">
    <b>ガードの仕組み:</b> 同レーンの<b>前列にユニットがいる場合、相手はそのレーンの後列やシールドを攻撃できません</b>。前列は強力な防壁となります。<br>
    ※前列・後列の両方が空のレーンでのみ、相手はシールドを攻撃可能です。
  </div>
</div>

<div class="manual-section">
  <h3>4. 戦闘ルール (Combat)</h3>
  <p>攻撃側がダメージを与えると同時に、防御側も攻撃力分のダメージを「反撃」として与えます。HPが0になったユニットは破壊されます。</p>
  <p><b>連撃 (Double Strike):</b> 攻撃時に2回ダメージ。1撃目で敵を倒せば反撃を受けず無傷で勝利できます。</p>
</div>

<div class="manual-section">
  <h3>5. 能力キーワード (Keywords)</h3>
  <ul style="list-style: none; padding: 0;">
    <li>🛡️ <b>挑発 (Taunt):</b> 前列にいる時、相手はこのユニット以外攻撃できません。</li>
    <li>⚡ <b>速攻 (Rush):</b> 出したターンから攻撃可能です。</li>
    <li>👤 <b>潜伏 (Stealth):</b> 攻撃するまで相手の攻撃対象になりません。</li>
    <li>✨ <b>加護 (Barrier):</b> 1度だけダメージを無効化します。</li>
    <li>💪 <b>不屈 (Endure):</b> 破壊される時、1度だけHP 1で耐えます。</li>
    <li>🏰 <b>攻城 (Siege):</b> シールドへのダメージが 2 になります。</li>
    <li>🩸 <b>吸命 (Drain):</b> ダメージを与えた時、自身のHPを最大 2 回復します。</li>
    <li>🔄 <b>逆転 (Comeback):</b> 自身の残りシールドが 1 枚以下の時に真価を発揮します。</li>
  </ul>
</div>
`;

function showGameManual() {
  const overlay = document.getElementById('help-overlay');
  const content = document.getElementById('help-content');
  const settingsOverlay = document.getElementById('settings-overlay');
  
  if (overlay && content) {
    // 設定画面が開いていれば閉じる
    if (settingsOverlay) settingsOverlay.style.display = 'none';
    
    content.innerHTML = manualHtml;
    overlay.style.display = 'flex';
    if (window.audioManager) window.audioManager.playSE('click');
  }
}

// ヘルプ機能の初期化
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

// スクリプト読み込み時に実行
initHelpManual();

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
let dragStartPos = null; // 誤爆防止用：ドラッグ開始地点
const DRAG_THRESHOLD = 50; // 50px以上動かさないとプレイされない
let attackerPos = null;
let pendingShieldAttack = null;
let selectedTribeColor = null; // レベルアップ確認用

function onPointerMove(e) {
  if (isDragging && dragGhost) {
    dragGhost.style.left = `${e.clientX - 90}px`;
    dragGhost.style.top = `${e.clientY - 126}px`;

    // カードドラッグ中（スペル or ユニット共通）のホバー表示
    const state = window.gameState;
    if (state && dragSource && dragSource.type === 'hand') {
      const card = state.me.hand[dragSource.index];
      const coords = getInternalCoords(e.clientX, e.clientY);
      const svg = document.getElementById('attack-arrow-svg');
      const line = document.getElementById('attack-arrow-line');
      const cardRect = document.querySelector(`[data-index="${dragSource.index}"]`)?.getBoundingClientRect();

      // ターゲット候補の特定（全カード共通）
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetSlot = elements.find(el => el.classList.contains('board-slot'));
      
      // 全スロットのホバー解除
      document.querySelectorAll('.board-slot').forEach(s => s.classList.remove('is-hovered'));
      if (targetSlot) targetSlot.classList.add('is-hovered');

      // スペルの場合のみ矢印を表示
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

        line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
        line.setAttribute('x2', targetX); line.setAttribute('y2', targetY);
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

      // ターゲットへのスナップ処理
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
        // ロックオン解除
        document.querySelectorAll('.is-locked-on').forEach(el => el.classList.remove('is-locked-on'));
      }

      line.setAttribute('x1', attackerPos.x); line.setAttribute('y1', attackerPos.y);
      line.setAttribute('x2', targetX); line.setAttribute('y2', targetY);
    }
  }
}

function onPointerUp(e) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  const state = window.gameState;
  
  // ホバー強調の全解除
  document.querySelectorAll('.is-hovered').forEach(el => el.classList.remove('is-hovered'));

  if (isDragging && dragSource && dragSource.type === 'hand') {
    // 誤爆防止：移動距離チェック
    const dist = dragStartPos ? Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y) : 0;
    
    if (dist < DRAG_THRESHOLD) {
      console.log('🛡️ [CLIENT] Drag cancelled: Under threshold', dist);
    } else {
      const card = state.me.hand[dragSource.index];
      const isSpell = card && card.type === 'spell';

      // スペルの対象チェック（対象がいない場合は警告を出して中断）
      if (isSpell && card.target) {
        let hasValidTarget = true;
        if (card.target.includes('self_unit')) {
            // 自分の盤面にユニットがいるか
            const hasMyUnit = Object.values(state.me.board).some(row => row.some(u => u !== null));
            if (!hasMyUnit) hasValidTarget = false;
        } else if (card.target.includes('enemy_unit')) {
            // 相手の盤面にユニットがいるか
            const hasEnemyUnit = Object.values(state.opponent.board).some(row => row.some(u => u !== null));
            if (!hasEnemyUnit) hasValidTarget = false;
        }

        if (!hasValidTarget) {
            console.warn('⚠️ [CLIENT] No valid targets for this spell');
            if (window.audioManager) window.audioManager.playSE('error');
            // モーダルまたはアラートを表示
            alert('適切な対象がいません。');
            return;
        }
      }

      // スペルなら相手の盤面も対象に取れるようにする
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
      // ロックオンされている要素、またはID/クラスで特定
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
  window.selectedCard = null; // 掴んでいるカード情報をクリア
  if (typeof window.updateUI === 'function') window.updateUI();
}

window.handleCardPointerDown = function(e, index) {
  // 右クリック等（ドラッグ以外）の時はドラッグ処理を行わずそのまま通す
  if (e.button !== 0) return;

  const state = window.gameState;
  // 誤操作ガード: 自分の番でない、または待機フェーズ以外は入力を無視
  if (!state || state.currentPlayerId !== state.me.id || state.phase !== 'main') {
    console.warn('🛡️ [CLIENT] Action blocked: Not your turn or in targeting phase');
    return;
  }
  if (window.pendingAction) return;

  const card = state.me.hand[index];
  window.selectedCard = card; // レンダラーに掴んでいるカードを伝える
  isDragging = true;
  dragSource = { type: 'hand', index };
  dragStartPos = { x: e.clientX, y: e.clientY };
  if (typeof window.updateUI === 'function') window.updateUI(); // 配置可能マスを光らせる

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
  // 通信中かつターゲット選択中以外なら入力をガード
  if (window.pendingAction && state.phase !== 'targeting') return;

  // ターゲット選択フェーズ中は、pointerdownキャプチャで処理するため
  // ここでは全ての操作をブロックして何もしない
  if (state.phase === 'targeting') {
      return;
  }

  // 以下は targeting フェーズ以外（通常時）の処理
  if (type === 'unit_pointerdown') {
    // 右クリックなど（左クリック以外）の場合はドラッグを開始せず詳細表示等の別処理に譲る
    if (e.button !== 0) return;

    const unit = state.me.board[row][lane];
    if (!unit || !unit.canAttack) return;
    isDraggingAttack = true;
    dragSource = { type: 'unit', row, lane };
    const rect = e.currentTarget.getBoundingClientRect();
    attackerPos = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
    e.preventDefault();
  } else if (type === 'place_unit') {
    // 手札のカードを使用/配置する処理
    if (window.selectedCardIndex !== null) {
      socket.emit('game_action', { 
        action: 'play_card', 
        handIndex: window.selectedCardIndex, 
        targetRow: row, 
        targetLane: lane 
      });
      // 使用後は選択解除（必要に応じて Renderer 側と同期）
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

  // --- 設定パネル ---
  const settingsBtn = document.getElementById('settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsBtn && settingsOverlay) {
    settingsBtn.onclick = () => {
      settingsOverlay.style.display = 'flex';
      if (window.audioManager) window.audioManager.playSE('select');
    };
  }

  // --- 音量スライダー ---
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

  // --- BGM 選択 ---
  const selectBGM = document.getElementById('select-bgm');
  if (selectBGM) {
    selectBGM.onchange = (e) => {
      if (window.audioManager) window.audioManager.playBGM(e.target.value, true);
    };
  }

  // --- 投了 ---
  document.getElementById('btn-surrender')?.addEventListener('click', () => {
    if (confirm('本当に投了しますか？')) {
      socket.emit('game_action', { action: 'surrender' });
      if (settingsOverlay) settingsOverlay.style.display = 'none';
    }
  });

  // --- リザルト画面アクション ---
  document.getElementById('btn-result-back')?.addEventListener('click', () => {
    // セッションをクリアしてロビーに戻る
    sessionStorage.removeItem('sessionId');
    window.location.href = '/';
  });

  // --- 神族レベルアップ ---
  const crystalConfirm = document.getElementById('crystal-confirm-popup');
  document.querySelectorAll('.crystal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const state = window.gameState;
      if (!state) return;
      
      // SP不足チェック
      if (!state.me || (state.me.sp || 0) <= 0) {
        console.warn('⚠️ SP不足：レベルアップできません');
        if (window.audioManager) window.audioManager.playSE('error');
        return;
      }

      selectedTribeColor = e.target.dataset.color;
      
      // アイコンの反映
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

  // --- 能力発動 ---
  document.getElementById('btn-activate-ability')?.addEventListener('click', () => {
    // 選択中のユニット情報を取得 (現在はドラッグソースやselectedCardIndexから推測)
    // ここではグローバルな選択状態から発動させるシンプルな実装にします
    console.log('⚡ 能力発動：現在は直接攻撃ドラッグで対応していますが、ボタンも有効化');
    const state = window.gameState;
    if (!state) return;
    // ... 適時拡張可能なように構造を用意 ...
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

// 破棄アクションの送信
window.emitDiscardCards = function(cardIndices) {
  console.log('🗑️ [CLIENT] Emitting discard_cards:', cardIndices);
  socket.emit('game_action', { 
    action: 'discard_cards', 
    cardIndices: cardIndices 
  });
  if (window.audioManager) window.audioManager.playSE('click');
};

// 最後に初期化を実行
initInteractions();
