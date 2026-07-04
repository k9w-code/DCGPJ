// game-client.js
const socket = io();

// ==========================================================================
// PHASE 10: Ultimate Visual Physics Engine (Drag Physics & Shield Particles)
// ==========================================================================

// 1. ドラッグ物理シミュレータ状態オブジェクト
let dragPhysics = {
  active: false,
  x: 0, y: 0,           // 現在の回転角度 (tiltX, tiltY)
  vx: 0, vy: 0,         // 回転速度
  targetX: 0, targetY: 0, // 目標復元角度 (0)
  k: 0.16,              // スプリング剛性 (バネの強さ)
  d: 0.84,              // 減衰定数 (ダンピング摩擦)
  rafId: null
};

// ドラッグ物理慣性＆スプリングスナップの毎フレーム更新ループ
function updateDragPhysics() {
  if (!dragPhysics.active && Math.abs(dragPhysics.x) < 0.05 && Math.abs(dragPhysics.y) < 0.05) {
    dragPhysics.x = 0; dragPhysics.y = 0;
    dragPhysics.vx = 0; dragPhysics.vy = 0;
    if (dragGhost) {
      dragGhost.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
    }
    dragPhysics.rafId = null;
    return;
  }

  // 物理計算 (F = -kx - dv)
  const ax = -dragPhysics.k * (dragPhysics.x - dragPhysics.targetX) - (1 - dragPhysics.d) * dragPhysics.vx;
  const ay = -dragPhysics.k * (dragPhysics.y - dragPhysics.targetY) - (1 - dragPhysics.d) * dragPhysics.vy;

  dragPhysics.vx += ax;
  dragPhysics.vy += ay;
  dragPhysics.x += dragPhysics.vx;
  dragPhysics.y += dragPhysics.vy;

  if (dragGhost) {
    // 極端な角度への変形破綻を防止するため制限
    const renderX = Math.max(-28, Math.min(28, dragPhysics.x));
    const renderY = Math.max(-28, Math.min(28, dragPhysics.y));
    dragGhost.style.transform = `perspective(1000px) rotateX(${renderX}deg) rotateY(${renderY}deg) scale(1.06)`;
  }

  dragPhysics.rafId = requestAnimationFrame(updateDragPhysics);
}

// 2. 物理シールドブレイクCanvasパーティクルエンジン
let vfxCanvas = null;
let vfxCtx = null;
let vfxParticles = [];
let vfxActive = false;

function initVfxCanvas() {
  vfxCanvas = document.getElementById('vfx-particle-canvas');
  if (vfxCanvas) {
    vfxCtx = vfxCanvas.getContext('2d');
  }
}

// クリスタル破片オブジェクトのクラス構造 (JSプレーン)
class CrystalParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // 放射状のランダムな初期速度（上と左右に吹き飛ぶ）
    const angle = Math.random() * Math.PI + Math.PI; // 上半球方向 (180〜360度)
    const speed = 4 + Math.random() * 12;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (2 + Math.random() * 5); // 強力な上昇力
    
    this.size = 6 + Math.random() * 12;
    this.gravity = 0.38; // 重力加速度
    this.rebound = -0.45; // 盤面底（1080px）での反発係数
    this.friction = 0.98; // 空気抵抗
    this.alpha = 1.0;
    this.fade = 0.012 + Math.random() * 0.018; // フェード速度
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.25; // 回転角速度
    
    // ゴールド、イエロー、氷ブルー、水晶シルバーのランダムな色
    const colors = [
      'rgba(251, 191, 36, ', // ゴールド
      'rgba(254, 240, 138, ', // イエロー
      'rgba(96, 165, 250, ', // 氷ブルー
      'rgba(226, 232, 240, ', // シルバー
      'rgba(147, 51, 234, '  // 魔力パープル
    ];
    this.colorBase = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.vy += this.gravity; // 重力
    this.vx *= this.friction; // 空気抵抗
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.alpha -= this.fade;

    // 盤面底（1080px）またはアバター枠下部での物理バウンド
    if (this.y >= 1060 && this.vy > 0) {
      this.y = 1060;
      this.vy *= this.rebound;
      this.vx *= 0.6; // 摩擦
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.colorBase + this.alpha + ')';
    
    // 立体的な多角形（ダイヤモンド状の破片）を描画
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(this.size * 0.6, 0);
    ctx.lineTo(0, this.size);
    ctx.lineTo(-this.size * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    
    // 破片のエッジハイライト（光沢）
    ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha * 0.8})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
}

// 物理ダメージ・バフポップアップ文字のパーティクルクラス
class DamageTextParticle {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y - 30; // カードの中心より少し上から
    this.text = text;
    this.color = color; // 'red' | 'gold' | 'green'
    
    // 放物線を描いて上に吹き出す初期速度
    this.vx = (Math.random() - 0.5) * 3; // 左右ブレ
    this.vy = -7 - Math.random() * 5;   // 上方向への力
    
    this.gravity = 0.28;
    this.alpha = 1.0;
    this.fade = 0.015;
    this.scale = 1.2;
  }

  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.fade;
    this.scale = Math.max(0.7, this.scale - 0.008);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    
    // AAA級のドロップシャドウ付きポップフォント
    ctx.font = `900 ${Math.floor(34 * this.scale)}px 'Outfit', 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let fill = '#ef4444'; // 赤（ダメージ）
    if (this.color === 'gold') fill = '#fbbf24'; // 金（バフ）
    if (this.color === 'green') fill = '#10b981'; // 緑（回復）
    
    // 太めの黒縁を描く（視認性向上）
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.lineWidth = 7;
    ctx.strokeText(this.text, this.x, this.y);
    
    ctx.fillStyle = fill;
    ctx.fillText(this.text, this.x, this.y);
    
    ctx.restore();
  }
}

// 物理ポップアップVFXの発火
window.triggerDamagePopupVFX = function(x, y, text, color) {
  if (!vfxCanvas) initVfxCanvas();
  if (!vfxCanvas) return;

  vfxParticles.push(new DamageTextParticle(x, y, text, color));

  if (!vfxActive) {
    vfxActive = true;
    requestAnimationFrame(updateVfxParticles);
  }
};

// 物理シールドブレイクVFXの発火
window.triggerShieldBreakVFX = function(x, y) {
  if (!vfxCanvas) initVfxCanvas();
  if (!vfxCanvas) return;

  console.log(`[VFX ENGINE] Exploding 3D crystal particles at (${x}, ${y})`);
  
  // 120個の物理破片を一度に放出
  for (let i = 0; i < 120; i++) {
    vfxParticles.push(new CrystalParticle(x, y));
  }

  if (!vfxActive) {
    vfxActive = true;
    requestAnimationFrame(updateVfxParticles);
  }
};

function updateVfxParticles() {
  if (!vfxCanvas || !vfxCtx) return;
  vfxCtx.clearRect(0, 0, vfxCanvas.width, vfxCanvas.height);

  vfxParticles.forEach((p, index) => {
    p.update();
    p.draw(vfxCtx);
    if (p.alpha <= 0) {
      vfxParticles.splice(index, 1);
    }
  });

  if (vfxParticles.length > 0) {
    requestAnimationFrame(updateVfxParticles);
  } else {
    vfxActive = false;
  }
}


// \u30b9\u30da\u30eb\u306e\u4f7f\u7528\u53ef\u5426\u30c1\u30a7\u30c3\u30af
function canPlaySpell(card) {
  if (!card || card.type !== 'spell') return true;
  if (!card.abilities || card.abilities.length === 0) return true;
  
  const state = window.gameState;
  if (!state) return true;

  const opponent = state.opponent;
  const player = state.me;

  // \u5168\u3066\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u3092\u30c1\u30a7\u30c3\u30af\u3057\u3001\u4e00\u3064\u3067\u3082\u5bfe\u8c61\u304c\u5fc5\u8981\u306a\u3082\u306e\u304c\u3042\u308c\u3070\u30c1\u30a7\u30c3\u30af
  for (const ability of card.abilities) {
    const target = ability.target || '';
    if (target.includes('enemy_unit')) {
      // \u6575\u30e6\u30cb\u30c3\u30c8\u304c\u5fc5\u8981\u306a\u5834\u5408
      let hasEnemy = false;
      const board = opponent.board || [];
      for (const row of ['front', 'back']) {
        if (board[row] && board[row].some(u => u !== null)) hasEnemy = true;
      }
      if (!hasEnemy) return false;
    }
    // \u5fc5\u8981\u306b\u5fdc\u3058\u3066\u4ed6\u306e\u30bf\u30fc\u30b2\u30c3\u30c8\uff08\u81ea\u5206\u306e\u30e6\u30cb\u30c3\u30c8\u306a\u3069\uff09\u3082\u8ffd\u52a0\u53ef\u80fd
  }
  return true;
}

function showWarning(message) {
  // \u7c21\u6613\u7684\u306a\u30a2\u30e9\u30fc\u30c8\u8868\u793a\uff08\u65e2\u5b58\u306eUI\u306b\u5408\u308f\u305b\u3066\u8abf\u6574\u53ef\u80fd\uff09
  const toast = document.createElement('div');
  toast.className = 'vfx-toast-warning';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:rgba(220,38,38,0.9); color:white; padding:15px 40px; border-radius:30px; z-index:100000; font-weight:bold; box-shadow:0 0 20px rgba(0,0,0,0.5); pointer-events:none; animation: toast-in-out 2s forwards;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
  if (window.audioManager) window.audioManager.playSE('error');
}


// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
// \u30b5\u30fc\u30d0\u30fc\u304b\u3089\u30ad\u30fc\u30ef\u30fc\u30c9\u306e\u5b9a\u7fa9\uff08\u8aac\u660e\u6587\u306a\u3069\uff09\u3092\u53d6\u5f97\u3057 \u30ec\u30f3\u30c0\u30e9\u30fc\u306b\u63d0\u4f9b\u3057\u307e\u3059 
fetch('/api/keywords')
  .then(res => res.json())
  .then(data => {
    window.keywordMap = data;
    console.log('   [CLIENT] Keyword map loaded:', Object.keys(data).length, 'keywords found.');
  })
  .catch(err => console.error('   [CLIENT] Keyword map load failed:', err));

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
fetch('/api/cards')
  .then(res => res.json())
  .then(data => {
    window.allCards = data;
    console.log('   [CLIENT] All cards loaded:', data.length, 'cards found.');
  })
  .catch(err => console.error('   [CLIENT] Cards load failed:', err));

// === ターゲット選択処理 ===
// これにより 接続完了直後にデータが届いてもこぼさず受け取れます 

// ステータス増減（バフ・デバフ）およびドローを自動検知してSEとVFXを適用する関数
function detectAndPlayStatChanges(oldState, newState) {
  if (!oldState || !newState) return;

  // 1. ドローSEの自動検知
  if (oldState.me && newState.me) {
    const oldHandSize = oldState.me.hand ? oldState.me.hand.length : 0;
    const newHandSize = newState.me.hand ? newState.me.hand.length : 0;
    if (newHandSize > oldHandSize && newState.phase !== 'mulligan') {
      if (window.audioManager) window.audioManager.playSE('draw');
      console.log(`[CLIENT VFX] Draw detected! Hand size went from ${oldHandSize} to ${newHandSize}`);
    }
  }
  if (oldState.opponent && newState.opponent) {
    const oldOppHandSize = oldState.opponent.hand ? oldState.opponent.hand.length : 0;
    const newOppHandSize = newState.opponent.hand ? newState.opponent.hand.length : 0;
    if (newOppHandSize > oldOppHandSize && newState.phase !== 'mulligan') {
      if (window.audioManager) window.audioManager.playSE('draw');
    }
  }

  // 2. バフ・デバフの自動検知
  const oldUnits = {};
  const mapBoard = (board) => {
    if (!board) return;
    for (const row of ['front', 'back']) {
      const slots = board[row];
      if (!slots) continue;
      slots.forEach(unit => {
        if (unit && unit.instanceId) {
          oldUnits[unit.instanceId] = unit;
        }
      });
    }
  };
  mapBoard(oldState.me && oldState.me.board);
  mapBoard(oldState.opponent && oldState.opponent.board);

  const checkNewBoard = (board, owner) => {
    if (!board) return;
    for (const row of ['front', 'back']) {
      const slots = board[row];
      if (!slots) continue;
      for (let lane = 0; lane < 3; lane++) {
        const unit = slots[lane];
        if (unit && unit.instanceId) {
          const oldUnit = oldUnits[unit.instanceId];
          if (oldUnit) {
            const atkDiff = (unit.currentAttack || 0) - (oldUnit.currentAttack || 0);
            const hpDiff = (unit.currentHp || 0) - (oldUnit.currentHp || 0);
            const maxHpDiff = (unit.maxHp || 0) - (oldUnit.maxHp || 0);

            const slotEl = window.VFX ? window.VFX.getBoardSlotEl(owner, row, lane) : null;
            if (slotEl) {
              const rect = slotEl.getBoundingClientRect();
              const container = document.getElementById('game-container');
              const containerRect = container.getBoundingClientRect();
              const scale = containerRect.width / 1920;
              const x = (rect.left + rect.width / 2 - containerRect.left) / scale;
              const y = (rect.top + rect.height / 2 - containerRect.top) / scale;

              if (atkDiff > 0 || maxHpDiff > 0) {
                // 攻撃力または最大生命力の上昇＝バフ！
                const buffText = atkDiff > 0 ? `+${atkDiff} ATK` : `+${maxHpDiff} HP`;
                if (window.triggerDamagePopupVFX) {
                  window.triggerDamagePopupVFX(x, y, buffText, 'gold');
                }
                if (window.VFX && window.VFX.playAbilityFlash) {
                  window.VFX.playAbilityFlash(slotEl, 'gold');
                }
                if (window.audioManager) window.audioManager.playSE('buff');
                console.log(`[CLIENT VFX] Buff detected on ${unit.name} (+${atkDiff}/+${maxHpDiff})`);
              } else if (hpDiff < 0 && maxHpDiff === 0) {
                // 通常の被弾ダメージ！
                const dmgText = `${hpDiff}`;
                if (window.triggerDamagePopupVFX) {
                  window.triggerDamagePopupVFX(x, y, dmgText, 'red');
                }
                if (window.VFX && window.VFX.playAbilityFlash) {
                  window.VFX.playAbilityFlash(slotEl, 'black');
                }
                if (window.audioManager) window.audioManager.playSE('debuff');
                console.log(`[CLIENT VFX] Damage detected on ${unit.name} (${hpDiff})`);
              } else if (atkDiff < 0 || (hpDiff < 0 && maxHpDiff < 0)) {
                // 攻撃力の低下、または最大生命力低下を伴う生命力減少＝デバフ！
                const debuffText = atkDiff < 0 ? `${atkDiff} ATK` : `${hpDiff} HP`;
                if (window.triggerDamagePopupVFX) {
                  window.triggerDamagePopupVFX(x, y, debuffText, 'red');
                }
                if (window.VFX && window.VFX.playAbilityFlash) {
                  window.VFX.playAbilityFlash(slotEl, 'black');
                }
                if (window.audioManager) window.audioManager.playSE('debuff');
                console.log(`[CLIENT VFX] Debuff detected on ${unit.name} (${atkDiff}/${hpDiff})`);
              }
            }
          }
        }
      }
    }
  };

  checkNewBoard(newState.me && newState.me.board, 'me');
  checkNewBoard(newState.opponent && newState.opponent.board, 'opp');

  // 3. SP変動検知 (v139)
  if (oldState.me && newState.me) {
    const oldSp = oldState.me.sp ?? 0;
    const newSp = newState.me.sp ?? 0;
    if (newSp !== oldSp) {
      const diff = newSp - oldSp;
      const spOrbsEl = document.getElementById('my-sp-orbs');
      if (spOrbsEl) {
        spOrbsEl.classList.remove('sp-flash');
        void spOrbsEl.offsetWidth; // リフロー
        spOrbsEl.classList.add('sp-flash');
        setTimeout(() => spOrbsEl.classList.remove('sp-flash'), 800);

        const popup = document.createElement('div');
        popup.className = `sp-diff-popup ${diff > 0 ? 'sp-gain' : 'sp-lose'}`;
        popup.textContent = diff > 0 ? `+${diff}` : `${diff}`;
        
        const rect = spOrbsEl.getBoundingClientRect();
        popup.style.left = `${rect.left + rect.width / 2}px`;
        popup.style.top = `${rect.top - 30}px`;
        document.body.appendChild(popup);
        
        setTimeout(() => {
          popup.remove();
        }, 1200);
      }
    }
  }

  // 4. 神族レベルアップ検知 (v139)
  if (oldState.me && newState.me && oldState.me.tribeLevels && newState.me.tribeLevels) {
    const tribeColors = ['red', 'blue', 'green', 'white', 'black'];
    tribeColors.forEach(color => {
      const oldLevel = oldState.me.tribeLevels[color] || 0;
      const newLevel = newState.me.tribeLevels[color] || 0;
      if (newLevel > oldLevel) {
        console.log(`[CLIENT VFX] Tribe ${color} leveled up to ${newLevel}`);
        
        // HUDバッジのフラッシュ
        const myTribesEl = document.getElementById('my-tribes');
        if (myTribesEl) {
          const badge = myTribesEl.querySelector(`.tribe-${color}`);
          if (badge) {
            badge.classList.remove('level-up-flash');
            void badge.offsetWidth;
            badge.classList.add('level-up-flash');
            setTimeout(() => badge.classList.remove('level-up-flash'), 1500);
          }
        }
        
        // クリスタル結晶ボタンのフラッシュ
        const crystalBtn = document.querySelector(`.crystal-btn[data-color="${color}"]`);
        if (crystalBtn) {
          crystalBtn.classList.remove('level-up-flash');
          void crystalBtn.offsetWidth;
          crystalBtn.classList.add('level-up-flash');
          setTimeout(() => crystalBtn.classList.remove('level-up-flash'), 1500);
        }

        // SE再生
        if (window.audioManager) {
          window.audioManager.playSE('levelUp');
        }
      }
    });
  }
}

// === クライアント主導型スマート・ターンタイマー (60秒制限) ===
let turnTimerInterval = null;
let turnTimeRemaining = 60;

let lastTimerTurnKey = null; // タイマーリセット防止用（同一ターンキー）

function manageTurnTimer(state) {
  // タイマーと警告演出の初期クリア
  clearInterval(turnTimerInterval);
  const timerContainer = document.getElementById('turn-timer-container');
  const timerRingCircle = document.getElementById('timer-ring-circle');
  const timerSeconds = document.getElementById('timer-seconds');
  const indicator = document.getElementById('turn-indicator');
  
  if (timerContainer) {
    timerContainer.classList.remove('warning-pulse');
    timerContainer.style.display = 'none'; // 通常（相手ターン等）は非表示
  }
  if (timerRingCircle) {
    timerRingCircle.style.strokeDashoffset = '0';
  }

  if (!state || state.phase === 'mulligan' || state.phase === 'waiting_mulligan' || state.phase === 'game_over') {
    if (indicator && state && state.phase === 'game_over') {
      indicator.innerHTML = `<div class="turn-number">FINISH</div><div class="turn-phase">GAME OVER</div>`;
    }
    return;
  }

  // 自分のターンか判定
  const isMyTurn = state.currentPlayerId === state.me.id;
  
  // ターン表示の初期化（HTML構造を崩さず、フェーズを綺麗に描画）
  if (indicator) {
    indicator.innerHTML = `<div class="turn-number">TURN ${state.turnNumber}</div><div class="turn-phase">${isMyTurn ? 'YOUR TURN' : "OPPONENT TURN"}</div>`;
  }
  
  if (isMyTurn) {
    // 同一ターン・同一プレイヤーの場合はタイマーをリセットしない
    const thisTurnKey = `${state.turnNumber}_${state.me.id}`;
    const isSameTurn = (thisTurnKey === lastTimerTurnKey);
    if (!isSameTurn) {
      lastTimerTurnKey = thisTurnKey;
      turnTimeRemaining = 90; // 新しいターン開始時のみ90秒にリセット
    }
    
    if (timerContainer) {
      timerContainer.style.display = 'flex'; // 自分ターン時は円形タイマーを表示
    }
    if (timerSeconds) {
      timerSeconds.textContent = turnTimeRemaining;
    }
    
    const maxTime = 90;
    const circumference = 188.4; // 2 * PI * r (30)

    turnTimerInterval = setInterval(() => {
      turnTimeRemaining--;
      
      // タイマー数値と円形プログレスバーの更新
      if (timerSeconds) {
        timerSeconds.textContent = turnTimeRemaining;
      }
      if (timerRingCircle) {
        const progress = turnTimeRemaining / maxTime;
        const offset = circumference * (1 - progress);
        timerRingCircle.style.strokeDashoffset = offset;
      }

      // 残り20秒以下で警告開始（赤脈打ち＋時計針SE）
      if (turnTimeRemaining <= 20 && turnTimeRemaining > 0) {
        if (timerContainer) {
          timerContainer.classList.add('warning-pulse');
        }
        if (window.audioManager) {
          window.audioManager.playSE('timer_tick');
        }
      }

      // 0秒で自動的にターン終了
      if (turnTimeRemaining <= 0) {
        clearInterval(turnTimerInterval);
        console.log('   [CLIENT] Turn timer expired, automatically ending turn.');
        window.pendingAction = true;
        socket.emit('game_action', { action: 'end_turn' });
        
        if (timerContainer) {
          timerContainer.classList.remove('warning-pulse');
        }
        if (timerSeconds) {
          timerSeconds.textContent = '0';
        }
        if (indicator) {
          indicator.innerHTML = `<div class="turn-number">TIME UP!</div><div class="turn-phase">CHANGING TURN</div>`;
        }
      }
    }, 1000);
  }
}

socket.on('game_state', (state) => {
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.style.display = 'none'; // ゲーム状態受信後は非表示
  }
  console.log('   [CLIENT] game_state received:', state ? `Phase: ${state.phase}, Turn: ${state.turnNumber}` : 'NULL');
  if (!state) return;

  // 1. サーバーから送られてきたアニメーション演出（戦闘・スキル発動等）の実行
  if (window.VFX && window.VFX.processAnimationEvents && state.animationEvents) {
    window.VFX.processAnimationEvents(state.animationEvents, state.me.id);
  }

  // 2. バフ・デバフ・ドローの自動検知SEの実行
  if (window.gameState) {
    detectAndPlayStatChanges(window.gameState, state);
  }
  
  window.gameState = state;
  window.pendingAction = false; // 通信完了につきロック解除

  // ターンタイマーの管理始動
  manageTurnTimer(state);

  const tryUpdate = () => {
    if (typeof window.updateUI === 'function') {
      window.updateUI();
      console.log('   [CLIENT] UI Updated');
    } else {
      console.warn('   [CLIENT] updateUI not ready, retrying in 100ms...');
      setTimeout(tryUpdate, 100);
    }
  };
  tryUpdate();

  // === ターゲット選択処理 ===
  if (state.phase !== 'mulligan' && state.phase !== 'waiting_mulligan') {
    const mulliganOverlay = document.getElementById('mulligan-overlay');
    if (mulliganOverlay && mulliganOverlay.style.display !== 'none') {
      mulliganOverlay.style.display = 'none';
    }
  }
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
// \u6839\u672c\u539f\u56e0: onPointerUp   updateUI() \u304cDOM\u3092\u518d\u69cb\u7bc9\u3059\u308b\u305f\u3081 
// \u540c\u4e00\u8981\u7d20\u3067\u306emousedown/mouseup\u30da\u30a2\u304c\u6210\u7acb\u305b\u305a click \u30a4\u30d9\u30f3\u30c8\u304c\u751f\u6210\u3055\u308c\u306a\u3044 
// \u89e3\u6c7a\u7b56: pointerdown\uff08\u30ad\u30e3\u30d7\u30c1\u30e3\u30d5\u30a7\u30fc\u30ba\uff09\u3067\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u3092\u5373\u5ea7\u306b\u51e6\u7406\u3059\u308b 
document.addEventListener('pointerdown', function(e) {
  const state = window.gameState;
  if (!state || state.phase !== 'targeting') return;
  if (state.currentPlayerId !== state.me.id) return;
  
  // \u53f3\u30af\u30ea\u30c3\u30af(1\u4ee5\u4e0a)\u306f\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u3068\u3057\u3066\u6271\u308f\u305a 
  // \u30ab\u30fc\u30c9\u8a73\u7d30\uff08contextmenu\uff09\u306a\u3069\u306e\u30c7\u30d5\u30a9\u30eb\u30c8\u6319\u52d5\u3092\u512a\u5148\u3055\u305b\u308b
  if (e.button !== 0) return;

  // \u30af\u30ea\u30c3\u30af\u3055\u308c\u305f\u8981\u7d20\u304b\u3089 can-target \u30b9\u30ed\u30c3\u30c8\u3092\u63a2\u3059
  const slot = e.target.closest('.board-slot.can-target');
  if (!slot) return;

  const row = slot.dataset.row;
  const lane = parseInt(slot.dataset.lane);
  
  console.log(`   [CLIENT] Targeting pointerdown: row=${row}, lane=${lane}`);
  
  const sourceInfo = state.pendingAbilitySource;
  if (sourceInfo && (sourceInfo.targetId === 'empty_slot' || sourceInfo.effect === 'summon_token')) {
    const unitAtSlot = state.me.board[row] && state.me.board[row][lane];
    if (unitAtSlot) {
      console.warn('   [CLIENT] Slot is occupied, ignoring.');
      return;
    }
  }
  
  console.log(`   [CLIENT] Emitting select_target: row=${row}, lane=${lane}`);
  window.pendingAction = true;
  socket.emit('game_action', { action: 'select_target', targetRow: row, targetLane: lane });
  
  // \u5f8c\u7d9a\u306e\u30a4\u30d9\u30f3\u30c8\uff08pointermove, pointerup, click\uff09\u3092\u5168\u3066\u6b62\u3081\u308b
  e.stopPropagation();
  e.preventDefault();
}, true); // true = \u30ad\u30e3\u30d7\u30c1\u30e3\u30d5\u30a7\u30fc\u30ba\uff08\u6700\u512a\u5148\uff09

socket.on('mulligan_phase', (data) => {
  console.log('   [CLIENT] mulligan_phase received');
  if (window.audioManager) window.audioManager.fadeToBGM('deck', 1200);

  // VS激突カットインを発火
  if (window.VFX && window.VFX.triggerVsCutin) {
    window.VFX.triggerVsCutin();
  }

  // カットイン完了後（約2.2秒後）にマリガン選択画面を表示
  setTimeout(() => {
    if (typeof showMulligan === 'function') {
      showMulligan(data.hand, (redrawIndices) => {
        socket.emit('mulligan_decision', { redrawIndices });
      });
    }
  }, 2200);
});

socket.on('error_msg', (data) => {
  console.error('  [CLIENT] Game error:', data.message);
  if (window.audioManager) window.audioManager.playSE('error');
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===

function requestSessionRestore() {
  const signal = document.getElementById('debug-signal');
  const sessionId = sessionStorage.getItem('sessionId');
  if (sessionId) {
    console.log('   [CLIENT] Requesting session restore for:', sessionId.slice(0, 8));
    socket.emit('restore_session', { sessionId });
    if (signal) {
      signal.textContent = 'STATUS: REQUESTING...';
      signal.style.background = 'rgba(0,191,255,0.8)';
    }
  } else {
    console.warn('   [CLIENT] No sessionId found in sessionStorage');
    if (signal) {
      signal.textContent = 'STATUS: NO SESSION ID (Back to Lobby)';
      signal.style.background = 'rgba(0,0,0,0.8)';
    }
  }
}

socket.on('session_restored', (data) => {
  console.log('   [CLIENT] Session restored successfully');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: AUTHORIZED (Waiting Data)';
    signal.style.background = 'rgba(147,112,219,0.8)';
  }
});

socket.on('session_invalid', () => {
  console.error('  [CLIENT] Session invalid');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: INVALID SESSION';
    signal.style.background = 'rgba(128,0,128,0.8)';
  }
});

socket.on('difficulty_changed', (data) => {
  console.log(`[CLIENT] AI difficulty synchronized: ${data.difficulty}`);
  const selectDiff = document.getElementById('select-difficulty');
  if (selectDiff) {
    selectDiff.value = data.difficulty;
  }
});

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===
const manualHtml = `
<div class="manual-section">
  <h3>1. \u57fa\u672c\u30eb\u30fc\u30eb (Basic Rules)</h3>
  <p>\u672c\u30b2\u30fc\u30e0\u306f<b>3\u3064\u306e\u30ec\u30fc\u30f3</b>\u3068<b>2\u3064\u306e\u5217\uff08\u524d\u5217\u30fb\u5f8c\u5217\uff09</b>\u3067\u69cb\u6210\u3055\u308c\u308b\u76e4\u9762\u3067\u6226\u3046\u5bfe\u6226\u578b\u30ab\u30fc\u30c9\u30b2\u30fc\u30e0\u3067\u3059 </p>
  <div class="rule-box">
    <b>\u52dd\u5229\u6761\u4ef6:</b><br>
    \u30fb\u76f8\u624b\u306e\u5168\u30b7\u30fc\u30eb\u30c9\u3092\u7834\u58ca\u3057 \u672c\u4f53\u3078\u306e<b>\u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af</b>\u3092\u6210\u529f\u3055\u305b\u308b <br>
    \u30fb\u76f8\u624b\u306e\u5c71\u672d\u304c0\u679a\u306b\u306a\u308a \u30c9\u30ed\u30fc\u3067\u304d\u306a\u304f\u306a\u308b\uff08\u30c7\u30c3\u30ad\u30a2\u30a6\u30c8\uff09 
  </div>
</div>

<div class="manual-section">
  <h3>2. \u30ea\u30bd\u30fc\u30b9\u7ba1\u7406 (Resources)</h3>
  <p><b>SP (\u7075\u529b):</b> \u30ab\u30fc\u30c9\u306e\u30d7\u30ec\u30a4\u3084\u795e\u65cf\u30ec\u30d9\u30eb\u4e0a\u3052\u306b\u4f7f\u7528 \u6bce\u30bf\u30fc\u30f3\u958b\u59cb\u6642\u306b <b>3 SP</b>\uff08\u5f8c\u653b1\u30bf\u30fc\u30f3\u76ee\u306f4\uff09\u7372\u5f97\u3057\u307e\u3059 </p>
  <p><b>\u795e\u65cf\u30ec\u30d9\u30eb:</b> \u8d64\u30fb\u9752\u30fb\u7dd1\u30fb\u767d\u30fb\u9ed2\u306e5\u5c5e\u6027 \u30ab\u30fc\u30c9\u3092\u51fa\u3059\u306b\u306f \u305d\u306e\u8272\u306e\u30ec\u30d9\u30eb\u304c<b>\u30ab\u30fc\u30c9\u306e\u30b3\u30b9\u30c8\u4ee5\u4e0a</b>\u3067\u3042\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059 </p>
  <div class="rule-box">
    <b>\u30ec\u30d9\u30eb\u4e0a\u3052:</b> 1 SP \u6d88\u8cbb\u3057\u3066 \u5c5e\u6027\u30ec\u30d9\u30eb\u3092 1 \u4e0a\u3052\u3089\u308c\u307e\u3059\uff08\u6700\u5927Lv.9\uff09 \u30ec\u30d9\u30eb\u306f\u6d88\u8cbb\u3055\u308c\u305a \u4e00\u5ea6\u4e0a\u3052\u308c\u3070\u30bf\u30fc\u30f3\u306e\u9593\u305a\u3063\u3068\u6709\u52b9\u3067\u3059 
  </div>
</div>

<div class="manual-section">
  <h3>3. \u914d\u7f6e\u3068\u30ac\u30fc\u30c9 (Lanes & Rows)</h3>
  <p>\u30e6\u30cb\u30c3\u30c8\u306f3\u3064\u306e\u30ec\u30fc\u30f3\u306e\u3044\u305a\u308c\u304b\u306e\u524d\u5217\u307e\u305f\u306f\u5f8c\u5217\u306b\u914d\u7f6e\u3057\u307e\u3059 </p>
  <div class="rule-box">
    <b>\u30ac\u30fc\u30c9\u306e\u4ed5\u7d44\u307f:</b> \u540c\u30ec\u30fc\u30f3\u306e<b>\u524d\u5217\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u308b\u5834\u5408 \u76f8\u624b\u306f\u305d\u306e\u30ec\u30fc\u30f3\u306e\u5f8c\u5217\u3084\u30b7\u30fc\u30eb\u30c9\u3092\u653b\u6483\u3067\u304d\u307e\u305b\u3093</b> \u524d\u5217\u306f\u5f37\u529b\u306a\u9632\u58c1\u3068\u306a\u308a\u307e\u3059 <br>
     \u524d\u5217\u30fb\u5f8c\u5217\u306e\u4e21\u65b9\u304c\u7a7a\u306e\u30ec\u30fc\u30f3\u3067\u306e\u307f \u76f8\u624b\u306f\u30b7\u30fc\u30eb\u30c9\u3092\u653b\u6483\u53ef\u80fd\u3067\u3059 
  </div>
</div>

<div class="manual-section">
  <h3>4. \u6226\u95d8\u30eb\u30fc\u30eb (Combat)</h3>
  <p>\u653b\u6483\u5074\u304c\u30c0\u30e1\u30fc\u30b8\u3092\u4e0e\u3048\u308b\u3068\u540c\u6642\u306b \u9632\u5fa1\u5074\u3082\u653b\u6483\u529b\u5206\u306e\u30c0\u30e1\u30fc\u30b8\u3092 \u53cd\u6483 \u3068\u3057\u3066\u4e0e\u3048\u307e\u3059 HP\u304c0\u306b\u306a\u3063\u305f\u30e6\u30cb\u30c3\u30c8\u306f\u7834\u58ca\u3055\u308c\u307e\u3059 </p>
  <p><b>\u9023\u6483 (Double Strike):</b> \u653b\u6483\u6642\u306b2\u56de\u30c0\u30e1\u30fc\u30b8 1\u6483\u76ee\u3067\u6575\u3092\u5012\u305b\u3070\u53cd\u6483\u3092\u53d7\u3051\u305a\u7121\u50b7\u3067\u52dd\u5229\u3067\u304d\u307e\u3059 </p>
</div>

<div class="manual-section">
  <h3>5. \u80fd\u529b\u30ad\u30fc\u30ef\u30fc\u30c9 (Keywords)</h3>
  <ul style="list-style: none; padding: 0; line-height: 1.6;" id="help-keyword-list">
    <li> \u30c7\u30fc\u30bf\u3092\u8aad\u307f\u8fbc\u3093\u3067\u3044\u307e\u3059...</li>
  </ul>
</div>
`;

function showGameManual() {
  const overlay = document.getElementById('help-overlay');
  const content = document.getElementById('help-content');
  const settingsOverlay = document.getElementById('settings-overlay');
  
  if (overlay && content) {
    // \u8a2d\u5b9a\u753b\u9762\u304c\u958b\u3044\u3066\u3044\u308c\u3070\u9589\u3058\u308b
    if (settingsOverlay) settingsOverlay.style.display = 'none';
    
    content.innerHTML = manualHtml;

    // \u30ad\u30fc\u30ef\u30fc\u30c9\u4e00\u89a7\u3092\u52d5\u7684\u751f\u6210
    const kwList = document.getElementById('help-keyword-list');
    if (kwList && window.keywordMap) {
      let kwHtml = '';
      Object.values(window.keywordMap).forEach(kw => {
         if (kw.name && kw.description) {
            kwHtml += `<li style="margin-bottom: 6px;"><b> ${kw.name} </b>: ${kw.description}</li>`;
         }
      });
      kwList.innerHTML = kwHtml;
    }

    overlay.style.display = 'flex';
    if (window.audioManager) window.audioManager.playSE('click');
  }
}

// \u30d8\u30eb\u30d7\u6a5f\u80fd\u306e\u521d\u671f\u5316
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

// \u30b9\u30af\u30ea\u30d7\u30c8\u8aad\u307f\u8fbc\u307f\u6642\u306b\u5b9f\u884c
initHelpManual();

socket.on('connect', () => {
  console.log('   [CLIENT] Socket connected via event');
  const signal = document.getElementById('debug-signal');
  if (signal) {
    signal.textContent = 'STATUS: CONNECTED';
    signal.style.background = 'rgba(255,165,0,0.8)';
  }
  requestSessionRestore();
});

// \u5373\u6642\u63a5\u7d9a\u6e08\u307f\u306e\u5834\u5408\u306e\u30ac\u30fc\u30c9\u30ec\u30fc\u30eb
if (socket.connected) {
  console.log('   [CLIENT] Socket ALREADY connected, proceeding immediately');
  requestSessionRestore();
}

// === \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u51e6\u7406 ===

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
let dragStartPos = null; // \u8aa4\u7206\u9632\u6b62\u7528\uff1a\u30c9\u30e9\u30c3\u30b0\u958b\u59cb\u5730\u70b9
const DRAG_THRESHOLD = 50; // 50px\u4ee5\u4e0a\u52d5\u304b\u3055\u306a\u3044\u3068\u30d7\u30ec\u30a4\u3055\u308c\u306a\u3044
let attackerPos = null;
let pendingShieldAttack = null;
let selectedTribeColor = null; // \u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u78ba\u8a8d\u7528

// 最もclientXに近いプレイヤー側の空きスロットを探す（フリックプレイ用）
function getBestEmptySlot(clientX) {
  const state = window.gameState;
  if (!state || !state.me || !state.me.board) return null;

  const boardEl = document.getElementById('player-board');
  if (!boardEl) return null;

  // プレイヤー側の空いている board-slot をすべて取得
  const slots = Array.from(boardEl.querySelectorAll('.board-slot.empty'));
  if (slots.length === 0) return null;

  let bestSlot = null;
  let minDistance = Infinity;

  slots.forEach(slot => {
    const rect = slot.getBoundingClientRect();
    const slotCenterX = rect.left + rect.width / 2;
    const dist = Math.abs(clientX - slotCenterX);
    if (dist < minDistance) {
      minDistance = dist;
      bestSlot = slot;
    }
  });

  if (bestSlot) {
    return {
      row: bestSlot.dataset.row,
      lane: parseInt(bestSlot.dataset.lane),
      element: bestSlot
    };
  }
  return null;
}

function onPointerMove(e) {
  if (isDragging && dragGhost) {
    dragGhost.style.left = `${e.clientX - 90}px`;
    dragGhost.style.top = `${e.clientY - 126}px`;

    // 本物の物理演算（角速度 vx, vy への慣性力の加算）
    const forceX = Math.max(-10, Math.min(10, e.movementY * 0.45));
    const forceY = Math.max(-10, Math.min(10, -e.movementX * 0.45));
    dragPhysics.vx += forceX;
    dragPhysics.vy += forceY;

    // カードドラッグ中（スペル or ユニット共通）のホバー表示
    const state = window.gameState;
    if (state && dragSource && dragSource.type === 'hand') {
      const card = state.me.hand[dragSource.index];

      // === スマホ対応：フリック（スワイプ）プレイ用の最適空きスロット検知 ===
      const isSwipeUp = dragStartPos && (dragStartPos.y - e.clientY) > 100;
      
      // 既存のスナップハイライトを全解除
      document.querySelectorAll('.board-slot.can-place-highlight').forEach(s => s.classList.remove('can-place-highlight'));
      
      if (isSwipeUp && card && card.type !== 'spell') {
        const snappedSlot = getBestEmptySlot(e.clientX);
        if (snappedSlot && snappedSlot.element) {
          // スナップ先が新しく有効化、あるいは別のスロットに切り替わった瞬間にスナップ音を再生
          if (!window.activeSnappedSlot || window.activeSnappedSlot.element !== snappedSlot.element) {
            if (window.audioManager) window.audioManager.playSE('flick_snap');
          }
          snappedSlot.element.classList.add('can-place-highlight');
          window.activeSnappedSlot = snappedSlot;
        } else {
          window.activeSnappedSlot = null;
        }
      } else {
        window.activeSnappedSlot = null;
      }
      const coords = getInternalCoords(e.clientX, e.clientY);
      const svg = document.getElementById('attack-arrow-svg');
      const line = document.getElementById('attack-arrow-line');
      const cardRect = document.querySelector(`[data-index="${dragSource.index}"]`)?.getBoundingClientRect();

      // ターゲット候補の特定（全カード共通）
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetSlot = elements.find(el => el.classList.contains('board-slot'));
      
      // 全スロットのホバー・プレビュー解除
      document.querySelectorAll('.board-slot').forEach(s => {
        s.classList.remove('is-hovered');
        s.classList.remove('drag-over-valid');
        s.classList.remove('drag-over-invalid');
      });

      if (targetSlot) {
        targetSlot.classList.add('is-hovered');
        
        if (card) {
          const isSpell = card.type === 'spell';
          const isMyBoard = targetSlot.closest('#player-board') !== null;
          
          if (!isSpell) {
            // ユニットの場合
            const row = targetSlot.dataset.row;
            const lane = parseInt(targetSlot.dataset.lane);
            const isSlotEmpty = state.me.board && state.me.board[row] && !state.me.board[row][lane];
            
            const myLevels = state.me.tribeLevels || {};
            const cardColors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
            const hasTribeLevel = cardColors.every(col => (myLevels[col] || 0) >= (card.cost || 0));
            const canPlay = (state.me.sp || 0) >= (card.cost || 0) && hasTribeLevel;
            
            // 配置可能条件：味方盤面、スロット空、リソース(SP/レベル)が足りる
            if (isMyBoard && isSlotEmpty && canPlay) {
              targetSlot.classList.add('drag-over-valid');
            } else {
              targetSlot.classList.add('drag-over-invalid');
            }
          } else {
            // スペルの場合：リソースが足りるなら valid、足りないなら invalid としてプレビュー
            const myLevels = state.me.tribeLevels || {};
            const cardColors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
            const hasTribeLevel = cardColors.every(col => (myLevels[col] || 0) >= (card.cost || 0));
            const canPlay = (state.me.sp || 0) >= (card.cost || 0) && hasTribeLevel;
            
            if (canPlay) {
              targetSlot.classList.add('drag-over-valid');
            } else {
              targetSlot.classList.add('drag-over-invalid');
            }
          }
        }
      }

      // \u30b9\u30da\u30eb\u306e\u5834\u5408\u306e\u307f\u77e2\u5370\u3092\u8868\u793a
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

        // 曲線(Quadratic Bezier)の描画
        const cpX = (start.x + targetX) / 2;
        const cpY = (start.y + targetY) / 2 - 100; // 少し上に膨らませる
        line.setAttribute('d', `M ${start.x} ${start.y} Q ${cpX} ${cpY} ${targetX} ${targetY}`);
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

      // 曲線(Quadratic Bezier)の描画
      const cpX = (attackerPos.x + targetX) / 2;
      const cpY = (attackerPos.y + targetY) / 2 - 150; // 少し上に膨らませる
      line.setAttribute('d', `M ${attackerPos.x} ${attackerPos.y} Q ${cpX} ${cpY} ${targetX} ${targetY}`);
    }
  }
}

function cleanupDrag() {
  isDragging = false;
  dragSource = null;
  dragStartPos = null;
  window.activeSnappedSlot = null;
  window.selectedCard = null;
  dragPhysics.active = false;
  
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  
  const svg = document.getElementById('attack-arrow-svg');
  if (svg) svg.style.display = 'none';
  
  document.querySelectorAll('.board-slot').forEach(s => {
    s.classList.remove('can-place-highlight');
    s.classList.remove('is-hovered');
    s.classList.remove('drag-over-valid');
    s.classList.remove('drag-over-invalid');
  });
  
  if (typeof window.updateUI === 'function') window.updateUI();
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
      console.log('    [CLIENT] Drag cancelled: Under threshold', dist);
      cleanupDrag();
      return;
    } else {
      const card = state.me.hand[dragSource.index];
      const isSpell = card && card.type === 'spell';

      // === スマホ対応：フリック（スワイプ）による自動スナッププレイ ===
      if (!isSpell && window.activeSnappedSlot) {
        const slot = window.activeSnappedSlot;
        console.log(`   [CLIENT] Flick Snap Play Triggered: row=${slot.row}, lane=${slot.lane}`);
        
        window.pendingAction = true;
        socket.emit('game_action', { 
          action: 'play_card', 
          handIndex: dragSource.index, 
          targetRow: slot.row, 
          targetLane: slot.lane 
        });
        
        if (window.audioManager) window.audioManager.playSE('card_play');
        cleanupDrag();
        return;
      }

      // スペルの対象チェック（対象がいない場合は警告を出して中断）
      if (isSpell && card.abilities) {
        let hasValidTarget = true;
        for (const ability of card.abilities) {
          if (!ability.target) continue;
          if (ability.target.includes('self_unit')) {
            const hasMyUnit = Object.values(state.me.board).some(row => row.some(u => u !== null));
            if (!hasMyUnit) hasValidTarget = false;
          } else if (ability.target.includes('enemy_unit')) {
            const hasEnemyUnit = Object.values(state.opponent.board).some(row => row.some(u => u !== null));
            if (!hasEnemyUnit) hasValidTarget = false;
          }
        }

        if (!hasValidTarget) {
            console.warn('   [CLIENT] No valid targets for this spell');
            if (window.audioManager) window.audioManager.playSE('error');
            cleanupDrag();
            alert('適切な対象がいません');
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
        if (window.audioManager) window.audioManager.playSE('card_play');
      }
    }
  }
  
  if (isDraggingAttack && dragSource && dragSource.type === 'unit' && state) {
    const targetEl = elements.find(el => el.classList.contains('board-slot') || el.id === 'opp-shields' || el.classList.contains('is-locked-on'));
    if (targetEl && state.opponent) {
      // ロックオンされている要素 またはID/クラスで特定
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
  window.activeSnappedSlot = null; // スナップ用キャッシュリセット
  window.selectedCard = null; // \u63b4\u3093\u3067\u3044\u308b\u30ab\u30fc\u30c9\u60c5\u5831\u3092\u30af\u30ea\u30a2
  if (typeof window.updateUI === 'function') window.updateUI();
}

window.handleCardPointerDown = function(e, index) {
  // \u53f3\u30af\u30ea\u30c3\u30af\u7b49\uff08\u30c9\u30e9\u30c3\u30b0\u4ee5\u5916\uff09\u306e\u6642\u306f\u30c9\u30e9\u30c3\u30b0\u51e6\u7406\u3092\u884c\u308f\u305a\u305d\u306e\u307e\u307e\u901a\u3059
  if (e.button !== 0) return;

  const state = window.gameState;
  // \u8aa4\u64cd\u4f5c\u30ac\u30fc\u30c9: \u81ea\u5206\u306e\u756a\u3067\u306a\u3044 \u307e\u305f\u306f\u5f85\u6a5f\u30d5\u30a7\u30fc\u30ba\u4ee5\u5916\u306f\u5165\u529b\u3092\u7121\u8996
  if (!state || state.currentPlayerId !== state.me.id || state.phase !== 'main') {
    console.warn('    [CLIENT] Action blocked: Not your turn or in targeting phase');
    return;
  }
  if (window.pendingAction) return;

  const card = state.me.hand[index];
  window.selectedCard = card; // レンダラーに掴んでいるカードを伝える
  isDragging = true;
  dragSource = { type: 'hand', index };
  dragStartPos = { x: e.clientX, y: e.clientY };

  // --- 慣性ドラッグ物理シミュレータの開始 ---
  dragPhysics.active = true;
  dragPhysics.x = 0; dragPhysics.y = 0;
  dragPhysics.vx = 0; dragPhysics.vy = 0;
  if (!dragPhysics.rafId) {
    dragPhysics.rafId = requestAnimationFrame(updateDragPhysics);
  }

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
  // \u901a\u4fe1\u4e2d\u304b\u3064\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u4e2d\u4ee5\u5916\u306a\u3089\u5165\u529b\u3092\u30ac\u30fc\u30c9
  if (window.pendingAction && state.phase !== 'targeting') return;

  // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba\u4e2d\u306f pointerdown\u30ad\u30e3\u30d7\u30c1\u30e3\u3067\u51e6\u7406\u3059\u308b\u305f\u3081
  // \u3053\u3053\u3067\u306f\u5168\u3066\u306e\u64cd\u4f5c\u3092\u30d6\u30ed\u30c3\u30af\u3057\u3066\u4f55\u3082\u3057\u306a\u3044
  if (state.phase === 'targeting') {
      return;
  }

  // \u4ee5\u4e0b\u306f targeting \u30d5\u30a7\u30fc\u30ba\u4ee5\u5916\uff08\u901a\u5e38\u6642\uff09\u306e\u51e6\u7406
  if (type === 'unit_pointerdown') {
    // \u53f3\u30af\u30ea\u30c3\u30af\u306a\u3069\uff08\u5de6\u30af\u30ea\u30c3\u30af\u4ee5\u5916\uff09\u306e\u5834\u5408\u306f\u30c9\u30e9\u30c3\u30b0\u3092\u958b\u59cb\u305b\u305a\u8a73\u7d30\u8868\u793a\u7b49\u306e\u5225\u51e6\u7406\u306b\u8b72\u308b
    if (e.button !== 0) return;

    const unit = state.me.board[row][lane];
    if (!unit || !unit.canAttack) return;
    isDraggingAttack = true;
    dragSource = { type: 'unit', row, lane };
    const rect = e.currentTarget.getBoundingClientRect();
    attackerPos = getInternalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
    e.preventDefault();
  } else if (type === 'place_unit') {
    // \u624b\u672d\u306e\u30ab\u30fc\u30c9\u3092\u4f7f\u7528/\u914d\u7f6e\u3059\u308b\u51e6\u7406
    if (window.selectedCardIndex !== null) {
      const card = window.gameState.me.hand[window.selectedCardIndex];
      if (!canPlaySpell(card)) {
        showWarning('\u6709\u52b9\u306a\u5bfe\u8c61\u304c\u3044\u307e\u305b\u3093');
        window.selectedCardIndex = null;
        if (typeof window.updateUI === 'function') window.updateUI();
        return;
      }
      socket.emit('game_action', { 
        action: 'play_card', 
        handIndex: window.selectedCardIndex, 
        targetRow: row, 
        targetLane: lane 
      });
      if (window.audioManager) window.audioManager.playSE('card_play');
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
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });

  document.getElementById('btn-shield-cancel')?.addEventListener('click', () => {
    pendingShieldAttack = null;
    isDraggingAttack = false;
    dragSource = null;
    if (typeof window.updateUI === 'function') window.updateUI();
    document.getElementById('shield-confirm-overlay').style.display = 'none';
  });

  // --- \u8a2d\u5b9a\u30d1\u30cd\u30eb ---
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
    if (window.audioManager) {
      sliderBGM.value = window.audioManager.bgmVolume;
    }
    sliderBGM.oninput = (e) => {
      if (window.audioManager) window.audioManager.updateBGMVolume(e.target.value);
    };
  }
  if (sliderSE) {
    if (window.audioManager) {
      sliderSE.value = window.audioManager.seVolume;
    }
    sliderSE.oninput = (e) => {
      if (window.audioManager) window.audioManager.updateSEVolume(e.target.value);
    };
  }

  // --- BGM \u9078\u629e ---
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

  // --- AI 難易度選択 ---
  const selectDiff = document.getElementById('select-difficulty');
  if (selectDiff) {
    selectDiff.onchange = (e) => {
      const difficulty = e.target.value;
      console.log(`[CLIENT] Requesting difficulty change: ${difficulty}`);
      socket.emit('change_difficulty', { difficulty });
      if (window.audioManager) window.audioManager.playSE('click');
    };
  }

  // --- リザルト画面アクション ---
  document.getElementById('btn-result-back')?.addEventListener('click', () => {
    // セッションをクリアしてロビーに戻る
    sessionStorage.removeItem('sessionId');
    window.location.href = '/';
  });

  // --- \u795e\u65cf\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7 ---
  const crystalConfirm = document.getElementById('crystal-confirm-popup');
  document.querySelectorAll('.crystal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const state = window.gameState;
      if (!state) return;
      
      // SP\u4e0d\u8db3\u30c1\u30a7\u30c3\u30af
      if (!state.me || (state.me.sp || 0) <= 0) {
        console.warn('   SP\u4e0d\u8db3\uff1a\u30ec\u30d9\u30eb\u30a2\u30c3\u30d7\u3067\u304d\u307e\u305b\u3093');
        if (window.audioManager) window.audioManager.playSE('error');
        return;
      }

      selectedTribeColor = e.target.dataset.color;
      
      // \u30a2\u30a4\u30b3\u30f3\u306e\u53cd\u6620
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

  // --- \u80fd\u529b\u767a\u52d5 ---
  document.getElementById('btn-activate-ability')?.addEventListener('click', () => {
    // \u9078\u629e\u4e2d\u306e\u30e6\u30cb\u30c3\u30c8\u60c5\u5831\u3092\u53d6\u5f97 (\u73fe\u5728\u306f\u30c9\u30e9\u30c3\u30b0\u30bd\u30fc\u30b9\u3084selectedCardIndex\u304b\u3089\u63a8\u6e2c)
    // \u3053\u3053\u3067\u306f\u30b0\u30ed\u30fc\u30d0\u30eb\u306a\u9078\u629e\u72b6\u614b\u304b\u3089\u767a\u52d5\u3055\u305b\u308b\u30b7\u30f3\u30d7\u30eb\u306a\u5b9f\u88c5\u306b\u3057\u307e\u3059
    console.log('  \u80fd\u529b\u767a\u52d5\uff1a\u73fe\u5728\u306f\u76f4\u63a5\u653b\u6483\u30c9\u30e9\u30c3\u30b0\u3067\u5bfe\u5fdc\u3057\u3066\u3044\u307e\u3059\u304c \u30dc\u30bf\u30f3\u3082\u6709\u52b9\u5316');
    const state = window.gameState;
    if (!state) return;
    // ... \u9069\u6642\u62e1\u5f35\u53ef\u80fd\u306a\u3088\u3046\u306b\u69cb\u9020\u3092\u7528\u610f ...
    socket.emit('game_action', { action: 'activate_ability', unitRow: 'front', unitLane: 0, abilityIndex: 0 }); 
  });
}

function showMulligan(hand, onSubmit) {
  const overlay = document.getElementById('mulligan-overlay');
  const container = document.getElementById('mulligan-cards');
  if (!overlay || !container) return;
  container.innerHTML = '';
  
  const selectedIndices = new Set();
  
  hand.forEach((card, index) => {
    const el = document.createElement('div');
    el.className = 'hand-card';
    const bgImage = (typeof window.getCardImagePath === 'function') 
      ? window.getCardImagePath(card) 
      : `/assets/images/cards/neutral/${card.artId || card.id}.webp`;
    el.style.backgroundImage = `url('${bgImage}')`;
    el.innerHTML = `<div class="card-overlay"><div class="cost-gem">${card.cost}</div></div>`;
    
    // カードをクリックした時の選択トグル処理
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (selectedIndices.has(index)) {
        selectedIndices.delete(index);
        el.classList.remove('selected-for-redraw');
        if (window.audioManager) window.audioManager.playSE('mulligan_select');
      } else {
        selectedIndices.add(index);
        el.classList.add('selected-for-redraw');
        if (window.audioManager) window.audioManager.playSE('mulligan_select');
      }
    });

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
      if (window.audioManager) window.audioManager.playSE('mulligan_swap');
      if (callback) callback();
    });
  };

  // 「選択したカードを交換」ボタン
  setupBtn('btn-mulligan-confirm', () => {
    const redrawIndices = Array.from(selectedIndices);
    onSubmit(redrawIndices);
  });

  // 「すべてキープ」ボタン
  setupBtn('btn-mulligan-keep-all', () => {
    onSubmit([]);
  });
}

// \u7834\u68c4\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u9001\u4fe1
window.emitDiscardCards = function(cardIndices) {
  console.log('    [CLIENT] Emitting discard_cards:', cardIndices);
  socket.emit('game_action', { 
    action: 'discard_cards', 
    cardIndices: cardIndices 
  });
  if (window.audioManager) window.audioManager.playSE('click');
};

// \u6700\u5f8c\u306b\u521d\u671f\u5316\u3092\u5b9f\u884c

  // --- \u30b7\u30fc\u30eb\u30c9\u30d6\u30ec\u30a4\u30af\u6f14\u51fa\u306e\u7d9a\u884c ---
  const sbOverlay = document.getElementById('shield-break-overlay');
  if (sbOverlay) {
    sbOverlay.addEventListener('click', () => {
      sbOverlay.style.display = 'none';
      socket.emit('game_action', { action: 'resolve_shield_break' });
      if (window.audioManager) window.audioManager.playSE('click');
    });
  }

initInteractions();

// Fullscreen Toggle
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

  // === 📜 戦闘履歴トグルドロワーの開閉制御 ===
  const logToggleBtn = document.getElementById('log-toggle-btn');
  const logDrawer = document.getElementById('log-drawer');
  const logDrawerClose = document.getElementById('log-drawer-close');

  if (logToggleBtn && logDrawer) {
    logToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      logDrawer.classList.toggle('active');
      if (window.audioManager) window.audioManager.playSE('click');
    });
  }
  if (logDrawerClose && logDrawer) {
    logDrawerClose.addEventListener('click', (e) => {
      e.stopPropagation();
      logDrawer.classList.remove('active');
      if (window.audioManager) window.audioManager.playSE('click');
    });
  }
  // ドロワーの外側をクリックした際に自動で閉じるUX
  document.addEventListener('click', (e) => {
    if (logDrawer && logDrawer.classList.contains('active')) {
      if (!logDrawer.contains(e.target) && e.target !== logToggleBtn) {
        logDrawer.classList.remove('active');
      }
    }
  });

  // =====================================================
  // 墓地ビューワー
  // =====================================================
  (function initGraveyardViewer() {
    const gyOverlay   = document.getElementById('graveyard-overlay');
    const gyGrid      = document.getElementById('gy-grid');
    const gyTitleCnt  = document.getElementById('gy-title-count');
    const gyCloseBtn  = document.getElementById('gy-close-btn');
    const gyTabMine   = document.getElementById('gy-tab-mine');
    const gyTabOpp    = document.getElementById('gy-tab-opp');
    const myGraveBtn  = document.getElementById('my-grave-btn');
    const oppGraveBtn = document.getElementById('opp-grave-btn');

    if (!gyOverlay || !gyGrid) return;

    // 現在表示中のターゲット（'mine' | 'opp'）
    let currentTarget = 'mine';

    // -------------------------------------------------------
    // カードを graveyard 配列からグリッドに描画する
    // -------------------------------------------------------
    function renderGyGrid(cards) {
      gyGrid.innerHTML = '';
      if (!cards || cards.length === 0) {
        gyGrid.innerHTML = '<div class="gy-empty">まだカードはありません</div>';
        if (gyTitleCnt) gyTitleCnt.textContent = '0';
        return;
      }

      if (gyTitleCnt) gyTitleCnt.textContent = String(cards.length);

      cards.forEach(card => {
        const rarity = card.rarity || 1;
        const imgPath = window.getCardImagePath
          ? window.getCardImagePath(card)
          : `/assets/images/card/${card.id || 'default'}.jpg`;

        const item = document.createElement('div');
        item.className = `gy-card-item gy-rarity-${rarity}`;

        // ステータス（ユニットのみ）
        const statsHtml = (card.type !== 'spell' && card.attack !== undefined)
          ? `<div class="gy-card-stats">
               <span class="gy-stat atk">${card.attack ?? 0}</span>
               <span class="gy-stat hp">${card.hp ?? 0}</span>
             </div>`
          : '';

        item.innerHTML = `
          <div class="gy-card-art" style="background-image: url('${imgPath}'), url('/assets/images/ui/card_back.jpeg');">
            ${statsHtml}
          </div>
          <div class="gy-card-name">${card.name || '???'}</div>
        `;

        // クリックでカード詳細を開く
        item.addEventListener('click', () => {
          if (window.showCardDetail) window.showCardDetail(card);
        });

        gyGrid.appendChild(item);
      });
    }

    // -------------------------------------------------------
    // オーバーレイを開く（ターゲット指定）
    // -------------------------------------------------------
    function openGraveyard(target) {
      currentTarget = target || 'mine';

      // タブ状態を更新
      gyTabMine.classList.toggle('active', currentTarget === 'mine');
      gyTabOpp.classList.toggle('active',  currentTarget === 'opp');

      // データを描画
      const data = window._gyData || { mine: [], opp: [] };
      renderGyGrid(data[currentTarget]);

      gyOverlay.style.display = 'flex';
      if (window.audioManager) window.audioManager.playSE('click');
    }

    // -------------------------------------------------------
    // オーバーレイを閉じる
    // -------------------------------------------------------
    function closeGraveyard() {
      gyOverlay.style.display = 'none';
      if (window.audioManager) window.audioManager.playSE('click');
    }

    // -------------------------------------------------------
    // イベントリスナー
    // -------------------------------------------------------

    // 自分の GY バッジ
    if (myGraveBtn)  myGraveBtn.addEventListener('click',  () => openGraveyard('mine'));
    // 相手の GY バッジ
    if (oppGraveBtn) oppGraveBtn.addEventListener('click', () => openGraveyard('opp'));

    // 閉じるボタン
    if (gyCloseBtn) gyCloseBtn.addEventListener('click', closeGraveyard);

    // 背景クリックで閉じる
    gyOverlay.addEventListener('click', (e) => {
      if (e.target === gyOverlay) closeGraveyard();
    });

    // タブ切り替え
    gyTabMine.addEventListener('click', () => {
      if (currentTarget === 'mine') return;
      currentTarget = 'mine';
      gyTabMine.classList.add('active');
      gyTabOpp.classList.remove('active');
      const data = window._gyData || { mine: [], opp: [] };
      renderGyGrid(data.mine);
    });

    gyTabOpp.addEventListener('click', () => {
      if (currentTarget === 'opp') return;
      currentTarget = 'opp';
      gyTabMine.classList.remove('active');
      gyTabOpp.classList.add('active');
      const data = window._gyData || { mine: [], opp: [] };
      renderGyGrid(data.opp);
    });

    // Escape キーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && gyOverlay.style.display !== 'none') {
        closeGraveyard();
      }
    });
  })();

  // =====================================================
  // 対戦終了ボタン（ロビーへ / REMATCH）
  // =====================================================
  const resultBackBtn   = document.getElementById('btn-result-back');
  const resultRematchBtn = document.getElementById('btn-result-rematch');

  if (resultBackBtn) {
    resultBackBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  if (resultRematchBtn) {
    resultRematchBtn.addEventListener('click', () => {
      // 同じロビーに戻るだけ（将来的にはRe-queue処理）
      window.location.href = '/';
    });
  }

});

