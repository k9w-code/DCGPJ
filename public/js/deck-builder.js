// deck-builder.js - デッキ構築画面のクライアントロジック（リッチ化版）
'use strict';

const socket = io();

// セッション復旧の試行（sessionStorage優先）
const sessionId = sessionStorage.getItem('sessionId') || localStorage.getItem('dcg_session_id');

if (sessionId) {
  sessionStorage.setItem('sessionId', sessionId);
  socket.emit('restore_session', { sessionId });
}

socket.on('session_restored', (data) => {
  console.log('✅ セッションが復帰しました:', data);
});

socket.on('session_reconnected', (data) => {
  console.log('✅ セッションが再接続されました:', data);
});

socket.on('session_invalid', () => {
  alert('セッションが無効です。ロビーに戻ります。');
  window.location.href = '/';
});

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

// データ取得と初期化
async function loadData() {
  try {
    console.log('🚀 Starting loadData...');
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
  } catch (err) {
    console.error('❌ [loadData ERROR]:', err);
    alert('❌ [loadData ERROR]: ' + err.message + '\n' + err.stack);
  }
}

function updateKeywordDropdown() {
  const keywordSet = new Set();
  allCards.forEach(c => {
    if (c.keywords && Array.isArray(c.keywords)) {
      c.keywords.forEach(kw => {
        const baseKw = kw.split(':')[0];
        if (baseKw) keywordSet.add(baseKw);
      });
    }
  });
  
  const select = document.getElementById('keyword-filter');
  if (!select) return;
  
  // 初期化 (最初の1つ以外を消す)
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // 初期表示用に一部ハードコードしたマッピングもサポート
  const KEYWORD_NAMES = {
    taunt: '挑発', rush: '速攻', speed: '速攻', stealth: '潜伏', double_strike: '連撃',
    barrier: '加護', endure: '不屈', siege: '攻城', comeback: '逆転', awaken: '覚醒',
    pierce: '貫通', spread: '拡散', drain: '吸命', intimidate: '威圧', lethal: '必殺',
    crisis: '背水', snipe: '狙撃', resonance: '共鳴', silence: '沈黙', link: '連携',
    vanguard: '先陣', rearguard: '後衛', spellshield: '魔盾', sacrifice: '代償',
    echo: '残響', overload: '暴走', loner: '孤高', avenger: '復讐', decay: '腐敗', legacy: '遺言'
  };

  Array.from(keywordSet).sort().forEach(baseKw => {
    // 削除済マスタ対応: baseKw (例:'awaken'等)でチェックし、マスタがロード済なのに該当設定がなければ除外
    if (window.keywordMap && Object.keys(window.keywordMap).length > 0 && !window.keywordMap[baseKw]) {
      return;
    }
    const opt = document.createElement('option');
    opt.value = baseKw;
    const master = window.keywordMap && window.keywordMap[baseKw];
    const kwName = master ? master.name : (KEYWORD_NAMES[baseKw] || baseKw);
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

  // === デッキコードのエクスポート ===
  const btnExport = document.getElementById('btn-export-code');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      if (Object.keys(deck).length === 0) {
        alert('空のデッキはエクスポートできません。カードを追加してください。');
        return;
      }
      try {
        const data = { d: deck, s: selectedShields };
        const jsonStr = JSON.stringify(data);
        const code = btoa(unescape(encodeURIComponent(jsonStr)));
        
        navigator.clipboard.writeText(code).then(() => {
          alert('🔑 デッキコードをクリップボードにコピーしました！\nこのコードをSNS等で共有したり、インポートして使ってください。');
        }).catch(err => {
          prompt('以下のデッキコードをコピーしてください：', code);
        });
        
        if (window.audioManager) window.audioManager.playSE('click');
      } catch (e) {
        alert('エクスポートに失敗しました: ' + e.message);
      }
    });
  }

  // === デッキコードのインポート ===
  const btnImport = document.getElementById('btn-import-code');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      const code = prompt('コピーしたデッキコードを入力してください：');
      if (!code) return;
      
      try {
        const jsonStr = decodeURIComponent(escape(atob(code.trim())));
        const data = JSON.parse(jsonStr);
        
        if (data.d && typeof data.d === 'object' && Array.isArray(data.s)) {
          // 有効なカードのみにクリーンアップ
          const cleanedDeck = {};
          for (const id in data.d) {
            const card = allCards.find(c => c.id === id);
            if (card && card.maxCopies > 0) {
              const maxCopies = typeof card.maxCopies !== 'undefined' ? card.maxCopies : 3;
              cleanedDeck[id] = Math.min(data.d[id], maxCopies);
            }
          }
          
          // 有効なシールドのみにクリーンアップ
          const cleanedShields = data.s.filter(id => allShields.some(s => s.id === id)).slice(0, 3);

          // 色数（属性数）チェック: 中立を除いて最大2色まで
          const colorsUsed = new Set();
          for (const id in cleanedDeck) {
            const card = allCards.find(c => c.id === id);
            if (card) {
              const cardColors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
              cardColors.forEach(col => {
                const c = col.toLowerCase();
                if (c !== 'neutral') colorsUsed.add(c);
              });
            }
          }

          if (colorsUsed.size > 2) {
            alert(`⚠️ インポートに失敗しました。デッキに含まれる神族の属性（色）は、中立を除き最大2色までである必要があります。（検出された属性: ${Array.from(colorsUsed).join(', ')}）`);
            return;
          }

          // デッキを上書き
          deck = cleanedDeck;
          selectedShields = cleanedShields;
          
          window.deck = deck;
          window.selectedShields = selectedShields;
          
          // 表示を更新
          renderDeckList();
          renderShieldSlotsList();
          updateSubmitButton();
          if (typeof renderDeckAnalysis === 'function') renderDeckAnalysis();
          
          alert('🔌 デッキコードからデッキを正常に読み込みました！');
          if (window.audioManager) window.audioManager.playSE('levelUp');
        } else {
          alert('無効なデッキコード形式です。');
        }
      } catch (e) {
        alert('インポートに失敗しました。コードが正しいか確認してください。\nエラー: ' + e.message);
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
      
      const savedName = localStorage.getItem(`dcg_deck_name_slot_${i}`) || `${i + 1}`;
      slot.textContent = savedName;
      slotsContainer.appendChild(slot);
    }
  }

  // デッキ保存スロット
  document.querySelectorAll('.save-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
      
      document.querySelectorAll('.save-slot').forEach(s => s.classList.remove('active'));
      slot.classList.add('active');
      currentSaveSlot = parseInt(slot.dataset.slot);
      loadDeckFromSlot(currentSaveSlot);
      renderGrid();
      renderDeckList();
      renderShieldSlotsList();
      updateSubmitButton();
    });

    slot.addEventListener('dblclick', () => {
      if (slot.querySelector('input')) return;

      const currentName = slot.textContent.trim();
      slot.innerHTML = '';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.width = '90px';
      input.style.background = '#0f172a';
      input.style.color = '#ffffff';
      input.style.border = '1px solid #fbbf24';
      input.style.borderRadius = '6px';
      input.style.padding = '4px 6px';
      input.style.fontSize = '12px';
      input.style.textAlign = 'center';
      input.style.outline = 'none';
      input.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.3)';
      
      slot.appendChild(input);
      input.focus();
      input.select();

      const finishEdit = () => {
        let newName = input.value.trim();
        if (!newName) newName = `${parseInt(slot.dataset.slot) + 1}`;
        localStorage.setItem(`dcg_deck_name_slot_${slot.dataset.slot}`, newName);
        slot.innerHTML = '';
        slot.textContent = newName;
        if (window.audioManager) window.audioManager.playSE('click');
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          finishEdit();
        } else if (e.key === 'Escape') {
          slot.innerHTML = '';
          slot.textContent = currentName;
        }
      });

      input.addEventListener('blur', () => {
        finishEdit();
      });
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
      
      // 無効なカードデータ（CSVから削除・変更されたID）が残っていれば自動的に削除
      let deckCleaned = false;
      for (const id in deck) {
        if (!allCards.find(c => c.id === id)) {
          delete deck[id];
          deckCleaned = true;
        }
      }
      if (deckCleaned) {
        console.warn('[DECK] Removed invalid/deleted cards from saved deck.');
      }

      // 無効なシールドデータも除去
      selectedShields = (data.selectedShields || []).filter(id => allShields.some(s => s.id === id));
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
      
    // キーワードによるフィルタ (パラメータ対応)
    const passKeyword = activeKeyword === 'all' || 
      (c.keywords && c.keywords.some(kw => kw.split(':')[0] === activeKeyword));

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

    el.style.backgroundImage = `url('${window.getCardImagePath(card)}')`;
    
    // コスト丸アイコン（右上）、カード名は非表示（プレビューで確認）
    // ユニットの場合はATK/HPも小さく表示
    const statsOverlay = card.type === 'unit' 
      ? `<div class="grid-stats"><span class="gs-atk">${card.attack}</span><span class="gs-hp">${card.hp}</span></div>` 
      : `<div class="grid-type-label">SPELL</div>`;
      
    const foilShineHtml = (card.rarity === 4) ? '<div class="foil-shine"></div>' : '';
    el.innerHTML = `
      ${foilShineHtml}
      <div class="grid-card-overlay">
        <div class="grid-cost" style="border-color:${primaryColor} !important;">${card.cost}</div>
        ${statsOverlay}
        <div class="grid-card-name">${card.name}</div>
        ${count > 0 ? `<div class="grid-count">×${count}</div>` : ''}
      </div>
      <img src="${window.getCardImagePath(card)}" style="display:none;" onerror="${IMG_FALLBACK}">
    `;
    
    el.addEventListener('click', () => showPreview('card', card));
    el.addEventListener('dblclick', () => {
      addToDeck(card);
      showPreview('card', card);
    });
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
    const bgImage = window.getCardImagePath(data);
    
    // スキル・キーワード表示 (日本語名＋属性名マッピング)
    const COLOR_JP = {
      red: '炎', blue: '水', green: '風', white: '光', black: '闇', neutral: '無'
    };

    const KEYWORD_NAMES = {
      taunt: '挑発', rush: '速攻', speed: '速攻', stealth: '潜伏', double_strike: '連撃',
      barrier: '加護', endure: '不屈', siege: '攻城', comeback: '逆転', awaken: '覚醒',
      pierce: '貫通', spread: '拡散', drain: '吸命', intimidate: '威圧', lethal: '必殺',
      crisis: '背水', snipe: '狙撃', resonance: '共鳴', silence: '沈黙', link: '連携',
      vanguard: '先陣', rearguard: '後衛', spellshield: '魔盾', sacrifice: '代償',
      echo: '残響', overload: '暴走', loner: '孤高', avenger: '復讐', decay: '腐敗', legacy: '遺言'
    };

    const keywordHtml = data.keywords && data.keywords.length > 0 
      ? `<div class="preview-keywords" style="margin: 4px 0; display: flex; flex-wrap: wrap; gap: 4px;">${data.keywords.map(kw => {
          const parts = kw.split(':');
          const baseKw = parts[0];
          const rawVal = parts[1];
          const master = window.keywordMap && window.keywordMap[baseKw];
          const name = master ? master.name : (KEYWORD_NAMES[baseKw] || baseKw);
          let label = `【${name}】`;
          if (rawVal) {
            const valJp = COLOR_JP[rawVal.toLowerCase()] || rawVal;
            label = `【${name}:${valJp}】`;
          }
          return `<span class="kw-badge" data-kw="${baseKw}">${label}</span>`;
        }).join('')}</div>` 
      : '';

    // アビリティリストの表示 (不要な先頭余白・インデントを除去して左上詰め)
    let cleanText = (data.text || '').trim();
    let abilitiesHtml = '';
    if (cleanText) {
      abilitiesHtml = `
        <div class="cd-abilities-list" style="margin:0; padding:0;">
          <div class="ability-item" style="border:none; text-align:left; text-indent:0; margin:0; padding:0; line-height:1.5; font-size:13px;">
            ${cleanText.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    } else if (data.abilities && data.abilities.length > 0) {
      abilitiesHtml = `
        <div class="cd-abilities-list" style="margin:0; padding:0;">
          ${data.abilities.map(a => `
            <div class="ability-item" style="text-align:left; text-indent:0; margin-bottom:4px; line-height:1.5; font-size:13px;">
              ${a.trigger && a.trigger !== 'none' ? `<span class="ability-trigger">${a.trigger.replace('on_', '').toUpperCase()}</span>` : ''}
              ${(a.text || a.effect || '').trim().replace(/\n/g, '<br>')}
            </div>
          `).join('')}
        </div>
      `;
    } else if (data.abilityEffect) {
      abilitiesHtml = `<div class="cd-abilities-list" style="margin:0; padding:0;"><div class="ability-item" style="text-align:left; font-size:13px;">${data.abilityEffect.trim()}</div></div>`;
    } else {
      abilitiesHtml = '';
    }

    // 召喚トークンセクション
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
                  <div style="width: 30px; height: 30px; background-image: url('${window.getCardImagePath(tc)}'); background-size: cover; border-radius: 2px;"></div>
                  <div style="flex:1; font-size: 11px; font-weight: bold;">${tc.name}</div>
                  <div style="font-size: 10px;"><span class="atk-box">${tc.attack}</span> <span class="hp-box">${tc.hp}</span></div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    const flavorHtml = data.flavorText ? `<div class="preview-flavor" style="font-size:13px; font-style:italic; margin-top:8px; color:#cbd5e1; border-left:3px solid #fbbf24; padding-left:8px; line-height:1.4;">${data.flavorText}</div>` : '';
    const statsHtml = data.type === 'unit' 
      ? `<div class="preview-stats" style="margin: 6px 0; display: flex; gap: 12px; align-items: center;"><span class="ps-atk">${data.attack}</span><span class="ps-hp">${data.hp}</span></div>` 
      : `<div class="preview-stats" style="margin: 4px 0;"><span class="ps-spell" style="background:rgba(147, 51, 234, 0.2); border:1px solid #c084fc; color:#e9d5ff; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">SPELL</span></div>`;

    const rarityText = window.getRarityName ? window.getRarityName(data.rarity || 1) : (data.rarity === 4 ? 'Legendary' : (data.rarity === 3 ? 'Majestic' : (data.rarity === 2 ? 'Rare' : 'Common')));

    container.innerHTML = `
      <div class="preview-card-image" style="background-image: url('${bgImage}')"></div>
      <div class="preview-info" style="padding-top: 4px;">
        <!-- 1行目: メタ（コストとレアリティ） -->
        <div class="preview-header-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span class="preview-cost" style="background-image: url('/assets/images/icon/divine/${(data.color || 'neutral').toLowerCase()}.png'); margin: 0;">${data.cost || (data.durability || 0)}</span>
          <div class="cd-rarity rarity-${data.rarity || 1}" style="font-size: 11px; padding: 2px 8px; margin: 0;">
            ${rarityText}
          </div>
        </div>
        
        <!-- 2行目: カード名 (最大12文字も改行せず1行表示) -->
        <div class="preview-title-row" style="margin-top: 4px; margin-bottom: 2px;">
          <h2 style="font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; line-height: 1.3; color: #fff;" title="${data.name}">${data.name}</h2>
        </div>

        ${statsHtml}
        ${keywordHtml}
        <div class="preview-desc" style="margin-top: 4px;">${abilitiesHtml}</div>
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
    
    // === キーワードクイッククリック絞り込み検索 ===
    container.querySelectorAll('.kw-badge').forEach(badge => {
      badge.style.cursor = 'pointer';
      badge.title = `「${badge.textContent}」で絞り込み`;
      badge.addEventListener('click', () => {
        const keywordText = badge.textContent.trim();
        const keywordSelect = document.getElementById('keyword-filter');
        if (keywordSelect) {
          let found = false;
          for (const opt of keywordSelect.options) {
            if (opt.textContent === keywordText) {
              keywordSelect.value = opt.value;
              activeKeyword = opt.value;
              found = true;
              break;
            }
          }
          if (!found) {
            // フルキーワード名 (例: "taunt:1"等) ではない単一検索マッチのフォールバック
            for (const opt of keywordSelect.options) {
              if (opt.value.split(':')[0] === keywordText) {
                keywordSelect.value = opt.value;
                activeKeyword = opt.value;
                break;
              }
            }
          }
        }
        
        // 検索文字列はクリアしてフィルタ優先
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = '';
          activeSearchText = '';
        }
        
        renderGrid();
        if (window.audioManager) window.audioManager.playSE('select');
      });
    });
    
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
    
    // 背景イラストとグラデーションマスクの設定
    const bgUrl = window.getCardImagePath(card);
    el.style.backgroundImage = `linear-gradient(90deg, rgba(15, 17, 26, 0.95) 0%, rgba(15, 17, 26, 0.8) 40%, rgba(15, 17, 26, 0.25) 100%), url('${bgUrl}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'right center';
    
    const primaryColor = getColorCSS(card.color);
    el.innerHTML = `
      <span class="de-cost" style="background:${primaryColor};">${card.cost}</span>
      <span class="de-name">${card.name}</span>
      <span class="de-copies">×${count}</span>
    `;
    el.addEventListener('click', () => { showPreview('card', card); });
    el.addEventListener('dblclick', () => {
      removeFromDeck(card.id);
      showPreview('card', card);
    });
    
    // デッキリスト内でも詳細表示を有効化
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(el, card);
    }
    
    list.appendChild(el);
  }
  
  // デッキ分析グラフの更新
  renderDeckAnalysis();
}

function renderDeckAnalysis() {
  const colorCounts = { white: 0, red: 0, blue: 0, green: 0, black: 0, neutral: 0 };
  const costCounts = Array(8).fill(0); // 0, 1, 2, 3, 4, 5, 6, 7+
  let totalCardsForColors = 0;

  for (const [id, count] of Object.entries(deck)) {
    const card = allCards.find(c => c.id === id);
    if (card) {
      // 1. 色割合集計
      const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
      colors.forEach(col => {
        const colLower = col.toLowerCase();
        if (colorCounts[colLower] !== undefined) {
          colorCounts[colLower] += count;
        }
      });
      totalCardsForColors += count * colors.length;

      // 2. コストマナカーブ集計
      if (card.cost !== undefined) {
        const cost = card.cost;
        if (cost >= 7) {
          costCounts[7] += count;
        } else {
          costCounts[cost] += count;
        }
      }
    }
  }

  // --- 色割合インジケーター描画 ---
  const bar = document.getElementById('color-balance-bar');
  if (bar) {
    bar.innerHTML = '';
    if (totalCardsForColors === 0) {
      bar.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; text-align: center; width: 100%; line-height: 12px;">デッキが空です</div>';
    } else {
      const colorsOrder = ['white', 'red', 'blue', 'green', 'black'];
      colorsOrder.forEach(col => {
        const cnt = colorCounts[col];
        if (cnt > 0) {
          const pct = (cnt / totalCardsForColors) * 100;
          const seg = document.createElement('div');
          seg.className = `color-segment segment-${col}`;
          seg.style.width = `${pct}%`;
          seg.style.background = getColorCSS(col);
          seg.title = `${col.toUpperCase()}: ${cnt}枚 (${Math.round(pct)}%)`;
          bar.appendChild(seg);
        }
      });
    }
  }

  // --- マナカーブ棒グラフ描画 ---
  const chart = document.getElementById('mana-curve-chart');
  if (chart) {
    chart.innerHTML = '';
    const maxCount = Math.max(1, ...costCounts);
    
    for (let i = 0; i <= 7; i++) {
      const cnt = costCounts[i];
      const heightPct = (cnt / maxCount) * 100;
      const colLabel = i === 7 ? '7+' : i;
      
      const barWrapper = document.createElement('div');
      barWrapper.className = 'mana-bar-wrapper';
      barWrapper.innerHTML = `
        <div class="mana-bar-value">${cnt > 0 ? cnt : ''}</div>
        <div class="mana-bar-outer">
          <div class="mana-bar-inner" style="height:${heightPct}%;"></div>
        </div>
        <div class="mana-bar-label">${colLabel}</div>
      `;
      chart.appendChild(barWrapper);
    }
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
      
      if (shield) {
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
        
        // 背景イラストとグラデーションマスクの設定
        const bgUrl = getShieldImagePath(shield);
        el.style.backgroundImage = `linear-gradient(90deg, rgba(15, 17, 26, 0.95) 0%, rgba(15, 17, 26, 0.8) 45%, rgba(15, 17, 26, 0.3) 100%), url('${bgUrl}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'right center';
      } else {
        el.innerHTML = `<span style="color:#ef4444;font-size:13px;">不明なシールド (ID: ${selectedShields[i]})</span>`;
        el.classList.add('error-slot');
      }
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

  const currentSessionId = sessionStorage.getItem('sessionId') || localStorage.getItem('dcg_session_id');
  socket.emit('submit_deck', { sessionId: currentSessionId, deckCardIds, shieldIds: selectedShields });
  document.getElementById('btn-submit-deck').disabled = true;
  document.getElementById('btn-submit-deck').textContent = 'ゲーム準備中...';
});

// ゲーム開始 → ゲーム画面へ遷移
socket.on('game_started', () => {
  window.location.href = '/game.html';
});

socket.on('waiting_opponent_deck', () => {
  document.getElementById('btn-submit-deck').textContent = '対戦相手のデッキ構築完了を待機中...';
});

socket.on('error_msg', (data) => {
  alert(data.message || 'エラーが発生しました');
  const btn = document.getElementById('btn-submit-deck');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'このデッキで対戦開始';
  }
});

loadData();

// フルスクリーン＆デッキ操作ドロップダウンメニュー制御
document.addEventListener('DOMContentLoaded', () => {
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen error:', err.message);
        });
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    });
  }

  // デッキ操作ドロップダウンメニューの制御
  const menuTrigger = document.getElementById('btn-deck-menu');
  const menuDropdown = document.getElementById('deck-menu-dropdown');

  if (menuTrigger && menuDropdown) {
    menuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menuDropdown.style.display !== 'none';
      menuDropdown.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!menuDropdown.contains(e.target) && !menuTrigger.contains(e.target)) {
        menuDropdown.style.display = 'none';
      }
    });

    menuDropdown.querySelectorAll('.deck-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        menuDropdown.style.display = 'none';
      });
    });
  }

  // ヘルプモーダルダイアログの制御
  const btnHelp = document.getElementById('btn-show-help');
  const btnCloseHelp = document.getElementById('btn-close-help');
  const helpOverlay = document.getElementById('help-overlay');

  if (btnHelp && helpOverlay) {
    btnHelp.addEventListener('click', () => {
      const helpContent = document.getElementById('help-content');
      if (helpContent) {
        helpContent.innerHTML = `
          <div style="margin-bottom: 18px;">
            <h3 style="color:#fbbf24; border-bottom: 1px solid rgba(251,191,36,0.3); padding-bottom: 6px; margin-top:0;">1. 基本構築 ＆ ライフシステム</h3>
            <p style="margin: 4px 0;">・デッキは<b>カード40枚</b>＋<b>シールド3枚</b>で構築します（同一カード最大3枚まで）。</p>
            <p style="margin: 4px 0;">・<b>ライフポイントの総数</b>: プレイヤーの総ライフは <b>「配置した全シールドの耐久値の合計 ＋ 最後のダイレクトアタック1回分」</b> です。</p>
            <p style="margin: 4px 0;">・シールドが全滅した状態で相手からダイレクトアタックを受けるか、山札切れ（ライブラリアウト）で負けとなります。</p>
          </div>
          <div style="margin-bottom: 18px;">
            <h3 style="color:#fbbf24; border-bottom: 1px solid rgba(251,191,36,0.3); padding-bottom: 6px;">2. 実装キーワード効果一覧</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; line-height: 1.5;">
              <div><b style="color:#fbbf24;">【速攻】</b>: 召喚ターンから攻撃可能</div>
              <div><b style="color:#fbbf24;">【挑発】</b>: 敵は最優先でこのユニットを攻撃</div>
              <div><b style="color:#fbbf24;">【連撃】</b>: 1回の攻撃宣言で2回ダメージ</div>
              <div><b style="color:#fbbf24;">【加護】</b>: 次の被ダメージ/破壊を1回無効化</div>
              <div><b style="color:#fbbf24;">【不屈】</b>: ダメージ受けても一度だけHP1で存続</div>
              <div><b style="color:#fbbf24;">【必殺】</b>: ダメージを与えた敵を即死させる</div>
              <div><b style="color:#fbbf24;">【貫通】</b>: 敵撃破時、過剰ダメージを本体へ</div>
              <div><b style="color:#fbbf24;">【吸命】</b>: 与ダメージ分だけ自HP回復</div>
              <div><b style="color:#fbbf24;">【潜伏】</b>: 攻撃するまで相手の攻撃/効果対象外</div>
              <div><b style="color:#fbbf24;">【覚醒】</b>: 特定属性レベル達成で能力発動</div>
              <div><b style="color:#fbbf24;">【逆転】</b>: 自分のシールド全滅時に真価発揮</div>
              <div><b style="color:#fbbf24;">【背水】</b>: 手札0枚の時に発動する能力</div>
              <div><b style="color:#fbbf24;">【狙撃】</b>: 前列ガードを無視して後衛/シールド攻撃</div>
              <div><b style="color:#fbbf24;">【共鳴】</b>: 特定カード/種族が場にいると強化</div>
              <div><b style="color:#fbbf24;">【沈黙】</b>: 対象のキーワード・効果を無効化</div>
              <div><b style="color:#fbbf24;">【連携】</b>: 他ユニット展開時に効果増幅</div>
              <div><b style="color:#fbbf24;">【先陣】</b>: 前列配置時にステータス向上</div>
              <div><b style="color:#fbbf24;">【後衛】</b>: 後列配置時に真価を発揮</div>
              <div><b style="color:#fbbf24;">【魔盾】</b>: 相手のスペル効果を受けない</div>
              <div><b style="color:#fbbf24;">【代償】</b>: 自傷ダメージ/コストを払って強力効果</div>
              <div><b style="color:#fbbf24;">【残響】</b>: 毎ターン開始時に発動する持続効果</div>
              <div><b style="color:#fbbf24;">【暴走】</b>: 攻撃可能時、強制的に攻撃を行う</div>
              <div><b style="color:#fbbf24;">【孤高】</b>: 自場に他ユニットがいない時強化</div>
              <div><b style="color:#fbbf24;">【復讐】</b>: 自ユニット破壊時にカウンター</div>
              <div><b style="color:#fbbf24;">【腐敗】</b>: ターン経過とともにHPが減少</div>
              <div><b style="color:#fbbf24;">【遺言】</b>: 破壊された瞬間に発動する効果</div>
            </div>
          </div>
        `;
      }
      helpOverlay.style.display = 'flex';
      if (window.audioManager) window.audioManager.playSE('click');
    });
  }

  if (btnCloseHelp && helpOverlay) {
    btnCloseHelp.addEventListener('click', () => {
      helpOverlay.style.display = 'none';
    });
  }

  if (helpOverlay) {
    helpOverlay.addEventListener('click', (e) => {
      if (e.target === helpOverlay) helpOverlay.style.display = 'none';
    });
  }
});

// ========== ★4レジェンダリーカード：ホログラフィック・ホイル座標追従グローバルデリゲーション ==========
document.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.rarity-4');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const px = (x / rect.width) * 100;
  const py = (y / rect.height) * 100;
  card.style.setProperty('--foil-x', `${px}%`);
  card.style.setProperty('--foil-y', `${py}%`);
});

document.addEventListener('pointerout', (e) => {
  const card = e.target.closest('.rarity-4');
  if (card && !card.contains(e.relatedTarget)) {
    card.style.setProperty('--foil-x', '50%');
    card.style.setProperty('--foil-y', '50%');
  }
});
