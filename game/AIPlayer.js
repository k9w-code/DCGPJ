// AIPlayer.js - NPCの行動AI（3レーン×前後列対応）
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');
const { hasKeyword, getValidAttackTargets } = require('./KeywordEffects');

class AIPlayer {
  constructor(playerId, cardMap) {
    this.playerId = playerId;
    this.cardMap = cardMap || {};
  }

  /**
   * 1手ずつアクションを決定する（逐次意思決定）
   */
  decideNextAction(playerView) {
    const me = playerView.me;
    const opponent = playerView.opponent;
    const phase = playerView.phase;

    // 0. ターゲット選択フェーズの処理（新機能）
    if (phase === 'targeting') {
      return this.decideTargetingAction(playerView);
    }

    // 1. 最優先：出せるカードがあれば出す（展開優先）
    const plays = this.decideCardPlays(me, opponent);
    if (plays.length > 0) return plays[0];

    // 2. 次点：レベル上げ
    const levels = this.decideLevelUps(me);
    if (levels.length > 0) return levels[0];

    // 3. 攻撃
    const attacks = this.decideAttacks(me, opponent);
    if (attacks.length > 0) return attacks[0];

    // 何もすることがなければ終了
    return { type: 'end_turn' };
  }

  /**
   * ターゲット選択フェーズにおける意思決定
   */
  decideTargetingAction(playerView) {
    const me = playerView.me;
    const opponent = playerView.opponent;
    const source = playerView.pendingAbilitySource;

    if (!source) return { type: 'end_turn' };

    const effect = source.effect;
    const targetId = source.targetId || '';

    // 1. トークン召喚 または 空きマス指定の場合
    if (effect === 'summon_token' || targetId === 'empty_slot') {
      const rowOrder = ['front', 'back'];
      const laneOrder = [1, 0, 2]; // 中央寄りから優先
      for (const row of rowOrder) {
        for (const lane of laneOrder) {
          if (!me.board[row][lane]) {
            return { type: 'select_target', targetRow: row, targetLane: lane };
          }
        }
      }
    }

    // 2. 敵ユニットへのダメージやデバフ、破壊、バウンス等
    // targetId が 'enemy_unit_1' や 'all_enemy_units' などの場合
    if (!targetId.includes('self') && ['damage', 'destroy', 'freeze', 'bounce', 'debuff_attack'].includes(effect)) {
       const targets = [];
       for (const row of ROWS) {
         for (let i = 0; i < NUM_LANES; i++) {
           if (opponent.board[row][i]) targets.push({ row, lane: i, unit: opponent.board[row][i] });
         }
       }
       if (targets.length > 0) {
         // 危険なユニット（攻撃力が高い）や、倒せそうなユニット（HPが低い）を優先
         targets.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack || a.unit.currentHp - b.unit.currentHp);
         return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
       }
    }

    // デフォルト（何もなければ最初の適当な敵ユニット、または自分）
    return { type: 'select_target', targetRow: 'front', targetLane: 0 };
  }

  // 旧一括型メソッド（後方互換用）
  decideTurnActions(playerView) {
    const actions = [];
    const me = playerView.me;
    const opponent = playerView.opponent;

    const plays = this.decideCardPlays(me, opponent);
    const levels = this.decideLevelUps(me);
    const attacks = this.decideAttacks(me, opponent);
    
    actions.push(...levels);
    actions.push(...plays);
    actions.push(...attacks);
    actions.push({ type: 'end_turn' });
    return actions;
  }

  decideLevelUps(me) {
    const actions = [];
    let availableSP = me.sp;
    
    // 今の手札で、あと1〜2レベル上げれば出せるカードがあるか優先的にチェック
    const cardsByColor = {};
    for (const card of me.hand) {
      if (!cardsByColor[card.color]) cardsByColor[card.color] = [];
      cardsByColor[card.color].push(card);
    }

    for (const [color, cards] of Object.entries(cardsByColor)) {
      const currentLevel = me.tribeLevels[color] || 0;
      // 実用性の高いコスト（4〜6）への到達を優先
      const targetCosts = cards.map(c => c.cost).sort((a, b) => a - b);
      
      for (const cost of targetCosts) {
        if (currentLevel < 9 && currentLevel < cost && availableSP >= (cost - currentLevel) && cost <= 6) {
          const needed = cost - currentLevel;
          for (let i = 0; i < needed; i++) {
            actions.push({ type: 'raise_tribe', color });
            availableSP--;
          }
          break;
        }
      }
    }
    return actions;
  }

  decideCardPlays(me, opponent) {
    const actions = [];
    let availableSP = me.sp;
    const currentLevels = { ...me.tribeLevels };

    // 盤面が埋まるのを防ぐため、攻撃力の高い順（高コスト寄り）に検討
    const sortedHand = me.hand
      .map((card, index) => ({ card, originalIndex: index }))
      .sort((a, b) => b.card.attack - a.card.attack || b.card.cost - a.card.cost);

    const playedIndices = new Set();
    const occupiedSlots = new Set();
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (me.board[row][lane]) occupiedSlots.add(`${row}_${lane}`);
      }
    }

    for (const { card, originalIndex } of sortedHand) {
      if (playedIndices.has(originalIndex)) continue;
      if (availableSP < card.cost) continue;
      if ((currentLevels[card.color] || 0) < card.cost) continue;

      if (card.type === 'unit') {
        const rowOrder = ['front', 'back'];
        const laneOrder = [1, 0, 2];
        let targetRow = null;
        let targetLane = -1;

        for (const row of rowOrder) {
          for (const lane of laneOrder) {
            if (!occupiedSlots.has(`${row}_${lane}`)) {
              targetRow = row;
              targetLane = lane;
              break;
            }
          }
          if (targetRow) break;
        }
        
        if (targetRow) {
          actions.push({ type: 'play_card', handIndex: originalIndex, targetRow, targetLane });
          availableSP -= card.cost;
          playedIndices.add(originalIndex);
          occupiedSlots.add(`${targetRow}_${targetLane}`);
        }
      } else if (card.type === 'spell') {
        // 敵の前列を排除して道を作ることを最優先
        let targetRow = null;
        let targetLane = null;
        if (['damage', 'destroy', 'freeze'].includes(card.abilityEffect)) {
          for (let i = 0; i < NUM_LANES; i++) {
            if (opponent.board.front[i]) { targetRow = 'front'; targetLane = i; break; }
          }
        }
        if (targetRow !== null) {
          actions.push({ type: 'play_card', handIndex: originalIndex, targetRow, targetLane });
          availableSP -= card.cost;
          playedIndices.add(originalIndex);
        }
      }
    }
    return actions;
  }

  decideAttacks(me, opponent) {
    const actions = [];
    const attackers = [];

    // 攻撃可能な全ユニットをリストアップ
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const unit = me.board[row][lane];
        if (unit && unit.canAttack && !unit.hasActed) {
          attackers.push({ unit, row, lane });
        }
      }
    }

    if (attackers.length === 0) return actions;

    // 仮想の敵盤面を作成（攻撃による変化をシミュレートするため）
    const virtualOpponentBoard = {
      front: opponent.board.front.map(u => u ? { ...u } : null),
      back: opponent.board.back.map(u => u ? { ...u } : null)
    };
    const virtualOpponentShields = (opponent.shields || []).map(s => ({ ...s }));

    // 1. リーサルチェック（仮想シールド耐久値で判定）
    const totalAtk = attackers.reduce((sum, a) => sum + (a.unit.currentAttack || 0), 0);
    const virtualShieldDurability = virtualOpponentShields.reduce((sum, s) => sum + (s.destroyed ? 0 : (s.currentDurability || 0)), 0);
    const hasLethal = totalAtk >= virtualShieldDurability && virtualShieldDurability > 0;

    // 2. 攻撃解決ループ
    for (const attacker of attackers) {
      // 現在の仮想盤面に基づき、ターゲットを「その都度」再計算
      const targets = getValidAttackTargets(attacker.row, attacker.lane, attacker.unit, virtualOpponentBoard, virtualOpponentShields);
      if (targets.length === 0) continue;

      const directTarget = targets.find(t => t.type === 'direct');
      const shieldTarget = targets.find(t => t.type === 'shield');
      const unitTargets = targets.filter(t => t.type === 'unit');

      let selectedTarget = null;

      // 優先順位 A: ダイレクト
      if (directTarget) {
        selectedTarget = directTarget;
      }
      // 優先順位 B: リーサルならシールド
      else if (hasLethal && shieldTarget) {
        selectedTarget = shieldTarget;
      }
      // 優先順位 C: 挑発ユニット排除
      else if (unitTargets.some(t => t.unit.keywords.includes('taunt'))) {
        selectedTarget = unitTargets.find(t => t.unit.keywords.includes('taunt'));
      }
      // 優先順位 D: 盤面有利ならシールド（この時点での仮想盤面でレーンが空いている場合のみ shieldTarget が存在する）
      else if (shieldTarget) {
        selectedTarget = shieldTarget;
      }
      // 優先順位 E: 目の前の敵を排除（仮想盤面でまだ生きている敵）
      else if (unitTargets.length > 0) {
        unitTargets.sort((a, b) => a.unit.currentHp - b.unit.currentHp);
        selectedTarget = unitTargets[0];
      }

      if (selectedTarget) {
        actions.push({ type: 'attack', attackerRow: attacker.row, attackerLane: attacker.lane, targetInfo: selectedTarget });
        
        // 【重要】仮想盤面を更新
        if (selectedTarget.type === 'unit') {
          const vRow = selectedTarget.row;
          const vLane = selectedTarget.lane;
          const defender = virtualOpponentBoard[vRow][vLane];
          if (defender) {
            defender.currentHp -= attacker.unit.currentAttack;
            if (defender.currentHp <= 0) {
              virtualOpponentBoard[vRow][vLane] = null; // 仮想的に撃破！道が開く
            }
          }
        } else if (selectedTarget.type === 'shield') {
          const vShield = virtualOpponentShields.find(s => s.id === selectedTarget.id);
          if (vShield) {
            vShield.durability -= 1;
            if (vShield.durability <= 0) vShield.destroyed = true;
          }
        }
      }
    }

    return actions;
  }

  decideMulligan(hand) {
    // 3コスト以上の重いカードが3枚以上あればマリガン（初動を安定させる）
    return hand.filter(c => c.cost >= 3).length >= 3;
  }
}

module.exports = AIPlayer;
