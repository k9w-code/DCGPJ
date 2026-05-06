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
  else if (upperId.startsWith('T')) folder = 'token'; // \u30c8\u30fc\u30af\u30f3\u7528
  
  return isShield
    ? `/assets/images/shields/${cleanId.replace('SH', 'S')}.webp?v=2`
    : `/assets/images/cards/${folder}/${cleanId}.webp?v=2`;
};

// \u76e4\u9762\u63cf\u753b
function renderBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  renderOpponentBoard(state, selectedAttacker, onSlotClick);
  renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick);
}

function renderOpponentBoard(state, selectedAttacker, onSlotClick) {
  const container = document.getElementById('opponent-board');
  if (!container) return;
  container.innerHTML = '';

  const rows = ['back', 'front']; // \u76f8\u624b\u306f\u5965\u304c\u5f8c\u5217\u3001\u624b\u524d\u304c\u524d\u5217

  rows.forEach(row => {
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
        if (cardEl) attachCardDetailEvent(cardEl, unit);
        
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
    container.appendChild(rowDiv);
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
          if (cardEl) attachCardDetailEvent(cardEl, unit);
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
          if (cardEl) attachCardDetailEvent(cardEl, unit);
          
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
    container.appendChild(rowDiv);
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
  
  // \u51fa\u73fe\u30a2\u30cb\u30e1\u30fc\u30b7\u30e7\u30f3\u5224\u5b9a
  let appearClass = '';
  if (unit.instanceId && !seenInstanceIds.has(unit.instanceId)) {
    if (!isInitialRender) {
      appearClass = ' unit-appear';
    }
    seenInstanceIds.add(unit.instanceId);
  }
  
  const bgImage = window.getCardImagePath(unit);
  const barrierClass = unit.barrierActive ? ' has-barrier' : '';
  
  // \u30d0\u30d5\u30fb\u30c7\u30d0\u30d5\u306b\u3088\u308b\u8272\u4ed8\u3051\u30af\u30e9\u30b9
  const atkClass = (unit.currentAttack > unit.attack) ? ' stat-buffed' : (unit.currentAttack < unit.attack ? ' stat-debuffed' : '');
  const hpClass = (unit.currentHp > unit.hp) ? ' stat-buffed' : (unit.currentHp < unit.hp ? ' stat-debuffed' : '');

  return `
    <div class="unit-card${actedClass}${canActClass}${appearClass}${barrierClass}" style="${borderStyle} background-image: url('${bgImage}');">
      <div class="card-overlay">
        <div class="unit-stats">
          <div class="atk">
            <span class="icon">\u2694\ufe0f</span>
            <span class="val${atkClass}">${unit.currentAttack !== undefined ? unit.currentAttack : (unit.attack || 0)}</span>
          </div>
          <div class="hp">
            <span class="icon">\u2764\ufe0f</span>
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
  safeSetText('cd-cost', card.cost !== undefined ? card.cost : (card.durability || 0));
  safeSetText('cd-type', (card.type || 'Unit').toUpperCase());
  
  // \u30ec\u30a2\u30ea\u30c6\u30a3\u8868\u793a
  const rarityEl = document.getElementById('cd-rarity');
  if (rarityEl) {
    const rarity = card.rarity || 1;
    rarityEl.textContent = getRarityName(rarity);
    // \u30af\u30e9\u30b9\u3092\u30ea\u30bb\u30c3\u30c8\u3057\u3066\u304b\u3089\u4ed8\u4e0e
    rarityEl.className = 'cd-rarity rarity-' + rarity;
  }
  
  // \u795e\u65cf\uff08\u8272\uff09\u8868\u793a
  const tribeIcon = document.getElementById('cd-tribe-icon');
  const tribeText = document.getElementById('cd-tribe-text');
  if (tribeIcon && tribeText) {
    const parentTag = tribeIcon.parentElement;
    if (isShield) {
      if (parentTag && parentTag.classList.contains('cd-tribe-tag')) {
        parentTag.style.display = 'none';
      }
      tribeIcon.style.display = 'none';
      tribeText.style.display = 'none';
    } else {
      if (parentTag && parentTag.classList.contains('cd-tribe-tag')) {
        parentTag.style.display = 'flex';
      }
      tribeIcon.style.display = 'block';
      tribeText.style.display = 'block';
      const mainColor = firstColor;
      tribeIcon.style.backgroundImage = `url('/assets/images/icon/divine/${mainColor}.png')`;
      tribeText.textContent = (COLOR_NAMES[mainColor] || mainColor).toUpperCase();
      tribeText.style.color = COLOR_CSS[mainColor] || '#fff';
    }
  }

  // \u30b9\u30c6\u30fc\u30bf\u30b9\u8868\u793a
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

  // \u30c6\u30ad\u30b9\u30c8\u30fb\u30a2\u30d3\u30ea\u30c6\u30a3\u8868\u793a
  const textEl = document.getElementById('cd-text');
  if (textEl) {
    let mainText = '';
    if (card.text) {
      mainText = `
        <div class="cd-abilities-list">
          <div class="ability-item" style="border:none;">
            ${(card.text || '').replace(/\\n/g, '<br>')}
          </div>
        </div>
      `;
    } else if (card.abilities && card.abilities.length > 0) {
      mainText = `
        <div class="cd-abilities-list">
          ${card.abilities.map(a => `
            <div class="ability-item">
              ${a.trigger && a.trigger !== 'none' ? `<span class="ability-trigger">${a.trigger.replace('on_', '').toUpperCase()}</span>` : ''}
              ${(a.text || a.effect || '').replace(/\\n/g, '<br>')}
            </div>
          `).join('')}
        </div>
      `;
    } else {
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
    
    if (currentKws.length > 0) {
      const validKws = currentKws.map(k => k.split(/[:_]/)[0]).filter(k => (window.keywordMap && window.keywordMap[k]));
      if (validKws.length > 0) {
        kwHTML = '<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2);">';
        validKws.forEach(kw => {
          const m = (window.keywordMap && window.keywordMap[kw]) || { name: kw, description: '' };
          kwHTML += `<div style="font-size: 14px; color: #a09880; line-height: 1.5; margin-bottom: 6px;">
            <strong style="color: #d4c8a8;">\u3010${m.name || kw}\u3011</strong>: ${m.description || ''}
          </div>`;
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
                <div class="cd-token-icon" style="background-image: url('${window.getCardImagePath(tc)}')"></div>
                <div class="cd-token-name">${tc.name}</div>
                <div class="cd-token-stats">
                  <span class="atk">\u2694\ufe0f${tc.attack}</span>
                  <span class="hp">\u2764\ufe0f${tc.hp}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        textEl.appendChild(tokenSection);

        // \u30af\u30ea\u30c3\u30af\u30a4\u30d9\u30f3\u30c8\u306e\u4ed8\u4e0e
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

  // \u30e2\u30d0\u30a4\u30eb\u5411\u3051\u9577\u62bc\u3057\u5224\u5b9a (500ms)
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
  // \u81ea\u5206\u306e\u30a2\u30d0\u30bf\u30fc\u8868\u793a
  const myAvatarEl = document.getElementById('my-avatar');
  if (myAvatarEl) {
    const avatarStr = String(state.me.avatar || '1');
    console.log(`[RENDERER] My Avatar State: "${state.me.avatar}", Rendering ID: "${avatarStr}"`);
    
    // \u753b\u50cf\u30d1\u30b9\u306e\u751f\u6210 (1\u301c99 \u756a\u306e\u6570\u5024\u3092\u60f3\u5b9a)
    let avatarPath = `/assets/images/avatar/${avatarStr}.png`;
    
    // \u6570\u5024\u3067\u306a\u3044\u3001\u307e\u305f\u306f\u7279\u6b8a\u306a\u6587\u5b57\u5217\u304c\u542b\u307e\u308c\u308b\u5834\u5408\u306e\u30a8\u30e9\u30fc\u30ac\u30fc\u30c9 (\u4ee5\u524d\u306e\u4ed5\u69d8\u3068\u306e\u4e92\u63db\u6027)
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
    orb.className = 'sp-orb-display victory-glow';
    orb.style.cssText = `
      width: 74px; height: 74px; border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #3b82f6, #1d4ed8);
      border: 3.5px solid #fff; box-shadow: 0 0 30px rgba(59, 130, 246, 1);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: var(--font-fantasy); position: relative; animation: pulse-orb 2s infinite alternate;
      z-index: 100;
    `;
    orb.innerHTML = `
      <div style="font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.9); margin-bottom: -4px; letter-spacing: 1px;">SP</div>
      <div style="font-size: 38px; font-weight: 900; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); line-height: 1;">${spValue}</div>
    `;
    mySpOrbs.appendChild(orb);
  }

  safeSetText('my-deck', state.me.deckCount);
  safeSetText('my-hand-count', state.me.hand.length);
  
  const myLifeEl = document.getElementById('my-life');
  if (myLifeEl) myLifeEl.textContent = state.me.life || 0;

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

  renderShields('my-shields', state.me.shields, true);

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
      orb.style.cssText = `
        width: 60px; height: 60px; border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, #4b5563, #1f2937);
        border: 2.5px solid rgba(255,255,255,0.6); box-shadow: 0 0 15px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: var(--font-fantasy); opacity: 0.95;
      `;
      orb.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: -2px;">SP</div>
        <div style="font-size: 28px; font-weight: 800; color: #fff; text-shadow: 0 2px 4px #000; line-height: 1;">${spValue}</div>
      `;
      oppSpOrbs.appendChild(orb);
    }
    
    safeSetText('opp-hand', state.opponent.handCount);
    safeSetText('opp-deck', state.opponent.deckCount);
    const oppLifeEl = document.getElementById('opp-life');
    if (oppLifeEl) oppLifeEl.textContent = state.opponent.life || 0;

    // \u76f8\u624b\u5074\u306e\u795e\u65cf\u30ec\u30d9\u30eb\u8868\u793a
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
  
  // \u81ea\u5206\u306e\u30b7\u30fc\u30eb\u30c9\u63cf\u753b\uff08\u3053\u3053\u3067\u306f\u653b\u6483\u5bfe\u8c61\u3067\u306f\u306a\u3044\u305f\u3081 selectedAttacker \u306f\u672a\u4f7f\u7528\uff09
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

  // \u76f8\u624b\u306e\u30b7\u30fc\u30eb\u30c9\u63cf\u753b
  if (state.opponent) {
    renderOpponentShields('opp-shields', state.opponent, selectedAttacker);
  }
}

function renderOpponentShields(containerId, opponent, selectedAttacker) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // \u653b\u6483\u9078\u629e\u4e2d\u306a\u3089\u30b3\u30f3\u30c6\u30ca\u306b can-attack \u3092\u4ed8\u4e0e\uff08\u77e2\u5370\u306e\u30b9\u30ca\u30c3\u30d7\u7528\uff09
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
  
  hand.forEach((card, index) => {
    if (!card) return;
    const myLevels = state.me.tribeLevels || {};
    const cardColors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const hasTribeLevel = cardColors.every(col => (myLevels[col] || 0) >= (card.cost || 0));
    const canPlay = isMyTurn && (state.me.sp || 0) >= (card.cost || 0) && hasTribeLevel;
    const el = document.createElement('div');
    el.className = `hand-card${selectedCardIndex === index ? ' selected' : ''}${!canPlay ? ' unplayable' : ''}`;
    
    const offset = handCount > 1 ? (index - (handCount - 1) / 2) : 0;
    const angle = handCount > 1 ? offset * (maxAngle / ((handCount - 1) || 1)) : 0;
    const translateX = offset * 60;
    const translateY = Math.abs(offset) * 15;
    el.style.transform = `translateX(${translateX}px) rotate(${angle}deg) translateY(${translateY}px)`;
    
    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const colorBorders = colors.map(c => COLOR_CSS[c] || '#666');
    const bgImage = window.getCardImagePath(card);
    el.style.backgroundImage = `url('${bgImage}')`;
    el.style.borderLeft = `4px solid ${colorBorders[0]}`;
    
    el.innerHTML = `
      <div class="card-overlay">
        <div class="cost-gem" style="background:${colorBorders[0]};">${card.cost}</div>
        ${card.type === 'unit' ? `
          <div class="unit-stats" style="bottom: 5px;">
            <div class="atk"><span class="icon">\u2694\ufe0f</span><span class="val">${card.attack}</span></div>
            <div class="hp"><span class="icon">\u2764\ufe0f</span><span class="val">${card.hp}</span></div>
          </div>` : ''}
      </div>
    `;

    if (canPlay) {
      el.onpointerdown = (e) => { if (onCardClick) onCardClick(e, index); };
    }
    attachCardDetailEvent(el, card);
    container.appendChild(el);
  });
}

function renderLogs(logs) {
  const container = document.getElementById('log-content');
  if (!container) return;
  container.innerHTML = '';
  logs.forEach(log => {
    const el = document.createElement('div');
    el.className = 'log-entry';
    el.textContent = log;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function renderTurnInfo(state) {
  const isMyTurn = state.currentPlayerId === state.me.id;
  const indicator = document.getElementById('turn-indicator');
  if (indicator) {
    indicator.innerHTML = `<div>TURN ${state.turnNumber}</div><div style="font-size:14px;">${isMyTurn ? 'YOUR TURN' : "ENEMY'S TURN"}</div>`;
  }
  const endBtn = document.getElementById('btn-end-turn');
  if (endBtn) {
    endBtn.disabled = !isMyTurn;
    endBtn.style.opacity = isMyTurn ? '1' : '0.4';
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
        const splash = document.getElementById('turn-splash');
        const content = document.getElementById('splash-content');
        if (splash && content) {
          const isMyTurn = state.currentPlayerId === state.me.id;
          content.textContent = isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN";
          content.style.textShadow = isMyTurn ? '0 0 50px var(--gold)' : '0 0 50px #ef4444';
          
          splash.style.display = 'block';
          setTimeout(() => { splash.style.display = 'none'; }, 2500);
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

    // --- \u5bfe\u6226\u7d42\u4e86\uff08\u30ea\u30b6\u30eb\u30c8\u6f14\u51fa\uff09 ---
    const resultOverlay = document.getElementById('result-overlay');
    if (state.phase === 'game_over') {
      const isWinner = state.winner === state.me.id;
      const header = document.getElementById('result-header');
      
      // \u30af\u30e9\u30b9\u4ed8\u4e0e\u3068\u6f14\u51fa\u958b\u59cb
      resultOverlay.style.display = 'flex';
      resultOverlay.className = 'overlay result-overlay ' + (isWinner ? 'victory' : 'defeat');
      header.className = 'result-title'; // \u30d7\u30ec\u30df\u30a2\u30e0\u30c7\u30b6\u30a4\u30f3\u5bfe\u5fdc
      header.textContent = isWinner ? 'VICTORY' : 'DEFEAT';

      // \u7d71\u8a08\u60c5\u5831\u306e\u8868\u793a
      const stats = document.getElementById('result-stats');
      if (stats) {
        stats.className = 'result-content'; // \u30d7\u30ec\u30df\u30a2\u30e0\u30c7\u30b6\u30a4\u30f3\u5bfe\u5fdc
        stats.innerHTML = `
          <div>SURVIVED FOR ${state.turn || 1} TURNS</div>
          <div style="font-size: 0.7em; color: rgba(255,255,255,0.6); margin-top: 10px;">FINAL LIFE: ${state.me.life}</div>
        `;
      }

      // BGM\u518d\u751f\uff08\u4e00\u5ea6\u3060\u3051\uff09
      if (!window.resultBgmPlayed) {
        if (window.audioManager) {
          window.audioManager.playBGM(isWinner ? 'victory' : 'defeat', false);
        }
        window.resultBgmPlayed = true;
      }
    } else {
      resultOverlay.style.display = 'none';
      window.resultBgmPlayed = false;
    }

    // --- \u30b7\u30fc\u30eb\u30c9\u30d6\u30ec\u30a4\u30af\u6f14\u51fa\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4 ---
    const sbOverlay = document.getElementById('shield-break-overlay');
    if (sbOverlay) {
      if (state.phase === 'shield_break_anim' && state.pendingShieldBreak) {
        if (sbOverlay.style.display !== 'flex') {
          const shield = state.pendingShieldBreak.shield;
          // IDを game.html の定義に合わせる
          const nameEl = document.getElementById('sb-card-name');
          const effectEl = document.getElementById('sb-trigger-effect');
          if (nameEl) nameEl.textContent = shield.name;
          if (effectEl) effectEl.textContent = shield.skill ? (shield.skill.desc || shield.skill.text || '\u80fd\u529b\u767a\u52d5\uff01') : '\u52b9\u679c\u306a\u3057';
          
          const sbCard = document.getElementById('sb-card-image');
          if (sbCard) {
            // 正しい画像パス (/assets/images/cards/) に修正
            sbCard.style.backgroundImage = `url('/assets/images/cards/${shield.id}.webp')`;
          }
          
          // 演出用クラスを付与
          sbOverlay.classList.remove('sb-exit');
          sbOverlay.classList.add('sb-enter');
          sbOverlay.style.display = 'flex';
          
          if (window.audioManager) {
            window.audioManager.playSE('shield_break');
          }
        }
      } else {
        if (sbOverlay.style.display === 'flex') {
           sbOverlay.style.display = 'none';
           sbOverlay.classList.remove('sb-enter');
        }
      }
    }

    // --- \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u4e2d\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4 ---
    const instructionDiv = document.getElementById('targeting-instruction');
    if (instructionDiv) {
        if (state.phase === 'targeting' && state.pendingAbilitySource && state.pendingAbilitySource.ownerId === state.me.id) {
            const source = state.pendingAbilitySource;
            const name = source ? source.unitName : '\u30e6\u30cb\u30c3\u30c8';
            const isSummon = source && (source.effect === 'summon_token' || (source.targetId && source.targetId.includes('empty')));
            const subtitle = isSummon 
                ? '\u30c8\u30fc\u30af\u30f3\u306e\u53ec\u559a\u5834\u6240\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044' 
                : '\u5bfe\u8c61\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044';
            instructionDiv.innerHTML = `
                <div class="targeting-message">
                    \u3010${name}\u3011\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5<br>
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
