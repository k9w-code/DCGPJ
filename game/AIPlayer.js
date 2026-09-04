// AIPlayer.js - NPCの行動AI (修正版 v7: 状況・対面・手札に応じたシチュエーション別戦術AI)
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');
const { hasKeyword, getValidAttackTargets } = require('./KeywordEffects');

class AIPlayer {
  constructor(playerId, cardMap, difficulty = 'hard') {
    this.playerId = playerId;
    this.cardMap = cardMap || {};
    this.difficulty = difficulty;
  }

  decideMulligan(hand) {
    const replaceIndices = [];
    if (hand && Array.isArray(hand)) {
      hand.forEach((card, index) => {
        if (card && card.cost >= 4) {
          replaceIndices.push(index);
        }
      });
    }
    return replaceIndices;
  }

  decideNextAction(playerView) {
    if (!playerView || !playerView.me) return null;
    const me = playerView.me;
    const opponent = playerView.opponent;
    const phase = playerView.phase;

    if (phase === 'targeting') {
      return this.decideTargetingAction(playerView);
    }

    const isEasyMiss = this.difficulty === 'easy' && Math.random() < 0.3;

    // --- 状況・戦術コンテクストの判定 ---
    const context = this.analyzeContext(me, opponent);

    // 1. 【対アグロ・防衛プラン】手札に挑発があり、盤面が危険またはアグロ対面なら挑発最優先！
    if (context.hasTauntInHand && (context.isOpponentAggro || context.isBoardThreatened)) {
      const tauntPlay = this.findTauntPlay(me);
      if (tauntPlay) return tauntPlay;
    }

    // 2. 【通常ユニット/スペル展開】手札に出せるカードがあれば優先プレイ（テンポ確保）
    const plays = this.decideCardPlays(me, opponent, context);
    if (plays.length > 0) {
      if (isEasyMiss && plays.length > 1) return plays[plays.length - 1];
      return plays[0];
    }

    // 3. 【覚醒/レベルアップ判断】盤面が安全、または出せる手札がない時、段階的にレベル上げ
    const levels = this.decideLevelUps(me, context);
    if (levels.length > 0) {
      if (!isEasyMiss) return levels[0];
    }

    // 4. 【攻撃判断】挑発優先破壊・顔攻撃
    const attacks = this.decideAttacks(me, opponent);
    if (attacks.length > 0) {
      if (isEasyMiss && attacks.length > 1) return attacks[attacks.length - 1];
      return attacks[0];
    }

    return { type: 'end_turn' };
  }

  analyzeContext(me, opponent) {
    const hand = me.hand || [];
    const board = me.board || { front: [], back: [] };
    const oppBoard = opponent.board || { front: [], back: [] };

    // 手札の挑発持ちチェック
    const hasTauntInHand = hand.some(c => hasKeyword(c, 'taunt'));
    // 手札の覚醒持ちチェック
    const hasAwakenInHand = hand.some(c => (c.keywords || []).some(k => k.startsWith('awaken')));

    // 自分の前列に挑発ユニットがすでにいるか
    let myTauntOnBoard = false;
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (board[row][lane] && hasKeyword(board[row][lane], 'taunt')) {
          myTauntOnBoard = true;
          break;
        }
      }
    }

    // 相手の盤面の脅威度
    let oppUnitCount = 0;
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (oppBoard[row][lane]) oppUnitCount++;
      }
    }
    const isBoardThreatened = oppUnitCount >= 2 && !myTauntOnBoard;
    const isOpponentAggro = oppUnitCount >= 1 && (opponent.shields || []).length < 3;

    return {
      hasTauntInHand,
      hasAwakenInHand,
      myTauntOnBoard,
      isBoardThreatened,
      isOpponentAggro
    };
  }

  findTauntPlay(me) {
    const currentLevels = me.tribeLevels || {};
    const occupiedSlots = new Set();
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (me.board[row][lane]) occupiedSlots.add(`${row}_${lane}`);
      }
    }

    for (let i = 0; i < me.hand.length; i++) {
      const card = me.hand[i];
      if (card.type === 'unit' && hasKeyword(card, 'taunt') && card.cost <= me.sp) {
        const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
        const levelOk = colors.every(col => col === 'neutral' || (currentLevels[col] || 0) >= card.cost);
        if (levelOk) {
          // 前列空きスロットを探す
          for (let lane = 0; lane < NUM_LANES; lane++) {
            if (!occupiedSlots.has(`front_${lane}`)) {
              return { type: 'play_card', handIndex: i, targetRow: 'front', targetLane: lane };
            }
          }
          for (let lane = 0; lane < NUM_LANES; lane++) {
            if (!occupiedSlots.has(`back_${lane}`)) {
              return { type: 'play_card', handIndex: i, targetRow: 'back', targetLane: lane };
            }
          }
        }
      }
    }
    return null;
  }

  decideTargetingAction(playerView) {
    const me = playerView.me;
    const opponent = playerView.opponent;
    const source = playerView.pendingAbilitySource;
    if (!source) return { type: 'end_turn' };

    // 1. 【防衛優先】自分の前列(front)に壁がいないレーンにいる敵アタッカーを最優先で足止め・バウンス！
    for (let lane = 0; lane < NUM_LANES; lane++) {
      if (!me.board.front[lane]) {
        // 自陣前列が空いているレーンの敵ユニットを探す
        for (const row of ['front', 'back']) {
          const oppUnit = opponent.board[row][lane];
          if (oppUnit) {
            return { type: 'select_target', targetRow: row, targetLane: lane };
          }
        }
      }
    }

    // 2. 【高ATK優先】相手の盤面で最もATKが高い敵ユニットをターゲット選択
    let bestTarget = null;
    let maxAtk = -1;
    for (const row of ['front', 'back']) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const u = opponent.board[row][lane];
        if (u) {
          const atk = u.currentAttack !== undefined ? u.currentAttack : u.attack;
          if (atk > maxAtk) {
            maxAtk = atk;
            bestTarget = { targetRow: row, targetLane: lane };
          }
        }
      }
    }
    if (bestTarget) {
      return { type: 'select_target', targetRow: bestTarget.targetRow, targetLane: bestTarget.targetLane };
    }

    // 味方対象スペルなどのフォールバック
    for (const row of ['back', 'front']) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (me.board[row][lane]) {
          return { type: 'select_target', targetRow: row, targetLane: lane };
        }
      }
    }
    return { type: 'select_target', targetRow: 'front', targetLane: 0 };
  }

  decideLevelUps(me, context) {
    if (me.sp <= 0) return [];
    const currentLevels = me.tribeLevels || {};

    // 出せる手札があるならレベル上げより展開を優先
    const canPlayHand = me.hand.some(card => {
      if (card.cost > me.sp) return false;
      const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
      return colors.every(col => col === 'neutral' || (currentLevels[col] || 0) >= card.cost);
    });

    // 出せる手札があり、盤面が脅かされている、または挑発が必要な場合はレベル上げをスキップ
    if (canPlayHand && (context.isBoardThreatened || !context.myTauntOnBoard && context.hasTauntInHand)) {
      return [];
    }

    // 覚醒ミッドレンジプラン：挑発で守れている、または手札がプレイ不可の時にレベル上げ
    for (const card of me.hand) {
      const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
      const awakenKw = (card.keywords || []).find(k => k.startsWith('awaken'));

      let targetNeeded = card.cost;
      let awakenColor = null;
      if (awakenKw) {
        const parts = awakenKw.split(':');
        awakenColor = parts[1] === 'self' || !parts[1] ? card.color : parts[1];
        targetNeeded = parseInt(parts[2]) || 7;
      }

      for (const col of colors) {
        if (col === 'neutral') continue;
        const targetCol = awakenColor || col;
        const curLv = currentLevels[targetCol] || 0;

        if (curLv < card.cost || (awakenKw && curLv < targetNeeded)) {
          if (curLv < 9) {
            return [{ type: 'raise_tribe', color: targetCol }];
          }
        }
      }
    }

    return [];
  }

  decideCardPlays(me, opponent, context) {
    const actions = [];
    let availableSP = me.sp;
    const currentLevels = { ...me.tribeLevels };

    const occupiedSlots = new Set();
    let occupiedCount = 0;
    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        if (me.board[row][lane]) {
          occupiedSlots.add(`${row}_${lane}`);
          occupiedCount++;
        }
      }
    }

    const playableHand = [];
    me.hand.forEach((card, index) => {
      if (card.cost > availableSP) return;
      const colors = card.colors && card.colors.length > 0 ? card.colors : [card.color || 'neutral'];
      const levelOk = colors.every(col => col === 'neutral' || (currentLevels[col] || 0) >= card.cost);
      if (levelOk) {
        playableHand.push({ card, index });
      }
    });

    if (playableHand.length === 0) return [];

    playableHand.sort((a, b) => {
      const aTaunt = hasKeyword(a.card, 'taunt') ? 10 : 0;
      const bTaunt = hasKeyword(b.card, 'taunt') ? 10 : 0;
      if (aTaunt !== bTaunt) return bTaunt - aTaunt;

      if (a.card.type === 'unit' && b.card.type === 'unit') {
        return b.card.cost - a.card.cost;
      }
      return 0;
    });

    for (const item of playableHand) {
      const card = item.card;
      const index = item.index;

      if (card.type === 'spell') {
        actions.push({ type: 'play_card', handIndex: index, targetRow: null, targetLane: null });
        break;
      }

      if (card.type === 'unit') {
        if (occupiedCount >= NUM_LANES * 2) continue;

        const preferredRow = hasKeyword(card, 'taunt') ? 'front' : 'back';
        const secondaryRow = preferredRow === 'front' ? 'back' : 'front';

        let targetSlot = null;
        for (let lane = 0; lane < NUM_LANES; lane++) {
          if (!occupiedSlots.has(`${preferredRow}_${lane}`)) {
            targetSlot = { row: preferredRow, lane };
            break;
          }
        }
        if (!targetSlot) {
          for (let lane = 0; lane < NUM_LANES; lane++) {
            if (!occupiedSlots.has(`${secondaryRow}_${lane}`)) {
              targetSlot = { row: secondaryRow, lane };
              break;
            }
          }
        }

        if (targetSlot) {
          actions.push({
            type: 'play_card',
            handIndex: index,
            targetRow: targetSlot.row,
            targetLane: targetSlot.lane
          });
          break;
        }
      }
    }

    return actions;
  }

  decideAttacks(me, opponent) {
    const attacks = [];
    if (!me || !me.board || !opponent || !opponent.board) return attacks;

    for (const row of ROWS) {
      for (let lane = 0; lane < NUM_LANES; lane++) {
        const attacker = me.board[row][lane];
        if (!attacker || !attacker.canAttack || attacker.attackedThisTurn) continue;

        const validTargets = getValidAttackTargets(row, lane, attacker, opponent.board, opponent.shields);
        if (validTargets.length === 0) continue;

        const tauntTarget = validTargets.find(t => t.type === 'unit' && hasKeyword(t.unit, 'taunt'));
        if (tauntTarget) {
          attacks.push({
            type: 'attack',
            attackerRow: row,
            attackerLane: lane,
            targetInfo: { type: 'unit', row: tauntTarget.row, lane: tauntTarget.lane }
          });
          continue;
        }

        const shieldTarget = validTargets.find(t => t.type === 'shield');
        if (shieldTarget) {
          attacks.push({
            type: 'attack',
            attackerRow: row,
            attackerLane: lane,
            targetInfo: { type: 'shield', shieldIndex: shieldTarget.shieldIndex }
          });
          continue;
        }

        const directTarget = validTargets.find(t => t.type === 'player');
        if (directTarget) {
          attacks.push({
            type: 'attack',
            attackerRow: row,
            attackerLane: lane,
            targetInfo: { type: 'player' }
          });
          continue;
        }

        const unitTarget = validTargets.find(t => t.type === 'unit');
        if (unitTarget) {
          attacks.push({
            type: 'attack',
            attackerRow: row,
            attackerLane: lane,
            targetInfo: { type: 'unit', row: unitTarget.row, lane: unitTarget.lane }
          });
        }
      }
    }
    return attacks;
  }
}

module.exports = AIPlayer;
