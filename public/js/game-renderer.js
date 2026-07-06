'use strict';

// \u5171\u6709\u3055\u308c\u308b\u30b2\u30fc\u30e0\u72b6\u614b\uff08\u30d5\u30a1\u30a4\u30eb\u3092\u8de8\u3044\u3067\u53c2\u7167\u53ef\u80fd\u306b\u3059\u308b\u305f\u3081 var \u3067\u5ba3\u8a00\uff09
var gameState = window.gameState || null;
var selectedCardIndex = window.selectedCardIndex || null;
var selectedAttacker = window.selectedAttacker || null;
 
 // \u3059\u3067\u306b\u63cf\u753b\u6e08\u307f\u306e\u30e6\u30cb\u30c3\u30c8ID\u3092\u4fdd\u6301\uff08\u30a2\u30cb\u30e1\u30fc\u30b7\u30e7\u30f3\u91cd\u8907\u9632\u6b62\uff09
 var seenInstanceIds = new Set();
 var isInitialRender = true;

// \u30de\u30b9\u30bf\u30c7\u30fc\u30bf\uff08keywords.csv\uff09\u306f game-client.js \u3067\u30d5\u30a7\u30c3\u30c1\u3055\u308c window.keywordMap \u306b\u683c\u7d0d\u3055\u308c\u307e\u3059\u3002

window.COLOR_CSS = window.COLOR_CSS || {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  white: '#e2e8f0',
  black: '#8b5cf6',
  neutral: '#6b7280',
};

window.COLOR_NAMES = window.COLOR_NAMES || {
  red: '\u8d64',
  blue: '\u9752',
  green: '\u7dd1',
  white: '\u767d',
  black: '\u9ed2',
  neutral: '\u7121',
};

function getKeywordDisplayName(kw) {
  if (kw.startsWith('search_')) {
    return `\u63a2\u7d22${kw.split('_')[1]}`;
  }
  const master = window.keywordMap && window.keywordMap[kw];
  return master ? master.name : kw;
}

function getKeywordDescription(kw) {
  const master = window.keywordMap && window.keywordMap[kw];
  return master ? master.description : '';
}

// カードの所持キーワードに基づいてアイコンバッジHTMLを生成する
function renderKeywordBadges(cardOrUnit) {
  const kws = [...(cardOrUnit.keywords || [])];
  if (cardOrUnit.barrierActive && !kws.includes('barrier')) kws.push('barrier');
  if (cardOrUnit.stealthActive && !kws.includes('stealth')) kws.push('stealth');
  if (cardOrUnit.endureActive && !kws.includes('endure')) kws.push('endure');
  
  if (kws.length === 0) return '';
  
  const kwMap = {
    taunt: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`, class: 'taunt', label: '挑発' },
    rush: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, class: 'rush', label: '速攻' },
    speed: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, class: 'rush', label: '速攻' },
    double_strike: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l3 3m-3 0l-3-3m5.5 1.5L7 4M6 9l-3 3m3 0l3-3m-4.5 1.5L17 20"/></svg>`, class: 'double-strike', label: '連撃' },
    stealth: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>`, class: 'stealth', label: '潜伏' },
    barrier: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`, class: 'barrier', label: '加護' },
    lethal: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 16 0c0 4.3-3.3 7-8 7s-8-2.7-8-7zM12 15v4M9 10h.01M15 10h.01"/></svg>`, class: 'lethal', label: '必殺' },
    drain: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>`, class: 'drain', label: '吸命' },
    spread: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fb923c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h4V4M6 8H2V4M2 16h4v4M22 16h-4v4M22 4L15 11M2 4l7 7M2 20l7-7M22 20l-7-7"/></svg>`, class: 'spread', label: '拡散' },
    decay: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`, class: 'decay', label: '腐敗' },
    endure: { icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V5a2 2 0 0 0-4 0v7M8 10V6a2 2 0 0 0-4 0v8a6 6 0 0 0 12 0v-5a2 2 0 0 0-4 0M16 12v-2a2 2 0 0 0-4 0"/></svg>`, class: 'endure', label: '不屈' },
  };

  let html = '<div class="card-keywords-badges">';
  kws.forEach(k => {
    const key = k.split(/[:_]/)[0];
    const info = kwMap[key];
    if (info) {
      html += `<span class="kw-icon-badge ${info.class}" title="${info.label}">${info.icon}</span>`;
    }
  });
  html += '</div>';
  return html;
}

// \u5171\u901a\u753b\u50cf\u30d1\u30b9\u751f\u6210\uff08ID\u30d7\u30ec\u30d5\u30a3\u30c3\u30af\u30b9\u306b\u3088\u308b\u30d5\u30a9\u30eb\u30c0\u7279\u5b9a\uff09
window.getCardImagePath = function(card) {
  if (!card) return '';
  const isShield = card.type === 'shield';
  const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
  const firstColor = colors[0].toLowerCase();
  const fileName = card.artId || card.cardId || card.id || 'unknown';
  const cleanId = String(fileName).split('_')[0]; // instanceId \u5bfe\u7b56
  const upperId = cleanId.toUpperCase();
  
  // 1. \u30c7\u30d5\u30a9\u30eb\u30c8\u5224\u5b9a
  let folder = firstColor === 'neutral' ? 'rainbow' : firstColor;

  // 2. ID\u30d7\u30ec\u30d5\u30a3\u30c3\u30af\u30b9\u306b\u3088\u308b\u5f37\u5236\u7279\u5b9a
  if (upperId.startsWith('RE') || upperId.startsWith('R')) folder = 'red';
  else if (upperId.startsWith('BK') || upperId.startsWith('KE') || upperId.startsWith('K')) folder = 'black';
  else if (upperId.startsWith('BE') || upperId.startsWith('B')) folder = 'blue';
  else if (upperId.startsWith('GE') || upperId.startsWith('G')) folder = 'green';
  else if (upperId.startsWith('WE') || upperId.startsWith('W')) folder = 'white';
  else if (upperId.startsWith('N')) folder = 'rainbow';
  else if (upperId.startsWith('T')) folder = 'token'; // トークン用
  
  return isShield
    ? `/assets/images/shields/${cleanId.replace('SH', 'S')}.webp?v=2`
    : `/assets/images/cards/${folder}/${cleanId}.webp?v=2`;
};

// 盤面描画
function renderBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  renderOpponentBoard(state, selectedCard, selectedAttacker, onSlotClick);
  renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick);
}

function renderOpponentBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  const container = document.getElementById('opponent-board');
  if (!container) return;
  container.innerHTML = '';

  const rows = ['back', 'front']; // 相手は奥が後列、手前が前列

  rows.forEach(row => {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = `board-row-wrapper opponent-${row}`;

    const label = document.createElement('div');
    label.className = `board-row-label ${row}-label`;
    label.textContent = row === 'front' ? 'FRONT LINE' : 'BACK LINE';
    rowWrapper.appendChild(label);

    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row opponent-${row}`;
    
    for (let lane = 0; lane < 3; lane++) {
      const board = (state.opponent && state.opponent.board) || {};
      const rowData = board[row] || [];
      const unit = rowData[lane];
      
      const slot = document.createElement('div');
      slot.className = `board-slot opponent ${row}`;
      slot.dataset.row = row;
      slot.dataset.lane = lane;
      
      if (unit) {
        slot.innerHTML = renderUnitCard(unit, false);
        const cardEl = slot.querySelector('.unit-card');
        if (cardEl) {
          attachCardDetailEvent(cardEl, unit);
          if (cardEl.classList.contains('unit-appear')) {
            if (window.VFX && window.VFX.playSummonEffect) {
              window.VFX.playSummonEffect(slot, unit.color);
            }
          }
        }
        
        if (selectedAttacker !== null) {
          slot.classList.add('can-attack');
          slot.addEventListener('click', () => onSlotClick('attack_unit', row, lane));
        } else if (selectedCard !== null && selectedCard.type === 'spell') {
          // \u30b9\u30da\u30eb\u4f7f\u7528\u6642\u306e\u6575\u30e6\u30cb\u30c3\u30c8\u30bf\u30fc\u30b2\u30c3\u30c8
          slot.classList.add('can-spell-target');
          slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
        }
      } else {
        slot.classList.add('empty');
        slot.textContent = ''; 
      }

      // \u5171\u901a\u306e\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba (\u6575\u9663)
      const isMyTurn = state.currentPlayerId === state.me.id;
      if (state.phase === 'targeting' && state.pendingAbilitySource && isMyTurn) {
        const source = state.pendingAbilitySource;
        const targetId = source.targetId || '';
        const isSummonToken = source.effect === 'summon_token';
        const isSelfTarget = targetId.includes('self');
        const needsEmpty = targetId.includes('empty');

        // self/empty/summon_token \u306f\u6575\u9663\u5bfe\u8c61\u5916
        const isSelectable = !isSelfTarget && !needsEmpty && !isSummonToken && !!unit;

        if (isSelectable) {
            slot.classList.add('can-target');
        } else {
            slot.classList.add('target-disabled');
        }
      }
      rowDiv.appendChild(slot);
    }
    rowWrapper.appendChild(rowDiv);
    container.appendChild(rowWrapper);
  });
}
function renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  // \u63cf\u753b\u958b\u59cb\u6642\u306b\u53e4\u3044\u6f14\u51fa\uff08\u30ed\u30c3\u30af\u30aa\u30f3\u6f14\u51fa\u306a\u3069\uff09\u3092\u5f37\u5236\u30af\u30ea\u30fc\u30f3\u30a2\u30c3\u30d7
  document.querySelectorAll('.is-locked-on').forEach(el => el.classList.remove('is-locked-on'));

  const container = document.getElementById('player-board');
  if (!container) return;
  container.innerHTML = '';
  const isMyTurn = state.currentPlayerId === state.me.id;
  
  // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba\u304b\u3069\u3046\u304b\u3092\u5148\u306b\u5224\u5b9a
  const isTargeting = state.phase === 'targeting' && state.pendingAbilitySource && (state.pendingAbilitySource.ownerId === state.me.id);
  if (isTargeting) {
    console.log('\ud83c\udfaf [RENDERER] Targeting phase detected! source:', JSON.stringify(state.pendingAbilitySource));
  }

  const rows = ['front', 'back']; // \u81ea\u5206\u306f\u624b\u524d\u304c\u524d\u5217\u3001\u5965\u304c\u5f8c\u5217

  rows.forEach(row => {
    const rowWrapper = document.createElement('div');
    rowWrapper.className = `board-row-wrapper player-${row}`;

    const label = document.createElement('div');
    label.className = `board-row-label ${row}-label`;
    label.textContent = row === 'front' ? 'FRONT LINE' : 'BACK LINE';
    rowWrapper.appendChild(label);

    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row player-${row}`;
    
    for (let lane = 0; lane < 3; lane++) {
      const board = (state.me && state.me.board) || {};
      const rowData = board[row] || [];
      const unit = rowData[lane];
      
      const slot = document.createElement('div');
      slot.className = `board-slot ${row}`;
      slot.dataset.row = row;
      slot.dataset.lane = lane;

      // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba\u4e2d\u306f\u3001\u901a\u5e38\u306e\u30ab\u30fc\u30c9\u914d\u7f6e\u30cf\u30f3\u30c9\u30e9\u3092\u4ed8\u3051\u306a\u3044
      if (isTargeting) {
        const source = state.pendingAbilitySource;
        const targetId = source.targetId || '';
        const isSummonToken = source.effect === 'summon_token';
        const isSelfTarget = targetId.includes('self');
        const needsEmpty = targetId.includes('empty');

        let isSelectable = false;
        if (isSummonToken || needsEmpty) {
            isSelectable = !unit;
        } else if (isSelfTarget || targetId === 'all_units') {
            isSelectable = !!unit || targetId === 'all_units';
        } else if (!isSelfTarget && unit) {
            // \u6575\u30bf\u30fc\u30b2\u30c3\u30c8\u306e\u5834\u5408\u306f\u81ea\u5206\u5074\u306f\u9078\u629e\u4e0d\u53ef
            isSelectable = false;
        }

        if (unit) {
          slot.innerHTML = renderUnitCard(unit, false); // \u30bf\u30fc\u30b2\u30c3\u30c8\u4e2d\u306f\u884c\u52d5\u4e0d\u53ef
          const cardEl = slot.querySelector('.unit-card');
          if (cardEl) {
            attachCardDetailEvent(cardEl, unit);
            if (cardEl.classList.contains('unit-appear')) {
              if (window.VFX && window.VFX.playSummonEffect) {
                window.VFX.playSummonEffect(slot, unit.color);
              }
            }
          }
        } else {
          slot.classList.add('empty');
        }

        if (isSelectable) {
            slot.classList.add('can-target');
            console.log(`\ud83c\udfaf [RENDERER] Slot ${row}/${lane} \u2192 can-target (empty=${!unit})`);
        } else {
            slot.classList.add('target-disabled');
        }
      } else {
        // \u901a\u5e38\u30d5\u30a7\u30fc\u30ba\u306e\u63cf\u753b
        if (unit) {
          const abilities = unit.abilities || [];
          const hasActivate = abilities.some(a => a.trigger === 'activate');
          const canAct = isMyTurn && !unit.hasActed && (unit.canAttack || hasActivate);
          
          slot.innerHTML = renderUnitCard(unit, canAct);
          
          const cardEl = slot.querySelector('.unit-card');
          if (cardEl) {
            attachCardDetailEvent(cardEl, unit);
            if (cardEl.classList.contains('unit-appear')) {
              if (window.VFX && window.VFX.playSummonEffect) {
                window.VFX.playSummonEffect(slot, unit.color);
              }
            }
          }
          
          if (canAct) {
            cardEl.addEventListener('pointerdown', (e) => onSlotClick('unit_pointerdown', row, lane, e));
            cardEl.style.cursor = 'grab';
          } else if (selectedCard !== null && selectedCard.type === 'spell') {
            slot.classList.add('can-spell-target');
            slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
          }
        } else {
          slot.classList.add('empty');
          if (selectedCard !== null && selectedCard.type === 'unit') {
            slot.classList.add('can-place');
            slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
          } else if (selectedCard !== null && selectedCard.type === 'spell') {
            slot.classList.add('can-spell-target');
            slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
          }
        }
      }
      rowDiv.appendChild(slot);
    }
    rowWrapper.appendChild(rowDiv);
    container.appendChild(rowWrapper);
  });
}
function renderUnitCard(unit, canAct) {
  const colors = unit.colors && unit.colors.length > 0 ? unit.colors : [unit.color || 'neutral'];
  const colorBorders = colors.map(c => COLOR_CSS[c] || COLOR_CSS.neutral);
  let borderStyle = `border-left: 4px solid ${colorBorders[0]};`;
  if (colorBorders.length > 1) {
    borderStyle = `border-left: 4px solid; border-image: linear-gradient(to bottom, ${colorBorders.join(', ')}) 1;`;
  }

  const isDamaged = unit.currentHp < unit.maxHp;
  const actedClass = unit.hasActed ? ' acted' : '';
  const canActClass = canAct ? ' can-act' : '';
  
  // 出現アニメーション判定
  let appearClass = '';
  if (unit.instanceId && !seenInstanceIds.has(unit.instanceId)) {
    if (!isInitialRender) {
      appearClass = ' unit-appear';
    }
    seenInstanceIds.add(unit.instanceId);
  }
  
  const bgImage = window.getCardImagePath(unit);
  
  // キーワード・状態の検出とクラス追加 (v138)
  const hasTaunt = unit.keywords && unit.keywords.includes('taunt');
  const isFrozen = unit.frozen === true;
  const tauntClass = hasTaunt ? ' has-taunt' : '';
  const frozenClass = isFrozen ? ' is-frozen' : '';
  const barrierClass = unit.barrierActive ? ' has-barrier' : '';
  const rarityClass = ` rarity-${unit.rarity || 1}`;
  
  const badgesHtml = renderKeywordBadges(unit);
  
  // バフ・デバフによる色付けクラス
  const atkClass = (unit.currentAttack > unit.attack) ? ' stat-buffed' : (unit.currentAttack < unit.attack ? ' stat-debuffed' : '');
  const hpClass = (unit.currentHp > unit.hp) ? ' stat-buffed' : (unit.currentHp < unit.hp ? ' stat-debuffed' : '');

  const foilShineHtml = (unit.rarity === 4) ? '<div class="foil-shine"></div>' : '';
  const frozenOverlayHtml = isFrozen ? '<div class="frozen-overlay"></div>' : '';
  
  return `
    <div class="unit-card${actedClass}${canActClass}${appearClass}${barrierClass}${tauntClass}${frozenClass}${rarityClass}" style="${borderStyle} background-image: url('${bgImage}'), url('/assets/images/ui/card_back.jpeg');">
      ${foilShineHtml}
      ${frozenOverlayHtml}
      <div class="card-overlay">
        ${badgesHtml}
        <div class="unit-stats">
          <div class="atk">
            <span class="val${atkClass}">${unit.currentAttack !== undefined ? unit.currentAttack : (unit.attack || 0)}</span>
          </div>
          <div class="hp">
            <span class="val${isDamaged ? ' damaged' : ''}${hpClass}">${unit.currentHp !== undefined ? unit.currentHp : (unit.hp || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.showCardDetail = function(card) {
  const overlay = document.getElementById('card-detail-overlay');
  if (!overlay) return;
  
  const getRarityName = (lvl) => {
    switch(parseInt(lvl)) {
      case 1: return 'Common';
      case 2: return 'Rare';
      case 3: return 'Majestic';
      case 4: return 'Legendary';
      default: return 'Common';
    }
  };

  overlay.style.display = 'flex';
  const isShield = card.type === 'shield';
  const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
  const firstColor = colors[0].toLowerCase();

  const bgImagePath = window.getCardImagePath(card);
  const imgEl = document.getElementById('cd-image');
  if (imgEl) {
    imgEl.style.backgroundImage = `url('${bgImagePath}')`;
    console.log(`[DEBUG] Final Logic: Name=${card.name}, ID=${card.id}, Path=${bgImagePath}`);
  }

  // \u8981\u7d20\u66f4\u65b0\u3092\u5b89\u5168\u306b\u884c\u3046
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) {
      // \n \u3068\u3044\u3046\u4e8c\u6587\u5b57\u306e\u6587\u5b57\u5217\u3092\u5b9f\u969b\u306e\u6539\u884c\u30b3\u30fc\u30c9\u306b\u5909\u63db
      const processedText = (text !== undefined ? text : '').toString().replace(/\\n/g, '\n');
      el.textContent = processedText;
    }
  };

  safeSetText('cd-name', card.name);
  const costEl = document.getElementById('cd-cost');
  if (costEl) {
    if (card.cost !== undefined) {
      costEl.style.display = 'flex';
      costEl.textContent = card.cost;
    } else {
      costEl.style.display = 'none';
    }
  }
  safeSetText('cd-type', (card.type || 'Unit').toUpperCase());
  
  // レアリティ表示
  const rarityEl = document.getElementById('cd-rarity');
  if (rarityEl) {
    const rarity = card.rarity || 1;
    rarityEl.textContent = getRarityName(rarity);
    // クラスをリセットしてから付与
    rarityEl.className = 'cd-rarity rarity-' + rarity;
  }
  
  // 神族（色）表示
  const tribeIcon = document.getElementById('cd-tribe-icon');
  const tribeText = document.getElementById('cd-tribe-text');

  if (tribeIcon && tribeText) {
    const parentTag = tribeIcon.parentElement;
    // ユーザー要望: テキストは不要、アイコンのみ表示
    tribeText.style.display = 'none';

    if (isShield) {
      if (parentTag && parentTag.classList.contains('cd-tribe-tag')) {
        parentTag.style.display = 'none';
      }
      tribeIcon.style.display = 'none';
    } else {
      if (parentTag && parentTag.classList.contains('cd-tribe-tag')) {
        parentTag.style.display = 'flex';
      }
      tribeIcon.style.display = 'block';
      const mainColor = firstColor;
      tribeIcon.style.backgroundImage = `url('/assets/images/icon/divine/${mainColor}.png')`;
    }
  }

  // ステータス表示
  const statsContainer = document.getElementById('cd-stats-container');
  if (statsContainer) {
    const cardType = (card.type || '').toLowerCase();
    if (cardType === 'unit') {
      statsContainer.style.display = 'flex';
      const atkEl = document.getElementById('cd-attack');
      const hpEl = document.getElementById('cd-hp');
      
      const currentAtk = card.currentAttack !== undefined ? card.currentAttack : (card.attack || 0);
      const currentHp = card.currentHp !== undefined ? card.currentHp : (card.hp || 0);
      
      if (atkEl) {
        atkEl.textContent = currentAtk;
        atkEl.className = (currentAtk > card.attack) ? 'stat-buffed' : (currentAtk < card.attack ? 'stat-debuffed' : '');
      }
      if (hpEl) {
        hpEl.textContent = currentHp;
        hpEl.className = (currentHp > card.hp) ? 'stat-buffed' : (currentHp < card.hp ? 'stat-debuffed' : '');
      }
    } else {
      statsContainer.style.display = 'none';
    }
  }

  // バニラ判定（能力もテキストもキーワードもシールドスキルもない場合）
  const isVanilla = (!card.text || card.text.trim() === '') &&
                    (!card.abilities || card.abilities.length === 0) &&
                    (!card.keywords || card.keywords.length === 0) &&
                    (!card.skill);

  const flavorEl = document.getElementById('cd-flavor');
  if (flavorEl) {
    if (isVanilla) {
      flavorEl.classList.add('is-vanilla');
    } else {
      flavorEl.classList.remove('is-vanilla');
    }
  }

  // テキスト・アビリティ表示
  const textEl = document.getElementById('cd-text');
  if (textEl) {
    if (isVanilla) {
      textEl.style.display = 'none';
    } else {
      textEl.style.display = 'block';
    }
    let mainText = '';
    if (card.text) {
      mainText = `<div class="cd-abilities-list"><div class="ability-item" style="border:none; background:transparent; padding:0;">${(card.text || '').replace(/\\n/g, '<br>')}</div></div>`;
    } else if (card.abilities && card.abilities.length > 0) {
      // \u30b7\u30fc\u30eb\u30c9\u3084\u30a2\u30d3\u30ea\u30c6\u30a3\u914d\u5217\u3092\u6301\u305f\u306a\u3044\u30ab\u30fc\u30c9
      if (card.skill) {
        mainText = card.skill.text || '';
      } else {
        mainText = (card.text || card.abilityEffect || '').replace(/\\n/g, '<br>');
      }
    }

    let kwHTML = '';
    const currentKws = [...(card.keywords || [])];
    if (card.barrierActive && !currentKws.includes('barrier')) currentKws.push('barrier');
    if (card.stealthActive && !currentKws.includes('stealth')) currentKws.push('stealth');
    if (card.endureActive && !currentKws.includes('endure')) currentKws.push('endure');
    
    if (currentKws.length > 0) {
      const validKws = currentKws.map(k => k.split(/[:_]/)[0]).filter(k => (window.keywordMap && window.keywordMap[k]));
      if (validKws.length > 0) {
        kwHTML = '<div class="cd-keywords-container">';
        validKws.forEach(kw => {
          const m = (window.keywordMap && window.keywordMap[kw]) || { name: kw, description: '' };
          kwHTML += `
            <div class="cd-keyword-tooltip-trigger">
              【${m.name || kw}】
              <span class="cd-keyword-tooltip-box">${m.description || ''}</span>
            </div>
          `;
        });
        kwHTML += '</div>';
      }
    }

    safeSetText('cd-flavor', card.flavorText || (card.skill ? card.skill.description : ''));
    
    // \u4fee\u6b63\u5c65\u6b74\uff08Modifiers\uff09\u306e\u8868\u793a
    let modHTML = '';
    if (card.modifiers && card.modifiers.length > 0) {
      modHTML += `
        <div class="cd-modifiers-container">
          <div class="cd-modifiers-title">\u30b9\u30c6\u30fc\u30bf\u30b9\u4fee\u6b63\u5c65\u6b74 (Modifications)</div>
          ${card.modifiers.map(m => {
            const valChar = m.value > 0 ? '+' : '';
            const valClass = m.value > 0 ? 'plus' : 'minus';
            const typeLabel = m.type === 'atk' ? '\u653b\u6483\u529b' : 'HP';
            return `
              <div class="modifier-item">
                <span class="modifier-source">${m.source}</span>
                <span class="modifier-value ${valClass}">${typeLabel} ${valChar}${m.value}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    
    if (mainText && !mainText.includes('<div')) {
      mainText = mainText.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    }
    textEl.innerHTML = mainText + kwHTML + modHTML;

    // --- \u53ec\u559a\u30c8\u30fc\u30af\u30f3\u30bb\u30af\u30b7\u30e7\u30f3\u306e\u8ffd\u52a0 ---
    const tokenAbilities = (card.abilities || []).filter(a => a.effect === 'summon_token');
    if (tokenAbilities.length > 0) {
      const tokenIds = [...new Set(tokenAbilities.map(a => a.tokenId || a.value))];
      const tokenCards = tokenIds.map(id => (window.allCards || []).find(c => c.id === id)).filter(Boolean);

      if (tokenCards.length > 0) {
        const tokenSection = document.createElement('div');
        tokenSection.className = 'cd-token-section';
        tokenSection.innerHTML = `
          <div class="cd-token-label">\ud83d\udce6 \u53ec\u559a\u30c8\u30fc\u30af\u30f3 (SUMMON TOKEN)</div>
          <div class="cd-token-list">
            ${tokenCards.map(tc => `
              <div class="cd-token-item" data-token-id="${tc.id}">
                <div class="cd-token-icon" style="background-image: url('${window.getCardImagePath(tc)}'), url('/assets/images/ui/card_back.jpeg')"></div>
                <div class="cd-token-name">${tc.name}</div>
                <div class="cd-token-stats">
                  <span class="atk-box">${tc.attack}</span>
                  <span class="hp-box">${tc.hp}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        textEl.appendChild(tokenSection);

        // クリックイベントの付与
        tokenSection.querySelectorAll('.cd-token-item').forEach(item => {
          item.onclick = (e) => {
            e.stopPropagation();
            const tid = item.dataset.tokenId;
            const tc = (window.allCards || []).find(c => c.id === tid);
            if (tc) window.showCardDetail(tc);
          };
        });
      }
    }
  }

  const closeBtn = document.getElementById('btn-close-detail');
  if (closeBtn) {
    closeBtn.onclick = () => { overlay.style.display = 'none'; };
  }
};

function attachCardDetailEvent(el, card) {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.showCardDetail(card);
  });

  // モバイル向け長押し判定 (500ms)
  let pressTimer;
  el.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => {
      window.showCardDetail(card);
    }, 500);
  }, { passive: true });
  el.addEventListener('touchend', () => clearTimeout(pressTimer));
  el.addEventListener('touchmove', () => clearTimeout(pressTimer));
}

function renderPlayerInfo(state, selectedAttacker) {
  if (!state || !state.me) return;

  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== undefined ? text : '';
  };

  safeSetText('my-name', state.me.name);
  // 自分のアバター表示
  const myAvatarEl = document.getElementById('my-avatar');
  if (myAvatarEl) {
    const avatarStr = String(state.me.avatar || '1');
    console.log(`[RENDERER] My Avatar State: "${state.me.avatar}", Rendering ID: "${avatarStr}"`);
    
    // 画像パスの生成 (1〜99 番の数値を想定)
    let avatarPath = `/assets/images/avatar/${avatarStr}.png`;
    
    // 数値でない、または特殊な文字列が含まれる場合のエラーガード (以前の仕様との互換性)
    if (isNaN(avatarStr) && avatarStr.includes('/')) {
        avatarPath = avatarStr;
    }

    if (avatarPath) {
      myAvatarEl.style.backgroundImage = `url('${avatarPath}')`;
      myAvatarEl.innerHTML = '';
      myAvatarEl.style.backgroundSize = 'cover';
      myAvatarEl.style.backgroundPosition = 'center';
      myAvatarEl.style.display = 'block';
    }
  }

  // プレイヤーのSP（霊力）表示を復旧
  const mySpOrbs = document.getElementById('my-sp-orbs');
  if (mySpOrbs) {
    mySpOrbs.innerHTML = '';
    const spValue = state.me.sp || 0;
    const orb = document.createElement('div');
    
    // SP変更アニメーション判定
    let flashClass = '';
    if (window.lastMySp !== undefined && window.lastMySp !== spValue) {
      flashClass = ' sp-change-flash';
    }
    window.lastMySp = spValue;

    orb.className = `sp-orb-display victory-glow${flashClass}`;
    orb.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      position: relative; z-index: 100;
    `;
    orb.innerHTML = `
      <div class="sp-label">SP</div>
      <div class="sp-value">${spValue}</div>
    `;
    mySpOrbs.appendChild(orb);

    if (flashClass) {
      setTimeout(() => {
        orb.classList.remove('sp-change-flash');
      }, 650);
    }
  }

  safeSetText('my-deck', state.me.deckCount);
  safeSetText('my-hand-count', state.me.hand.length);

  // 自分の墓地カウント更新
  const myGraveCount = (state.me.graveyard || []).length;
  safeSetText('my-grave', myGraveCount);
  // グローバルに最新の墓地データを保持（ビューワー参照用）
  window._gyData = { mine: state.me.graveyard || [], opp: state.opponent ? (state.opponent.graveyard || []) : [] };
  
  const myLifeEl = document.getElementById('my-life');
  if (myLifeEl) {
    const lastLife = parseInt(myLifeEl.getAttribute('data-last-life') || state.me.life || 7);
    const currentLife = state.me.life || 0;
    myLifeEl.textContent = currentLife;
    
    const parent = myLifeEl.closest('.avatar-life');
    if (parent) {
      const maxLife = 7;
      const percent = Math.max(0, Math.min(100, (currentLife / maxLife) * 100));
      parent.style.setProperty('--life-percent', percent);
      
      if (currentLife < lastLife) {
        parent.classList.remove('damaged-flash');
        void parent.offsetWidth; // Reflow to restart animation
        parent.classList.add('damaged-flash');
        if (window.audioManager) window.audioManager.playSE('avatar_damaged');
      }
    }
    myLifeEl.setAttribute('data-last-life', currentLife);
  }

  // 自分の神族レベル表示
  const tribeColors = ['red', 'blue', 'green', 'white', 'black'];
  const myTribes = document.getElementById('my-tribes');
  if (myTribes) {
    myTribes.innerHTML = '';
    tribeColors.forEach(color => {
      const level = (state.me.tribeLevels && state.me.tribeLevels[color]) || 0;
      const badge = document.createElement('div');
      badge.className = `tribe-badge tribe-${color}${level > 0 ? ' active' : ''}`;
      badge.style.backgroundImage = `url('/assets/images/icon/divine/${color}.png')`;
      badge.innerHTML = `<span class="level-text">${level}</span>`;
      myTribes.appendChild(badge);
    });
  }

  if (state.opponent) {
    safeSetText('opp-name', state.opponent.name);
    const oppAvatarEl = document.getElementById('opp-avatar');
    if (oppAvatarEl) {
      const oppAvatarStr = String(state.opponent.avatar || '1');
      const oppAvatarPath = `/assets/images/avatar/${oppAvatarStr}.png`;
      oppAvatarEl.style.backgroundImage = `url('${oppAvatarPath}')`;
      oppAvatarEl.innerHTML = '';
      oppAvatarEl.style.backgroundSize = 'cover';
      oppAvatarEl.style.backgroundPosition = 'center';
      oppAvatarEl.style.display = 'block';
    }
    
    // 相手側のSP表示を更新
    const oppSpOrbs = document.getElementById('opp-sp-orbs');
    if (oppSpOrbs) {
      oppSpOrbs.innerHTML = '';
      const spValue = state.opponent.sp || 0;
      const orb = document.createElement('div');
      
      // SP変更アニメーション判定
      let flashClass = '';
      if (window.lastOppSp !== undefined && window.lastOppSp !== spValue) {
        flashClass = ' sp-change-flash';
      }
      window.lastOppSp = spValue;

      orb.className = `sp-orb-display${flashClass}`;
      orb.style.cssText = `
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        position: relative; z-index: 100;
      `;
      orb.innerHTML = `
        <div class="sp-label sp-label--opp">SP</div>
        <div class="sp-value sp-value--opp">${spValue}</div>
      `;
      oppSpOrbs.appendChild(orb);

      if (flashClass) {
        setTimeout(() => {
          orb.classList.remove('sp-change-flash');
        }, 650);
      }
    }
    
    safeSetText('opp-hand', state.opponent.handCount);
    safeSetText('opp-deck', state.opponent.deckCount);
    // 相手の墓地カウント更新
    const oppGraveCount = (state.opponent.graveyard || []).length;
    safeSetText('opp-grave', oppGraveCount);
    const oppLifeEl = document.getElementById('opp-life');
    if (oppLifeEl) {
      const lastLife = parseInt(oppLifeEl.getAttribute('data-last-life') || state.opponent.life || 7);
      const currentLife = state.opponent.life || 0;
      oppLifeEl.textContent = currentLife;
      
      const parent = oppLifeEl.closest('.avatar-life');
      if (parent) {
        const maxLife = 7;
        const percent = Math.max(0, Math.min(100, (currentLife / maxLife) * 100));
        parent.style.setProperty('--life-percent', percent);
        
        if (currentLife < lastLife) {
          parent.classList.remove('damaged-flash');
          void parent.offsetWidth; // Reflow
          parent.classList.add('damaged-flash');
          if (window.audioManager) window.audioManager.playSE('avatar_damaged');
        }
      }
      oppLifeEl.setAttribute('data-last-life', currentLife);
    }

    // 相手側の神族レベル表示
    const oppTribes = document.getElementById('opp-tribes');
    if (oppTribes) {
      oppTribes.innerHTML = '';
      tribeColors.forEach(color => {
        const level = (state.opponent.tribeLevels && state.opponent.tribeLevels[color]) || 0;
        const badge = document.createElement('div');
        badge.className = `tribe-badge tribe-${color}${level > 0 ? ' active' : ''}`;
        badge.style.backgroundImage = `url('/assets/images/icon/divine/${color}.png')`;
        badge.innerHTML = `<span class="level-text">${level}</span>`;
        oppTribes.appendChild(badge);
      });
    }
    renderOpponentShields('opp-shields', state.opponent, selectedAttacker);
  }
}

function renderShields(state, selectedAttacker) {
  if (!state || !state.me) return;
  
  // 自分のシールド描画（ここでは攻撃対象ではないため selectedAttacker は未使用）
  const container = document.getElementById('my-shields');
  if (container) {
    container.innerHTML = '';
    const shields = state.me.shields || [];
    shields.forEach(shield => {
      const el = document.createElement('div');
    const rarityClass = shield.rarity ? ` rarity-${shield.rarity}` : ' rarity-1';
    el.className = `shield-gem${shield.destroyed ? ' destroyed' : ''}${rarityClass}`;
      if (!shield.destroyed) {
        const dur = document.createElement('div');
        dur.className = 'shield-durability-overlay';
        dur.textContent = `${shield.currentDurability}`;
        el.appendChild(dur);
      }
      attachCardDetailEvent(el, shield);
      container.appendChild(el);
    });
  }

  // 相手のシールド描画
  if (state.opponent) {
    renderOpponentShields('opp-shields', state.opponent, selectedAttacker);
  }
}

function renderOpponentShields(containerId, opponent, selectedAttacker) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // 攻撃選択中ならコンテナに can-attack を付与（矢印のスナップ用）
  if (selectedAttacker !== null) {
    container.classList.add('can-attack');
  } else {
    container.classList.remove('can-attack');
  }

  const totalShields = 3;
  const destroyed = opponent.shieldsDestroyed || 0;
  for (let i = 0; i < totalShields; i++) {
    const el = document.createElement('div');
    el.className = i < destroyed ? 'shield-gem destroyed' : 'shield-gem hidden';
    container.appendChild(el);
  }
}

function renderHand(state, selectedCardIndex, onCardClick) {
  const container = document.getElementById('hand-cards');
  if (!container) return;
  container.innerHTML = '';
  const isMyTurn = state.currentPlayerId === state.me.id;
  const hand = state.me.hand || [];
  const handCount = hand.length;
  const maxAngle = Math.min(40, handCount * 8);

  const prevHandInstanceIds = window.prevHandInstanceIds || [];
  const currentHandInstanceIds = [];

  // --- シングルトン ツールチップ DOM を初期化（なければ作成）---
  if (!document.getElementById('hand-card-tooltip')) {
    const tip = document.createElement('div');
    tip.id = 'hand-card-tooltip';
    tip.innerHTML = '<div class="hct-inner"></div>';
    document.body.appendChild(tip);
  }
  const tooltip = document.getElementById('hand-card-tooltip');
  let hoverTimer = null;

  const buildTooltipHTML = (card) => {
    const bgImage = window.getCardImagePath(card);
    const isUnit  = (card.type || '').toLowerCase() === 'unit';
    const rarity  = card.rarity || 1;
    const type    = (card.type || 'UNIT').toUpperCase();
    const kws     = card.keywords || [];
    const rawText = (card.text || (card.skill ? card.skill.text : '') || '').replace(/\\n/g, '\n');

    const statsHTML = isUnit ? `
      <div class="hct-stats">
        <div class="hct-stat-gem atk">${card.attack || 0}</div>
        <div class="hct-stat-gem hp">${card.hp || 0}</div>
      </div>` : '';

    const kwHTML = kws.length > 0
      ? `<div class="hct-keywords">${kws.map(k => {
          const kname = (window.keywordMap && window.keywordMap[k]) ? window.keywordMap[k].name : k;
          return `<span class="hct-keyword">${kname}</span>`;
        }).join('')}</div>`
      : '';

    return `
      <div class="hct-image" style="background-image:url('${bgImage}'),url('/assets/images/ui/card_back.jpeg')">
        ${card.cost !== undefined ? `<div class="hct-cost">${card.cost}</div>` : ''}
      </div>
      <div class="hct-name">${card.name || ''}</div>
      <div class="hct-meta">
        <span class="hct-type">${type}</span>
        <span class="hct-rarity-dot hct-rarity-${rarity}"></span>
      </div>
      ${statsHTML}
      ${rawText ? `<div class="hct-divider"></div><div class="hct-text">${rawText}</div>` : ''}
      ${kwHTML}
      <div class="hct-hint">右クリック / 長押し で詳細</div>
    `;
  };

  const showTooltip = (card, el) => {
    tooltip.querySelector('.hct-inner').innerHTML = buildTooltipHTML(card);

    // カードの位置を取得してツールチップ配置を決定
    const rect = el.getBoundingClientRect();
    const TIP_W = 280;
    const TIP_GAP = 14; // カードとの隙間
    const leftSpace = rect.left;
    const rightSpace = window.innerWidth - rect.right;

    // 左に置けるなら左、置けないなら右
    const placeRight = leftSpace < TIP_W + TIP_GAP;
    let tipLeft, tipTop;

    if (placeRight) {
      tipLeft = rect.right + TIP_GAP;
      tooltip.classList.remove('flip-right');
      tooltip.classList.add('flip-right'); // 右方向スライドイン
    } else {
      tipLeft = rect.left - TIP_W - TIP_GAP;
      tooltip.classList.remove('flip-right');
    }

    // 縦位置: カード上辺に合わせ、はみ出ないよう調整
    const tipHeight = 380; // 概算
    tipTop = Math.min(rect.top, window.innerHeight - tipHeight - 10);
    tipTop = Math.max(10, tipTop);

    tooltip.style.left = `${tipLeft}px`;
    tooltip.style.top  = `${tipTop}px`;
    tooltip.classList.add('visible');
  };

  const hideTooltip = () => {
    clearTimeout(hoverTimer);
    tooltip.classList.remove('visible');
  };
  
  hand.forEach((card, index) => {
    if (!card) return;
    const instanceId = card.instanceId || card.id;
    currentHandInstanceIds.push(instanceId);

    const isNewCard = !prevHandInstanceIds.includes(instanceId);

    const myLevels = state.me.tribeLevels || {};
    const cardColors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const hasTribeLevel = cardColors.every(col => (myLevels[col] || 0) >= (card.cost || 0));
    const canPlay = isMyTurn && (state.me.sp || 0) >= (card.cost || 0) && hasTribeLevel;
    
    const el = document.createElement('div');
    el.dataset.index = index; // かき分け用のインデックス付与
    // 属性の第一カラーを取得してオーラクラスを付与
    const firstColor = cardColors[0] ? cardColors[0].toLowerCase() : 'neutral';
    const rarityClass = ` rarity-${card.rarity || 1}`;
    const drawAnimClass = isNewCard ? ' draw-in-anim' : '';
    el.className = `hand-card aura-${firstColor}${selectedCardIndex === index ? ' selected' : ''}${!canPlay ? ' unplayable' : ''}${rarityClass}${drawAnimClass}`;
    
    const offset = handCount > 1 ? (index - (handCount - 1) / 2) : 0;
    const angle = handCount > 1 ? offset * (maxAngle / ((handCount - 1) || 1)) : 0;
    const translateX = offset * 60;
    const translateY = Math.abs(offset) * 15;
    el.style.transform = `translateX(${translateX}px) rotate(${angle}deg) translateY(${translateY}px)`;
    
    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const colorBorders = colors.map(c => COLOR_CSS[c] || '#666');
    const bgImage = window.getCardImagePath(card);
    el.style.backgroundImage = `url('${bgImage}'), url('/assets/images/ui/card_back.jpeg')`;
    el.style.borderLeft = `4px solid ${colorBorders[0]}`;

    const costGemHtml = (card.cost !== undefined) ? `<div class="cost-gem">${card.cost}</div>` : '';
    const badgesHtml = ''; // 手札には能力バッジを一切表示せず、美麗なイラストを100%フル表示で見せる！

    const foilShineHtml = (card.rarity === 4) ? '<div class="foil-shine"></div>' : '';
    el.innerHTML = `
      ${foilShineHtml}
      <div class="card-overlay">
        ${costGemHtml}
      </div>
    `;

    // 3Dチルト ＆ スムーズなインタラクション（かき分けエフェクト付き）の実装
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      const angleX = -((y - yc) / yc) * 15; // 最大15度傾く
      const angleY = ((x - xc) / xc) * 15;

      const hoveredIndex = index;
      const allHandCards = container.querySelectorAll('.hand-card');
      
      allHandCards.forEach((c) => {
        const cIndex = parseInt(c.dataset.index);
        const cOffset = handCount > 1 ? (cIndex - (handCount - 1) / 2) : 0;
        const cAngle = handCount > 1 ? cOffset * (maxAngle / ((handCount - 1) || 1)) : 0;
        const cTranslateX = cOffset * 60;
        const cTranslateY = Math.abs(cOffset) * 15;

        if (cIndex === hoveredIndex) {
          // ホバー中のカード：大きく拡大して上に持ち上げる
          c.style.transform = `translateX(${cTranslateX}px) rotate(${cAngle}deg) translateY(${cTranslateY - 45}px) scale(1.28) perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
          c.style.zIndex = '999';
        } else if (cIndex < hoveredIndex) {
          // ホバーされたカードより左側のカード：左にスライドし、少し傾ける
          c.style.transform = `translateX(${cTranslateX - 25}px) rotate(${cAngle - 6}deg) translateY(${cTranslateY + 5}px) scale(0.95)`;
          c.style.zIndex = '90';
        } else {
          // ホバーされたカードより右側のカード：右にスライドし、少し傾ける
          c.style.transform = `translateX(${cTranslateX + 25}px) rotate(${cAngle + 6}deg) translateY(${cTranslateY + 5}px) scale(0.95)`;
          c.style.zIndex = '90';
        }
      });

      if (card.rarity === 4) {
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        el.style.setProperty('--foil-x', `${px}%`);
        el.style.setProperty('--foil-y', `${py}%`);

        // パララックス用の変位
        const parallaxX = ((x - xc) / xc) * 8;
        const parallaxY = ((y - yc) / yc) * 8;
        
        const overlay = el.querySelector('.card-overlay');
        if (overlay) {
          overlay.style.transform = `translate3d(${-parallaxX * 1.2}px, ${-parallaxY * 1.2}px, 15px)`;
        }
        const foil = el.querySelector('.foil-shine');
        if (foil) {
          foil.style.transform = `translate3d(${parallaxX * 1.8}px, ${parallaxY * 1.8}px, 25px)`;
        }
      }

      // ホバー開始から 0.7秒後にツールチップを表示（タイマー重複防止）
      if (!hoverTimer) {
        hoverTimer = setTimeout(() => {
          showTooltip(card, el);
        }, 700);
      }
    });

    el.addEventListener('pointerleave', () => {
      const allHandCards = container.querySelectorAll('.hand-card');
      allHandCards.forEach((c) => {
        const cIndex = parseInt(c.dataset.index);
        const cOffset = handCount > 1 ? (cIndex - (handCount - 1) / 2) : 0;
        const cAngle = handCount > 1 ? cOffset * (maxAngle / ((handCount - 1) || 1)) : 0;
        const cTranslateX = cOffset * 60;
        const cTranslateY = Math.abs(cOffset) * 15;
        
        c.style.transform = `translateX(${cTranslateX}px) rotate(${cAngle}deg) translateY(${cTranslateY}px) scale(1) rotateX(0deg) rotateY(0deg)`;
        c.style.zIndex = '';
        
        const overlay = c.querySelector('.card-overlay');
        if (overlay) overlay.style.transform = 'translate3d(0, 0, 0)';
        const foil = c.querySelector('.foil-shine');
        if (foil) foil.style.transform = 'translate3d(0, 0, 0)';
      });

      if (card.rarity === 4) {
        el.style.setProperty('--foil-x', '50%');
        el.style.setProperty('--foil-y', '50%');
      }

      hideTooltip();
      hoverTimer = null;
    });

    if (canPlay) {
      el.onpointerdown = (e) => { if (onCardClick) onCardClick(e, index); };
    }
    attachCardDetailEvent(el, card);
    container.appendChild(el);
  });

  // グローバル変数に今回の手札IDリストを保存 (v138)
  window.prevHandInstanceIds = currentHandInstanceIds;
}


function renderLogs(logs) {
  const container = document.getElementById('log-content');
  if (!container) return;
  container.innerHTML = '';
  logs.forEach(log => {
    // 開発用のシステム生デバッグログは非表示にし、チープさを一掃
    if (log.includes('[CLIENT]') || log.includes('[RENDER]') || log.includes('[AUDIO]')) return;
    
    const el = document.createElement('div');
    el.className = 'log-entry';
    
    // "[GameEngine] " などの接頭辞を除去し、ゲーム世界観に馴染む日本語のみを抽出
    let cleanedLog = log.replace(/^\[GameEngine\]\s*/i, '');
    
    el.textContent = cleanedLog;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function renderTurnInfo(state) {
  const isMyTurn = state.currentPlayerId === state.me.id;
  const indicator = document.getElementById('turn-indicator');
  if (indicator) {
    indicator.innerHTML = `<div class="turn-number">TURN ${state.turnNumber}</div><div class="turn-phase">${isMyTurn ? 'YOUR TURN' : "ENEMY'S TURN"}</div>`;
  }
  const endBtn = document.getElementById('btn-end-turn');
  if (endBtn) {
    endBtn.disabled = !isMyTurn;
    endBtn.style.opacity = '';
    if (isMyTurn) {
      endBtn.classList.add('my-turn');
      endBtn.classList.remove('opp-turn');
      endBtn.textContent = 'TURN END';
    } else {
      endBtn.classList.remove('my-turn');
      endBtn.classList.add('opp-turn');
      endBtn.textContent = 'ENEMY TURN';
    }
  }
}

window.updateUI = function() {
  const state = window.gameState;
  if (!state || !state.me) {
    console.log('\u23f3 [RENDER] updateUI: No state yet');
    return;
  }
  
  // \u30c7\u30fc\u30bf\u306e\u6975\u9650\u6b63\u898f\u5316\uff08\u6b20\u843d\u3057\u3066\u3044\u3066\u3082\u63cf\u753b\u3092\u7d99\u7d9a\uff09
  try {
    state.me.hand = state.me.hand || [];
    state.me.board = state.me.board || { front: [null,null,null], back: [null,null,null] };
    state.opponent = state.opponent || { 
      name: 'OPPONENT', 
      sp: 0, 
      hand: [], 
      board: { front: [null,null,null], back: [null,null,null] },
      shields: [] 
    };
    state.logs = state.logs || [];
  } catch (e) {
    console.warn('\u26a0\ufe0f [RENDER] Data normalization failed:', e.message);
  }

  try {
    const selIndex = window.selectedCardIndex;
    const selectedCard = (selIndex !== null && state.me.hand && state.me.hand[selIndex]) ? state.me.hand[selIndex] : null;
    const attacker = window.selectedAttacker;
    const slotClickHandler = window.handleSlotClick;

    // \u5404\u30d1\u30fc\u30c4\u3092\u72ec\u7acb\u3057\u3066\u63cf\u753b\uff08\u4e00\u3064\u304c\u6b7b\u3093\u3067\u3082\u4ed6\u3092\u751f\u304b\u3059\uff09
    try { renderPlayerInfo(state, attacker); } catch (e) { console.error('\u274c renderPlayerInfo error:', e); }
    try { renderHand(state, selIndex, window.handleCardPointerDown); } catch (e) { console.error('\u274c renderHand error:', e); }
    try { renderBoard(state, selectedCard, attacker, slotClickHandler); } catch (e) { console.error('\u274c renderBoard error:', e); }
    try { renderShields(state, attacker); } catch (e) { console.error('\u274c renderShields error:', e); }
    try { renderLogs(state.logs); } catch (e) { console.error('\u274c renderLogs error:', e); }
    try { renderTurnInfo(state); } catch (e) { console.error('\u274c renderTurnInfo error:', e); }
    
    if (typeof window.onUpdateUIHook === 'function') {
      try { window.onUpdateUIHook(); } catch (e) {}
    }

    // --- \u30bf\u30fc\u30f3\u958b\u59cb\u6f14\u51fa\uff08\u30b9\u30d7\u30e9\u30c3\u30b7\u30e5\uff09 ---
    // \u30bf\u30fc\u30f3\u6570\u307e\u305f\u306f\u624b\u756a\u30d7\u30ec\u30a4\u30e4\u30fc\u304c\u5909\u308f\u3063\u305f\u77ac\u9593\u306b\u4e00\u5ea6\u3060\u3051\u8868\u793a
    if (state.phase === 'main' || state.phase === 'mulligan') {
      if (state.turnNumber !== window.lastTurnNumber || state.currentPlayerId !== window.lastTurnPlayerId) {
        const splashPremium = document.getElementById('turn-splash-premium');
        const emblem = document.getElementById('turn-emblem');
        const emblemText = document.getElementById('emblem-text');
        
        if (splashPremium && emblem && emblemText) {
          const isMyTurn = state.currentPlayerId === state.me.id;
          emblemText.textContent = isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN";
          if (isMyTurn) {
            emblemText.classList.remove('opponent');
          } else {
            emblemText.classList.add('opponent');
          }
          
          splashPremium.style.display = 'flex';
          emblem.classList.remove('enter', 'exit');
          
          // リフロー
          void emblem.offsetWidth;
          
          emblem.classList.add('enter');
          
          if (window.audioManager) {
            window.audioManager.playSE(isMyTurn ? 'levelUp' : 'click');
          }
          
          // 黄金の火花（CSSパーティクル）の放出演出
          spawnTurnParticles(isMyTurn);

          setTimeout(() => {
            emblem.classList.add('exit');
            setTimeout(() => {
              splashPremium.style.display = 'none';
              emblem.classList.remove('enter', 'exit');
            }, 400);
          }, 2000);
        }
        window.lastTurnNumber = state.turnNumber;
        window.lastTurnPlayerId = state.currentPlayerId;
      }
    }

    // \u624b\u672d\u4e0a\u9650\u7834\u68c4\u30d5\u30a7\u30fc\u30ba\u306e\u30c1\u30a7\u30c3\u30af
    if (state.phase === 'discarding' && state.currentPlayerId === state.me.id) {
      const needed = state.me.hand.length - 7; // MAX_HAND_SIZE = 7
      if (needed > 0) {
        showDiscardModal(state.me.hand, needed);
      }
    } else if (document.getElementById('discard-overlay')) {
      document.getElementById('discard-overlay').style.display = 'none';
    }

    // --- 対戦終了（リザルト演出） ---
    const resultOverlay = document.getElementById('result-overlay');
    if (state.phase === 'game_over') {
      const isWinner = state.winner === state.me.id;
      const header  = document.getElementById('result-header');
      const subtitle = document.getElementById('result-subtitle');
      const crystal = document.getElementById('result-crystal');
      const bgLayer = document.getElementById('result-bg-layer');
      
      if (resultOverlay) {
        resultOverlay.style.display = 'flex';
        resultOverlay.className = 'overlay result-overlay ' + (isWinner ? 'victory' : 'defeat');
      }

      if (bgLayer) bgLayer.className = 'result-bg-layer ' + (isWinner ? 'victory' : 'defeat');

      if (header) {
        header.className = 'result-title ' + (isWinner ? 'victory' : 'defeat');
        header.textContent = isWinner ? 'VICTORY' : 'DEFEAT';
      }

      if (subtitle) {
        subtitle.textContent = isWinner
          ? '— 完全勝利 —'
          : '— 敗北 —';
        subtitle.className = 'result-subtitle ' + (isWinner ? 'victory' : 'defeat');
      }

      // 統計情報の表示
      const stats = document.getElementById('result-stats');
      if (stats) {
        const turns    = state.turnNumber || state.turn || 1;
        const myLife   = state.me.life ?? 0;
        const oppLife  = state.opponent ? (state.opponent.life ?? 0) : 0;
        const myShieldsBroken  = state.me.shieldsDestroyed || 0;
        const oppShieldsBroken = state.opponent ? (state.opponent.shieldsDestroyed || 0) : 0;

        stats.innerHTML = `
          <div class="result-stat-grid">
            <div class="result-stat-item">
              <div class="result-stat-label">TURNS</div>
              <div class="result-stat-value">${turns}</div>
            </div>
            <div class="result-stat-item">
              <div class="result-stat-label">FINAL LIFE</div>
              <div class="result-stat-value ${myLife <= 2 ? 'danger' : ''}">${myLife}</div>
            </div>
            <div class="result-stat-item">
              <div class="result-stat-label">SHIELDS BROKEN</div>
              <div class="result-stat-value accent">${oppShieldsBroken}</div>
            </div>
            <div class="result-stat-item">
              <div class="result-stat-label">SHIELDS LOST</div>
              <div class="result-stat-value muted">${myShieldsBroken}</div>
            </div>
          </div>
        `;
      }

      // 商業級ダイナミックVFXの実行（一度だけ起動）
      if (!window.gameOverVfxStarted) {
        window.gameOverVfxStarted = true;
        
        if (crystal) {
          crystal.style.opacity = '1';
          crystal.classList.remove('enter');
          void crystal.offsetWidth;
          crystal.classList.add('enter');
        }

        if (isWinner) {
          // 黄金の物理紙吹雪
          spawnVictoryConfetti();
        } else {
          // 石板＆クリスタル粉砕
          spawnDefeatShatter();
        }

        // 極限パーティクル演出 (v139)
        if (window.VFX && window.VFX.playGameOverParticles) {
          window.VFX.playGameOverParticles(isWinner);
        }
      }

      // BGM再生
      if (!window.resultBgmPlayed) {
        if (window.audioManager) {
          window.audioManager.playBGM(isWinner ? 'victory' : 'defeat', false);
        }
        window.resultBgmPlayed = true;
      }
    } else {
      if (resultOverlay) resultOverlay.style.display = 'none';
      window.resultBgmPlayed = false;
      window.gameOverVfxStarted = false;
    }


    // --- シールドブレイク演出オーバーレイ ---
    const sbOverlay = document.getElementById('shield-break-overlay');
    if (sbOverlay) {
      if (state.phase === 'shield_break_anim' && state.pendingShieldBreak) {
        if (sbOverlay.style.display !== 'flex') {
          const shield = state.pendingShieldBreak.shield;
          
          // 破片が飛び散る物理パーティクルの発射！
          let targetDom = null;
          
          // 自分のシールドから一致するものを探す
          const myShieldIndex = (state.me.shields || []).findIndex(s => s.id === shield.id);
          if (myShieldIndex !== -1) {
            const myShieldsContainer = document.getElementById('my-shields');
            if (myShieldsContainer) {
              const gems = myShieldsContainer.querySelectorAll('.shield-gem');
              if (gems[myShieldIndex]) {
                targetDom = gems[myShieldIndex];
              }
            }
          } else {
            // 相手のシールドとみなす
            const oppShieldsContainer = document.getElementById('opp-shields');
            if (oppShieldsContainer) {
              const destroyedCount = state.opponent.shieldsDestroyed || 0;
              const gems = oppShieldsContainer.querySelectorAll('.shield-gem');
              const targetIdx = Math.max(0, destroyedCount - 1);
              if (gems[targetIdx]) {
                targetDom = gems[targetIdx];
              } else {
                targetDom = oppShieldsContainer;
              }
            }
          }
          
          if (targetDom) {
            const rect = targetDom.getBoundingClientRect();
            const container = document.getElementById('game-container');
            const containerRect = container.getBoundingClientRect();
            const scale = containerRect.width / 1920;
            const x = (rect.left + rect.width / 2 - containerRect.left) / scale;
            const y = (rect.top + rect.height / 2 - containerRect.top) / scale;
            
            if (window.triggerShieldBreakVFX) {
              window.triggerShieldBreakVFX(x, y);
            }
          }

          // VFXエンジンの高度なフリップ・演出関数を呼び出す
          if (window.VFX && window.VFX.playShieldBreakEffect) {
            window.VFX.playShieldBreakEffect(shield);
          } else {
            // フォールバック
            const nameEl = document.getElementById('sb-card-name');
            const effectEl = document.getElementById('sb-trigger-effect');
            if (nameEl) nameEl.textContent = shield.name;
            if (effectEl) effectEl.textContent = shield.skill ? (shield.skill.desc || shield.skill.text || '能力発動！') : '効果なし';
            const sbCard = document.getElementById('sb-card-image');
            if (sbCard) {
              sbCard.style.backgroundImage = `url('/assets/images/cards/${shield.id}.webp')`;
            }
            sbOverlay.classList.remove('sb-exit');
            sbOverlay.classList.add('sb-enter');
            sbOverlay.style.display = 'flex';
          }
          
          if (window.audioManager) {
            window.audioManager.playSE('shield_break');
          }
        }
      } else {
        if (sbOverlay.style.display === 'flex') {
           sbOverlay.style.display = 'none';
           sbOverlay.classList.remove('sb-enter');
           const cardWrapper = document.getElementById('sb-card-wrapper');
           if (cardWrapper) cardWrapper.classList.remove('flipped');
        }
      }
    }

    // --- \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u4e2d\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4 ---
    const instructionDiv = document.getElementById('targeting-instruction');
    if (instructionDiv) {
        if (state.phase === 'targeting' && state.pendingAbilitySource && state.pendingAbilitySource.ownerId === state.me.id) {
            const source = state.pendingAbilitySource;
            const name = source ? source.unitName : 'ユニット';
            const isSummon = source && (source.effect === 'summon_token' || (source.targetId && source.targetId.includes('empty')));
            const isSacrifice = source && source.effect === 'sacrifice_destruction';
            let subtitle = '対象を選択してください';
            if (isSummon) subtitle = 'トークンの召喚場所を選択してください';
            if (isSacrifice) subtitle = '代償（生け贄）にする味方ユニットを選択してください';
            
            instructionDiv.innerHTML = `
                <div class="targeting-message">
                    【${name}】のアビリティ発動<br>
                    <span style="font-size: 24px; color: #fff;">${subtitle}</span>
                </div>
            `;
            instructionDiv.style.display = 'flex';
        } else {
            instructionDiv.style.display = 'none';
        }
    }
    isInitialRender = false;
  } catch (e) {
    console.error('\ud83d\udca5 [RENDER] FATAL: Critical Render Protection triggered:', e);
  }
};

/**
 * \u624b\u672d\u7834\u68c4\u30e2\u30fc\u30c0\u30eb\u306e\u8868\u793a\u3068\u9078\u629e\u30ed\u30b8\u30c3\u30af
 */
function showDiscardModal(hand, neededCount) {
  const overlay = document.getElementById('discard-overlay');
  const container = document.getElementById('discard-cards');
  const msg = document.getElementById('discard-message');
  const btn = document.getElementById('btn-discard-confirm');
  
  if (overlay.style.display === 'flex') return; // \u3059\u3067\u306b\u958b\u3044\u3066\u3044\u308c\u3070\u4f55\u3082\u3057\u306a\u3044

  overlay.style.display = 'flex';
  msg.textContent = `\u624b\u672d\u304c\u4e0a\u9650 (${hand.length}/7) \u3092\u8d85\u3048\u3066\u3044\u307e\u3059\u3002\u3042\u3068 ${neededCount} \u679a\u9078\u3093\u3067\u6368\u3066\u3066\u304f\u3060\u3055\u3044\u3002`;
  container.innerHTML = '';
  
  const selectedIndices = [];
  
  // \u65e7\u30dc\u30bf\u30f3\u3092\u30af\u30ed\u30fc\u30f3\u3057\u3066\u5dee\u3057\u66ff\u3048\uff08\u30a4\u30d9\u30f3\u30c8\u306e\u91cd\u8907\u767b\u9332\u9632\u6b62\uff09
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  // \u6700\u65b0\u306e\u30dc\u30bf\u30f3(newBtn)\u306e\u72b6\u614b\u3092\u66f4\u65b0\u3059\u308b\u95a2\u6570
  const updateButtonState = () => {
    const remaining = neededCount - selectedIndices.length;
    if (remaining === 0) {
      newBtn.disabled = false;
      newBtn.textContent = '\u9078\u629e\u3057\u305f\u30ab\u30fc\u30c9\u3092\u6368\u3066\u308b';
      newBtn.style.opacity = '1';
      newBtn.style.filter = 'none';
      newBtn.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.8)';
      msg.textContent = '\u679a\u6570\u304c\u63c3\u3044\u307e\u3057\u305f\u3002\u78ba\u5b9a\u30dc\u30bf\u30f3\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002';
      msg.style.color = '#10b981'; 
    } else {
      newBtn.disabled = true;
      newBtn.textContent = `\u3042\u3068 ${remaining} \u679a\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044`;
      newBtn.style.opacity = '0.4';
      newBtn.style.boxShadow = 'none';
      msg.textContent = `\u624b\u672d\u304c\u4e0a\u9650\u3092\u8d85\u3048\u3066\u3044\u307e\u3059\u3002\u3042\u3068 ${remaining} \u679a\u9078\u3093\u3067\u6368\u3066\u3066\u304f\u3060\u3055\u3044\u3002`;
      msg.style.color = '#f43f5e';
    }
  };

  hand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'hand-card';
    cardEl.innerHTML = renderUnitCard(card, true); 
    cardEl.dataset.index = index;

    cardEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedIndices.includes(index)) {
        const pos = selectedIndices.indexOf(index);
        selectedIndices.splice(pos, 1);
        cardEl.classList.remove('selected-to-discard');
      } else {
        if (selectedIndices.length < neededCount) {
          selectedIndices.push(index);
          cardEl.classList.add('selected-to-discard');
        }
      }
      updateButtonState();
    });

    container.appendChild(cardEl);
  });

  newBtn.addEventListener('click', () => {
    if (selectedIndices.length === neededCount) {
      if (typeof window.emitDiscardCards === 'function') {
        window.emitDiscardCards(selectedIndices);
        overlay.style.display = 'none';
      }
    }
  });
}

// 黄金・紅蓮の火花（CSSパーティクル）放出演出ヘルパー
function spawnTurnParticles(isMyTurn) {
  const container = document.getElementById('turn-splash-premium');
  if (!container) return;
  const color = isMyTurn ? 'rgba(255, 215, 0, 0.85)' : 'rgba(239, 68, 68, 0.85)';
  
  // 35個の火花を生成してランダムな方向に飛ばす
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle'; // CSSでz-indexなどを共有
    p.style.background = color;
    p.style.boxShadow = `0 0 12px ${color}, 0 0 4px #fff`;
    
    // 画面中央からスタート
    p.style.left = '50%';
    p.style.top = '50%';
    
    container.appendChild(p);
    
    // ランダムな速度と角度
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 18 + 12;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    let posX = 0;
    let posY = 0;
    let opacity = 1;
    const scale = Math.random() * 0.6 + 0.6;
    
    const update = () => {
      posX += vx;
      posY += vy;
      opacity -= 0.022;
      p.style.transform = `translate3d(calc(-50% + ${posX}px), calc(-50% + ${posY}px), 0) scale(${scale})`;
      p.style.opacity = opacity;
      
      if (opacity > 0) {
        requestAnimationFrame(update);
      } else {
        p.remove();
      }
    };
    
    requestAnimationFrame(update);
  }
}

// 勝利時：物理紙吹雪アニメーション
function spawnVictoryConfetti() {
  const container = document.body;
  const colors = ['#ffd700', '#f43f5e', '#3b82f6', '#10b981', '#ffffff', '#fbbf24'];
  
  // 120個の紙吹雪を物理運動で降らせる
  for (let i = 0; i < 120; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    // 画面上部からランダムな横座標でスタート
    p.style.left = `${Math.random() * 100}vw`;
    p.style.top = `-20px`;
    
    container.appendChild(p);
    
    // 物理パラメータ
    const gravity = Math.random() * 0.15 + 0.1;
    let vy = Math.random() * 4 + 2;
    let vx = Math.random() * 4 - 2;
    const wobbleSpeed = Math.random() * 0.1 + 0.05;
    let wobble = Math.random() * Math.PI * 2;
    
    let posY = -20;
    let posX = parseFloat(p.style.left) * (window.innerWidth / 100);
    let rotation = Math.random() * 360;
    const rotSpeed = Math.random() * 6 - 3;
    
    const update = () => {
      vy += gravity;
      posY += vy;
      wobble += wobbleSpeed;
      // ひらひらと横に揺れる
      posX += vx + Math.sin(wobble) * 1.5;
      rotation += rotSpeed;
      
      p.style.top = `${posY}px`;
      p.style.left = `${posX}px`;
      p.style.transform = `rotate3d(1, 1, 1, ${rotation}deg)`;
      
      // 画面外に出るか一定時間経過で削除
      if (posY < window.innerHeight && posX > -20 && posX < window.innerWidth + 20) {
        if (window.gameOverVfxStarted) {
          requestAnimationFrame(update);
        } else {
          p.remove();
        }
      } else {
        p.remove();
      }
    };
    
    requestAnimationFrame(update);
  }
}

// 敗北時：石板＆クリスタル粉砕物理アニメーション
function spawnDefeatShatter() {
  const gameWrapper = document.getElementById('game-wrapper');
  if (gameWrapper) {
    gameWrapper.classList.add('screen-shake');
    setTimeout(() => gameWrapper.classList.remove('screen-shake'), 1000);
  }

  setTimeout(() => {
    const crystal = document.getElementById('result-crystal');
    if (crystal) {
      crystal.style.opacity = '0';
    }
    
    if (window.audioManager) {
      window.audioManager.playSE('impact');
    }

    const container = document.body;
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.className = 'shatter-piece';
      p.style.background = Math.random() > 0.4 ? 'rgba(239, 68, 68, 0.95)' : 'rgba(31, 41, 55, 0.95)';
      p.style.boxShadow = p.style.background.includes('239') ? '0 0 12px rgba(239, 68, 68, 0.8)' : 'none';
      
      p.style.left = '50vw';
      p.style.top = '40vh';
      
      container.appendChild(p);
      
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 18 + 7;
      let vx = Math.cos(angle) * velocity;
      let vy = Math.sin(angle) * velocity - 4;
      const gravity = 0.35;
      
      let posX = window.innerWidth / 2;
      let posY = window.innerHeight * 0.4;
      let rotation = Math.random() * 360;
      const rotSpeed = Math.random() * 10 - 5;
      let opacity = 1.0;
      
      const update = () => {
        vy += gravity;
        posX += vx;
        posY += vy;
        rotation += rotSpeed;
        opacity -= 0.015;
        
        p.style.left = `${posX}px`;
        p.style.top = `${posY}px`;
        p.style.transform = `rotate(${rotation}deg) scale(${opacity})`;
        p.style.opacity = opacity;
        
        if (opacity > 0 && posY < window.innerHeight) {
          if (window.gameOverVfxStarted) {
            requestAnimationFrame(update);
          } else {
            p.remove();
          }
        } else {
          p.remove();
        }
      };
      
      requestAnimationFrame(update);
    }
  }, 800);
}

// ========== ★4レジェンダリーカード：ホログラフィック・ホイル座標追従グローバルデリゲーション ==========
document.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.rarity-4');
  if (!card) return;
  
  // ドラッグ中は物理エンジンが姿勢制御するため3Dチルトは適用しない
  if (card.classList.contains('drag-ghost') || card.classList.contains('dragging')) return;

  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const xc = rect.width / 2;
  const yc = rect.height / 2;
  
  // 傾き角度（最大15度）
  const angleX = -((y - yc) / yc) * 15;
  const angleY = ((x - xc) / xc) * 15;

  // パララックスのズレ幅（最大8px）
  const parallaxX = ((x - xc) / xc) * 8;
  const parallaxY = ((y - yc) / yc) * 8;

  card.style.setProperty('--tilt-x', `${angleX}deg`);
  card.style.setProperty('--tilt-y', `${angleY}deg`);
  card.style.setProperty('--parallax-x', `${parallaxX}px`);
  card.style.setProperty('--parallax-y', `${parallaxY}px`);

  // ホイル光の反射位置
  const px = (x / rect.width) * 100;
  const py = (y / rect.height) * 100;
  card.style.setProperty('--foil-x', `${px}%`);
  card.style.setProperty('--foil-y', `${py}%`);
  
  // 手札以外の盤面ユニットカードの場合、直接transformを適用しても安全
  if (!card.classList.contains('hand-card')) {
    card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.06)`;
    card.style.zIndex = '100';
    
    // 子要素である .card-overlay や .foil-shine へのパララックス
    const overlay = card.querySelector('.card-overlay');
    if (overlay) {
      overlay.style.transform = `translate3d(${-parallaxX * 1.2}px, ${-parallaxY * 1.2}px, 15px)`;
    }
    const foil = card.querySelector('.foil-shine');
    if (foil) {
      foil.style.transform = `translate3d(${parallaxX * 1.8}px, ${parallaxY * 1.8}px, 25px)`;
    }
  }
});

document.addEventListener('pointerout', (e) => {
  const card = e.target.closest('.rarity-4');
  if (card && !card.contains(e.relatedTarget)) {
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--parallax-x', '0px');
    card.style.setProperty('--parallax-y', '0px');
    card.style.setProperty('--foil-x', '50%');
    card.style.setProperty('--foil-y', '50%');
    
    if (!card.classList.contains('hand-card')) {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      card.style.zIndex = '';
      
      const overlay = card.querySelector('.card-overlay');
      if (overlay) overlay.style.transform = 'translate3d(0, 0, 0)';
      const foil = card.querySelector('.foil-shine');
      if (foil) foil.style.transform = 'translate3d(0, 0, 0)';
    }
  }
});
