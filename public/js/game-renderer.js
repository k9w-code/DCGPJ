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

const COLOR_CSS = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  white: '#e2e8f0',
  black: '#8b5cf6',
  neutral: '#6b7280',
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
  container.innerHTML = '';

  const rows = ['back', 'front']; // 相手は奥が後列、手前が前列

  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row opponent-${row}`;
    
    // 3レーン
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
        // slot.textContent = '—'; // 削除
      }
      rowDiv.appendChild(slot);
    }
    container.appendChild(rowDiv);
  });
}

function renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick) {
  const container = document.getElementById('player-board');
  container.innerHTML = '';
  const isMyTurn = state.currentPlayerId === state.me.id;

  const rows = ['front', 'back']; // 自分は手前が前列、奥が後列

  rows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = `board-row player-${row}`;
    
    // 3レーン
    for (let lane = 0; lane < 3; lane++) {
      const unit = state.me.board[row][lane];
      const slot = document.createElement('div');
      slot.className = `board-slot ${row}`;
      slot.dataset.row = row;
      slot.dataset.lane = lane;
      
      if (unit) {
        const canAct = isMyTurn && unit.canAttack && !unit.hasActed;
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
          slot.textContent = '配置';
          slot.addEventListener('click', () => onSlotClick('place_unit', row, lane));
        } else {
          slot.textContent = '—';
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
  const bgImage = `/assets/images/cards/${unit.color}/${unit.artId || unit.cardId || unit.id}.webp`;
  
  const keywordBadges = (unit.keywords || []).map(kw => {
    const name = getKeywordDisplayName(kw);
    const desc = getKeywordDescription(kw);
    return `<span class="keyword-badge" title="${desc}">${name}</span>`;
  }).join('');

  const tribeText = colors.map(c => c.toUpperCase()).join('/');
  const tooltip = `${unit.name} [${tribeText}]\nATK: ${unit.currentAttack} / HP: ${unit.currentHp}\n${(unit.keywords||[]).map(kw => `${getKeywordDisplayName(kw)}: ${getKeywordDescription(kw)}`).join('\n')}`;

  return `
    <div class="unit-card${actedClass}${canActClass}" style="${borderStyle} background-image: url('${bgImage}');" title="${tooltip}">
      <div class="card-overlay">
        <div class="keywords-display">${keywordBadges}</div>
        <div class="unit-stats">
          <div class="stat-badge atk-badge">
            <span class="icon">⚔️</span>
            <span class="val">${unit.currentAttack}</span>
          </div>
          <div class="stat-badge hp-badge">
            <span class="icon">❤️</span>
            <span class="val${isDamaged ? ' damaged' : ''}">${unit.currentHp}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ======== カード詳細表示モーダル ========
window.showCardDetail = function(card) {
  const overlay = document.getElementById('card-detail-overlay');
  if (!overlay) return;
  
  // マリガン画面が表示されている場合、一時的に隠して最前面を確保する
  const mulliganOverlay = document.getElementById('mulligan-overlay');
  if (mulliganOverlay && mulliganOverlay.style.display !== 'none') {
    mulliganOverlay.style.display = 'none';
    window._mulliganWasVisible = true;
  }

  overlay.style.zIndex = '1000000';
  overlay.style.display = 'flex';
  
  // ... (情報の流し込み処理) ...
  const bgImage = card.type === 'shield' || card.type === 'tribe' 
    ? '' : `url('/assets/images/cards/${card.color}/${card.artId || card.id}.webp')`;
  
  const cdImage = document.getElementById('cd-image');
  cdImage.style.backgroundImage = bgImage;
  if (!bgImage) cdImage.classList.add('no-image');
  else cdImage.classList.remove('no-image');

  document.getElementById('cd-name').textContent = card.name;
  document.getElementById('cd-cost').textContent = card.cost || 0;
  const cardColor = card.color || 'neutral';
  document.getElementById('cd-cost').style.backgroundColor = COLOR_CSS[cardColor] || '#2563eb';
  document.getElementById('cd-cost').style.boxShadow = `0 0 20px ${COLOR_CSS[cardColor] || '#2563eb'}`;
  
  document.getElementById('cd-type').textContent = card.type === 'unit' ? 'Unit' : (card.type === 'shield' ? 'Shield' : 'Spell');
  document.getElementById('cd-color').textContent = cardColor;
  
  const statsContainer = document.getElementById('cd-stats-container');
  if (card.type === 'unit') {
    statsContainer.style.display = 'flex';
    document.getElementById('cd-attack').textContent = card.attack;
    document.getElementById('cd-hp').textContent = card.hp;
  } else {
    statsContainer.style.display = 'none';
  }

  let effectText = card.abilityEffect || '';
  if (card.keywords && card.keywords.length > 0) {
    const kws = card.keywords.map(kw => `[${getKeywordDisplayName(kw)}]`).join(' ');
    effectText = kws + '<br>' + effectText;
  }
  document.getElementById('cd-text').innerHTML = effectText || '効果なし';
  document.getElementById('cd-flavor').textContent = card.flavorText || '（魔法の力が込められている…）';
  
  // 閉じる処理
  const closeDetail = () => {
    overlay.style.display = 'none';
    if (window._mulliganWasVisible) {
      if (mulliganOverlay) mulliganOverlay.style.display = 'flex';
      window._mulliganWasVisible = false;
    }
  };

  const closeBtn = document.getElementById('btn-close-detail');
  closeBtn.onclick = closeDetail;
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  };
};

function attachCardDetailEvent(el, card) {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.showCardDetail(card);
  });
}

// プレイヤー情報更新
function renderPlayerInfo(state) {
  // キーワードマスタをクライアント側変数に同期（初回のみ）
  if (typeof window !== 'undefined') window.keywordMap = window.keywordMap || {};

  // 自分の情報
  document.getElementById('my-name').textContent = state.me.name;
  document.getElementById('my-sp').textContent = state.me.sp;
  document.getElementById('my-deck').textContent = state.me.deckCount;
  
  const myLifeEl = document.getElementById('my-life');
  if (myLifeEl) myLifeEl.textContent = state.me.life;

  const myTribes = document.getElementById('my-tribes');
  myTribes.innerHTML = '';
  for (const [color, level] of Object.entries(state.me.tribeLevels)) {
    if (level <= 0) continue;
    const badge = document.createElement('div');
    badge.className = `tribe-badge active tribe-${color}`;
    badge.style.color = COLOR_CSS[color];
    badge.innerHTML = `<span class="level-text">${level}</span>`;
    badge.title = `${color} Lv.${level}`;
    myTribes.appendChild(badge);
  }

  renderShields('my-shields', state.me.shields, true);

  // 相手の情報
  document.getElementById('opp-name').textContent = state.opponent.name;
  document.getElementById('opp-sp').textContent = state.opponent.sp;
  document.getElementById('opp-hand').textContent = state.opponent.handCount;
  document.getElementById('opp-deck').textContent = state.opponent.deckCount;
  
  const oppLifeEl = document.getElementById('opp-life');
  if (oppLifeEl) oppLifeEl.textContent = state.opponent.life;

  const oppTribes = document.getElementById('opp-tribes');
  oppTribes.innerHTML = '';
  for (const [color, level] of Object.entries(state.opponent.tribeLevels)) {
    if (level <= 0) continue;
    const badge = document.createElement('div');
    badge.className = `tribe-badge active tribe-${color}`;
    badge.style.color = COLOR_CSS[color];
    badge.innerHTML = `<span class="level-text">${level}</span>`;
    oppTribes.appendChild(badge);
  }

  renderOpponentShields('opp-shields', state.opponent);
}

function renderShields(containerId, shields, showDurability) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (!shields) return;
  
  for (const shield of shields) {
    const el = document.createElement('div');
    el.className = `shield-gem${shield.destroyed ? ' destroyed' : ''}`;
    el.textContent = showDurability ? shield.currentDurability : '魔法';
    el.title = `${shield.name} (耐久: ${shield.currentDurability}/${shield.maxDurability})`;
    if (!shield.destroyed) {
      attachCardDetailEvent(el, shield);
    }
    container.appendChild(el);
  }
}

function renderOpponentShields(containerId, opponent) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  const totalShields = 3;
  const destroyed = opponent.shieldsDestroyed || 0;
  
  for (let i = 0; i < totalShields; i++) {
    const el = document.createElement('div');
    if (i < destroyed) {
      el.className = 'shield-gem destroyed';
      el.textContent = '×';
    } else {
      el.className = 'shield-gem hidden';
      el.textContent = '?';
    }
    container.appendChild(el);
  }
  
  const totalEl = document.createElement('span');
  totalEl.style.cssText = 'font-size:14px;color:var(--text-dim);font-weight:bold;align-self:center;';
  totalEl.textContent = `計${opponent.totalShieldDurability}`;
  container.appendChild(totalEl);
}

// 手札描画（扇状Fan-out展開）
function renderHand(state, selectedCardIndex, onCardClick) {
  const container = document.getElementById('hand-cards');
  container.innerHTML = '';
  const isMyTurn = state.currentPlayerId === state.me.id;
  
  const handCount = state.me.hand.length;
  const maxAngle = Math.min(40, handCount * 8); // 広がりを大きく
  
  state.me.hand.forEach((card, index) => {
    const hasTribeLevel = (card.colors || [card.color]).every(col => state.me.tribeLevels[col] >= card.cost);
    const canPlay = isMyTurn && state.me.sp >= card.cost && hasTribeLevel;
    
    const el = document.createElement('div');
    el.className = `hand-card${selectedCardIndex === index ? ' selected' : ''}${!canPlay ? ' unplayable' : ''}`;
    
    const offset = handCount > 1 ? (index - (handCount - 1) / 2) : 0;
    const angle = handCount > 1 ? offset * (maxAngle / ((handCount - 1) || 1)) : 0;
    const translateY = Math.abs(offset) * 20; // 両端の下げ幅を大きく
    
    // 選択中のカードやホバー時はCSS側で transform が上書きされるよう調整
    el.style.transform = `rotate(${angle}deg) translateY(${translateY}px)`;
    // ホバー時に角度を維持したまま浮かせるためにカスタムプロパティを使う（後日CSS連携）
    el.style.setProperty('--fan-angle', `${angle}deg`);
    
    attachCardDetailEvent(el, card);

    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const colorBorders = colors.map(c => COLOR_CSS[c] || '#666');
    let borderStyle = `border-left: 4px solid ${colorBorders[0]};`;
    if (colorBorders.length > 1) {
      borderStyle = `border-left: 4px solid; border-image: linear-gradient(to bottom, ${colorBorders.join(', ')}) 1;`;
    }

    const bgImage = `/assets/images/cards/${card.color}/${card.artId || card.id}.webp`;
    el.style.cssText += `${borderStyle} background-image: url('${bgImage}');`;
    
    // 選択時はtransformを固定化
    if (selectedCardIndex === index) {
      el.style.transform = `rotate(${angle}deg) translateY(-40px) scale(1.15)`;
      el.style.zIndex = '1000';
    } else {
      // 選択されていない時のZ-Index（右のカードほど上に来る一般的なDCG仕様）
      el.style.zIndex = index + 10;
    }
    
    // JSのホバーイベントで扇状角度を考慮して浮かせる
    el.onmouseenter = () => {
      if (selectedCardIndex !== index) {
        el.style.transform = `rotate(${angle}deg) translateY(${translateY - 30}px) scale(1.1)`;
        el.style.zIndex = '1000';
      }
    };
    el.onmouseleave = () => {
      if (selectedCardIndex !== index) {
        el.style.transform = `rotate(${angle}deg) translateY(${translateY}px)`;
        el.style.zIndex = index + 10;
      }
    };

    const statsText = card.type === 'unit'
      ? `<div class="unit-stats" style="margin-top:auto;">
          <div class="stat-badge atk-badge"><span class="icon">⚔️</span><span class="val">${card.attack}</span></div>
          <div class="stat-badge hp-badge"><span class="icon">❤️</span><span class="val">${card.hp}</span></div>
         </div>`
      : `<div class="hc-stats" style="color:var(--accent); margin-top:auto; font-size:10px;">${card.abilityEffect || '期待値'}</div>`;
    
    el.innerHTML = `
      <div class="card-overlay">
        <div class="cost-gem" style="background:${colorBorders[0]};">${card.cost}</div>
        ${statsText}
      </div>
    `;

    if (canPlay) {
      // ドラッグイベント (pointerdown)
      el.onpointerdown = (e) => {
        if (onCardClick) onCardClick(e, index); // eを渡す
      };
    }
    
    container.appendChild(el);
  });
}

// ログ描画
function renderLogs(logs) {
  const container = document.getElementById('log-content');
  container.innerHTML = '';
  
  for (const log of logs) {
    const el = document.createElement('div');
    el.className = `log-entry${log.includes('═══') || log.includes('🏆') ? ' important' : ''}`;
    el.textContent = log;
    container.appendChild(el);
  }
  
  container.scrollTop = container.scrollHeight;
}

// マリガン画面表示
function showMulligan(hand, onKeep, onMulligan) {
  const overlay = document.getElementById('mulligan-overlay');
  overlay.style.zIndex = '10000';
  console.log('Showing Mulligan, zIndex:', overlay.style.zIndex);
  overlay.style.display = 'flex';
  
  const cardsContainer = document.getElementById('mulligan-cards');
  cardsContainer.innerHTML = '';
  
  for (const card of hand) {
    const el = document.createElement('div');
    el.className = 'hand-card';
    
    const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
    const colorBorders = colors.map(c => COLOR_CSS[c] || '#666');
    let borderStyle = `border-left: 4px solid ${colorBorders[0]};`;
    if (colorBorders.length > 1) {
      borderStyle = `border-left: 4px solid; border-image: linear-gradient(to bottom, ${colorBorders.join(', ')}) 1;`;
    }

    const bgImage = `/assets/images/cards/${card.color}/${card.artId || card.id}.webp`;
    el.style.cssText = `${borderStyle} background-image: url('${bgImage}');`;
    
    // オーバーレイ構造を手札に合わせる
    el.innerHTML = `
      <div class="card-overlay">
        <div class="cost-gem" style="background:${colorBorders[0]};">${card.cost}</div>
      </div>
    `;

    // 右クリックで詳細を表示
    attachCardDetailEvent(el, card);
    
    cardsContainer.appendChild(el);
  }
  
  document.getElementById('btn-keep').onclick = () => {
    overlay.style.display = 'none';
    onKeep();
  };
  document.getElementById('btn-mulligan').onclick = () => {
    overlay.style.display = 'none';
    onMulligan();
  };
}

// 勝敗表示
function showResult(isWinner) {
  const overlay = document.getElementById('result-overlay');
  overlay.style.display = 'flex';
  const text = document.getElementById('result-text');
  text.textContent = isWinner ? 'VICTORY' : 'DEFEAT';
  text.className = `result-text ${isWinner ? 'win' : 'lose'}`;
}

// ターン表示更新
function renderTurnInfo(state) {
  const isMyTurn = state.currentPlayerId === state.me.id;
  const indicator = document.getElementById('turn-indicator');
  indicator.innerHTML = `<div style="font-size:18px;opacity:0.6;">TURN</div><div style="font-size:48px;line-height:1;">${state.turnNumber}</div><div style="font-size:14px;margin-top:4px;">${isMyTurn ? 'YOUR TURN' : "ENEMY'S TURN"}</div>`;
  indicator.style.color = isMyTurn ? 'var(--accent)' : 'var(--text-dim)';
  
  document.getElementById('btn-end-turn').disabled = !isMyTurn;
  document.getElementById('btn-end-turn').style.opacity = isMyTurn ? '1' : '0.4';
}

// 先攻・後攻演出
window.showTurnOrder = function(isFirst) {
  const overlay = document.getElementById('turn-order-overlay');
  const textEl = document.getElementById('turn-order-text');
  if (!overlay || !textEl) return;

  textEl.textContent = isFirst ? 'YOU GO FIRST' : 'YOU GO SECOND';
  overlay.style.display = 'flex';

  // アニメーションが終わったら非表示にする (CSSアニメーションが3sなので、余裕を持って4s)
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 4000);
};
