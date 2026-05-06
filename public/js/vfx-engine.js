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

  // ========== ダイレクトアタック演出 ==========
  function playDirectAttackEffect() {
    const wrapper = document.getElementById('game-wrapper') || document.getElementById('game-container');
    if (wrapper) {
      wrapper.classList.add('screen-shake');
      setTimeout(() => wrapper.classList.remove('screen-shake'), 500);
    }

    const layer = document.getElementById('vfx-layer');
    if (layer) {
      // 画面中央に大きな衝撃波
      spawnImpactBurst(960, 540, '#ef4444');
      setTimeout(() => spawnImpactBurst(960, 540, '#f59e0b'), 150);
    }

    if (window.audioManager) window.audioManager.playSE('direct_attack');
  }

  // ========== アニメーションイベントの一括処理 ==========
  function processAnimationEvents(events, myPlayerId) {
    if (!events || events.length === 0) return;
    events.forEach(event => {
      switch (event.type) {
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
    playDirectAttackEffect,
    processAnimationEvents,
    getBoardSlotEl,
  };
})();
