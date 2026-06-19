// AIPlayer.js - NPCの行動AI（3難易度対応：Easy / Normal / Hard - 極限突破戦術思考版）
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');
const { hasKeyword, getValidAttackTargets } = require('./KeywordEffects');

class AIPlayer {
  constructor(playerId, cardMap, difficulty = 'normal') {
    this.playerId = playerId;
    this.cardMap = cardMap || {};
    this.difficulty = difficulty; // 'easy' | 'normal' | 'hard'
  }

  /**
   * 1手ずつアクションを決定する（逐次意思決定）
   */
  decideNextAction(playerView) {
    const me = playerView.me;
    const opponent = playerView.opponent;
    const phase = playerView.phase;

    // 0. ターゲット選択フェーズの処理
    if (phase === 'targeting') {
      return this.decideTargetingAction(playerView);
    }

    // 難易度 Easy の場合：30%の確率で無意味な行動やミスアクションを選択
    const isEasyMiss = this.difficulty === 'easy' && Math.random() < 0.3;

    // 1. 最優先：出せるカードがあれば出す（展開優先）
    const plays = this.decideCardPlays(me, opponent);
    if (plays.length > 0) {
      if (isEasyMiss && plays.length > 1) {
        // Easy時はわざと非効率な（コストが低い、または攻撃力が低い）カードをプレイ
        console.log(`[AI NPC] Easy difficulty: Making a minor mistake by playing a weaker card.`);
        return plays[plays.length - 1];
      }
      return plays[0];
    }

    // 2. 次点：レベル上げ
    const levels = this.decideLevelUps(me);
    if (levels.length > 0) {
      if (isEasyMiss) {
        // Easy時はレベル上げをパスして次の攻撃フェーズへ流す
        console.log(`[AI NPC] Easy difficulty: Skipping level up as a minor mistake.`);
      } else {
        return levels[0];
      }
    }

    // 3. 攻撃
    const attacks = this.decideAttacks(me, opponent);
    if (attacks.length > 0) {
      if (isEasyMiss && attacks.length > 1) {
        // Easy時はわざと非効率なアタック（一番弱いターゲット等）を実行
        console.log(`[AI NPC] Easy difficulty: Attacking a non-optimal target.`);
        return attacks[attacks.length - 1];
      }
      return attacks[0];
    }

    // 何もすることがなければ終了
    return { type: 'end_turn' };
  }

  /**
   * ターゲット選択フェーズにおける高度な意思決定
   */
  decideTargetingAction(playerView) {
    const me = playerView.me;
    const opponent = playerView.opponent;
    const source = playerView.pendingAbilitySource;

    if (!source) return { type: 'end_turn' };

    const effect = source.effect;
    const targetId = source.targetId || '';

    // Easyのターゲット選択：30%の確率で最も弱い・適当な対象を選択
    const isEasyMiss = this.difficulty === 'easy' && Math.random() < 0.3;

    // 1. トークン召喚 または 空きマス指定の場合（味方盤面）
    if (effect === 'summon_token' || targetId === 'empty_slot' || targetId.includes('empty')) {
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

    // 2. 敵ユニットへのアタック (ダメージ、破壊、凍結、バウンス、デバフなど)
    const isEnemyTarget = !targetId.includes('self') && 
      ['damage', 'destroy', 'freeze', 'bounce', 'debuff_attack'].includes(effect);

    if (isEnemyTarget) {
      const targets = [];
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          const unit = opponent.board[row][i];
          if (unit) {
            targets.push({ row, lane: i, unit });
          }
        }
      }

      if (targets.length > 0) {
        if (isEasyMiss) {
          // Easy時のミス：一番攻撃力の低いどうでもいい敵を選択
          targets.sort((a, b) => a.unit.currentAttack - b.unit.currentAttack);
          return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
        }

        // 効果別の戦術的最適ターゲット選定
        if (effect === 'damage') {
          const dmgValue = source.value || 2; // デフォルト2ダメージと仮定
          
          // 戦術A: ちょうど倒せる（HPがdmgValue以下）敵の中で、最も攻撃力が高い敵を優先（有利交換）
          const killable = targets.filter(t => t.unit.currentHp <= dmgValue);
          if (killable.length > 0) {
            killable.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack);
            return { type: 'select_target', targetRow: killable[0].row, targetLane: killable[0].lane };
          }
          // 戦術B: 倒せないなら、最もHPの高いエースを削るか、最も高ATKの敵を狙う
          targets.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack);
          return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
        } 
        
        else if (effect === 'freeze') {
          // 凍結：今ターンまだ行動しておらず、最も攻撃力が高い敵を止めるのが最強
          const activeThreats = targets.filter(t => !t.unit.hasActed);
          if (activeThreats.length > 0) {
            activeThreats.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack);
            return { type: 'select_target', targetRow: activeThreats[0].row, targetLane: activeThreats[0].lane };
          }
        } 
        
        else if (effect === 'destroy' || effect === 'bounce') {
          // 即死・バウンス：最も価値の高い敵（高攻撃力 ＆ 高レア）を排除
          targets.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack || (b.unit.rarity || 1) - (a.unit.rarity || 1));
          return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
        }
        
        // デフォルト：最も高ATKの敵
        targets.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack);
        return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
      }
    }

    // 3. 味方ユニットへのバフや回復など
    const isSelfTarget = targetId.includes('self') && ['buff', 'heal', 'shield_gain'].includes(effect);
    if (isSelfTarget) {
      const targets = [];
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          const unit = me.board[row][i];
          if (unit) {
            targets.push({ row, lane: i, unit });
          }
        }
      }

      if (targets.length > 0) {
        if (isEasyMiss) {
          // Easy時のミス：最も無価値な味方を選択
          targets.sort((a, b) => a.unit.currentAttack - b.unit.currentAttack);
          return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
        }

        if (effect === 'heal') {
          // 回復：最もHPが削れている味方を優先
          targets.sort((a, b) => (b.unit.maxHp - b.unit.currentHp) - (a.unit.maxHp - a.unit.currentHp));
          return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
        }
        
        // バフ等：最も攻撃力が高く、生き残りやすいエースをさらに強化
        targets.sort((a, b) => b.unit.currentAttack - a.unit.currentAttack || b.unit.currentHp - a.unit.currentHp);
        return { type: 'select_target', targetRow: targets[0].row, targetLane: targets[0].lane };
      }
    }

    // デフォルト（何もなければ最初の適当な敵ユニット、または自分）
    for (const row of ROWS) {
      for (let i = 0; i < NUM_LANES; i++) {
        if (opponent.board[row][i]) {
          return { type: 'select_target', targetRow: row, targetLane: i };
        }
      }
    }
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

  /**
   * 手札カード需要に基づき、SPレベルアップ先を合理的に先読み選定
   */
  decideLevelUps(me) {
    const actions = [];
    let availableSP = me.sp;
    
    if (availableSP <= 0) return actions;

    // 手札の各カードについて神族別の需要を分析
    const demands = {};
    for (const card of me.hand) {
      const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
      for (const col of colors) {
        if (col === 'neutral') continue;
        if (!demands[col]) {
          demands[col] = {
            count: 0,
            maxCost: 0,
            requiredUpgrades: 0,
            priorityScore: 0
          };
        }
        demands[col].count++;
        if (card.cost > demands[col].maxCost) {
          demands[col].maxCost = card.cost;
        }
        
        // エースカード（レア度3以上、または高コスト）への補正
        const isEpicOrLegendary = card.rarity >= 3;
        demands[col].priorityScore += card.cost * (isEpicOrLegendary ? 2.5 : 1.0);
      }
    }

    // 各属性の現在レベルとのギャップを算出
    const candidates = [];
    for (const [color, demand] of Object.entries(demands)) {
      const currentLevel = me.tribeLevels[color] || 0;
      
      if (currentLevel < 9) {
        const gap = Math.max(0, demand.maxCost - currentLevel);
        const score = demand.priorityScore / (gap + 1);
        
        candidates.push({
          color,
          score,
          currentLevel,
          gap
        });
      }
    }

    // 候補を優先度スコア順にソート
    candidates.sort((a, b) => b.score - a.score);

    // SPの許す限りレベルアップを決定
    for (const candidate of candidates) {
      if (availableSP <= 0) break;
      
      const targetLevel = Math.min(9, Math.max(candidate.currentLevel + 1, candidate.gap + candidate.currentLevel));
      const upgradesNeeded = Math.min(availableSP, targetLevel - candidate.currentLevel);

      for (let i = 0; i < upgradesNeeded; i++) {
        actions.push({ type: 'raise_tribe', color: candidate.color });
        availableSP--;
      }
    }

    // SPが余っており、他に上げられるものがなければ、最もレベルの高い属性を補強
    if (actions.length === 0 && availableSP > 0) {
      const activeColors = Object.keys(me.tribeLevels).filter(c => c !== 'neutral');
      if (activeColors.length > 0) {
        activeColors.sort((a, b) => (me.tribeLevels[b] || 0) - (me.tribeLevels[a] || 0));
        const bestColor = activeColors[0];
        if ((me.tribeLevels[bestColor] || 0) < 9) {
          actions.push({ type: 'raise_tribe', color: bestColor });
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

  /**
   * 最適戦闘トレード（有利交換評価）シミュレーション
   */
  decideAttacks(me, opponent) {
    const actions = [];
    const attackers = [];

    // 攻撃可能な全ユニットをリストアップ
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const unit = me.board[row][lane];
        if (unit && unit.canAttack && !unit.hasActed) {
          attackers.push({ unit, row, lane, acted: false });
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

    // リーサルチェック（仮想シールド耐久値で判定）
    const totalAtk = attackers.reduce((sum, a) => sum + (a.unit.currentAttack || 0), 0);
    const virtualShieldDurability = virtualOpponentShields.reduce((sum, s) => sum + (s.destroyed ? 0 : (s.currentDurability || 0)), 0);

    // 【Hard限定】手札内の即発ダメージスペル（火力）も、リーサル総攻撃計算の総火力として加算する
    let handBurnDamage = 0;
    if (this.difficulty === 'hard') {
      let tempSp = me.sp;
      for (const card of me.hand) {
        if (card.type === 'spell' && card.abilityEffect === 'damage' && tempSp >= card.cost) {
          handBurnDamage += (card.value || 2);
          tempSp -= card.cost;
        }
      }
    }

    // 盤面上の総ATK ＋ 手札のスペル火力で相手のシールドをすべて割り切れるか
    const hasLethal = (totalAtk + handBurnDamage) >= virtualShieldDurability && virtualShieldDurability > 0;

    // 最適なトレード順序を計算するためのループ
    for (let step = 0; step < attackers.length; step++) {
      let bestAttack = null;
      let maxScore = -Infinity;

      for (const attacker of attackers) {
        if (attacker.acted) continue;

        const targets = getValidAttackTargets(attacker.row, attacker.lane, attacker.unit, virtualOpponentBoard, virtualOpponentShields);
        if (targets.length === 0) continue;

        for (const target of targets) {
          let score = 0;

          if (target.type === 'direct') {
            score = 1000; // アバターへの攻撃は最優先
          } else if (target.type === 'shield') {
            if (hasLethal) {
              score = 950; // リーサル時はシールド破壊最優先（Hard/Normal共通）
            } else if (this.difficulty === 'hard') {
              score = 400; // Hard難易度：盤面有利なら積極的に相手のシールドを削り圧力をかける
            } else {
              score = 100; // 通常時、レーンが空いているならシールド攻撃は適度に優先
            }
          } else if (target.type === 'unit') {
            const defender = target.unit;
            const attackerVal = (attacker.unit.currentAttack || 0) * 1.5 + (attacker.unit.currentHp || 0);
            const defenderVal = (defender.currentAttack || 0) * 1.5 + (defender.currentHp || 0);

            // 敵が挑発（Taunt）を持っている場合は強制的にスコアを大幅に上乗せして挑発を真っ先に処理させる
            const isTaunt = defender.keywords && defender.keywords.includes('taunt');
            if (isTaunt) {
              score += 600;
            }

            const defenderWillDie = (attacker.unit.currentAttack || 0) >= (defender.currentHp || 0);
            
            // 敵が必殺（Lethal）持ちの場合のヘイトコントロール
            const defenderHasLethal = defender.keywords && defender.keywords.includes('lethal');
            const attackerWillDie = defenderHasLethal || (defender.currentAttack || 0) >= (attacker.unit.currentHp || 0);

            if (defenderWillDie) {
              score += defenderVal * 2.0;
              
              if (attackerWillDie) {
                score += (defenderVal - attackerVal) * 1.5;
                if (defenderHasLethal && attackerVal < 6) {
                  // 強力な「必殺」を低コスト雑魚で処理できれば超高スコア
                  score += 350;
                }
              } else {
                score += defenderVal * 3.0 + attackerVal * 0.5; // 一方的な有利交換
              }
            } else {
              if (attackerWillDie) {
                // 自殺アタックは基本的に大減点
                score -= attackerVal * 5.0;
              } else {
                score += (attacker.unit.currentAttack || 0) * 1.2; // 削り
              }
            }
          }

          if (score > maxScore) {
            maxScore = score;
            bestAttack = { attacker, target };
          }
        }
      }

      if (bestAttack) {
        const { attacker, target } = bestAttack;
        actions.push({ type: 'attack', attackerRow: attacker.row, attackerLane: attacker.lane, targetInfo: target });
        attacker.acted = true; // 行動済みに

        // 仮想盤面の更新
        if (target.type === 'unit') {
          const defender = virtualOpponentBoard[target.row][target.lane];
          if (defender) {
            const attackerHasLethal = attacker.unit.keywords && attacker.unit.keywords.includes('lethal');
            if (attackerHasLethal) {
              virtualOpponentBoard[target.row][target.lane] = null;
            } else {
              defender.currentHp -= (attacker.unit.currentAttack || 0);
              if (defender.currentHp <= 0) {
                virtualOpponentBoard[target.row][target.lane] = null;
              }
            }
          }
        } else if (target.type === 'shield') {
          const vShield = virtualOpponentShields.find(s => s.id === target.id);
          if (vShield) {
            vShield.currentDurability -= 1;
            if (vShield.currentDurability <= 0) vShield.destroyed = true;
          }
        }
      } else {
        break; // もう実行可能な攻撃がない
      }
    }

    return actions;
  }

  decideMulligan(hand) {
    // 3コスト以上の重いカードを引き直すインデックスとして返す
    const redrawIndices = [];
    hand.forEach((card, idx) => {
      if (card.cost >= 3) {
        redrawIndices.push(idx);
      }
    });
    return redrawIndices;
  }
}

module.exports = AIPlayer;
