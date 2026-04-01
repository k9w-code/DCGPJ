// game-renderer.js - 盤面描画（3レーン×前後列対応）
'use strict';

const KEYWORD_NAMES = {
  taunt: '挑発',
  rush: '速攻',
  speed: '速攻',
  stealth: '潜伏',
  double_strike: '連撃',
  barrier: '加護',
  endure: '不屈',
  siege: '攻城',
  comeback: '逆転',
};

window.COLOR_CSS = window.COLOR_CSS || {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  white: '#e2e8f0',
  black: '#8b5cf6',
  neutral: '#6b7280',
};

window.COLOR_NAMES = window.COLOR_NAMES || {
  red: '赤',
  blue: '青',
  green: '緑',
  white: '白',
  black: '黒',
  neutral: '無',
};

function getKeywordDisplayName(kw) {
  if (kw.startsWith('search_')) {
    return `探索${kw.split('_')[1]}`;
  }
  const master = window.keywordMap && window.keywordMap[kw];
  return master ? master.name : (KEYWORD_NAMES[kw] || kw);
}

function getKeywordDescription(kw) {
  const master = window.keywordMap && window.keywordMap[kw];
  return master ? master.description : '';
}

// 盤面描画
function renderBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  renderOpponentBoard(state, selectedAttacker, onSlotClick);
  renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick);
}

function renderOpponentBoard(state, selectedAttacker, onSlotClick) {
  const container = document.getElementById('opponent-board');
  if (!container) return;
  container.innerHTML = '';

  const rows = ['back', 'front']; // 相手は奥が後列、手前が前列

  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row opponent-${row}`;
    
    for (let lane = 0; lane < 3; lane++) {
      const unit = state.opponent.board[row][lane];
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
        }
      } else {
        slot.classList.add('empty');
        slot.textContent = ''; 
      }
      rowDiv.appendChild(slot);
    }
    container.appendChild(rowDiv);
  });
}

function renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  const container = document.getElementById('player-board');
  if (!container) return;
  container.innerHTML = '';
  const isMyTurn = state.currentPlayerId === state.me.id;

  const rows = ['front', 'back']; // 自分は手前が前列、奥が後列

  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row player-${row}`;
    
    for (let lane = 0; lane < 3; lane++) {
      const unit = state.me.board[row][lane];
      const slot = document.createElement('div');
      slot.className = `board-slot ${row}`;
      slot.dataset.row = row;
      slot.dataset.lane = lane;
      
      if (unit) {
        const hasActivate = (unit.abilities || []).some(a => a.trigger === 'activate');
        const canAct = isMyTurn && !unit.hasActed && (unit.canAttack || hasActivate);
        
        slot.innerHTML = renderUnitCard(unit, canAct);
        
        const cardEl = slot.querySelector('.unit-card');
        if (cardEl) attachCardDetailEvent(cardEl, unit);
        
        if (canAct) {
          cardEl.addEventListener('pointerdown', (e) => onSlotClick('unit_pointerdown', row, lane, e));
          cardEl.style.cursor = 'grab';
        }
      } else {
        slot.classList.add('empty');
        if (selectedCard !== null && selectedCard.type === 'unit') {
          slot.classList.add('can-place');
          slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
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
  const folder = unit.color === 'neutral' ? 'rainbow' : (unit.color || 'neutral');
  const bgImage = `/assets/images/cards/${folder}/${unit.artId || unit.cardId || unit.id}.webp`;
  
  return `
    <div class="unit-card${actedClass}${canActClass}" style="${borderStyle} background-image: url('${bgImage}');">
      <div class="card-overlay">
        <div class="unit-stats">
          <div class="atk">
            <span class="icon">⚔️</span>
            <span class="val">${unit.currentAttack}</span>
          </div>
          <div class="hp">
            <span class="icon">❤️</span>
            <span class="val${isDamaged ? ' damaged' : ''}">${unit.currentHp}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.showCardDetail = function(card) {
  const overlay = document.getElementById('card-detail-overlay');
  if (!overlay) return;
  
  overlay.style.display = 'flex';
  const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
  const firstColor = colors[0].toLowerCase();
  const fileName = card.artId || card.cardId || card.id || 'unknown';
  const cleanId = String(fileName).split('_')[0]; // instanceId 対策
  const upperId = cleanId.toUpperCase();
  
  const isShield = card.type === 'shield';
  // 1. 属性(color)に基づくデフォルト判定
  let folder = firstColor === 'neutral' ? 'rainbow' : firstColor;

  // 2. IDプレフィックスによるフォルダ強制特定 (修正の核心)
  if (upperId.startsWith('RE') || upperId.startsWith('R')) folder = 'red';
  else if (upperId.startsWith('BK') || upperId.startsWith('KE') || upperId.startsWith('K')) folder = 'black';
  else if (upperId.startsWith('BE') || upperId.startsWith('B')) {
    // BK (Black) と B (Blue) を区別
    folder = 'blue';
  }
  else if (upperId.startsWith('GE') || upperId.startsWith('G')) folder = 'green';
  else if (upperId.startsWith('WE') || upperId.startsWith('W')) folder = 'white';
  else if (upperId.startsWith('N')) folder = 'rainbow';
  
  const bgImage = isShield
    ? `url('/assets/images/shields/${card.id.replace('SH', 'S')}.webp')`
    : `url('/assets/images/cards/${folder}/${cleanId}.webp')`;
  
  const imgEl = document.getElementById('cd-image');
  if (imgEl) {
    imgEl.style.backgroundImage = bgImage;
    console.log(`[DEBUG] Final Logic: Name=${card.name}, ID=${cleanId}, Folder=${folder}, Path=${bgImage}`);
  }

  // 要素更新を安全に行う
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== undefined ? text : '';
  };

  safeSetText('cd-name', card.name);
  safeSetText('cd-cost', card.cost !== undefined ? card.cost : (card.durability || 0));
  safeSetText('cd-type', (card.type || 'Unit').toUpperCase());
  
  // 神族（色）表示
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

  // ステータス表示
  const statsContainer = document.getElementById('cd-stats-container');
  if (statsContainer) {
    const cardType = (card.type || '').toLowerCase();
    if (cardType === 'unit') {
      statsContainer.style.display = 'flex';
      const atkEl = document.getElementById('cd-attack');
      const hpEl = document.getElementById('cd-hp');
      if (atkEl) atkEl.textContent = card.currentAttack !== undefined ? card.currentAttack : (card.attack || 0);
      if (hpEl) hpEl.textContent = card.currentHp !== undefined ? card.currentHp : (card.hp || 0);
    } else {
      statsContainer.style.display = 'none';
    }
  }

  // テキスト・アビリティ表示
  const textEl = document.getElementById('cd-text');
  if (textEl) {
    let mainText = '';
    if (card.abilities && card.abilities.length > 0) {
      mainText = `
        <div class="cd-abilities-list">
          ${card.abilities.map(a => `
            <div class="ability-item">
              ${a.trigger && a.trigger !== 'none' ? `<span class="ability-trigger">${a.trigger.replace('on_', '').toUpperCase()}</span>` : ''}
              ${a.text || a.effect || ''}
            </div>
          `).join('')}
        </div>
      `;
    } else {
      mainText = card.text || card.abilityEffect || (card.skill ? card.skill.text : '');
    }

    let kwHTML = '';
    if (card.keywords && card.keywords.length > 0) {
      const validKws = card.keywords.map(k => k.split(':')[0]).filter(k => window.keywordMap && window.keywordMap[k]);
      if (validKws.length > 0) {
        kwHTML = '<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2);">';
        validKws.forEach(kw => {
          const m = window.keywordMap[kw];
          kwHTML += `<div style="font-size: 11px; color: #a09880; line-height: 1.4; margin-bottom: 6px;">
            <strong style="color: #d4c8a8;">【${m.name}】</strong>: ${m.description}
          </div>`;
        });
        kwHTML += '</div>';
      }
    }
    
    if (mainText && !mainText.includes('<div')) {
      mainText = mainText.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    }
    textEl.innerHTML = mainText + kwHTML;
  }

  const flavorEl = document.getElementById('cd-flavor');
  if (flavorEl) {
    flavorEl.textContent = card.flavorText || (card.skill ? card.skill.description : '');
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
}

function renderPlayerInfo(state) {
  if (!state || !state.me) return;

  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== undefined ? text : '';
  };

  safeSetText('my-name', state.me.name);
  const myAvatarEl = document.getElementById('my-avatar');
  if (myAvatarEl) {
    // もしアバターが絵文字の場合
    myAvatarEl.innerHTML = `<div style="font-size: 60px; text-align: center; line-height: 120px;">${state.me.avatar || '🤖'}</div>`;
  }
  safeSetText('my-sp', state.me.sp);
  safeSetText('my-deck', state.me.deckCount);
  safeSetText('my-hand-count', state.me.hand.length);
  
  const myLifeEl = document.getElementById('my-life');
  if (myLifeEl) myLifeEl.textContent = state.me.life || 0;

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
      // もしアバターが絵文字の場合
      oppAvatarEl.innerHTML = `<div style="font-size: 60px; text-align: center; line-height: 120px;">${state.opponent.avatar || '🤖'}</div>`;
    }
    safeSetText('opp-sp', state.opponent.sp);
    safeSetText('opp-hand', state.opponent.handCount);
    safeSetText('opp-deck', state.opponent.deckCount);
    const oppLifeEl = document.getElementById('opp-life');
    if (oppLifeEl) oppLifeEl.textContent = state.opponent.life || 0;

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
    renderOpponentShields('opp-shields', state.opponent);
  }
}

function renderShields(containerId, shields, showDurability) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!shields) return;
  shields.forEach(shield => {
    const el = document.createElement('div');
    el.className = `shield-gem${shield.destroyed ? ' destroyed' : ''}`;
    if (!shield.destroyed && showDurability) {
      const dur = document.createElement('div');
      dur.className = 'shield-durability-overlay';
      dur.textContent = `${shield.currentDurability}`;
      el.appendChild(dur);
    }
    attachCardDetailEvent(el, shield);
    container.appendChild(el);
  });
}

function renderOpponentShields(containerId, opponent) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
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
  const handCount = state.me.hand.length;
  const maxAngle = Math.min(40, handCount * 8);
  
  state.me.hand.forEach((card, index) => {
    const hasTribeLevel = (card.colors || [card.color]).every(col => state.me.tribeLevels[col] >= card.cost);
    const canPlay = isMyTurn && state.me.sp >= card.cost && hasTribeLevel;
    const el = document.createElement('div');
    el.className = `hand-card${selectedCardIndex === index ? ' selected' : ''}${!canPlay ? ' unplayable' : ''}`;
    
    const offset = handCount > 1 ? (index - (handCount - 1) / 2) : 0;
    const angle = handCount > 1 ? offset * (maxAngle / ((handCount - 1) || 1)) : 0;
    const translateX = offset * 60;
    const translateY = Math.abs(offset) * 15;
    el.style.transform = `translateX(${translateX}px) rotate(${angle}deg) translateY(${translateY}px)`;
    
    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const colorBorders = colors.map(c => COLOR_CSS[c] || '#666');
    const folder = card.color === 'neutral' ? 'rainbow' : (card.color || 'neutral');
    const bgImage = `/assets/images/cards/${folder}/${card.artId || card.id}.webp`;
    el.style.backgroundImage = `url('${bgImage}')`;
    el.style.borderLeft = `4px solid ${colorBorders[0]}`;
    
    el.innerHTML = `
      <div class="card-overlay">
        <div class="cost-gem" style="background:${colorBorders[0]};">${card.cost}</div>
        ${card.type === 'unit' ? `
          <div class="unit-stats" style="bottom: 5px;">
            <div class="atk"><span class="icon">⚔️</span><span class="val">${card.attack}</span></div>
            <div class="hp"><span class="icon">❤️</span><span class="val">${card.hp}</span></div>
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

function updateUI() {
  if (!gameState || !gameState.me) return;
  try {
    renderPlayerInfo(gameState);
    renderBoard(gameState, selectedCardIndex !== null ? gameState.me.hand[selectedCardIndex] : null, selectedAttacker, handleSlotClick);
    renderHand(gameState, selectedCardIndex, handleCardPointerDown);
    renderLogs(gameState.logs || []);
    renderTurnInfo(gameState);
  } catch (e) { console.error('❌ updateUI failed!', e); }
}
