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

// グローバル共有用
window.allCards = allCards;
window.allShields = allShields;
window.deck = deck;
window.selectedShields = selectedShields;

let activeTab = 'cards';
let activeColors = new Set(['red', 'blue', 'green', 'white', 'black']);
let activeType = 'all';
let activeCost = 'all';
let activeSearchText = '';
let activeKeyword = 'all';
let currentPreviewItem = null;
let currentSaveSlot = 0;

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
  const [cardsRes, shieldsRes, keywordsRes] = await Promise.all([
    fetch('/api/cards'),
    fetch('/api/shields'),
    fetch('/api/keywords')
  ]);
  allCards = await cardsRes.json();
  allShields = await shieldsRes.json();
  window.keywordMap = await keywordsRes.json();
  
  // グローバル変数を更新
  window.allCards = allCards;
  window.allShields = allShields;
  
  console.log('Data loaded:', { cards: allCards.length, shields: allShields.length });
  updateKeywordDropdown();
  loadDeckFromSlot(currentSaveSlot);
  initUI();
  renderGrid();
  renderDeckList();
  renderShieldSlotsList();
  updateSubmitButton();
}

function updateKeywordDropdown() {
  const keywordSet = new Set();
  allCards.forEach(c => {
    if (c.keywords && Array.isArray(c.keywords)) {
      c.keywords.forEach(kw => keywordSet.add(kw));
    }
  });
  
  const select = document.getElementById('keyword-filter');
  if (!select) return;
  
  // 初期化 (最初の1つ以外を消す)
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // 初期表示用に一部ハードコードしたマッピングもサポート
  const KEYWORD_NAMES = { taunt: '挑発', rush: '速攻', speed: '速攻', stealth: '潜伏', double_strike: '連撃', barrier: '加護', endure: '不屈', siege: '攻城', comeback: '逆転', awaken: '覚醒', pierce: '貫通', spread: '拡散', drain: '吸命', intimidate: '威圧' };

  Array.from(keywordSet).sort().forEach(kw => {
    // 削除済マスタ対応: baseKw (例:'awaken'等)でチェックし、マスタがロード済なのに該当設定がなければ除外
    const baseKw = kw.split(':')[0];
    if (window.keywordMap && Object.keys(window.keywordMap).length > 0 && !window.keywordMap[baseKw]) {
      return;
    }
    const opt = document.createElement('option');
    opt.value = kw;
    const master = window.keywordMap && window.keywordMap[kw];
    const kwName = master ? master.name : (typeof KEYWORD_NAMES !== 'undefined' ? KEYWORD_NAMES[baseKw] : kw);
    opt.textContent = kwName;
    select.appendChild(opt);
  });
}

function initUI() {
  // タブ切り替え
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      
      if (activeTab === 'cards') {
        document.getElementById('card-grid').style.display = 'grid';
        document.getElementById('shield-grid').style.display = 'none';
        document.getElementById('card-specific-filters').style.display = 'flex';
        document.getElementById('shield-specific-filters').style.display = 'none';
      } else {
        document.getElementById('card-grid').style.display = 'none';
        document.getElementById('shield-grid').style.display = 'grid';
        document.getElementById('card-specific-filters').style.display = 'none';
        document.getElementById('shield-specific-filters').style.display = 'flex';
      }
      renderGrid();
    });
  });

  // フィルタ：神族アイコン（色）
  document.querySelectorAll('.tribe-filter').forEach(el => {
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

  window.activeDurability = 'all';
  // フィルタ：耐久値（シールド用ピル型）
  document.querySelectorAll('.durability-filters .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.durability-filters .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      window.activeDurability = btn.dataset.durability;
      renderGrid();
    });
  });

  // フィルタ：検索窓
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchText = e.target.value.trim();
      renderGrid();
    });
  }

  // フィルタ：キーワードプルダウン
  const keywordFilter = document.getElementById('keyword-filter');
  if (keywordFilter) {
    keywordFilter.addEventListener('change', (e) => {
      activeKeyword = e.target.value;
      renderGrid();
    });
  }

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

  // デッキ保存スロットの生成と初期化
  const slotsContainer = document.getElementById('deck-slots');
  if (slotsContainer && slotsContainer.children.length === 0) {
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = `save-slot${i === currentSaveSlot ? ' active' : ''}`;
      slot.dataset.slot = i;
      slot.textContent = i + 1;
      slotsContainer.appendChild(slot);
    }
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

  document.getElementById('btn-save-deck')?.addEventListener('click', () => {
    saveDeckToSlot(currentSaveSlot);
  });

  document.getElementById('btn-clear-deck')?.addEventListener('click', () => {
    if (confirm('現在編集中のデッキをすべて空にしますか？')) {
      deck = {};
      selectedShields = [];
      renderGrid();
      renderDeckList();
      renderShieldSlotsList();
      updateSubmitButton();
    }
  });

  document.getElementById('btn-delete-deck')?.addEventListener('click', () => {
    const slotNum = currentSaveSlot + 1;
    if (confirm(`スロット ${slotNum} に保存されているデッキを完全に削除しますか？`)) {
      console.log(`[DECK] Deleting slot ${currentSaveSlot}`);
      deck = {};
      selectedShields = [];
      localStorage.removeItem(SAVE_KEY_PREFIX + currentSaveSlot);
      
      // UIを即座にリセット
      updateSlotIndicators();
      renderGrid();
      renderDeckList();
      renderShieldSlotsList();
      updateSubmitButton();
      
      alert(`スロット ${slotNum} のデッキを削除しました。`);
    }
  });

  // 詳細モーダルの閉じるボタン初期化
  const btnCloseDetail = document.getElementById('btn-close-detail');
  if (btnCloseDetail) {
    btnCloseDetail.onclick = () => {
      document.getElementById('card-detail-overlay').style.display = 'none';
    };
  }
}

function getColorCSS(color) {
  const c = (color || 'neutral').toLowerCase();
  const map = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', white: '#e2e8f0', black: '#8b5cf6', neutral: '#9ca3af' };
  return map[c] || '#666';
}

// カード画像パスの取得は game-renderer.js の window.getCardImagePath を直接参照します

function getShieldImagePath(shield) {
  const fileName = shield.artId || shield.id || 'unknown';
  return `/assets/images/shields/${fileName}.webp?v=2`;
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
    if (window.audioManager) window.audioManager.playSE('levelUp');
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
    const colors = c.colors && c.colors.length > 0 ? c.colors : [c.color || 'neutral'];
    const passColor = colors.some(col => {
      const colLower = col.toLowerCase();
      return colLower === 'neutral' || activeColors.has(colLower);
    });
    
    const passType = activeType === 'all' || (c.type || '').toLowerCase() === activeType.toLowerCase();
    let passCost = true;
    if (activeCost !== 'all') {
      if (activeCost === '7+') passCost = c.cost >= 7;
      else passCost = c.cost === parseInt(activeCost);
    }
    
    // 検索テキストによるフィルタ (名称またはテキスト)
    const passSearch = !activeSearchText || 
      (c.name && c.name.includes(activeSearchText)) || 
      (c.text && c.text.includes(activeSearchText));
      
    // キーワードによるフィルタ (完全一致)
    const passKeyword = activeKeyword === 'all' || 
      (c.keywords && c.keywords.includes(activeKeyword));

    // 枚数制限が0のカード(トークン用)はコレクションに表示しない
    const passLimit = (typeof c.maxCopies !== 'undefined') ? c.maxCopies > 0 : true;

    return passColor && passType && passCost && passSearch && passKeyword && passLimit;
  });
  
  console.log(`Rendering Grid: Tab=${activeTab}, Total=${allCards.length}, Filtered=${filtered.length}`);
  
  filtered.sort((a, b) => {
    const costDiff = (a.cost || 0) - (b.cost || 0);
    if (costDiff !== 0) return costDiff;
    const colorA = (a.colors && a.colors.length > 0 ? a.colors[0] : (a.color || 'neutral')).toLowerCase();
    const colorB = (b.colors && b.colors.length > 0 ? b.colors[0] : (b.color || 'neutral')).toLowerCase();
    return colorA.localeCompare(colorB);
  });

  for (const card of filtered) {
    const count = deck[card.id] || 0;
    const el = document.createElement('div');
    const rarityClass = card.rarity ? ` rarity-${card.rarity}` : ' rarity-1';
    el.className = `grid-item card-item${count > 0 ? ' in-deck' : ''}${rarityClass}`;
    
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
    
    // バトル画面と同じ詳細表示を有効化
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(el, card);
    }
    
    grid.appendChild(el);
  }
  
  updateSlotIndicators();
}

// ======== シールドグリッド描画 ========
function renderShieldGrid() {
  const grid = document.getElementById('shield-grid');
  grid.innerHTML = '';
  
  const filteredShields = allShields.filter(s => {
    if (!window.activeDurability || window.activeDurability === 'all') return true;
    return s.durability === parseInt(window.activeDurability);
  });

  for (const shield of filteredShields) {
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
    
    // 詳細モーダル表示イベントのアタッチ
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(el, shield);
    }
    
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
    const maxCopies = (typeof data.maxCopies !== 'undefined') ? data.maxCopies : 3;
    const bgImage = getCardImagePath(data);
    
    // スキル・キーワード表示 (DataLoaderのマッピングに合わせて調整)
    const keywordHtml = data.keywords && data.keywords.length > 0 
      ? `<div class="preview-keywords">${data.keywords.map(kw => `<span class="kw-badge">${kw}</span>`).join('')}</div>` 
      : '';

    // アビリティリストの表示 (複数能力対応。card.textが存在する場合は単一表示)
    let abilitiesHtml = '';
    if (data.text) {
      abilitiesHtml = `
        <div class="cd-abilities-list">
          <div class="ability-item" style="border:none;">
            ${data.text}
          </div>
        </div>
      `;
    } else if (data.abilities && data.abilities.length > 0) {
      abilitiesHtml = `
        <div class="cd-abilities-list">
          ${data.abilities.map(a => `
            <div class="ability-item">
              ${a.trigger && a.trigger !== 'none' ? `<span class="ability-trigger">${a.trigger.replace('on_', '').toUpperCase()}</span>` : ''}
              ${(a.text || a.effect || '').replace(/\\n/g, '<br>')}
            </div>
          `).join('')}
        </div>
      `;
    } else if (data.abilityEffect) {
      abilitiesHtml = `<div class="cd-abilities-list"><div class="ability-item">${data.abilityEffect}</div></div>`;
    } else {
      abilitiesHtml = '<div class="ability-item" style="border:none;">アビリティを持たない。</div>';
    }

    // 召喚トークンセクションの追加 (プレビューパネル用)
    let tokenHtml = '';
    const tokenAbilities = (data.abilities || []).filter(a => a.effect === 'summon_token');
    if (tokenAbilities.length > 0) {
      const tokenIds = [...new Set(tokenAbilities.map(a => a.tokenId || a.value))];
      const tokenCards = tokenIds.map(id => (window.allCards || []).find(c => c.id === id)).filter(Boolean);

      if (tokenCards.length > 0) {
        tokenHtml = `
          <div class="preview-token-section" style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 10px;">
            <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 8px;">📦 召喚トークン</div>
            <div class="token-list">
              ${tokenCards.map(tc => `
                <div class="token-item" style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px; cursor: pointer; transition: background 0.2s;" onclick="const tc = (window.allCards || []).find(c => c.id === '${tc.id}'); if (tc) window.showCardDetail(tc);">
                  <div style="width: 30px; height: 30px; background-image: url('${getCardImagePath(tc)}'); background-size: cover; border-radius: 2px;"></div>
                  <div style="flex:1; font-size: 11px; font-weight: bold;">${tc.name}</div>
                  <div style="font-size: 10px;">⚔️${tc.attack} ❤️${tc.hp}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    const flavorHtml = data.flavorText ? `<div class="preview-flavor">${data.flavorText}</div>` : '';
    const statsHtml = data.type === 'unit' 
      ? `<div class="preview-stats"><span class="ps-atk">⚔ ${data.attack}</span><span class="ps-hp">❤ ${data.hp}</span></div>` 
      : `<div class="preview-stats"><span class="ps-spell">SPELL</span></div>`;

    container.innerHTML = `
      <div class="preview-card-image" style="background-image: url('${bgImage}')"></div>
      <div class="preview-info">
        <div class="preview-title">
          <span class="preview-cost" style="background-image: url('/assets/images/icon/divine/${(data.color || 'neutral').toLowerCase()}.png');">${data.cost || (data.durability || 0)}</span>
          <h2>${data.name}</h2>
          <div class="cd-rarity rarity-${data.rarity || 1}" style="font-size: 11px; padding: 2px 8px; margin-left: 10px;">
            ${(window.getRarityName ? window.getRarityName(data.rarity || 1) : (data.rarity === 4 ? 'Legendary' : (data.rarity === 3 ? 'Majestic' : (data.rarity === 2 ? 'Rare' : 'Common'))))}
          </div>
        </div>
        ${statsHtml}
        ${keywordHtml}
        <div class="preview-desc">${abilitiesHtml}</div>
        ${flavorHtml}
        ${tokenHtml}
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
    const abilityText = (data.skill ? data.skill.text || '' : '能力なし').toString().replace(/\\n/g, '\n');
    const flavorText = (data.skill ? data.skill.description || '' : '').toString().replace(/\\n/g, '\n');
    
    container.innerHTML = `
      <div class="preview-card-image" style="background-image: url('${bgImage}')"></div>
      <div class="preview-info">
        <div class="preview-title">
          <h2>${data.name}</h2>
        </div>
        <div class="preview-stats"><span style="background:#444;padding:4px 12px;border-radius:6px;border:1px solid #b8860b;">耐久値 ${data.durability}</span></div>
        <div class="preview-desc">${abilityText}</div>
        ${flavorText ? `<div class="preview-flavor">${flavorText}</div>` : ''}
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
  const maxCopies = (typeof card.maxCopies !== 'undefined') ? card.maxCopies : 3;
  if (current >= maxCopies) return;
  deck[card.id] = current + 1;
  if (window.audioManager) window.audioManager.playSE('draw');
  renderGrid();
  renderDeckList();
  updateSubmitButton();
}

function removeFromDeck(cardId) {
  if (!deck[cardId]) return;
  deck[cardId]--;
  if (deck[cardId] <= 0) delete deck[cardId];
  if (window.audioManager) window.audioManager.playSE('draw');
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
  if (window.audioManager) window.audioManager.playSE('click');
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
    
    // デッキリスト内でも詳細表示を有効化
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(el, card);
    }
    
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

  const deckBadge = document.getElementById('deck-count').parentElement;
  if(totalCards !== 40 && totalCards > 0) deckBadge.classList.add('error-pulse');
  else deckBadge.classList.remove('error-pulse');
  
  const shieldBadge = document.getElementById('shield-count').parentElement;
  if(selectedShields.length !== 3 && totalCards > 0) shieldBadge.classList.add('error-pulse');
  else shieldBadge.classList.remove('error-pulse');
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
