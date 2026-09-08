// lobby.js - 洗練されたトップ画面（直接対戦 & デッキ事前選択型）
'use strict';

const socket = io();

if (window.audioManager) {
  window.audioManager.playBGM('lobby');
}

let selectedMode = 'pve';
let selectedAvatar = localStorage.getItem('dcg_avatar') || '1';
let selectedDifficulty = localStorage.getItem('dcg_difficulty') || 'normal';
let activeSlot = parseInt(localStorage.getItem('dcg_active_slot') || '0');
let isWaitingGameStart = false;
let pendingDeckSubmission = null;

// ==================== 初期化処理 ====================

// 保存されたプレイヤー名の復帰
const nameInput = document.getElementById('player-name');
if (nameInput) {
  const savedName = localStorage.getItem('dcg_player_name');
  if (savedName) nameInput.value = savedName;
  nameInput.addEventListener('input', () => {
    localStorage.setItem('dcg_player_name', nameInput.value.trim());
  });
}

// アバターの初期選択状態
document.querySelectorAll('.avatar-option').forEach(opt => {
  if (opt.dataset.avatar === selectedAvatar) {
    opt.classList.add('active');
  } else {
    opt.classList.remove('active');
  }
  opt.addEventListener('click', () => {
    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    selectedAvatar = opt.dataset.avatar;
    localStorage.setItem('dcg_avatar', selectedAvatar);
    if (window.audioManager) window.audioManager.playSE('click');
  });
});

// 難易度の初期選択状態
document.querySelectorAll('.diff-btn').forEach(btn => {
  if (btn.dataset.difficulty === selectedDifficulty) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.difficulty;
    localStorage.setItem('dcg_difficulty', selectedDifficulty);
    if (window.audioManager) window.audioManager.playSE('click');
  });
});

// モード切り替えタブ
const modePve = document.getElementById('mode-pve');
const modePvp = document.getElementById('mode-pvp');
const pveContent = document.getElementById('pve-content');
const pvpContent = document.getElementById('pvp-content');

if (modePve && modePvp) {
  modePve.addEventListener('click', () => {
    modePve.classList.add('active');
    modePvp.classList.remove('active');
    selectedMode = 'pve';
    if (pveContent) pveContent.style.display = 'block';
    if (pvpContent) pvpContent.style.display = 'none';
    if (window.audioManager) window.audioManager.playSE('click');
  });

  modePvp.addEventListener('click', () => {
    modePvp.classList.add('active');
    modePve.classList.remove('active');
    selectedMode = 'pvp';
    if (pveContent) pveContent.style.display = 'none';
    if (pvpContent) pvpContent.style.display = 'block';
    socket.emit('get_rooms');
    if (window.audioManager) window.audioManager.playSE('click');
  });
}

// ==================== デッキスロット管理 & 自動スターター ====================

async function initDeckSlots() {
  try {
    // スロット0が完全に空、もしくは40枚未満の場合はスターターデッキを自動セットアップ
    const rawSlot0 = localStorage.getItem('dcg_deck_slot_0');
    let needStarter = false;

    if (!rawSlot0) {
      needStarter = true;
    } else {
      try {
        const parsed = JSON.parse(rawSlot0);
        const cardCount = Object.values(parsed.deck || {}).reduce((s, c) => s + c, 0);
        const shieldCount = (parsed.selectedShields || []).length;
        if (cardCount !== 40 || shieldCount !== 3) needStarter = true;
      } catch (e) {
        needStarter = true;
      }
    }

    if (needStarter) {
      console.log('📦 [LOBBY] 初期スターターデッキを自動生成します...');
      const [cardsRes, shieldsRes] = await Promise.all([
        fetch('/api/cards'),
        fetch('/api/shields')
      ]);
      const allCards = await cardsRes.json();
      const allShields = await shieldsRes.json();

      if (allCards.length > 0 && allShields.length >= 3) {
        // 火（red）＋水（blue）または中立を中心に40枚を構築
        const redCards = allCards.filter(c => (c.color === 'red' || (c.colors && c.colors.includes('red'))) && !c.isToken);
        const blueCards = allCards.filter(c => (c.color === 'blue' || (c.colors && c.colors.includes('blue'))) && !c.isToken);
        const starterDeckMap = {};
        let totalAdded = 0;

        const addCandidate = (cardList) => {
          for (const c of cardList) {
            if (totalAdded >= 40) break;
            const maxCopies = typeof c.maxCopies !== 'undefined' ? c.maxCopies : 3;
            const toAdd = Math.min(maxCopies, 40 - totalAdded);
            if (toAdd > 0) {
              starterDeckMap[c.id] = toAdd;
              totalAdded += toAdd;
            }
          }
        };

        addCandidate(redCards);
        addCandidate(blueCards);

        // まだ40枚に満たない場合は全カードプールから補充
        if (totalAdded < 40) {
          for (const c of allCards) {
            if (totalAdded >= 40) break;
            if (c.color === 'red' || c.color === 'blue' || c.color === 'neutral') {
              const cur = starterDeckMap[c.id] || 0;
              const maxCopies = typeof c.maxCopies !== 'undefined' ? c.maxCopies : 3;
              if (cur < maxCopies) {
                starterDeckMap[c.id] = cur + 1;
                totalAdded++;
              }
            }
          }
        }

        const starterShields = allShields.slice(0, 3).map(s => s.id);

        localStorage.setItem('dcg_deck_slot_0', JSON.stringify({
          deck: starterDeckMap,
          selectedShields: starterShields
        }));
        if (!localStorage.getItem('dcg_deck_name_slot_0')) {
          localStorage.setItem('dcg_deck_name_slot_0', '火水スターターデッキ');
        }
      }
    }
  } catch (err) {
    console.warn('[LOBBY] Starter deck setup check failed:', err);
  }

  renderDeckSelector();
}

function renderDeckSelector() {
  const select = document.getElementById('active-deck-select');
  if (!select) return;
  select.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const raw = localStorage.getItem('dcg_deck_slot_' + i);
    const name = localStorage.getItem('dcg_deck_name_slot_' + i) || `スロット ${i + 1}`;
    let cardCount = 0;
    let shieldCount = 0;

    if (raw) {
      try {
        const d = JSON.parse(raw);
        cardCount = Object.values(d.deck || {}).reduce((s, c) => s + c, 0);
        shieldCount = (d.selectedShields || []).length;
      } catch (e) {}
    }

    const opt = document.createElement('option');
    opt.value = i;
    const isReady = (cardCount === 40 && shieldCount === 3);
    const statusText = isReady ? '完了' : '未完成';
    opt.textContent = `[${i + 1}] ${name} (${cardCount}/40・シールド${shieldCount}/3 - ${statusText})`;
    if (i === activeSlot) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', (e) => {
    activeSlot = parseInt(e.target.value);
    localStorage.setItem('dcg_active_slot', activeSlot);
    if (window.audioManager) window.audioManager.playSE('click');
  });
}

initDeckSlots();

// ==================== ステータス表示制御 ====================

function showStatus(text, allowCancel = false) {
  const statusSection = document.getElementById('status-section');
  const statusText = document.getElementById('status-text');
  const btnCancel = document.getElementById('btn-cancel-queue');

  if (statusSection) statusSection.style.display = 'flex';
  if (statusText) statusText.textContent = text;
  if (btnCancel) {
    btnCancel.style.display = allowCancel ? 'inline-block' : 'none';
    btnCancel.onclick = () => {
      isWaitingGameStart = false;
      pendingDeckSubmission = null;
      statusSection.style.display = 'none';
    };
  }
}

function hideStatus() {
  const statusSection = document.getElementById('status-section');
  if (statusSection) statusSection.style.display = 'none';
}

// ==================== SOLO PLAY（AI対戦）直接対戦開始 ====================

const btnStartPve = document.getElementById('btn-start-pve');
if (btnStartPve) {
  btnStartPve.addEventListener('click', () => {
    const rawDeck = localStorage.getItem('dcg_deck_slot_' + activeSlot);
    let deckData = null;
    if (rawDeck) {
      try { deckData = JSON.parse(rawDeck); } catch (e) {}
    }

    const totalCards = deckData ? Object.values(deckData.deck || {}).reduce((s, c) => s + c, 0) : 0;
    const shieldCount = deckData ? (deckData.selectedShields || []).length : 0;

    if (totalCards !== 40 || shieldCount !== 3) {
      alert(`選択中のスロット ${activeSlot + 1} のデッキが未完成です。\n（現在: カード ${totalCards}/40枚, シールド ${shieldCount}/3枚）\n「デッキ編成」ボタンからデッキを完成させてください。`);
      return;
    }

    const deckCardIds = [];
    for (const [id, count] of Object.entries(deckData.deck)) {
      for (let i = 0; i < count; i++) deckCardIds.push(id);
    }
    const shieldIds = deckData.selectedShields;

    // ゲーム画面復元用に保存
    localStorage.setItem('selectedDeck', JSON.stringify({ deckCardIds, shieldIds }));

    const playerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'プレイヤー';
    localStorage.setItem('dcg_player_name', playerName);

    if (window.audioManager) window.audioManager.playSE('sword_draw');
    showStatus('対戦相手（NPC）を招集中...');

    isWaitingGameStart = true;
    pendingDeckSubmission = { deckCardIds, shieldIds, mode: 'solo' };

    console.log(`[LOBBY] PvEを開始します: Avatar=${selectedAvatar}, Diff=${selectedDifficulty}`);
    socket.emit('create_room', {
      playerName,
      avatar: selectedAvatar,
      mode: 'pve',
      difficulty: selectedDifficulty
    });
  });
}

// ==================== ROOM MATCH（PvP）ルーム作成 & 参加 ====================

const btnCreateRoom = document.getElementById('btn-create-room');
if (btnCreateRoom) {
  btnCreateRoom.addEventListener('click', () => {
    const rawDeck = localStorage.getItem('dcg_deck_slot_' + activeSlot);
    let deckData = null;
    if (rawDeck) {
      try { deckData = JSON.parse(rawDeck); } catch (e) {}
    }

    const totalCards = deckData ? Object.values(deckData.deck || {}).reduce((s, c) => s + c, 0) : 0;
    const shieldCount = deckData ? (deckData.selectedShields || []).length : 0;

    if (totalCards !== 40 || shieldCount !== 3) {
      alert(`選択中のスロット ${activeSlot + 1} のデッキが未完成です。\n（現在: カード ${totalCards}/40枚, シールド ${shieldCount}/3枚）\n「デッキ編成」から完成させてください。`);
      return;
    }

    const deckCardIds = [];
    for (const [id, count] of Object.entries(deckData.deck)) {
      for (let i = 0; i < count; i++) deckCardIds.push(id);
    }
    const shieldIds = deckData.selectedShields;
    localStorage.setItem('selectedDeck', JSON.stringify({ deckCardIds, shieldIds }));

    const playerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'プレイヤー1';
    const roomInput = document.getElementById('room-name');
    const roomName = (roomInput && roomInput.value.trim()) ? roomInput.value.trim() : `${playerName}の部屋`;

    isWaitingGameStart = true;
    pendingDeckSubmission = { deckCardIds, shieldIds, mode: 'multi' };

    showStatus('対戦相手の入室を待機中...', true);
    socket.emit('create_room', {
      playerName,
      avatar: selectedAvatar,
      roomName,
      mode: 'pvp'
    });
  });
}

// ルーム更新ボタン
document.getElementById('btn-refresh')?.addEventListener('click', () => socket.emit('get_rooms'));

// ルーム一覧の描画
socket.on('room_list', (roomItems) => {
  const list = document.getElementById('room-list');
  if (!list) return;
  list.innerHTML = '';

  if (roomItems.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: #94a3b8; padding: 12px 0; font-size: 12px;">
        参加可能なルームはありません
      </div>
    `;
    return;
  }

  roomItems.forEach(room => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.padding = '8px 10px';
    item.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

    item.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 13px; color: #fff;">${room.name}</div>
        <div style="font-size: 11px; color: #94a3b8;">ホスト: ${room.hostName}</div>
      </div>
      <button class="btn btn-sm btn-primary" style="padding: 4px 14px; font-size: 12px;">参加</button>
    `;

    item.querySelector('button').addEventListener('click', () => {
      const rawDeck = localStorage.getItem('dcg_deck_slot_' + activeSlot);
      let deckData = null;
      if (rawDeck) {
        try { deckData = JSON.parse(rawDeck); } catch (e) {}
      }

      const totalCards = deckData ? Object.values(deckData.deck || {}).reduce((s, c) => s + c, 0) : 0;
      const shieldCount = deckData ? (deckData.selectedShields || []).length : 0;

      if (totalCards !== 40 || shieldCount !== 3) {
        alert(`選択中のスロット ${activeSlot + 1} のデッキが未完成です。`);
        return;
      }

      const deckCardIds = [];
      for (const [id, count] of Object.entries(deckData.deck)) {
        for (let i = 0; i < count; i++) deckCardIds.push(id);
      }
      const shieldIds = deckData.selectedShields;
      localStorage.setItem('selectedDeck', JSON.stringify({ deckCardIds, shieldIds }));

      const playerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'プレイヤー2';

      isWaitingGameStart = true;
      pendingDeckSubmission = { deckCardIds, shieldIds, mode: 'multi' };

      socket.emit('join_room', { roomId: room.roomId, playerName, avatar: selectedAvatar });
      showStatus('ルームに参加中...');
    });

    list.appendChild(item);
  });
});

// ==================== ソケットイベントハンドラ ====================

socket.on('room_created', (data) => {
  sessionStorage.setItem('sessionId', data.sessionId);
  sessionStorage.setItem('playerId', data.playerId);
  sessionStorage.setItem('roomId', data.roomId);
  console.log('🏠 [LOBBY] room_created:', data.roomId);
});

socket.on('room_joined', (data) => {
  sessionStorage.setItem('sessionId', data.sessionId);
  sessionStorage.setItem('playerId', data.playerId);
  sessionStorage.setItem('roomId', data.roomId);
  console.log('👤 [LOBBY] room_joined:', data.roomId);
});

// ルームが揃った時 → 直ちに使用デッキを提出！
socket.on('room_ready', (data) => {
  sessionStorage.setItem('gameMode', data.mode);
  console.log('⚡ [LOBBY] room_ready received. Direct deck submission executing...');

  if (isWaitingGameStart && pendingDeckSubmission) {
    showStatus('デッキを展開中...');
    const curSessionId = sessionStorage.getItem('sessionId');
    socket.emit('submit_deck', {
      sessionId: curSessionId,
      deckCardIds: pendingDeckSubmission.deckCardIds,
      shieldIds: pendingDeckSubmission.shieldIds,
      mode: pendingDeckSubmission.mode || 'solo'
    });
  }
});

// ゲーム開始通知 → バトル画面へ直行！
let isNavigatingToBattle = false;
socket.on('game_started', () => {
  if (isNavigatingToBattle) return;
  isNavigatingToBattle = true;
  console.log('🎮 [LOBBY] game_started received! Redirecting directly to /game.html...');
  showStatus('対戦開始！盤面へ移動中...');

  sessionStorage.removeItem('dcg_session_id');
  localStorage.removeItem('dcg_session_id');

  window.location.href = '/game.html';
});

socket.on('waiting_opponent_deck', () => {
  showStatus('対戦相手のデッキ提出を待機中...', true);
});

socket.on('error_msg', (data) => {
  alert(data.message || 'エラーが発生しました');
  hideStatus();
  isWaitingGameStart = false;
  pendingDeckSubmission = null;
});
