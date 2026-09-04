// vfx-engine.js - DCG Visual Effects Engine
// 全演出ロジックをここに集約する
'use strict';

window.VFX = (function() {
  // ボードスロット要素を取得するユーティリティ
  function getBoardSlotEl(owner, row, lane) {
    const boardId = owner === 'me' ? 'player-board' : 'opponent-board';
    const board = document.getElementById(boardId);
    if (!board) return null;
    return board.querySelector(`.board-slot[data-row="${row}"][data-lane="${lane}"]`);
  }

  function getSlotCenter(el) {
    if (!el) return null;
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const scale = containerRect.width / 1920;
    return {
      x: (rect.left + rect.width / 2 - containerRect.left) / scale,
      y: (rect.top + rect.height / 2 - containerRect.top) / scale,
    };
  }

  // ========== ダメージ数値ポップアップ ==========
  function spawnDamageNumber(el, amount, type) {
    if (!el || amount <= 0) return;
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;

    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const scale = containerRect.width / 1920;

    const x = (rect.left + rect.width / 2 - containerRect.left) / scale;
    const y = (rect.top + rect.height / 2 - containerRect.top) / scale;

    const num = document.createElement('div');
    num.className = `damage-number dmg-${type}`;
    num.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
    num.style.left = `${x + (Math.random() * 60 - 30)}px`;
    num.style.top = `${y - 30}px`;
    layer.appendChild(num);

    // アニメーション終了後に削除
    setTimeout(() => num.remove(), 1200);
  }

  // ========== ユニット衝撃フラッシュ ==========
  function playHitFlash(el, color) {
    if (!el) return;
    const flashClass = color === 'red' ? 'unit-hit-red' : 'unit-hit-white';
    el.classList.add('unit-hit-flash', flashClass);
    setTimeout(() => el.classList.remove('unit-hit-flash', flashClass), 400);
  }

  // ========== 死亡シェイク ==========
  function playDeathEffect(el) {
    if (!el) return;
    el.classList.add('unit-death-shake');
    setTimeout(() => {
      el.classList.add('unit-dying');
    }, 300);
    if (window.audioManager) window.audioManager.playSE('death');
  }

  // ========== 衝撃波エフェクト ==========
  function spawnImpactBurst(x, y, color) {
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;
    const burst = document.createElement('div');
    burst.className = 'impact-burst';
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;
    burst.style.borderColor = color || '#f43f5e';
    burst.style.boxShadow = `0 0 20px ${color || '#f43f5e'}`;
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 600);
  }

  // ========== アビリティ発動フラッシュ ==========
  function playAbilityFlash(el, color) {
    if (!el) return;
    const colorMap = {
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#22c55e',
      white: '#e2e8f0',
      black: '#8b5cf6',
      neutral: '#d4a017',
    };
    const glowColor = colorMap[color] || '#d4a017';
    el.style.setProperty('--ability-glow', glowColor);
    el.classList.add('unit-ability-flash');
    setTimeout(() => el.classList.remove('unit-ability-flash'), 800);
  }

  // ========== 腐敗（Decay）演出 ==========
  function playDecayEffect(el) {
    if (!el) return;
    el.classList.add('unit-hit-flash', 'unit-hit-purple');
    setTimeout(() => el.classList.remove('unit-hit-flash', 'unit-hit-purple'), 500);
  }

  // ========== 不屈（Endure）演出 ==========
  function playEndureEffect(el) {
    if (!el) return;
    // 黄金のフラッシュ
    el.classList.add('unit-hit-flash', 'unit-hit-gold');
    setTimeout(() => el.classList.remove('unit-hit-flash', 'unit-hit-gold'), 600);

    // ENDURE! ラベル
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;
    const center = getSlotCenter(el);
    if (!center) return;

    const label = document.createElement('div');
    label.className = 'endure-label';
    label.textContent = 'ENDURE!';
    label.style.left = `${center.x}px`;
    label.style.top = `${center.y - 40}px`;
    layer.appendChild(label);
    setTimeout(() => label.remove(), 1500);
    if (window.audioManager) window.audioManager.playSE('endure');
  }

  // ========== シールド破壊エフェクト ==========
  function playShieldShatter(el) {
    if (!el) return;
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;
    
    // 要素の中心座標を取得（viewport上の絶対座標に近いもの）
    const rect = el.getBoundingClientRect();
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const scale = containerRect.width / 1920;
    
    const x = (rect.left + rect.width / 2 - containerRect.left) / scale;
    const y = (rect.top + rect.height / 2 - containerRect.top) / scale;

    const shatterContainer = document.createElement('div');
    shatterContainer.className = 'shield-shatter-container';
    shatterContainer.style.left = `${x}px`;
    shatterContainer.style.top = `${y}px`;

    // 破片を複数生成
    for (let i = 0; i < 6; i++) {
      const shard = document.createElement('div');
      shard.className = 'shield-shatter-shard';
      const angle = (Math.PI * 2 / 6) * i + (Math.random() * 0.5);
      const distance = 40 + Math.random() * 60;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 20; // 少し上方向にバイアス
      const rot = (Math.random() - 0.5) * 720; // 回転角度
      
      shard.style.setProperty('--tx', `${tx}px`);
      shard.style.setProperty('--ty', `${ty}px`);
      shard.style.setProperty('--rot', `${rot}deg`);
      
      shatterContainer.appendChild(shard);
    }
    
    layer.appendChild(shatterContainer);
    setTimeout(() => shatterContainer.remove(), 600);
    if (window.audioManager) window.audioManager.playSE('shield_break'); // SEがあれば再生
  }

  // ========== 召喚エフェクト ==========
  function playSummonEffect(el, color) {
    if (!el) return;
    const colorMap = {
      red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
      white: '#e2e8f0', black: '#8b5cf6', neutral: '#d4a017',
    };
    const glowColor = colorMap[color] || '#d4a017';

    // スロット全体に召喚フラッシュ
    const flash = document.createElement('div');
    flash.className = 'summon-flash';
    flash.style.setProperty('--summon-color', glowColor);
    el.appendChild(flash);
    setTimeout(() => flash.remove(), 700);

    // プレミアム召喚オーラを追加 (v138)
    const aura = document.createElement('div');
    aura.className = `summon-aura ${color || 'neutral'}`;
    aura.style.setProperty('--summon-color', glowColor);
    el.appendChild(aura);
    setTimeout(() => aura.remove(), 900);

    // VFXレイヤーに衝撃波
    const center = getSlotCenter(el);
    if (center) spawnImpactBurst(center.x, center.y, glowColor);

    if (window.audioManager) {
      window.audioManager.playSE('summon');
    }
  }

  // ========== 戦闘演出メイン ==========
  function playBattleEffect(event, myPlayerId) {
    const isAttackerMe = event.attackerOwner === myPlayerId;

    const attackerEl = getBoardSlotEl(
      isAttackerMe ? 'me' : 'opp',
      event.attackerRow,
      event.attackerLane
    );
    const defenderEl = getBoardSlotEl(
      isAttackerMe ? 'opp' : 'me',
      event.defenderRow,
      event.defenderLane
    );

    const delay = 300; // 矢印が伸びるアニメーションを少し待つ

    setTimeout(() => {
      // 衝突地点の衝撃波
      const attackerCenter = getSlotCenter(attackerEl);
      const defenderCenter = getSlotCenter(defenderEl);

      if (attackerCenter && defenderCenter) {
        const midX = (attackerCenter.x + defenderCenter.x) / 2;
        const midY = (attackerCenter.y + defenderCenter.y) / 2;
        spawnImpactBurst(midX, midY, '#f43f5e');
      }

      // 画面全体を揺らす
      const wrapper = document.getElementById('game-wrapper') || document.getElementById('game-container');
      if (wrapper) {
        wrapper.classList.add('screen-shake');
        setTimeout(() => wrapper.classList.remove('screen-shake'), 400);
      }

      // 攻撃側を少し前に突き出させる（簡易的な攻撃モーション）
      if (attackerEl) {
        attackerEl.classList.add('unit-shake');
        setTimeout(() => attackerEl.classList.remove('unit-shake'), 300);
      }

      // ダメージ表示と被弾フラッシュ（防御側）
      if (defenderEl) {
        defenderEl.classList.add('unit-shake');
        setTimeout(() => defenderEl.classList.remove('unit-shake'), 300);
        
        if (event.defenderDmg > 0) {
          playHitFlash(defenderEl, 'red');
          spawnDamageNumber(defenderEl, event.defenderDmg, 'damage');
        } else {
          // 0ダメ（加護など）
          spawnDamageNumber(defenderEl, 0, 'blocked');
        }
      }

      // ダメージ表示と被弾フラッシュ（攻撃側の反撃受け）
      if (event.attackerDmg > 0 && attackerEl) {
        setTimeout(() => {
          playHitFlash(attackerEl, 'red');
          spawnDamageNumber(attackerEl, event.attackerDmg, 'damage');
        }, 200);
      }

      // 死亡エフェクト
      if (event.defenderDied) {
        setTimeout(() => playDeathEffect(defenderEl), 400);
      }
      if (event.attackerDied) {
        setTimeout(() => playDeathEffect(attackerEl), 600);
      }

      if (window.audioManager) {
        window.audioManager.playSE('impact');
      }
    }, delay);
  }

  // ========== シールド攻撃演出 ==========
  function playShieldHitEffect(event, myPlayerId) {
    const isAttackerMe = event.attackerOwner === myPlayerId;
    const attackerEl = getBoardSlotEl(
      isAttackerMe ? 'me' : 'opp',
      event.attackerRow,
      event.attackerLane
    );

    // シールドエリアに向かって撃撕波紋を発生
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;

    // シールド演出エリアの座標を取得
    const shieldsArea = document.getElementById(isAttackerMe ? 'opp-shields' : 'my-shields');
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const scale = containerRect.width / 1920;

    let targetX, targetY;
    if (shieldsArea) {
      const rect = shieldsArea.getBoundingClientRect();
      targetX = (rect.left + rect.width / 2 - containerRect.left) / scale;
      targetY = (rect.top + rect.height / 2 - containerRect.top) / scale;
    } else {
      targetX = isAttackerMe ? 320 : 320;
      targetY = isAttackerMe ? 200 : 880;
    }

    // 撃突波
    const burst = document.createElement('div');
    burst.className = 'impact-burst';
    burst.style.left = `${targetX}px`;
    burst.style.top = `${targetY}px`;
    burst.style.borderColor = event.destroyed ? '#ef4444' : '#f59e0b';
    burst.style.width = '120px';
    burst.style.height = '120px';
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 700);

    // 画面揺れ（wrapperにかけることでスケール崩れを防ぐ）
    const wrapper = document.getElementById('game-wrapper') || document.getElementById('game-container');
    if (wrapper) {
      wrapper.classList.add('screen-shake');
      setTimeout(() => wrapper.classList.remove('screen-shake'), 400);
    }

    // シールドヒットテキスト
    setTimeout(() => {
      const label = document.createElement('div');
      label.className = `shield-hit-label${event.destroyed ? ' shield-break-label' : ''}`;
      label.textContent = event.destroyed ? 'SHIELD BREAK!' : 'SHIELD HIT!';
      label.style.left = `${targetX}px`;
      label.style.top = `${targetY - 60}px`;
      layer.appendChild(label);
      setTimeout(() => label.remove(), 1400);
    }, 100);

    if (window.audioManager) {
      window.audioManager.playSE(event.destroyed ? 'shield_break' : 'impact');
    }
    
    // バイブレーション（シールド破壊は強ダブル、ヒットは単発）
    if (navigator.vibrate) {
      if (event.destroyed) {
        navigator.vibrate([80, 50, 80]);
      } else {
        navigator.vibrate(40);
      }
    }
  }

  // ========== 共鳴（Resonance）演出 ==========
  function playResonanceEffect(event, myPlayerId) {
    const isMe = event.ownerId === myPlayerId;
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;

    // 共鳴波紋の中心（盟族エリアから発生）
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const scale = containerRect.width / 1920;

    const boardId = isMe ? 'player-board' : 'opponent-board';
    const board = document.getElementById(boardId);
    let centerX = 960, centerY = isMe ? 700 : 380;
    if (board) {
      const rect = board.getBoundingClientRect();
      centerX = (rect.left + rect.width / 2 - containerRect.left) / scale;
      centerY = (rect.top + rect.height / 2 - containerRect.top) / scale;
    }

    // 波紋リングを段次的に拡散
    const colors = ['#818cf8', '#6366f1', '#a78bfa'];
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ring = document.createElement('div');
        ring.className = 'resonance-ring';
        ring.style.left = `${centerX}px`;
        ring.style.top = `${centerY}px`;
        ring.style.borderColor = colors[i];
        ring.style.boxShadow = `0 0 15px ${colors[i]}`;
        layer.appendChild(ring);
        setTimeout(() => ring.remove(), 800);
      }, i * 160);
    }

    //  共鳴 ラベル
    setTimeout(() => {
      const label = document.createElement('div');
      label.className = 'resonance-label';
      label.textContent = `  共鳴  `;
      label.style.left = `${centerX}px`;
      label.style.top = `${centerY - 80}px`;
      layer.appendChild(label);
      setTimeout(() => label.remove(), 2000);
    }, 200);

    if (window.audioManager) window.audioManager.playSE('resonance');
  }

  // ========== シールドブレイク演出 ==========
  function playShieldBreakEffect(shieldData) {

    const overlay = document.getElementById('shield-break-overlay');
    if (!overlay) return;

    // カード画像を正しいパスで設定
    const sbCard = document.getElementById('sb-card-image');
    if (sbCard && window.getCardImagePath) {
      shieldData.type = 'shield';
      const imagePath = window.getCardImagePath(shieldData);
      sbCard.style.backgroundImage = `url('${imagePath}')`;
    }

    // カード名
    const nameEl = document.getElementById('sb-card-name');
    if (nameEl) nameEl.textContent = shieldData.name || 'Unknown Shield';

    // 効果テキスト（全ての発動効果をゴールドで表示）
    const effectEl = document.getElementById('sb-trigger-effect');
    if (effectEl) {
      const abilities = shieldData.abilities || [];
      if (abilities.length > 0 && abilities[0].text) {
        effectEl.textContent = abilities[0].text;
        effectEl.style.color = '#d4a017';
      } else if (shieldData.skill && shieldData.skill.text) {
        effectEl.textContent = shieldData.skill.text;
        effectEl.style.color = '#d4a017';
      } else {
        effectEl.textContent = '効果なし';
        effectEl.style.color = '#6b7280';
      }
    }

    // オーバーレイを表示してアニメーション開始
    overlay.style.display = 'flex';
    overlay.classList.remove('sb-exit');
    overlay.classList.add('sb-enter');

    // カードフリップ演出のトリガー
    const cardWrapper = document.getElementById('sb-card-wrapper');
    if (cardWrapper) {
      cardWrapper.classList.remove('flipped');
      setTimeout(() => cardWrapper.classList.add('flipped'), 400);
    }
  }

  // ========== SP回復演出 ==========
  function playSpGainEffect(amount, total) {
    // SPオーブを更新する（renderPlayerInfoが行うが 追加でスパーク演出）
    const spDisplay = document.getElementById('my-sp-orbs');
    if (!spDisplay) return;

    spDisplay.classList.add('sp-gain-pulse');
    setTimeout(() => spDisplay.classList.remove('sp-gain-pulse'), 600);

    // SP回復数値を表示
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;
    const rect = spDisplay.getBoundingClientRect();
    const container = document.getElementById('game-container');
    const containerRect = container.getBoundingClientRect();
    const scale = containerRect.width / 1920;
    const x = (rect.left + rect.width / 2 - containerRect.left) / scale;
    const y = (rect.top - containerRect.top) / scale;

    const num = document.createElement('div');
    num.className = 'sp-gain-number';
    num.textContent = `SP +${amount}`;
    num.style.left = `${x}px`;
    num.style.top = `${y - 10}px`;
    layer.appendChild(num);
    setTimeout(() => num.remove(), 1200);
  }

  // ========== アビリティ発動演出 ==========
  function playAbilityTriggerEffect(event, myPlayerId) {
    const isMe = event.ownerId === myPlayerId;
    const state = window.gameState;
    if (!state) return;

    // 盤面からユニットのスロットを探す
    const board = isMe ? state.me.board : state.opponent.board;
    let foundSlot = null;
    for (const row of ['front', 'back']) {
      for (let lane = 0; lane < 3; lane++) {
        const unit = board[row] && board[row][lane];
        if (unit && unit.instanceId === event.unitInstanceId) {
          foundSlot = getBoardSlotEl(isMe ? 'me' : 'opp', row, lane);
          break;
        }
      }
      if (foundSlot) break;
    }

    if (foundSlot) {
      playAbilityFlash(foundSlot, event.color);
    }

    // アビリティ発動テキストを表示
    const layer = document.getElementById('vfx-layer');
    if (!layer || !foundSlot) return;
    const center = getSlotCenter(foundSlot);
    if (!center) return;

    const triggerLabel = {
      on_play: '登場時',
      on_death: '遺言',
      on_kill: '撃破時',
      on_attack: '攻撃時',
      activate: '起動',
      awaken: '覚醒',
    }[event.trigger] || event.trigger;

    const label = document.createElement('div');
    label.className = 'ability-trigger-label';
    label.textContent = ` ${triggerLabel} ${event.unitName}`;
    label.style.left = `${center.x}px`;
    label.style.top = `${center.y - 80}px`;
    layer.appendChild(label);
    setTimeout(() => label.remove(), 1800);
  }

  // ========== ターン開始演出 ==========
  function playTurnStartEffect(isMyTurn) {
    const splash = document.getElementById('turn-splash');
    const content = document.getElementById('splash-content');
    if (!splash || !content) return;

    splash.classList.remove('turn-splash-victory', 'turn-splash-enemy');
    splash.classList.add(isMyTurn ? 'turn-splash-victory' : 'turn-splash-enemy');
    content.textContent = isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN";

    // スプラッシュ内にサブテキストを追加
    const sub = splash.querySelector('.splash-sub');
    if (sub) sub.style.display = "none";

    splash.style.display = 'flex';
    splash.classList.remove('splash-fade-out');
    splash.classList.add('splash-fade-in');

    setTimeout(() => {
      splash.classList.remove('splash-fade-in');
      splash.classList.add('splash-fade-out');
      setTimeout(() => { splash.style.display = 'none'; splash.classList.remove('splash-fade-out'); }, 500);
    }, 1800);

    if (window.audioManager) window.audioManager.playSE('turn_start');
  }

  // 🎬 対戦開始シーケンス: VS激突 → 先攻後攻 → マリガン (コールバックチェーン版)
  function startBattleIntroSequence(data) {
    console.log('🎬 [VFX] Starting Battle Intro Sequence...', data);
    const isFirst = data ? data.isFirst : true;

    // まずマリガン画面を完全に隠す
    const mulliganOverlay = document.getElementById('mulligan-overlay');
    if (mulliganOverlay) {
      mulliganOverlay.style.display = 'none';
      mulliganOverlay.style.opacity = '0';
      mulliganOverlay.style.pointerEvents = 'none';
    }

    // Step 1: VS激突カットイン (0s~2.5s)
    triggerVsCutin();

    // Step 2: 2.5秒後に先攻後攻カットイン、終了コールバックでマリガンを開く
    setTimeout(() => {
      triggerOrderCutin(isFirst, () => {
        // Step 3: 先攻後攻演出終了後にマリガン画面を表示
        if (window.showMulligan && data && data.hand) {
          window.showMulligan(data.hand, (redrawIndices) => {
            if (window.socket) {
              window.socket.emit('mulligan_decision', { redrawIndices });
            }
          });
        } else {
          if (mulliganOverlay) {
            mulliganOverlay.style.display = 'flex';
            mulliganOverlay.style.opacity = '1';
            mulliganOverlay.style.pointerEvents = 'auto';
          }
        }
      });
    }, 2500);
  }

  // 対戦開始のVS激突カットイン（左右スライドイン → 中央で谝為衝突）
    // 📳 画面振動 (スクリーンシェイク)
  function triggerScreenShake(intensity) {
    const container = document.getElementById('game-container') || document.body;
    const animClass = intensity === 'heavy' ? 'screen-shake-heavy' : 'screen-shake-anim';
    container.classList.remove('screen-shake-heavy', 'screen-shake-anim');
    void container.offsetWidth; // リフロー
    container.classList.add(animClass);
    setTimeout(() => {
      container.classList.remove('screen-shake-heavy', 'screen-shake-anim');
    }, 450);
  }

function triggerVsCutin() {
    let vsOverlay = document.getElementById('vs-cutin-overlay');
    if (vsOverlay) vsOverlay.remove();

    const state = window.gameState || {};
    const myName   = (state.me       && state.me.name)       ? state.me.name       : 'YOU';
    const oppName  = (state.opponent && state.opponent.name) ? state.opponent.name : 'OPPONENT';
    const myAvatar  = (state.me       && state.me.avatar)  ? state.me.avatar  : '1';
    const oppAvatar = (state.opponent && state.opponent.avatar) ? state.opponent.avatar : '1';

    // アニメーションスタイルシート（一度だけ注入）
    if (!document.getElementById('vs-cutin-anim-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'vs-cutin-anim-style';
      styleEl.innerHTML = `
        @keyframes vsSlideInLeft {
          0%   { transform: translateX(-120vw) rotate(-8deg); opacity: 0; }
          60%  { transform: translateX(8px) rotate(-1deg); opacity: 1; }
          80%  { transform: translateX(-6px) rotate(1deg); }
          100% { transform: translateX(0) rotate(0deg); opacity: 1; }
        }
        @keyframes vsSlideInRight {
          0%   { transform: translateX(120vw) rotate(8deg); opacity: 0; }
          60%  { transform: translateX(-8px) rotate(1deg); opacity: 1; }
          80%  { transform: translateX(6px) rotate(-1deg); }
          100% { transform: translateX(0) rotate(0deg); opacity: 1; }
        }
        @keyframes vsBurst {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          50%  { transform: scale(1.4) rotate(5deg); opacity: 1; }
          70%  { transform: scale(0.9) rotate(-3deg); }
          100% { transform: scale(1.1) rotate(0deg); opacity: 1; }
        }
        @keyframes vsGlow {
          0%, 100% { text-shadow: 0 0 40px #fbbf24, 0 0 80px #d97706; }
          50%       { text-shadow: 0 0 80px #fef08a, 0 0 120px #fbbf24, 0 0 200px #d97706; }
        }
        @keyframes vsFadeOut {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08); }
        }
        @keyframes vsShockwave {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    vsOverlay = document.createElement('div');
    vsOverlay.id = 'vs-cutin-overlay';
    vsOverlay.style.cssText = `
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100vw !important; height: 100vh !important;
      z-index: 9999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(3, 7, 18, 0.92) !important;
      backdrop-filter: blur(12px) !important;
      pointer-events: none !important;
      overflow: hidden !important;
    `;

    vsOverlay.innerHTML = `
      <!-- 左: 自分 -->
      <div id="vs-left-panel" style="
        position: absolute; left: 0; top: 0; width: 45%; height: 100%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        animation: vsSlideInLeft 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        background: linear-gradient(90deg, rgba(37, 99, 235, 0.3) 0%, transparent 100%);
        border-right: 2px solid rgba(96, 165, 250, 0.4);
        gap: 20px;
      ">
        <div style="
          width: 140px; height: 140px; border-radius: 50%;
          border: 4px solid #60a5fa; box-shadow: 0 0 40px #3b82f6, 0 0 80px rgba(59,130,246,0.4);
          background: url('/assets/images/avatar/${myAvatar}.png') center/cover, #1e293b;
          background-size: cover;
          background-position: center;
        "></div>
        <div style="
          font-family: 'Shippori Mincho', serif; font-size: 32px; font-weight: 900;
          color: #93c5fd; text-shadow: 0 0 20px #3b82f6, 0 2px 4px rgba(0,0,0,0.9);
          letter-spacing: 3px; text-align: center;
          padding: 0 20px;
        ">${myName}</div>
        <div style="
          font-size: 12px; color: rgba(147, 197, 253, 0.7); letter-spacing: 2px; font-family: 'Cinzel', serif;
        ">YOUR DECK</div>
      </div>

      <!-- 右: 相手 -->
      <div id="vs-right-panel" style="
        position: absolute; right: 0; top: 0; width: 45%; height: 100%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        animation: vsSlideInRight 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        background: linear-gradient(270deg, rgba(220, 38, 38, 0.3) 0%, transparent 100%);
        border-left: 2px solid rgba(248, 113, 113, 0.4);
        gap: 20px;
      ">
        <div style="
          width: 140px; height: 140px; border-radius: 50%;
          border: 4px solid #f87171; box-shadow: 0 0 40px #ef4444, 0 0 80px rgba(239,68,68,0.4);
          background: url('/assets/images/avatar/${oppAvatar}.png') center/cover, #1e293b;
          background-size: cover;
          background-position: center;
        "></div>
        <div style="
          font-family: 'Cinzel', 'Shippori Mincho', serif; font-size: 32px; font-weight: 900;
          color: #fca5a5; text-shadow: 0 0 20px #ef4444, 0 2px 4px rgba(0,0,0,0.9);
          letter-spacing: 3px; text-align: center;
          padding: 0 20px;
        ">${oppName}</div>
        <div style="
          font-size: 12px; color: rgba(252, 165, 165, 0.7); letter-spacing: 2px; font-family: 'Cinzel', serif;
        ">OPPONENT</div>
      </div>

      <!-- 中央: VS -->
      <div id="vs-center" style="
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        font-family: 'Cinzel', serif; font-size: 120px; font-weight: 900;
        color: #fef08a;
        animation: vsBurst 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.5s both,
                   vsGlow 1.5s ease-in-out 1s infinite;
        z-index: 2;
        pointer-events: none;
        text-align: center;
        line-height: 1;
      ">VS</div>

      <!-- 衝突波紋 -->
      <div id="vs-shockwave" style="
        position: absolute; left: 50%; top: 50%;
        width: 200px; height: 200px;
        border-radius: 50%; border: 4px solid rgba(251,191,36,0.8);
        animation: vsShockwave 0.6s ease-out 0.5s both;
        pointer-events: none;
      "></div>
    `;

    document.body.appendChild(vsOverlay);
    if (window.audioManager) window.audioManager.playSE('impact');

    // 2.5秒後にフェードアウトしてDOM削除
    setTimeout(() => {
      if (vsOverlay && vsOverlay.parentNode) {
        vsOverlay.style.animation = 'vsFadeOut 0.4s ease-out forwards';
        setTimeout(() => {
          if (vsOverlay && vsOverlay.parentNode) vsOverlay.parentNode.removeChild(vsOverlay);
        }, 400);
      }
    }, 2100);
  }

  // 🎲 先攻 / 後攻決定 シャドウバース風シネマティック演出
  function triggerOrderCutin(isFirst, callback) {
    let orderOverlay = document.getElementById('order-cutin-overlay');
    if (orderOverlay) orderOverlay.remove();

    orderOverlay = document.createElement('div');
    orderOverlay.id = 'order-cutin-overlay';
    orderOverlay.className = 'order-overlay-sv';
    // SVG コインアイコン (先攻: 太陽と聖剣 / 後攻: 月光と神聖盾)

    orderOverlay.innerHTML = `
      <!-- 1. 3D コインフリップ -->
      <div id="sv-coin-stage" class="sv-coin-stage">
        <div class="sv-coin-halo"></div>
        <div id="sv-coin-flipper" class="sv-coin-flipper ${isFirst ? 'flip-to-heads' : 'flip-to-tails'}">
          <!-- 表: 先攻 -->
          <div class="sv-coin-face sv-coin-heads">
            <div class="sv-coin-shine"></div>
          </div>
          <!-- 裏: 後攻 -->
          <div class="sv-coin-face sv-coin-tails">
            <div class="sv-coin-shine"></div>
          </div>
        </div>
      </div>

      <!-- 2. 斬撃ビーム ＆ フラッシュ -->
      <div id="sv-order-slash" class="sv-order-slash ${isFirst ? 'first-color' : 'second-color'}"></div>
      <div id="sv-screen-flash" class="sv-screen-flash"></div>

      <!-- 3. シャドウバース風 巨大漢字タイトル -->
      <div id="sv-order-banner" class="sv-order-banner ${isFirst ? 'first' : 'second'}">
        <div class="sv-magic-circle-bg"></div>

        <!-- 巨大漢字: 先 攻 / 後 攻 -->
        <div class="sv-kanji-wrap">
          <span class="sv-kanji-char">${isFirst ? '先' : '後'}</span>
          <span class="sv-kanji-char">攻</span>
        </div>

        <!-- 英語サブタイトル: ── FIRST TURN ── -->
        <div class="sv-roman-sub">
          <span class="sv-sub-line"></span>
          <span class="sv-sub-text">${isFirst ? 'FIRST TURN' : 'SECOND TURN'}</span>
          <span class="sv-sub-line right"></span>
        </div>
      </div>
    `;

    document.body.appendChild(orderOverlay);

    // [0.0s] コイン回転音
    if (window.audioManager) {
      window.audioManager.playSE('select');
    }

    // [1.35s] コイン着地 → 斬撃ビーム・画面閃光・シェイク
    setTimeout(() => {
      const coinStage = document.getElementById('sv-coin-stage');
      const slash = document.getElementById('sv-order-slash');
      const flash = document.getElementById('sv-screen-flash');
      const banner = document.getElementById('sv-order-banner');

      if (coinStage) coinStage.classList.add('fade-out');
      if (slash) slash.classList.add('active');
      if (flash) flash.classList.add('flash');

      // 画面強振動
      triggerScreenShake('heavy');

      // 斬撃音 ＆ 激突音
      if (window.audioManager) {
        window.audioManager.playSE('coin_land');
        setTimeout(() => {
          window.audioManager.playSE('attack');
        }, 80);
      }

      // [1.45s] 巨大漢字バナー着弾
      setTimeout(() => {
        if (banner) banner.classList.add('active');
      }, 100);
    }, 1350);

    // [3.6s] フェードアウトしてマリガン画面へ接続
    setTimeout(() => {
      if (orderOverlay && orderOverlay.parentNode) {
        orderOverlay.classList.add('order-fade-out');
        setTimeout(() => {
          if (orderOverlay && orderOverlay.parentNode) {
            orderOverlay.parentNode.removeChild(orderOverlay);
          }
          if (typeof callback === 'function') callback();
        }, 450);
      } else {
        if (typeof callback === 'function') callback();
      }
    }, 3600);
  }

  // ⚔️ BATTLE START カットイン演出 (マリガン完了時に発火)
  function triggerBattleStartCutin(callback) {
    let bsOverlay = document.getElementById('battle-start-overlay');
    if (bsOverlay) bsOverlay.remove();

    bsOverlay = document.createElement('div');
    bsOverlay.id = 'battle-start-overlay';
    bsOverlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 9999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(3, 7, 18, 0.7) !important;
      backdrop-filter: blur(8px) !important;
      pointer-events: none !important;
      overflow: hidden !important;
    `;

    bsOverlay.innerHTML = `
      <div style="
        font-family: 'Cinzel', 'Shippori Mincho', serif !important;
        font-size: 64px !important;
        font-weight: 900 !important;
        color: #fef08a !important;
        background: linear-gradient(135deg, #78350f 0%, #d97706 40%, #fbbf24 50%, #d97706 60%, #451a03 100%) !important;
        border: 4px solid #ffffff !important;
        padding: 28px 100px !important;
        border-radius: 24px !important;
        box-shadow: 0 0 100px #fbbf24, 0 25px 60px rgba(0,0,0,0.9) !important;
        letter-spacing: 12px !important;
        text-shadow: 0 4px 20px rgba(0,0,0,0.9), 0 0 30px #fbbf24 !important;
        text-align: center !important;
        animation: battleStartPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important;
      ">
        ⚔️ BATTLE START ⚔️
      </div>
    `;

    if (!document.getElementById('battle-start-anim-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'battle-start-anim-style';
      styleEl.innerHTML = `
        @keyframes battleStartPop {
          0% { transform: scale(0.2); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    document.body.appendChild(bsOverlay);
    if (window.audioManager) window.audioManager.playSE('levelUp');

    setTimeout(() => {
      if (bsOverlay && bsOverlay.parentNode) {
        bsOverlay.parentNode.removeChild(bsOverlay);
      }
      if (typeof callback === 'function') callback();
    }, 1500);
  }

  // 物理突進・衝突バウンドアニメーション
  function playCombatAnimation(attackerId, defenderId, targetType, isOpponentAttack) {
    const sourceEl = getBoardSlotElByInstanceId(attackerId);
    if (!sourceEl) return;

    let targetEl = null;
    if (targetType === 'shield') {
      targetEl = document.getElementById(isOpponentAttack ? 'my-shields' : 'opp-shields');
    } else if (targetType === 'direct') {
      targetEl = document.getElementById(isOpponentAttack ? 'my-avatar' : 'opp-avatar');
    } else {
      targetEl = getBoardSlotElByInstanceId(defenderId);
    }

    if (!targetEl) {
      // フォールバック（通常シェイク）
      sourceEl.classList.add('unit-shake');
      setTimeout(() => sourceEl.classList.remove('unit-shake'), 300);
      if (window.audioManager) window.audioManager.playSE('attack');
      return;
    }

    // 衝突元と先の位置を取得
    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    // 差分を計算
    const dx = (targetRect.left + targetRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (sourceRect.top + sourceRect.height / 2);

    // transitionとzIndexの初期化
    sourceEl.style.transition = 'none';
    sourceEl.style.zIndex = '9999';

    // タメ演出（進行方向と逆にわずかに引く）
    const pullX = -dx * 0.08;
    const pullY = -dy * 0.08;
    sourceEl.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;

    setTimeout(() => {
      // 突進開始（激突）
      sourceEl.style.transition = 'transform 0.16s cubic-bezier(0.25, 1, 0.2, 1)';
      sourceEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

      setTimeout(() => {
        // 激突位置に衝撃波エフェクトを発生
        const center = getSlotCenter(targetEl);
        if (center) {
          spawnImpactBurst(center.x, center.y, '#ef4444');
        }

        // 激突時エフェクト
        if (targetType === 'direct') {
          triggerScreenShake();
          if (window.audioManager) window.audioManager.playSE('direct_attack');
        } else if (targetType === 'shield') {
          if (window.audioManager) window.audioManager.playSE('shield_hit');
        } else {
          if (window.audioManager) window.audioManager.playSE('attack');
        }

        // ヒットフラッシュを適用
        playHitFlash(targetEl, 'red');

        // バウンド（元の位置に戻る）
        sourceEl.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1)';
        sourceEl.style.transform = 'translate3d(0, 0, 0)';

        setTimeout(() => {
          sourceEl.style.zIndex = '';
          sourceEl.style.transition = '';
        }, 350);

      }, 160);
    }, 80);
  }

  // ========== アニメーションイベントの一括処理 ==========
  function processAnimationEvents(events, myPlayerId) {
    if (!events || events.length === 0) return;
    events.forEach(event => {
      console.log('   [VFX EVENT] Processing:', JSON.stringify(event));
      switch (event.type) {
        // --- サーバーの生イベント対応 ---
        case 'attack': {
          let isOpponentAttack = false;
          if (window.gameState && window.gameState.opponent) {
            const oppSlots = [];
            for (const r of ['front', 'back']) {
              if (window.gameState.opponent.board[r]) {
                window.gameState.opponent.board[r].forEach(u => { if (u) oppSlots.push(u.instanceId); });
              }
            }
            if (oppSlots.includes(event.source)) {
              isOpponentAttack = true;
            }
          }
          playCombatAnimation(event.source, event.target, event.targetType, isOpponentAttack);
          break;
        }
        case 'counter': {
          const el = getBoardSlotElByInstanceId(event.source);
          if (el) {
            el.classList.add('unit-shake');
            setTimeout(() => el.classList.remove('unit-shake'), 300);
          }
          if (window.audioManager) window.audioManager.playSE('impact');
          break;
        }
        case 'damage': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            let flashColor = 'red';
            let playSE = 'impact';
            
            if (event.vfxType === 'decay') {
              flashColor = 'purple';
              playSE = 'debuff';
              playDecayEffect(el);
            } else if (event.vfxType === 'spell') {
              flashColor = 'blue';
              playSE = 'spell';
            } else if (event.vfxType === 'ability') {
              flashColor = 'gold';
              playSE = 'buff';
            }
            
            playHitFlash(el, flashColor);
            spawnDamageNumber(el, event.damage, 'damage');
            
            if (window.audioManager) window.audioManager.playSE(playSE);
          }
          break;
        }
        case 'kill': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playDeathEffect(el);
          }
          break;
        }
        case 'endure': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playEndureEffect(el);
          }
          break;
        }
        case 'ability_freeze': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playAbilityFlash(el, 'blue');
            if (window.audioManager) window.audioManager.playSE('freeze');
          }
          break;
        }
        case 'ability_silence': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playAbilityFlash(el, 'black');
            if (window.audioManager) window.audioManager.playSE('silence');
          }
          break;
        }
        case 'ability_barrier': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playAbilityFlash(el, 'white');
            if (window.audioManager) window.audioManager.playSE('barrier');
          }
          break;
        }
        case 'ability_bounce': {
          const el = getBoardSlotElByInstanceId(event.target);
          if (el) {
            playAbilityFlash(el, 'white');
            if (window.audioManager) window.audioManager.playSE('draw');
          }
          break;
        }
        case 'summon': {
          if (window.audioManager) window.audioManager.playSE('summon');
          break;
        }

        // --- 既存のイベント対応 ---
        case 'unit_combat':
          playBattleEffect(event, myPlayerId);
          break;
        case 'shield_break_attack':
          playShieldHitEffect(event, myPlayerId);
          break;
        case 'spell_play':
          if (window.audioManager) window.audioManager.playSE('spell');
          break;
        case 'ability_trigger':
          // 共鳴は専用演出
          if (event.trigger === 'on_spell_play' || event.trigger === 'on_friendly_spell_play') {
            playResonanceEffect(event, myPlayerId);
          }
          playAbilityTriggerEffect(event, myPlayerId);
          break;
        case 'sp_gain':
          if (event.playerId === myPlayerId) {
            playSpGainEffect(event.amount, event.total);
          }
          break;
        case 'unit_decay': {
          const el = getBoardSlotEl(event.ownerId === myPlayerId ? 'me' : 'opp', event.row, event.lane);
          if (el) {
            playDecayEffect(el);
            spawnDamageNumber(el, event.damage, 'damage');
          }
          break;
        }
        case 'unit_endure': {
          const el = getBoardSlotEl(event.ownerId === myPlayerId ? 'me' : 'opp', event.row, event.lane);
          if (el) playEndureEffect(el);
          break;
        }
      }
    });
  }

  // BATTLE START イントロ演出
  function playBattleStartIntro() {
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;

    const emblem = document.createElement('div');
    emblem.className = 'battle-start-emblem';
    
    const text = document.createElement('div');
    text.className = 'battle-start-text';
    text.textContent = 'BATTLE START';
    emblem.appendChild(text);
    
    layer.appendChild(emblem);
    
    if (window.audioManager) {
      window.audioManager.playSE('resonance');
    }

    setTimeout(() => {
      triggerScreenShake();
      
      if (window.audioManager) {
        window.audioManager.playSE('shield_break');
      }
      
      // 1920x1080の中央から黄金の物理パーティクルをバースト射出
      if (window.triggerShieldBreakVFX) {
        window.triggerShieldBreakVFX(960, 540);
        window.triggerShieldBreakVFX(960, 540);
      }
      
      emblem.classList.add('shattered');
      
      setTimeout(() => {
        emblem.remove();
      }, 1000);
    }, 900);
  }

  // 決着パーティクル演出 (v139)
  function playGameOverParticles(isWinner) {
    const layer = document.getElementById('vfx-layer');
    if (!layer) return;

    const particleCount = 100;
    const colors = isWinner
      ? ['#ffd700', '#f59e0b', '#fbbf24', '#ffffff', '#fffbeb'] // 黄金/白
      : ['#ef4444', '#7f1d1d', '#1f2937', '#111827', '#000000']; // 赤黒/灰

    const startX = 960; // 1920x1080 基準の中央
    const startY = 540;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div');
      p.className = `game-over-particle ${isWinner ? 'victory-p' : 'defeat-p'}`;
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      p.style.left = `${startX}px`;
      p.style.top = `${startY}px`;
      
      const size = isWinner 
        ? Math.random() * 8 + 4 
        : Math.random() * 12 + 6;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      
      const angle = Math.random() * Math.PI * 2;
      const speed = isWinner 
        ? Math.random() * 15 + 5 
        : Math.random() * 25 + 8;
      
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      const gravity = isWinner ? 0.12 : 0.28;
      const friction = 0.96;
      
      let posX = startX;
      let posY = startY;
      let opacity = 1.0;
      let rotation = Math.random() * 360;
      const rotSpeed = (Math.random() - 0.5) * 10;
      
      layer.appendChild(p);
      
      const update = () => {
        vx *= friction;
        vy += gravity;
        posX += vx;
        posY += vy;
        rotation += rotSpeed;
        opacity -= isWinner ? 0.01 : 0.015;
        
        p.style.left = `${posX}px`;
        p.style.top = `${posY}px`;
        p.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        p.style.opacity = opacity;
        
        if (opacity > 0 && posY < 1080 && posX > 0 && posX < 1920) {
          requestAnimationFrame(update);
        } else {
          p.remove();
        }
      };
      
      requestAnimationFrame(update);
    }
  }

  // ========== 公開API ==========
  return {
    playBattleEffect,
    playShieldBreakEffect,
    playShieldHitEffect,
    playResonanceEffect,
    playSummonEffect,
    playAbilityFlash,
    playHitFlash,
    playDeathEffect,
    playDecayEffect,
    playEndureEffect,
    spawnDamageNumber,
    playSpGainEffect,
    playAbilityTriggerEffect,
    playTurnStartEffect,
    processAnimationEvents,
    getBoardSlotEl,
    playCombatAnimation,
    triggerVsCutin,
    triggerOrderCutin,
    triggerBattleStartCutin,
    playBattleStartIntro,
    playGameOverParticles,
    startBattleIntroSequence,
    triggerScreenShake
  };
})();
