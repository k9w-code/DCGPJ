// AIPlayer.js - NPCの行動AI（3レーン×前後列対応）
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');
const { hasKeyword, getValidAttackTargets } = require('./KeywordEffects');

class AIPlayer {
  constructor(playerId) {
    this.playerId = playerId;
  }

  decideTurnActions(playerView) {
    const actions = [];
    const me = playerView.me;
    const opponent = playerView.opponent;

    actions.push(...this.decideLevelUps(me));
    actions.push(...this.decideCardPlays(me, opponent));
    actions.push(...this.decideAttacks(me, opponent));
    actions.push({ type: 'end_turn' });
    return actions;
  }

  decideLevelUps(me) {
    const actions = [];
    let availableSP = me.sp;
    const cardsByColor = {};
    for (const card of me.hand) {
      if (!cardsByColor[card.color]) cardsByColor[card.color] = [];
      cardsByColor[card.color].push(card);
    }
    for (const [color, cards] of Object.entries(cardsByColor)) {
      const maxCost = Math.max(...cards.map(c => c.cost));
      const currentLevel = me.tribeLevels[color] || 0;
      if (currentLevel < maxCost && availableSP > 0) {
        const levelsNeeded = Math.min(maxCost - currentLevel, Math.floor(availableSP / 2));
        for (let i = 0; i < levelsNeeded; i++) {
          actions.push({ type: 'raise_tribe', color });
          availableSP--;
        }
      }
    }
    return actions;
  }

  decideCardPlays(me, opponent) {
    const actions = [];
    let availableSP = me.sp;
    const simulatedLevels = { ...me.tribeLevels };

    const sortedHand = me.hand
      .map((card, index) => ({ card, originalIndex: index }))
      .sort((a, b) => b.card.cost - a.card.cost);

    const playedIndices = new Set();
    const occupiedSlots = new Set();

    // 既存ユニットを記録
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (me.board[row][lane]) occupiedSlots.add(`${row}_${lane}`);
      }
    }

    for (const { card, originalIndex } of sortedHand) {
      if (playedIndices.has(originalIndex)) continue;
      if (availableSP < card.cost) continue;
      if ((simulatedLevels[card.color] || 0) < card.cost) continue;

      if (card.type === 'unit') {
        // 前列優先、中央優先で配置
        const rowOrder = ['front', 'back'];
        const laneOrder = [1, 0, 2]; // 中央→左→右
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
        if (!targetRow) continue;

        actions.push({ type: 'play_card', handIndex: originalIndex, targetRow, targetLane });
        availableSP -= card.cost;
        playedIndices.add(originalIndex);
        occupiedSlots.add(`${targetRow}_${targetLane}`);

      } else if (card.type === 'spell') {
        let targetRow = null;
        let targetLane = null;
        if (['damage', 'destroy', 'freeze', 'drain'].includes(card.abilityEffect)) {
          let bestRow = null, bestLane = -1, minHp = Infinity;
          for (const row of ROWS) {
            for (let i = 0; i < NUM_LANES; i++) {
              const u = opponent.board[row][i];
              if (u && u.currentHp < minHp) { minHp = u.currentHp; bestRow = row; bestLane = i; }
            }
          }
          if (bestRow) { targetRow = bestRow; targetLane = bestLane; }
          else continue;
        } else if (['buff_attack', 'buff_hp', 'grant_barrier'].includes(card.abilityEffect)) {
          let bestRow = null, bestLane = -1, maxAtk = -1;
          for (const row of ROWS) {
            for (let i = 0; i < NUM_LANES; i++) {
              const u = me.board[row][i];
              if (u && u.currentAttack > maxAtk) { maxAtk = u.currentAttack; bestRow = row; bestLane = i; }
            }
          }
          if (bestRow) { targetRow = bestRow; targetLane = bestLane; }
          else continue;
        }

        actions.push({ type: 'play_card', handIndex: originalIndex, targetRow, targetLane });
        availableSP -= card.cost;
        playedIndices.add(originalIndex);
      }
    }
    return actions;
  }

  decideAttacks(me, opponent) {
    const actions = [];
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const unit = me.board[row][lane];
        if (!unit || !unit.canAttack || unit.hasActed) continue;

        const targets = getValidAttackTargets(row, lane, unit, opponent.board, opponent.shields || []);
        if (targets.length === 0) continue;

        const directTarget = targets.find(t => t.type === 'direct');
        if (directTarget) {
          actions.push({ type: 'attack', attackerRow: row, attackerLane: lane, targetInfo: directTarget });
          continue;
        }
        
        const unitTargets = targets.filter(t => t.type === 'unit');
        const shieldTarget = targets.find(t => t.type === 'shield');

        // NPCは弱いユニットを優先、次点でシールドを狙う
        if (unitTargets.length > 0) {
          unitTargets.sort((a, b) => a.unit.currentHp - b.unit.currentHp);
          actions.push({ type: 'attack', attackerRow: row, attackerLane: lane, targetInfo: unitTargets[0] });
        } else if (shieldTarget) {
          actions.push({ type: 'attack', attackerRow: row, attackerLane: lane, targetInfo: shieldTarget });
        }
      }
    }
    return actions;
  }

  decideMulligan(hand) {
    return hand.filter(c => c.cost >= 3).length >= 3;
  }
}

module.exports = AIPlayer;
