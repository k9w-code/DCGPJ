'use strict';

// 共有されるゲーム状態（ファイルを跨いで参照可能にするため var で宣言）
var gameState = window.gameState || null;
var selectedCardIndex = window.selectedCardIndex || null;
var selectedAttacker = window.selectedAttacker || null;

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

// 共通画像パス生成（IDプレフィックスによるフォルダ特定）
window.getCardImagePath = function(card) {
  if (!card) return '';
  const isShield = card.type === 'shield';
  const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
  const firstColor = colors[0].toLowerCase();
  const fileName = card.artId || card.cardId || card.id || 'unknown';
  const cleanId = String(fileName).split('_')[0]; // instanceId 対策
  const upperId = cleanId.toUpperCase();
  
  // 1. デフォルト判定
  let folder = firstColor === 'neutral' ? 'rainbow' : firstColor;

  // 2. IDプレフィックスによる強制特定
  if (upperId.startsWith('RE') || upperId.startsWith('R')) folder = 'red';
  else if (upperId.startsWith('BK') || upperId.startsWith('KE') || upperId.startsWith('K')) folder = 'black';
  else if (upperId.startsWith('BE') || upperId.startsWith('B')) folder = 'blue';
  else if (upperId.startsWith('GE') || upperId.startsWith('G')) folder = 'green';
  else if (upperId.startsWith('WE') || upperId.startsWith('W')) folder = 'white';
  else if (upperId.startsWith('N')) folder = 'rainbow';
  
  return isShield
    ? `/assets/images/shields/${cleanId.replace('SH', 'S')}.webp`
    : `/assets/images/cards/${folder}/${cleanId}.webp`;
};

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
      const board = (state.me && state.me.board) || {};
      const rowData = board[row] || [];
      const unit = rowData[lane];
      
      const slot = document.createElement('div');
      slot.className = `board-slot ${row}`;
      slot.dataset.row = row;
      slot.dataset.lane = lane;
      
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
  const bgImage = window.getCardImagePath(unit);
  
  return `
    <div class="unit-card${actedClass}${canActClass}" style="${borderStyle} background-image: url('${bgImage}');">
      <div class="card-overlay">
        <div class="unit-stats">
          <div class="atk">
            <span class="icon">⚔️</span>
            <span class="val">${unit.currentAttack !== undefined ? unit.currentAttack : (unit.attack || 0)}</span>
          </div>
          <div class="hp">
            <span class="icon">❤️</span>
            <span class="val${isDamaged ? ' damaged' : ''}">${unit.currentHp !== undefined ? unit.currentHp : (unit.hp || 0)}</span>
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
  const isShield = card.type === 'shield';
  const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
  const firstColor = colors[0].toLowerCase();

  const bgImagePath = window.getCardImagePath(card);
  const imgEl = document.getElementById('cd-image');
  if (imgEl) {
    imgEl.style.backgroundImage = `url('${bgImagePath}')`;
    console.log(`[DEBUG] Final Logic: Name=${card.name}, ID=${card.id}, Path=${bgImagePath}`);
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
          ${card.abilities.map(a => {
            // 日本語テキストがあればそれを使い、なければ a.effect や card.text を検討
            const displayAbilityText = (a.text && a.text !== a.effect) ? a.text : (card.text || a.effect || '');
            return `
              <div class="ability-item">
                ${a.trigger && a.trigger !== 'none' ? `<span class="ability-trigger">${a.trigger.replace('on_', '').toUpperCase()}</span>` : ''}
                ${displayAbilityText}
              </div>
            `;
          }).join('')}
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
    const avatarStr = String(state.me.avatar || '1');
    const avatarPath = (!isNaN(avatarStr) && avatarStr.length < 3) 
      ? `/assets/images/avatar/${avatarStr}.png` 
      : (avatarStr.includes('/') ? avatarStr : null);
    
    if (avatarPath) {
      myAvatarEl.style.backgroundImage = `url('${avatarPath}')`;
      myAvatarEl.innerHTML = '';
      myAvatarEl.style.backgroundSize = 'cover';
      myAvatarEl.style.display = 'block';
    } else {
      myAvatarEl.innerHTML = avatarStr;
      myAvatarEl.style.backgroundImage = 'none';
      myAvatarEl.style.display = 'flex';
      myAvatarEl.style.alignItems = 'center';
      myAvatarEl.style.justifyContent = 'center';
      myAvatarEl.style.fontSize = '60px';
      myAvatarEl.style.color = '#ffffff';
    }
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
      const avatarStr = String(state.opponent.avatar || '1');
      const avatarPath = (!isNaN(avatarStr) && avatarStr.length < 3) 
        ? `/assets/images/avatar/${avatarStr}.png` 
        : (avatarStr.includes('/') ? avatarStr : null);
      
      if (avatarPath) {
        oppAvatarEl.style.backgroundImage = `url('${avatarPath}')`;
        oppAvatarEl.innerHTML = '';
        oppAvatarEl.style.backgroundSize = 'cover';
        oppAvatarEl.style.display = 'block';
      } else {
        oppAvatarEl.innerHTML = avatarStr;
        oppAvatarEl.style.backgroundImage = 'none';
        oppAvatarEl.style.display = 'flex';
        oppAvatarEl.style.alignItems = 'center';
        oppAvatarEl.style.justifyContent = 'center';
        oppAvatarEl.style.fontSize = '60px';
        oppAvatarEl.style.color = '#ffffff';
      }
    }
    
    // 相手側の各ステータステキスト更新
    safeSetText('opp-sp', state.opponent.sp);
    safeSetText('opp-hand', state.opponent.handCount);
    safeSetText('opp-deck', state.opponent.deckCount);
    const oppLifeEl = document.getElementById('opp-life');
    if (oppLifeEl) oppLifeEl.textContent = state.opponent.life || 0;

    // 相手側の神族レベル表示
    const oppTribes = document.getElementById('opp-tribes');
    if (oppTribes) {
      oppTribes.innerHTML = '';
      const tribeColors = ['red', 'blue', 'green', 'white', 'black'];
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

window.updateUI = function() {
  const state = window.gameState;
  if (!state || !state.me) {
    console.log('⏳ [RENDER] updateUI: No state yet');
    return;
  }
  
  // データの極限正規化（欠落していても描画を継続）
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
    console.warn('⚠️ [RENDER] Data normalization failed:', e.message);
  }

  try {
    const selIndex = window.selectedCardIndex;
    const selectedCard = (selIndex !== null && state.me.hand && state.me.hand[selIndex]) ? state.me.hand[selIndex] : null;
    const attacker = window.selectedAttacker;
    const slotClickHandler = window.handleSlotClick;

    // 各パーツを独立して描画（一つが死んでも他を生かす）
    try { renderPlayerInfo(state); } catch (e) { console.error('❌ renderPlayerInfo error:', e); }
    try { renderHand(state, selIndex, window.handleCardPointerDown); } catch (e) { console.error('❌ renderHand error:', e); }
    try { renderBoard(state, selectedCard, attacker, slotClickHandler); } catch (e) { console.error('❌ renderBoard error:', e); }
    try { renderShields(state); } catch (e) { console.error('❌ renderShields error:', e); }
    try { renderLogs(state.logs); } catch (e) { console.error('❌ renderLogs error:', e); }
    try { renderTurnInfo(state); } catch (e) { console.error('❌ renderTurnInfo error:', e); }
    
    if (typeof window.onUpdateUIHook === 'function') {
      try { window.onUpdateUIHook(); } catch (e) {}
    }

    // 手札上限破棄フェーズのチェック
    if (state.phase === 'discarding' && state.currentPlayerId === state.me.id) {
      const needed = state.me.hand.length - 7; // MAX_HAND_SIZE = 7
      if (needed > 0) {
        showDiscardModal(state.me.hand, needed);
      }
    } else {
      document.getElementById('discard-overlay').style.display = 'none';
    }
  } catch (e) {
    console.error('💥 [RENDER] FATAL: Critical Render Protection triggered:', e);
  }
};

/**
 * 手札破棄モーダルの表示と選択ロジック
 */
function showDiscardModal(hand, neededCount) {
  const overlay = document.getElementById('discard-overlay');
  const container = document.getElementById('discard-cards');
  const msg = document.getElementById('discard-message');
  const btn = document.getElementById('btn-discard-confirm');
  
  if (overlay.style.display === 'flex') return; // すでに開いていれば何もしない

  overlay.style.display = 'flex';
  msg.textContent = `手札が上限 (${hand.length}/7) を超えています。あと ${neededCount} 枚選んで捨ててください。`;
  container.innerHTML = '';
  
  const selectedIndices = [];
  
  // 旧ボタンをクローンして差し替え（イベントの重複登録防止）
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  // 最新のボタン(newBtn)の状態を更新する関数
  const updateButtonState = () => {
    const remaining = neededCount - selectedIndices.length;
    if (remaining === 0) {
      newBtn.disabled = false;
      newBtn.textContent = '選択したカードを捨てる';
      newBtn.style.opacity = '1';
      newBtn.style.filter = 'none';
      newBtn.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.8)';
      msg.textContent = '枚数が揃いました。確定ボタンを押してください。';
      msg.style.color = '#10b981'; 
    } else {
      newBtn.disabled = true;
      newBtn.textContent = `あと ${remaining} 枚選択してください`;
      newBtn.style.opacity = '0.4';
      newBtn.style.boxShadow = 'none';
      msg.textContent = `手札が上限を超えています。あと ${remaining} 枚選んで捨ててください。`;
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
