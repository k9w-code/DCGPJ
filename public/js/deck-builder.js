// deck-builder.js - デッキ構築画面のクライアントロジック（リッチ化版）
'use strict';

const socket = io();
const sessionId = sessionStorage.getItem('sessionId');

// BGM再生
if (window.audioManager) {
  window.audioManager.playBGM('deck');
}

let allCards = [];
let allShields = [];
let deck = {};
let selectedShields = [];

let activeTab = 'cards';
let activeColors = new Set(['red', 'blue', 'green', 'white', 'black']);
let activeType = 'all';
let activeCost = 'all';
let currentPreviewItem = null;
let currentSaveSlot = 0;

const COLOR_NAMES = { red: '赤', blue: '青', green: '緑', white: '白', black: '黒' };
const SAVE_KEY_PREFIX = 'dcg_deck_slot_';

// セッション復帰
if (sessionId) {
  socket.emit('restore_session', { sessionId });
}

socket.on('session_invalid', () => {
  alert('セッションが無効です。ロビーに戻ります。');
  window.location.href = '/';
});

// データ取得と初期化
async function loadData() {
  const [cardsRes, shieldsRes] = await Promise.all([
    fetch('/api/cards'),
    fetch('/api/shields'),
  ]);
  allCards = await cardsRes.json();
  allShields = await shieldsRes.json();
  
  loadDeckFromSlot(currentSaveSlot);
  initUI();
  renderGrid();
  renderDeckList();
  renderShieldSlotsList();
  updateSubmitButton();
}

function initUI() {
  // タブ切り替え
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      
      if (activeTab === 'cards') {
        document.getElementById('card-grid').style.display = 'grid';
        document.getElementById('shield-grid').style.display = 'none';
        document.getElementById('card-filters').style.display = '';
      } else {
        document.getElementById('card-grid').style.display = 'none';
        document.getElementById('shield-grid').style.display = 'grid';
        document.getElementById('card-filters').style.display = 'none';
      }
      renderGrid();
    });
  });

  // フィルタ：色（オーブ型）
  document.querySelectorAll('.color-orb').forEach(el => {
    el.addEventListener('click', () => {
      const color = el.dataset.color;
      if (activeColors.has(color)) { activeColors.delete(color); el.classList.remove('active'); }
      else { activeColors.add(color); el.classList.add('active'); }
      renderGrid();
    });
  });

  // フィルタ：タイプ（ピル型）
  document.querySelectorAll('.type-filters .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filters .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeType = btn.dataset.type;
      renderGrid();
    });
  });

  // フィルタ：コスト（ピル型）
  document.querySelectorAll('.cost-filters .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cost-filters .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCost = btn.dataset.cost;
      renderGrid();
    });
  });

  // マスターデータのリロード
  const btnReload = document.getElementById('btn-reload-master');
  if (btnReload) {
    btnReload.addEventListener('click', async () => {
      if (!confirm('スプレッドシートから最新のマスターデータを取得します。よろしいですか？')) return;
      
      const originalText = btnReload.textContent;
      btnReload.disabled = true;
      btnReload.textContent = '🔄 更新中...';
      
      try {
        const res = await fetch('/api/reload', { method: 'POST' });
        const result = await res.json();
        
        if (result.success) {
          // データを再取得して表示を更新
          const [cardsRes, shieldsRes] = await Promise.all([
            fetch('/api/cards'),
            fetch('/api/shields'),
          ]);
          allCards = await cardsRes.json();
          allShields = await shieldsRes.json();
          
          alert(`更新完了！\nカード: ${result.counts.cards}枚\nシールド: ${result.counts.shields}種`);
          renderGrid();
          // 詳細プレビューが古い可能性があるのでクリア
          document.getElementById('preview-content').innerHTML = '<p class="empty-msg">データが更新されました。再度選択してください。</p>';
          document.getElementById('preview-content').classList.add('empty');
        } else {
          alert('更新に失敗しました: ' + result.error);
        }
      } catch (e) {
        alert('通信エラーが発生しました: ' + e.message);
      } finally {
        btnReload.disabled = false;
        btnReload.textContent = originalText;
      }
    });
  }

  // デッキ保存スロット
  document.querySelectorAll('.save-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      document.querySelectorAll('.save-slot').forEach(s => s.classList.remove('active'));
      slot.classList.add('active');
      currentSaveSlot = parseInt(slot.dataset.slot);
      loadDeckFromSlot(currentSaveSlot);
      renderGrid();
      renderDeckList();
      renderShieldSlotsList();
      updateSubmitButton();
    });
  });

  document.getElementById('btn-save-deck').addEventListener('click', () => {
    saveDeckToSlot(currentSaveSlot);
  });
}

function getColorCSS(color) {
  const map = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', white: '#e2e8f0', black: '#8b5cf6', neutral: '#9ca3af' };
  return map[color] || '#666';
}

function getCardImagePath(card) {
  const folder = card.colors && card.colors.length > 0 ? card.colors[0] : card.color;
  const fileName = card.artId || card.id;
  return `/assets/images/cards/${folder}/${fileName}.webp`;
}

function getShieldImagePath(shield) {
  // マスタのID(SH001)とファイル名(S001.webp)のズレを吸収
  const fileName = shield.id.replace('SH', 'S');
  return `/assets/images/shields/${fileName}.webp`;
}

// 画像のフォールバック処理用（HTML生成時に onerror を付与）
const IMG_FALLBACK = "this.onerror=null; this.parentElement.classList.add('no-image');";

function renderGrid() {
  if (activeTab === 'cards') {
    renderCardGrid();
  } else {
    renderShieldGrid();
  }
}

// ======== デッキ保存/読み込み ========
function saveDeckToSlot(slotIndex) {
  const data = { deck, selectedShields };
  try {
    localStorage.setItem(SAVE_KEY_PREFIX + slotIndex, JSON.stringify(data));
    // 視覚的フィードバック
    const slot = document.querySelector(`.save-slot[data-slot="${slotIndex}"]`);
    slot.classList.add('saved-flash');
    setTimeout(() => slot.classList.remove('saved-flash'), 600);
    updateSlotIndicators();
  } catch (e) {
    console.error('デッキ保存エラー:', e);
  }
}

function loadDeckFromSlot(slotIndex) {
  try {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + slotIndex);
    if (raw) {
      const data = JSON.parse(raw);
      deck = data.deck || {};
      selectedShields = data.selectedShields || [];
    } else {
      deck = {};
      selectedShields = [];
    }
  } catch (e) {
    deck = {};
    selectedShields = [];
  }
}

function updateSlotIndicators() {
  document.querySelectorAll('.save-slot').forEach(slot => {
    const idx = slot.dataset.slot;
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + idx);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const count = Object.values(data.deck || {}).reduce((s, c) => s + c, 0);
        slot.classList.toggle('has-data', count > 0);
      } catch { slot.classList.remove('has-data'); }
    } else {
      slot.classList.remove('has-data');
    }
  });
}

// ======== カードグリッド描画 ========
function renderCardGrid() {
  const grid = document.getElementById('card-grid');
  grid.innerHTML = '';
  
  const filtered = allCards.filter(c => {
    const colors = c.colors && c.colors.length > 0 ? c.colors : [c.color];
    const isNeutral = c.color === 'neutral' || !c.color;
    const passColor = isNeutral ? true : colors.some(col => activeColors.has(col));
    const passType = activeType === 'all' || c.type === activeType;
    let passCost = true;
    if (activeCost !== 'all') {
      if (activeCost === '7+') passCost = c.cost >= 7;
      else passCost = c.cost === parseInt(activeCost);
    }
    return passColor && passType && passCost;
  });
  
  filtered.sort((a, b) => a.cost - b.cost || (a.colors ? a.colors[0] : a.color).localeCompare(b.colors ? b.colors[0] : b.color));

  for (const card of filtered) {
    const count = deck[card.id] || 0;
    const el = document.createElement('div');
    el.className = `card-item${count > 0 ? ' in-deck' : ''}`;
    
    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const primaryColor = getColorCSS(colors[0]);

    el.style.backgroundImage = `url('${getCardImagePath(card)}')`;
    
    // コスト丸アイコン（右上）、カード名は非表示（プレビューで確認）
    // ユニットの場合はATK/HPも小さく表示
    const statsOverlay = card.type === 'unit' 
      ? `<div class="grid-stats"><span class="gs-atk">${card.attack}</span><span class="gs-hp">${card.hp}</span></div>` 
      : `<div class="grid-type-label">SPELL</div>`;
      
    el.innerHTML = `
      <div class="grid-card-overlay">
        <div class="grid-cost" style="background:${primaryColor};">${card.cost}</div>
        ${statsOverlay}
        ${count > 0 ? `<div class="grid-count">×${count}</div>` : ''}
      </div>
      <img src="${getCardImagePath(card)}" style="display:none;" onerror="${IMG_FALLBACK}">
    `;
    
    el.addEventListener('click', () => showPreview('card', card));
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); removeFromDeck(card.id); });
    grid.appendChild(el);
  }
  
  updateSlotIndicators();
}

// ======== シールドグリッド描画 ========
function renderShieldGrid() {
  const grid = document.getElementById('shield-grid');
  grid.innerHTML = '';
  
  for (const shield of allShields) {
    const isSelected = selectedShields.includes(shield.id);
    const el = document.createElement('div');
    el.className = `card-item shield-item${isSelected ? ' in-deck' : ''}`;
    el.style.backgroundImage = `url('${getShieldImagePath(shield)}')`;
    
    el.innerHTML = `
      <div class="grid-card-overlay">
        <div class="grid-cost" style="background:#b8860b;">${shield.durability}</div>
        ${isSelected ? `<div class="grid-count">✓</div>` : ''}
      </div>
      <img src="${getShieldImagePath(shield)}" style="display:none;" onerror="${IMG_FALLBACK}">
    `;
    
    el.addEventListener('click', () => showPreview('shield', shield));
    grid.appendChild(el);
  }
}

// ======== プレビュー表示 ========
function showPreview(type, data) {
  currentPreviewItem = { type, data };
  const container = document.getElementById('preview-content');
  container.classList.remove('empty');
  
  if (type === 'card') {
    const count = deck[data.id] || 0;
    const maxCopies = data.maxCopies || 3;
    const bgImage = getCardImagePath(data);
    
    // スキル・キーワード表示 (DataLoaderのマッピングに合わせて調整)
    const keywordHtml = data.keywords && data.keywords.length > 0 
      ? `<div class="preview-keywords">${data.keywords.map(kw => `<span class="kw-badge">${kw}</span>`).join('')}</div>` 
      : '';
    // text (アビリティ記述列) を優先表示。なければ abilityEffect。
    const descText = data.text || data.abilityEffect || 'アビリティを持たない。';
    const flavorHtml = data.flavorText ? `<div class="preview-flavor">${data.flavorText}</div>` : '';
    const statsHtml = data.type === 'unit' 
      ? `<div class="preview-stats"><span class="ps-atk">⚔ ${data.attack}</span><span class="ps-hp">❤ ${data.hp}</span></div>` 
      : `<div class="preview-stats"><span class="ps-spell">SPELL</span></div>`;

    container.innerHTML = `
      <div class="preview-card-image" style="background-image: url('${bgImage}')"></div>
      <div class="preview-info">
        <div class="preview-title">
          <span class="preview-cost" style="background:${getColorCSS(data.color)};">${data.cost}</span>
          <h2>${data.name}</h2>
        </div>
        ${statsHtml}
        ${keywordHtml}
        <div class="preview-desc">${descText}</div>
        ${flavorHtml}
      </div>
      
      <div class="preview-controls">
        <label>デッキへの枚数</label>
        <div class="control-group">
          <button class="btn btn-secondary" id="btn-minus" ${count === 0 ? 'disabled' : ''}>ー</button>
          <span class="count-display">${count} / ${maxCopies}</span>
          <button class="btn btn-primary" id="btn-plus" ${count >= maxCopies || Object.values(deck).reduce((a,b)=>a+b,0) >= 40 ? 'disabled' : ''}>＋</button>
        </div>
      </div>
    `;
    
    document.getElementById('btn-minus').addEventListener('click', () => { removeFromDeck(data.id); showPreview('card', data); });
    document.getElementById('btn-plus').addEventListener('click', () => { addToDeck(data); showPreview('card', data); });
    
  } else if (type === 'shield') {
    const isSelected = selectedShields.includes(data.id);
    const bgImage = getShieldImagePath(data);
    const abilityText = data.skill ? data.skill.description : '能力なし';
    
    container.innerHTML = `
      <div class="preview-card-image" style="background-image: url('${bgImage}')"></div>
      <div class="preview-info">
        <div class="preview-title">
          <h2>${data.name}</h2>
        </div>
        <div class="preview-stats"><span style="background:#444;padding:4px 12px;border-radius:6px;border:1px solid #b8860b;">耐久値 ${data.durability}</span></div>
        <div class="preview-desc">${abilityText}</div>
      </div>
      
      <div class="preview-controls">
        <label>シールド枠（最大3）</label>
        <div class="control-group">
          <button class="btn ${isSelected ? 'btn-secondary' : 'btn-primary'}" id="btn-toggle-shield" style="width:100%;">
            ${isSelected ? '選択を解除' : 'シールドを選択'}
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('btn-toggle-shield').addEventListener('click', () => { toggleShield(data.id); showPreview('shield', data); });
  }
}

function addToDeck(card) {
  const totalCards = Object.values(deck).reduce((s, c) => s + c, 0);
  if (totalCards >= 40) return;
  const current = deck[card.id] || 0;
  if (current >= (card.maxCopies || 3)) return;
  deck[card.id] = current + 1;
  renderGrid();
  renderDeckList();
  updateSubmitButton();
}

function removeFromDeck(cardId) {
  if (!deck[cardId]) return;
  deck[cardId]--;
  if (deck[cardId] <= 0) delete deck[cardId];
  renderGrid();
  renderDeckList();
  updateSubmitButton();
}

function toggleShield(shieldId) {
  if (selectedShields.includes(shieldId)) {
    selectedShields = selectedShields.filter(id => id !== shieldId);
  } else if (selectedShields.length < 3) {
    selectedShields.push(shieldId);
  }
  renderGrid();
  renderShieldSlotsList();
  updateSubmitButton();
}

function renderDeckList() {
  const list = document.getElementById('deck-list');
  list.innerHTML = '';
  const totalCards = Object.values(deck).reduce((s, c) => s + c, 0);
  document.getElementById('deck-count').textContent = totalCards;

  const entries = Object.entries(deck).map(([id, count]) => {
    const card = allCards.find(c => c.id === id);
    return { card, count };
  }).filter(e => e.card).sort((a, b) => a.card.cost - b.card.cost);

  for (const { card, count } of entries) {
    const el = document.createElement('div');
    el.className = 'deck-entry';
    const primaryColor = getColorCSS(card.color);
    el.innerHTML = `
      <span class="de-cost" style="background:${primaryColor};">${card.cost}</span>
      <span class="de-name">${card.name}</span>
      <span class="de-copies">×${count}</span>
    `;
    el.addEventListener('click', () => { showPreview('card', card); });
    list.appendChild(el);
  }
}

function renderShieldSlotsList() {
  const container = document.getElementById('shield-slots');
  container.innerHTML = '';
  document.getElementById('shield-count').textContent = selectedShields.length;
  
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'shield-list-item';
    
    if (i < selectedShields.length) {
      const shield = allShields.find(s => s.id === selectedShields[i]);
      
      const controls = document.createElement('div');
      controls.className = 'shield-reorder-controls';
      controls.innerHTML = `
        <button class="btn-arrow btn-up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-arrow btn-down" ${i === selectedShields.length - 1 ? 'disabled' : ''}>▼</button>
      `;
      
      const content = document.createElement('div');
      content.style.flex = '1';
      content.style.cursor = 'pointer';
      content.innerHTML = `<span>${shield.name}</span><span style="font-size:12px;color:var(--text-dim);margin-left:8px;">耐久${shield.durability}</span>`;
      content.addEventListener('click', () => showPreview('shield', shield));
      
      controls.querySelector('.btn-up').addEventListener('click', (e) => { e.stopPropagation(); moveShield(i, -1); });
      controls.querySelector('.btn-down').addEventListener('click', (e) => { e.stopPropagation(); moveShield(i, 1); });
      
      el.appendChild(controls);
      el.appendChild(content);
      el.classList.add('filled');
    } else {
      el.innerHTML = `<span style="color:var(--text-dim);font-size:13px;">空のシールド枠</span>`;
      el.classList.add('empty-slot');
    }
    container.appendChild(el);
  }
}

function moveShield(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= selectedShields.length) return;
  const temp = selectedShields[index];
  selectedShields[index] = selectedShields[newIndex];
  selectedShields[newIndex] = temp;
  renderShieldSlotsList();
}

function updateSubmitButton() {
  const totalCards = Object.values(deck).reduce((s, c) => s + c, 0);
  const btn = document.getElementById('btn-submit-deck');
  btn.disabled = !(totalCards === 40 && selectedShields.length === 3);
}

document.getElementById('btn-submit-deck').addEventListener('click', () => {
  const totalCards = Object.values(deck).reduce((s, c) => s + c, 0);
  if (totalCards !== 40 || selectedShields.length !== 3) return;

  // 自動保存
  saveDeckToSlot(currentSaveSlot);

  const deckCardIds = [];
  for (const [id, count] of Object.entries(deck)) {
    for (let i = 0; i < count; i++) deckCardIds.push(id);
  }

  socket.emit('submit_deck', { deckCardIds, shieldIds: selectedShields });
  document.getElementById('btn-submit-deck').disabled = true;
  document.getElementById('btn-submit-deck').textContent = 'ゲーム準備中...';
});

// ゲーム開始 → ゲーム画面へ遷移
socket.on('game_started', () => {
  window.location.href = '/game.html';
});

socket.on('waiting_opponent_deck', () => {
  document.getElementById('btn-submit-deck').textContent = '対戦相手のデッキ構築を完了待機...';
});

loadData();
