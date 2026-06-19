// GameEngine.js - \u30b2\u30fc\u30e0\u30a8\u30f3\u30b8\u30f3\uff083\u30ec\u30fc\u30f3\u00d7\u524d\u5f8c\u5217\u5bfe\u5fdc\uff09
'use strict';

const {
  NUM_LANES, ROWS, INITIAL_HAND_SIZE, MAX_HAND_SIZE, SP_PER_TURN,
  FIRST_TURN_SP, MAX_TRIBE_LEVEL, NUM_SHIELDS,
  createPlayerState, createUnitInstance, createShieldInstance,
  createGameState, shuffleDeck, drawCards, getCurrentPlayer, getOpponentPlayer,
  forEachUnit, getBoardUnit, calculateLife,
} = require('./GameState');

const { hasKeyword, getKeywordParam, getValidAttackTargets } = require('./KeywordEffects');
const { resolveUnitCombat, resolveShieldAttack, processUnitDeath } = require('./CombatResolver');
const { processAbility, processSearch, processSpellEffect, processShieldSkill } = require('./AbilityProcessor');

class GameEngine {
  constructor(gameData) {
    this.cardMap = gameData.cardMap;
    this.cards = gameData.cards;
    this.shields = gameData.shields;
    this.keywordMap = gameData.keywordMap;
    this.gameState = null;
  }

  initGame(p1Info, p2Info) {
    const p1 = createPlayerState(p1Info.id, p1Info.name, p1Info.isAI, p1Info.avatar);
    const p2 = createPlayerState(p2Info.id, p2Info.name, p2Info.isAI, p2Info.avatar);
    this.gameState = createGameState(p1, p2);

    p1.deck = shuffleDeck(p1Info.deckCardIds);
    p2.deck = shuffleDeck(p2Info.deckCardIds);

    p1.shields = p1Info.shieldIds.map(id => {
      const sd = this.shields.find(s => s.id === id);
      return createShieldInstance(sd);
    });
    p2.shields = p2Info.shieldIds.map(id => {
      const sd = this.shields.find(s => s.id === id);
      return createShieldInstance(sd);
    });

    p1.totalShieldDurability = p1.shields.reduce((s, sh) => s + sh.currentDurability, 0);
    p2.totalShieldDurability = p2.shields.reduce((s, sh) => s + sh.currentDurability, 0);

    if (Math.random() < 0.5) {
      this.gameState.playerOrder = [p1.id, p2.id];
    } else {
      this.gameState.playerOrder = [p2.id, p1.id];
    }

    this.log(`\ud83c\udfae \u30b2\u30fc\u30e0\u958b\u59cb\uff01\u5148\u653b: ${this.gameState.players[this.gameState.playerOrder[0]].name}, \u5f8c\u653b: ${this.gameState.players[this.gameState.playerOrder[1]].name}`);

    for (const pid of this.gameState.playerOrder) {
      const player = this.gameState.players[pid];
      drawCards(player, this.cardMap, INITIAL_HAND_SIZE);
      this.log(`\ud83d\udcd6 ${player.name}: \u521d\u671f\u624b\u672d ${INITIAL_HAND_SIZE} \u679a\u30c9\u30ed\u30fc`);
    }

    this.gameState.phase = 'mulligan';
    return this.getGameStateForClients();
  }

  processMulligan(playerId, decision) {
    const player = this.gameState.players[playerId];
    if (!player) {
      console.warn(`⚠️ processMulligan: プレイヤー ${playerId} が見つかりません`);
      return null;
    }

    let redrawIndices = [];
    if (Array.isArray(decision)) {
      redrawIndices = decision;
    } else if (decision && typeof decision === 'object' && Array.isArray(decision.redrawIndices)) {
      redrawIndices = decision.redrawIndices;
    } else if (decision === true) {
      // 互換性のため: trueなら全引き直し
      redrawIndices = player.hand.map((_, idx) => idx);
    }

    if (redrawIndices.length > 0) {
      const redrawCards = [];
      const keepCards = [];
      player.hand.forEach((card, idx) => {
        if (redrawIndices.includes(idx)) {
          redrawCards.push(card.id);
        } else {
          keepCards.push(card);
        }
      });

      // 引き直すカードを山札に戻してシャッフル
      player.deck = shuffleDeck([...player.deck, ...redrawCards]);
      player.hand = keepCards;

      // 不足枚数をドロー
      drawCards(player, this.cardMap, redrawIndices.length);
      this.log(`🔄 ${player.name}: マリガン実行（${redrawIndices.length}枚交換: [${redrawIndices.join(', ')}]）`);
    } else {
      this.log(`✅ ${player.name}: マリガンなし (キープ)`);
    }
    return this.getGameStateForClients();
  }


  startTurn() {
    const gs = this.gameState;
    const current = getCurrentPlayer(gs);
    const isSecondPlayer = gs.playerOrder[1] === current.id;
    const isFirstTurn = gs.isFirstTurn[current.id];
    this.log(`\ud83d\udd0d [GameEngine] startTurn: player=${current.name}, id=${current.id}, isFirstTurn=${isFirstTurn}, gs.isFirstTurn=${JSON.stringify(gs.isFirstTurn)}`);

    this.log(`\n\u2550\u2550\u2550 \u30bf\u30fc\u30f3 ${gs.turnNumber} - ${current.name} \u2550\u2550\u2550`);

    const isFirstPlayerFirstTurn = gs.playerOrder[0] === current.id && isFirstTurn;
    if (!isFirstPlayerFirstTurn) {
      const result = drawCards(current, this.cardMap, 1);
      if (result.deckOut) {
        this.log(`\ud83d\udc80 ${current.name}: \u30c7\u30c3\u30ad\u5207\u308c\uff01\u6557\u5317\uff01`);
        gs.winner = gs.playerOrder[gs.currentPlayerIndex === 0 ? 1 : 0];
        gs.phase = 'game_over';
        return this.getGameStateForClients();
      }
      if (result.drawn.length > 0) {
        this.log(`\ud83d\udcd6 ${current.name}: ${result.drawn[0].name} \u3092\u30c9\u30ed\u30fc`);
      }
    } else {
      this.log(`\ud83d\udcd6 ${current.name}: \u5148\u653b1\u30bf\u30fc\u30f3\u76ee\u306e\u305f\u3081\u30c9\u30ed\u30fc\u306a\u3057`);
    }

    // \u521d\u56de\u30bf\u30fc\u30f3\uff08\u5404\u30d7\u30ec\u30a4\u30e4\u30fc\u306b\u3068\u3063\u3066\u306e\u6700\u521d\u306e\u30bf\u30fc\u30f3\uff09\u306f4 SP\u3001\u305d\u308c\u4ee5\u964d\u306f3 SP
    const isFirstTurnForThisPlayer = gs.isFirstTurn[current.id];
    const baseSpGain = isFirstTurnForThisPlayer ? 4 : 3;
    
    const spGain = Math.max(0, baseSpGain + (current.spModifiers || 0));
    current.spModifiers = 0; // \u4e00\u6642\u7684\u306a\u30e2\u30c7\u30a3\u30d5\u30a1\u30a4\u30a2\u3092\u30ea\u30bb\u30c3\u30c8
    current.sp += spGain;
    this.log(`\ud83d\udcb0 [GameEngine] ${current.name}: SP+${spGain} (Base:${baseSpGain}, Current SP: ${current.sp}, isFirstTurn:${isFirstTurnForThisPlayer}, turn:${gs.turnNumber})`);

    // \u30bf\u30fc\u30f3\u958b\u59cb\u6642\u306b\u30d5\u30e9\u30b0\u3092\u66f4\u65b0
    gs.isFirstTurn[current.id] = false;
    current.cardsPlayedThisTurn = 0;
    current.friendlyDeathsThisTurn = 0;

    // \u30e6\u30cb\u30c3\u30c8\u306e\u884c\u52d5\u53ef\u80fd\u72b6\u614b\u3092\u30ea\u30bb\u30c3\u30c8\uff08\u5168\u5217\u8d70\u67fb\uff09
    forEachUnit(current.board, (unit) => {
      if (unit.frozen) {
        unit.frozen = false; // \u51cd\u7d50\u72b6\u614b\u3092\u6d88\u8cbb
        unit.hasActed = true; // \u884c\u52d5\u6e08\u307f\u72b6\u614b\u3092\u7dad\u6301
        unit.canAttack = false; // \u653b\u6483\u4e0d\u53ef\u3092\u7dad\u6301
        this.log(`\u2744\ufe0f ${unit.name} \u306f\u51cd\u7d50\u3055\u308c\u3066\u3044\u308b\u305f\u3081\u3001\u3053\u306e\u30bf\u30fc\u30f3\u306f\u884c\u52d5\u3067\u304d\u307e\u305b\u3093`);
      } else {
        unit.hasActed = false;
        unit.canAttack = true;
      }
      unit.summonedThisTurn = false; 
    });

    gs.phase = 'main';
    return this.getGameStateForClients();
  }

  raiseTribeLevel(playerId, color) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'main') return { error: '\u30a2\u30af\u30b7\u30e7\u30f3\u4e0d\u53ef' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '\u81ea\u5206\u306e\u30bf\u30fc\u30f3\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };
    if (player.sp < 1) return { error: 'SP\u304c\u8db3\u308a\u307e\u305b\u3093' };
    if (player.tribeLevels[color] >= MAX_TRIBE_LEVEL) return { error: `${color}\u306f\u6700\u5927\u30ec\u30d9\u30eb\u3067\u3059` };

    player.sp -= 1;
    player.tribeLevels[color]++;
    this.log(`\u2b06\ufe0f ${player.name}: ${color}\u306e\u795e\u65cf\u30ec\u30d9\u30eb+1 (Lv.${player.tribeLevels[color]}, SP: ${player.sp})`);
    
    // \u899a\u9192\u30c1\u30a7\u30c3\u30af
    this.checkAwakening(player);
    
    return this.getGameStateForClients();
  }

  checkAwakening(player) {
    const gs = this.gameState;
    const opponent = Object.values(gs.players).find(p => p.id !== player.id);
    forEachUnit(player.board, (unit) => {
      if (!unit.keywords) return;
      unit.keywords.forEach(keyword => {
          const { getKeywordId } = require('./KeywordEffects');
          const kw = getKeywordId(keyword);
          if (kw.id === 'awaken') {
              let currentLevel = 0;
              if (kw.color === 'any') {
                  currentLevel = Object.values(player.tribeLevels).reduce((val, sum) => val + sum, 0);
              } else if (kw.color === 'self') {
                  currentLevel = player.tribeLevels[unit.color] || 0;
              } else {
                  currentLevel = player.tribeLevels[kw.color] || 0;
              }
              
              if (currentLevel >= kw.param) {
                  if (!unit.awakenedKeywords) unit.awakenedKeywords = [];
                  if (!unit.awakenedKeywords.includes(keyword)) {
                      unit.awakenedKeywords.push(keyword);
                      this.log(`\u2728 ${unit.name} \u304c\u899a\u9192\u6761\u4ef6\u3092\u6e80\u305f\u3057\u305f\uff01 (${keyword})`);
                      const { processAbility } = require('./AbilityProcessor');
                      const res = processAbility('awaken', unit, gs, player, opponent, this.cardMap, gs.logs);
                      this.handleAbilityResult(res, unit, 'awaken', player, opponent);
                  }
              }
          }
      });
    });
  }

  surrender(playerId) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player) return { error: '\u30d7\u30ec\u30a4\u30e4\u30fc\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093' };

    this.log(`\ud83c\udff3\ufe0f ${player.name}\u304c\u6295\u4e86\u3057\u307e\u3057\u305f`);
    gs.phase = 'game_over';
    gs.winner = gs.playerOrder.find(id => id !== playerId);
    return this.getGameStateForClients();
  }

  playCard(playerId, handIndex, targetRow, targetLane) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'main') return { error: '\u30a2\u30af\u30b7\u30e7\u30f3\u4e0d\u53ef' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '\u81ea\u5206\u306e\u30bf\u30fc\u30f3\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };
    if (handIndex < 0 || handIndex >= player.hand.length) return { error: '\u7121\u52b9\u306a\u30ab\u30fc\u30c9' };

    const card = player.hand[handIndex];
    if (player.sp < card.cost) return { error: `SP\u304c\u8db3\u308a\u307e\u305b\u3093\uff08\u5fc5\u8981: ${card.cost}, \u73fe\u5728: ${player.sp}\uff09` };
    
    // \u591a\u8272\u795e\u65cf\u30ec\u30d9\u30eb\u30c1\u30a7\u30c3\u30af
    const requiredColors = card.colors || [card.color];
    for (const col of requiredColors) {
      if (player.tribeLevels[col] < card.cost) {
        return { error: `${col}\u306e\u795e\u65cf\u30ec\u30d9\u30eb\u304c\u8db3\u308a\u307e\u305b\u3093\uff08\u5fc5\u8981: ${card.cost}, \u73fe\u5728: Lv.${player.tribeLevels[col]}\uff09` };
      }
    }

    // \u4ee3\u511f (Sacrifice) \u30b3\u30b9\u30c8\u306e\u30d0\u30ea\u30c7\u30fc\u30b7\u30e7\u30f3: \u5473\u65b9\u304c1\u4f53\u3082\u3044\u306a\u3051\u308c\u3070\u5931\u6557
    if (card.keywords && card.keywords.some(k => k.startsWith('sacrifice'))) {
      let alliesCount = 0;
      for (const r of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          if (player.board[r][i]) alliesCount++;
        }
      }
      if (alliesCount === 0) return { error: '\u4ee3\u511f\uff08\u751f\u3051\u8d04\uff09\u306b\u3059\u308b\u5473\u65b9\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u306a\u3044\u305f\u3081\u30d7\u30ec\u30a4\u3067\u304d\u307e\u305b\u3093' };
    }

    // \u30b7\u30fc\u30eb\u30c9\u81ea\u50b7\u30b3\u30b9\u30c8\u306e\u30d0\u30ea\u30c7\u30fc\u30b7\u30e7\u30f3: \u30b7\u30fc\u30eb\u30c9\u304c\u306a\u3051\u308c\u3070\u5931\u6557
    if (card.abilities) {
      const isShieldSacrifice = card.abilities.some(a => a.effect === 'damage_shield' && (a.target === 'self' || a.target === 'self_shield'));
      if (isShieldSacrifice) {
        const activeShields = player.shields.filter(s => !s.destroyed && s.currentDurability > 0);
        if (activeShields.length === 0) {
          return { error: '\u7834\u58ca\u53ef\u80fd\u306a\u81ea\u5206\u306e\u30b7\u30fc\u30eb\u30c9\u304c\u306a\u3044\u305f\u3081\u30d7\u30ec\u30a4\u3067\u304d\u307e\u305b\u3093' };
        }
      }
    }

    const opponent = getOpponentPlayer(gs);

    if (card.type === 'unit') {
      if (!targetRow || !ROWS.includes(targetRow)) return { error: '\u5217\u3092\u6307\u5b9a\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u524d\u5217/\u5f8c\u5217\uff09' };
      if (targetLane === undefined || targetLane === null || targetLane < 0 || targetLane >= NUM_LANES) {
        return { error: '\u7121\u52b9\u306a\u30ec\u30fc\u30f3' };
      }
      if (player.board[targetRow][targetLane] !== null) return { error: '\u305d\u306e\u30b9\u30ed\u30c3\u30c8\u306b\u306f\u3059\u3067\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u307e\u3059' };

      // \u30e6\u30cb\u30c3\u30c8\u30d7\u30ec\u30a4\u78ba\u5b9a\u3002\u3053\u3053\u3067 1 \u56de\u3060\u3051\u30b3\u30b9\u30c8\u3092\u652f\u6255\u3046
      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      player.cardsPlayedThisTurn++;

      // \u66b4\u8d70 (Overload) \u30da\u30ca\u30eb\u30c6\u30a3\u306e\u9069\u7528
      if (card.keywords && card.keywords.includes('overload')) {
        player.spModifiers -= 1;
        this.log(`\u26a1 ${card.name} \u306e\u300c\u66b4\u8d70\u300d\uff01 \u6b21\u30bf\u30fc\u30f3\u306e\u7372\u5f97SP\u304c1\u6e1b\u5c11\u3059\u308b\uff08\u78ba\u5b9a\uff09`);
      }

      const unit = createUnitInstance(card, playerId);
      unit.canAttack = hasKeyword(unit, 'rush');
      unit.barrierActive = hasKeyword(unit, 'barrier');
      unit.endureActive = hasKeyword(unit, 'endure');
      unit.stealthActive = hasKeyword(unit, 'stealth');

      // \u672c\u4f53\u3092\u76e4\u9762\u306b\u914d\u7f6e\uff08\u30a2\u30d3\u30ea\u30c6\u30a3\u89e3\u6c7a\u524d\u306b\u5b58\u5728\u3092\u78ba\u5b9a\u3055\u305b\u308b\uff09
      player.board[targetRow][targetLane] = unit;
      const rowLabel = targetRow === 'front' ? '\u524d\u5217' : '\u5f8c\u5217';
      this.log(`\ud83c\udccf ${player.name}: ${card.name} \u3092${rowLabel}\u30ec\u30fc\u30f3${targetLane + 1}\u306b\u914d\u7f6e (SP: ${player.sp})`);

      // \u30a2\u30d3\u30ea\u30c6\u30a3\u51e6\u7406
      const abilityResult = processAbility('on_play', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs, null, null);
      if (this.handleAbilityResult(abilityResult, unit, 'on_play', player, opponent)) {
        // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u304c\u5fc5\u8981\u306a\u5834\u5408\u306f\u3053\u3053\u3067\u4e00\u65e6\u505c\u6b62\uff08\u30af\u30e9\u30a4\u30a2\u30f3\u30c8\u306b\u901a\u77e5\uff09
        // \u65e2\u306b\u76e4\u9762\u306b\u3044\u308b\u305f\u3081\u3001resolveTargeting \u3067 instanceId \u304b\u3089\u518d\u691c\u7d22\u53ef\u80fd
        return this.getGameStateForClients();
      }

      this.processEvents(abilityResult.events, player, opponent);
      
      // \u30d7\u30ec\u30a4\u76f4\u5f8c\u306e\u899a\u9192\u30c1\u30a7\u30c3\u30af\uff08\u65e2\u306b\u6761\u4ef6\u3092\u6e80\u305f\u3057\u3066\u3044\u308b\u5834\u5408\uff09
      this.checkAwakening(player);
      
      // \u5a01\u5727\uff08intimidate\uff09\u51e6\u7406: \u6b63\u9762\u306e\u6575\u30e6\u30cb\u30c3\u30c81\u4f53\u3092\u51cd\u7d50
      if (hasKeyword(unit, 'intimidate')) {
        let frontEnemy = opponent.board.front[targetLane];
        if (!frontEnemy && targetRow === 'back') {
          frontEnemy = opponent.board.back[targetLane];
        }
        if (frontEnemy && !frontEnemy.stealthActive) {
          frontEnemy.hasActed = true;
          frontEnemy.canAttack = false;
          this.log(`\u2744\ufe0f ${unit.name} \u306e\u300c\u5a01\u5727\u300d\uff01\u6b63\u9762\u306e ${frontEnemy.name} \u3092\u51cd\u7d50\uff08\u6b21\u30bf\u30fc\u30f3\u884c\u52d5\u4e0d\u53ef\uff09`);
          // Note: events push not strictly needed for basic intimidate, just status change + log is enough for client update
        }
      }

    } else if (card.type === 'spell') {
      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs, 0);
      
      if (result.needsTarget) {
        // \u30b9\u30da\u30eb\u767a\u52d5\u4e2d\u306b\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\uff08\u53ec\u559a\u5834\u6240\u306a\u3069\uff09\u304c\u5fc5\u8981\u306a\u5834\u5408
        gs.phase = 'targeting';
        gs.pendingAbilitySource = {
          spellCardId: card.id,
          unitName: card.name, // \u5171\u901a\u8868\u793a\u7528
          trigger: 'on_play',
          effect: result.effect,
          targetId: result.targetId,
          abilityIndex: result.abilityIndex || 0,
          ownerId: player.id
        };
        this.log(`\u2728 \u30b9\u30da\u30eb\u300c${card.name}\u300d\u306e\u767a\u52d5\u5bfe\u8c61\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044...`);
        return this.getGameStateForClients();
      }

      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      player.cardsPlayedThisTurn++;
      
      // \u66b4\u8d70 (Overload) \u30da\u30ca\u30eb\u30c6\u30a3\u306e\u9069\u7528
      if (card.keywords && card.keywords.includes('overload')) {
        player.spModifiers -= 1;
        this.log(`\u26a1 ${card.name} \u306e\u300c\u66b4\u8d70\u300d\uff01 \u6b21\u30bf\u30fc\u30f3\u306e\u7372\u5f97SP\u304c1\u6e1b\u5c11\u3059\u308b\uff08\u78ba\u5b9a\uff09`);
      }
      
      this.log(`\u2728 ${player.name}: \u30b9\u30da\u30eb\u300c${card.name}\u300d\u3092\u767a\u52d5 (SP: ${player.sp})`);

      this.processEvents(result.events, player, opponent);
      player.graveyard.push(card);
      this.broadcastTrigger('spell_play', playerId);
    }

    this.cleanupDeadUnits();
    return this.getGameStateForClients();
  }

  // --- \u30b0\u30ed\u30fc\u30d0\u30eb\u30c8\u30ea\u30ac\u30fc\u6a5f\u69cb ---
  // \u6307\u5b9a\u3057\u305f\u30a4\u30d9\u30f3\u30c8\u3092\u76e4\u9762\u306e\u5168\u30e6\u30cb\u30c3\u30c8\u306b\u901a\u77e5\u3057\u3001\u6761\u4ef6\u306b\u5408\u3046\u30c8\u30ea\u30ac\u30fc\u3092\u767a\u52d5\u3055\u305b\u308b
  broadcastTrigger(triggerType, sourcePlayerId) {
    const gs = this.gameState;
    const p1 = gs.players[gs.playerOrder[0]];
    const p2 = gs.players[gs.playerOrder[1]];

    const triggerForBoard = (owner, opponent, isOwnerTrigger) => {
      const specificTrigger = isOwnerTrigger ? `on_friendly_${triggerType}` : `on_enemy_${triggerType}`;
      forEachUnit(owner.board, u => {
        // \u4f8b: on_friendly_death, on_enemy_spell_play \u306a\u3069
        const res1 = processAbility(specificTrigger, u, gs, owner, opponent, this.cardMap, gs.logs);
        this.handleAbilityResult(res1, u, specificTrigger, owner, opponent);
        
        // \u5206\u3051\u9694\u3066\u306a\u3044\u6c4e\u7528\u30c8\u30ea\u30ac\u30fc \u4f8b: on_spell_play, on_card_draw
        const res2 = processAbility(`on_${triggerType}`, u, gs, owner, opponent, this.cardMap, gs.logs);
        this.handleAbilityResult(res2, u, `on_${triggerType}`, owner, opponent);
      });
    };

    triggerForBoard(p1, p2, p1.id === sourcePlayerId);
    triggerForBoard(p2, p1, p2.id === sourcePlayerId);
  }

  resolvePendingAbility(playerId, targetRow, targetLane) {
    const gs = this.gameState;
    if (gs.phase !== 'targeting') return { error: '\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u30d5\u30a7\u30fc\u30ba\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };
    
    const sourceInfo = gs.pendingAbilitySource;
    if (!sourceInfo) {
       gs.phase = 'main';
       return this.getGameStateForClients();
    }

    // \u81ea\u5206\u306e\u30bf\u30fc\u30f3\u304b\u3069\u3046\u304b\u3067\u306f\u306a\u304f\u3001\u30a2\u30d3\u30ea\u30c6\u30a3\u306e\u6301\u3061\u4e3b\u304b\u3069\u3046\u304b\u3092\u30c1\u30a7\u30c3\u30af
    if (sourceInfo.ownerId && playerId !== sourceInfo.ownerId) {
      return { error: '\u5bfe\u8c61\u3092\u9078\u629e\u3059\u308b\u6a29\u9650\u304c\u3042\u308a\u307e\u305b\u3093' };
    }

    const player = gs.players[playerId];
    const opId = Object.keys(gs.players).find(id => id !== playerId);
    const opponent = gs.players[opId];

    // \u5171\u901a\u306e\u30e6\u30cb\u30c3\u30c8\u30a2\u30d3\u30ea\u30c6\u30a3\u89e3\u6c7a\uff08\u65e2\u306b\u76e4\u9762\u306b\u914d\u7f6e\u3055\u308c\u3066\u3044\u308b\u524d\u63d0\uff09
    if (sourceInfo.unitInstanceId) {
      let unit = null;
      let owner = gs.players[sourceInfo.ownerId] || player;
      forEachUnit(owner.board, u => { if (u.instanceId === sourceInfo.unitInstanceId) unit = u; });
      
      if (!unit) {
        // 盤面に見つからない場合（死亡して除去された後など）、保存されたインスタンスがあればそれを使用
        if (sourceInfo.unit) {
          unit = sourceInfo.unit;
        } else {
          console.warn(`[GameEngine] Unit ${sourceInfo.unitInstanceId} not found and no backup info.`);
          gs.phase = 'main';
          gs.pendingAbilitySource = null;
          return this.getGameStateForClients();
        }
      }

      // \u89e3\u6c7a\u524d\u306e\u30d0\u30ea\u30c7\u30fc\u30b7\u30e7\u30f3 (empty_slot \u306e\u5834\u5408)
      if (sourceInfo.targetId === 'empty_slot') {
          if (gs.players[playerId].board[targetRow][targetLane] !== null) {
              console.warn(`\u26a0\ufe0f [GameEngine] Invalid target: ${targetRow},${targetLane} is occupied.`);
              return this.getGameStateForClients();
          }
      }

      // \u6b8b\u97ff (Echo) \u306e\u89e3\u6c7a
      if (sourceInfo.effect === 'echo_summon') {
        const cost = unit.cost || 0;
        if (player.sp < cost) {
          this.log(`\u26a0\ufe0f SP\u304c\u8db3\u308a\u306a\u3044\u305f\u3081\u300c\u6b8b\u97ff\u300d\u306f\u4e0d\u767a\u306b\u7d42\u308f\u308a\u307e\u3057\u305f`);
        } else {
          player.sp -= cost;
          const cardData = this.cardMap[unit.cardId];
          const copy = createUnitInstance(cardData, player.id);
          copy.hasActed = true; // \u51fa\u3057\u305f\u30bf\u30fc\u30f3\u306f\u653b\u6483\u4e0d\u53ef
          copy.canAttack = false;
          // \u30b3\u30d4\u30fc\u304b\u3089\u306f\u6b8b\u97ff\u30ad\u30fc\u30ef\u30fc\u30c9\u3092\u6d88\u53bb\uff08\u7121\u9650\u9023\u9396\u9632\u6b62\uff09
          if (copy.keywords) {
            copy.keywords = copy.keywords.filter(k => k !== 'echo');
          }
          player.board[targetRow][targetLane] = copy;
          this.log(`\u2728 ${unit.name} \u306e\u300c\u6b8b\u97ff\u300d\uff01SP\u3092 ${cost} \u6d88\u8cbb\u3057\u3066\u30b3\u30d4\u30fc\u3092\u53ec\u559a\u3057\u305f (\u6b8bSP: ${player.sp})`);
          
          // \u30b3\u30d4\u30fc\u914d\u7f6e\u5f8c\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u51e6\u7406\uff08\u6b8b\u97ff\u306f\u4ed8\u4e0e\u3055\u308c\u306a\u3044\u3088\u3046\u306b\u8abf\u6574\u6e08\u307f\uff09
          const { processAbility } = require('./AbilityProcessor');
          const abilityResult = processAbility('on_play', copy, gs, player, opponent, this.cardMap, gs.logs);
          this.handleAbilityResult(abilityResult, copy, 'on_play', player, opponent);
        }
        
        this.cleanupDeadUnits();
        return this.getGameStateForClients();
      }

      // \u4ee3\u511f (Sacrifice) \u306e\u89e3\u6c7a
      if (sourceInfo.effect === 'sacrifice_destruction') {
        const targetUnit = getBoardUnit(player.board, targetRow, targetLane);
        if (targetUnit && targetUnit.instanceId !== unit.instanceId) {
          const { processUnitDeath } = require('./CombatResolver');
          targetUnit.currentHp = 0;
          this.log(`\u2696\ufe0f ${unit.name} \u306e\u300c\u4ee3\u511f\u300d\uff01\u5473\u65b9\u306e ${targetUnit.name} \u3092\u751f\u3051\u8d04\u306b\u6367\u3052\u305f`);
          this.cleanupDeadUnits();
        }

        // \u4ee3\u511f\u306e\u5f8c\u306f\u3001\u672c\u6765\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u51e6\u7406\u3092\u7d99\u7d9a\uff08startIndex=0\u304b\u3089\u3002targetRow\u6307\u5b9a\u3042\u308a\u306a\u306e\u3067Sacrifice\u306f\u30b9\u30ad\u30c3\u30d7\u3055\u308c\u308b\uff09
        const { processAbility } = require('./AbilityProcessor');
        const abilityResult = processAbility('on_play', unit, gs, player, opponent, this.cardMap, gs.logs);
        if (this.handleAbilityResult(abilityResult, unit, 'on_play', player, opponent)) {
          return this.getGameStateForClients();
        }
        
        gs.phase = 'main';
        gs.pendingAbilitySource = null;
        this.cleanupDeadUnits();
        return this.getGameStateForClients();
      }

      // Manual Target Validation (Other abilities)
      const targetPlayer = sourceInfo.targetId && sourceInfo.targetId.includes('enemy') ? opponent : gs.players[playerId];
      const targetUnit = getBoardUnit(targetPlayer.board, targetRow, targetLane);
      if (targetUnit && targetPlayer.id !== player.id) {
          if (targetUnit.stealthActive || hasKeyword(targetUnit, 'spellshield')) {
              return { error: '\u5bfe\u8c61\u306e\u30ab\u30fc\u30c9\u306f\u6f5c\u4f0f\u3001\u307e\u305f\u306f\u9b54\u76fe\u306e\u52b9\u679c\u306b\u3088\u308a\u80fd\u529b\u306e\u5bfe\u8c61\u306b\u306a\u308a\u307e\u305b\u3093' };
          }
      }

      // 1. \u307e\u305a\u8a72\u5f53\u306e\uff08\u73fe\u5728\u5f85\u6a5f\u4e2d\u3060\u3063\u305f\uff09\u30a2\u30d3\u30ea\u30c6\u30a3\u306e\u307f\u3092\u89e3\u6c7a\u3059\u308b
      const originalAbilities = unit.abilities;
      const targetAbilityIndex = sourceInfo.abilityIndex || 0;
      
      // \u5bfe\u8c61\u30a2\u30d3\u30ea\u30c6\u30a3\u306e\u307f\u306b\u7d5e\u3063\u3066\u5b9f\u884c\uff08startIndex\u306f0\u3068\u3057\u3066\u6271\u3046\uff09
      if (originalAbilities && originalAbilities.length > targetAbilityIndex) {
          unit.abilities = [originalAbilities[targetAbilityIndex]];
      }
      
      const abilityResult = processAbility(sourceInfo.trigger, unit, gs, player, opponent, this.cardMap, gs.logs, targetRow, targetLane, 0);
      this.processEvents(abilityResult.events, player, opponent);
      
      // \u5143\u306b\u623b\u3059
      unit.abilities = originalAbilities;

      // 2. \u6b8b\u308a\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u304c\u3042\u308b\u5834\u5408\u3001\u5f15\u304d\u7d9a\u304d\u51e6\u7406\u3092\u8a66\u307f\u308b
      if (unit.abilities && targetAbilityIndex + 1 < unit.abilities.length) {
          const nextIndex = targetAbilityIndex + 1;
          const nextResult = processAbility(sourceInfo.trigger, unit, gs, player, opponent, this.cardMap, gs.logs, null, null, nextIndex);
          if (this.handleAbilityResult(nextResult, unit, sourceInfo.trigger, player, opponent)) {
              // \u518d\u3073 targeting \u306b\u306a\u3063\u305f\u5834\u5408\u306f\u3001\u30ea\u30bf\u30fc\u30f3\u3057\u3066\u5165\u529b\u3092\u5f85\u3064
              return this.getGameStateForClients();
          }
      }

      gs.phase = 'main';
      gs.pendingAbilitySource = null;
      this.cleanupDeadUnits();
      return this.getGameStateForClients();
    }

    if (sourceInfo.spellCardId) {
      // \u30b9\u30da\u30eb\uff08\u30d7\u30ec\u30a4\u5f85\u6a5f\u4e2d\uff09\u306e\u89e3\u6c7a
      let card = player.hand.find(c => c.id === sourceInfo.spellCardId);
      const isContinuation = (sourceInfo.abilityIndex !== undefined && sourceInfo.abilityIndex > 0) || sourceInfo.isPaid;

      if (!card && isContinuation) {
        // \u3059\u3067\u306b\u624b\u672d\u304b\u3089\u6d88\u3048\u3066\u3044\u308b\u5834\u5408\u3001sourceInfo \u307e\u305f\u306f\u5893\u5730\u304b\u3089\u53d6\u5f97
        card = sourceInfo.cardData || player.graveyard.find(c => c.id === sourceInfo.spellCardId);
      }

      if (!card) {
          console.error(`\u274c [GameEngine] Spell card not found: ${sourceInfo.spellCardId}`);
          gs.phase = 'main';
          gs.pendingAbilitySource = null;
          return this.getGameStateForClients();
      }

      // \u624b\u52d5\u30bf\u30fc\u30b2\u30c3\u30c8\u306e\u5834\u5408\u306e\u9b54\u76fe\u30fb\u6f5c\u4f0f\u30c1\u30a7\u30c3\u30af
      const targetPlayer = sourceInfo.targetId.includes('enemy') ? opponent : player;
      const targetUnit = getBoardUnit(targetPlayer.board, targetRow, targetLane);
      if (targetUnit && targetPlayer.id !== player.id) {
          if (targetUnit.stealthActive || hasKeyword(targetUnit, 'spellshield')) {
              this.log(`\ud83d\udca8 ${targetUnit.name} \u306f\u5bfe\u8c61\u306b\u306a\u3089\u306a\u3044\u52b9\u679c\u3092\u6301\u3064\u305f\u3081\u3001\u30b9\u30da\u30eb\u306f\u4e0d\u767a\u306b\u7d42\u308f\u3063\u305f\uff01`);
              if (!isContinuation) {
                const handIndex = player.hand.indexOf(card);
                player.sp -= card.cost;
                player.hand.splice(handIndex, 1);
                player.graveyard.push(card);
              }
              gs.phase = 'main';
              gs.pendingAbilitySource = null;
              this.cleanupDeadUnits();
              return this.getGameStateForClients();
          }
      }

      if (!isContinuation) {
        const handIndex = player.hand.indexOf(card);
        player.sp -= card.cost;
        player.hand.splice(handIndex, 1);
        player.cardsPlayedThisTurn++;
        player.graveyard.push(card);
        this.log(`\u2728 ${player.name}: \u30b9\u30da\u30eb\u300c${card.name}\u300d\u3092\u78ba\u5b9a\u767a\u52d5 (SP: ${player.sp})`);
      }

      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs, sourceInfo.abilityIndex || 0);
      
      if (result.needsTarget) {
        // \u6b21\u306e\u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u304c\u5fc5\u8981\u306a\u5834\u5408
        gs.phase = 'targeting';
        gs.pendingAbilitySource = {
          ...sourceInfo,
          abilityIndex: result.abilityIndex,
          isPaid: true,
          cardData: card
        };
        this.processEvents(result.events, player, opponent);
        return this.getGameStateForClients();
      }

      this.processEvents(result.events, player, opponent);
      this.broadcastTrigger('spell_play', playerId);

      gs.phase = 'main';
      gs.pendingAbilitySource = null;
      this.cleanupDeadUnits();
      return this.getGameStateForClients();
    }
    
  }

  attackWithUnit(playerId, attackerRow, attackerLane, targetInfo) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'main') return { error: '\u30a2\u30af\u30b7\u30e7\u30f3\u4e0d\u53ef' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '\u81ea\u5206\u306e\u30bf\u30fc\u30f3\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };

    const attacker = getBoardUnit(player.board, attackerRow, attackerLane);
    if (!attacker) return { error: '\u305d\u306e\u30b9\u30ed\u30c3\u30c8\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u307e\u305b\u3093' };
    if (!attacker.canAttack) return { error: '\u3053\u306e\u30e6\u30cb\u30c3\u30c8\u306f\u653b\u6483\u3067\u304d\u307e\u305b\u3093\uff08\u53ec\u559a\u9154\u3044\uff09' };
    if (attacker.hasActed) return { error: '\u3053\u306e\u30e6\u30cb\u30c3\u30c8\u306f\u3059\u3067\u306b\u884c\u52d5\u6e08\u307f\u3067\u3059' };

    const opponent = getOpponentPlayer(gs);
    const validTargets = getValidAttackTargets(attackerRow, attackerLane, attacker, opponent.board, opponent.shields);
    if (validTargets.length === 0) return { error: '\u653b\u6483\u5bfe\u8c61\u304c\u3042\u308a\u307e\u305b\u3093' };

    // \u30bf\u30fc\u30b2\u30c3\u30c8\u306e\u59a5\u5f53\u6027\u30c1\u30a7\u30c3\u30af
    const isTargetValid = validTargets.some(t => {
      if (t.type !== targetInfo.type) return false;
      if (t.type === 'unit') {
        return t.row === targetInfo.row && t.lane === targetInfo.lane;
      }
      if (t.type === 'shield') {
        return t.id === targetInfo.id || !targetInfo.id; // \u65e7AI\u3068\u306e\u4e92\u63db\u6027\u306e\u305f\u3081\u306b !targetInfo.id \u3082\u8a31\u5bb9
      }
      return true; // direct
    });

    if (!isTargetValid) {
      return { error: '\u7121\u52b9\u306a\u653b\u6483\u5bfe\u8c61\u3067\u3059\uff08\u6311\u767a\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u308b\u304b\u3001\u6b63\u9762\u306e\u6575\u3092\u512a\u5148\u3059\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\uff09' };
    }
    // \u6f5c\u4f0f\u89e3\u9664
    if (attacker.stealthActive) {
      attacker.stealthActive = false;
      attacker.keywords = attacker.keywords.filter(k => k !== 'stealth');
      this.log(`\ud83d\udc41\ufe0f ${attacker.name} \u304c\u6f5c\u4f0f\u3092\u89e3\u9664\uff01`);
    }

    const abilityResult = processAbility('on_attack', attacker, gs, player, opponent, this.cardMap, gs.logs);
    if (this.handleAbilityResult(abilityResult, attacker, 'on_attack', player, opponent)) return this.getGameStateForClients();

    // \u653b\u6483\u6642\u52b9\u679c\u306b\u3088\u308b\u6b7b\u4ea1\u5224\u5b9a\uff08\u3053\u3053\u3067\u6b7b\u4ea1\u3057\u305f\u30e6\u30cb\u30c3\u30c8\u306f\u6226\u95d8\u3092\u884c\u3048\u306a\u3044\uff09
    // \u5148\u306b\u30af\u30ea\u30fc\u30f3\u30a2\u30c3\u30d7\u3092\u5b9f\u884c\u3057\u3066\u6b7b\u4ea1\u3057\u305f\u30e6\u30cb\u30c3\u30c8\u306e\u60c5\u5831\u3092\u53cd\u6620
    this.cleanupDeadUnits();

    // \u30af\u30ea\u30fc\u30f3\u30a2\u30c3\u30d7\u306b\u3088\u308a\u653b\u6483\u8005\u307e\u305f\u306f\u9632\u5fa1\u8005\u304c\u76e4\u9762\u304b\u3089\u6d88\u6ec5\u3057\u305f\u304b\u30c1\u30a7\u30c3\u30af
    const isAttackerAlive = getBoardUnit(player.board, attackerRow, attackerLane) !== null;
    let isDefenderDeadByAbility = false;

    if (targetInfo.type === 'unit') {
      const defRow = targetInfo.row || 'front';
      const defLane = targetInfo.lane;
      const defender = getBoardUnit(opponent.board, defRow, defLane);

      if (!defender) {
         // \u9632\u5fa1\u5074\u304c\u653b\u6483\u6642\u52b9\u679c\u3067\u6b7b\u4ea1\u3057\u305f\u5834\u5408
         isDefenderDeadByAbility = true;
      } else {
         if (defender.stealthActive) return { error: '\u3053\u306e\u30e6\u30cb\u30c3\u30c8\u306f\u6f5c\u4f0f\u4e2d\u3067\u653b\u6483\u5bfe\u8c61\u306b\u3067\u304d\u307e\u305b\u3093' };

         if (isAttackerAlive) {
            // \u6f14\u51fa\uff1a\u653b\u6483\u958b\u59cb
            this.queueAnimationEvent({
              type: 'attack',
              source: attacker.instanceId,
              target: defender.instanceId
            });

            // \u901a\u5e38\u6226\u95d8\u306e\u89e3\u6c7a
            const result = resolveUnitCombat(attacker, defender, gs.logs);

            // \u6f14\u51fa\uff1a\u30c0\u30e1\u30fc\u30b8\u53cd\u6620\uff08CombatResolver\u304b\u3089\u8fd4\u3055\u308c\u308b\u8a73\u7d30\u30a4\u30d9\u30f3\u30c8\u3092\u30ad\u30e5\u30fc\u306b\u8ffd\u52a0\uff09
            if (result.events) {
              result.events.forEach(ev => this.queueAnimationEvent(ev));
            }

           if (result.defenderDead) {
             const killResult = processAbility('on_kill', attacker, gs, player, opponent, this.cardMap, gs.logs);
             this.handleAbilityResult(killResult, attacker, 'on_kill', player, opponent);
           }
         }
      }

      // \u62e1\u6563\uff08spread\uff09\u51e6\u7406: \u653b\u6483\u6642\u3001\u96a3\u63a5\u30ec\u30fc\u30f3\u306b\u30821\u30c0\u30e1\u30fc\u30b8
      if (hasKeyword(attacker, 'spread') && !attacker.stealthActive) { // stealth check just in case, though attacking breaks stealth
        const spreadDmg = 1;
        const adjLanes = [defLane - 1, defLane + 1];
        adjLanes.forEach(l => {
          if (l >= 0 && l < 3) {
            const adj = opponent.board[defRow][l];
            if (adj) {
              adj.currentHp -= spreadDmg;
              this.queueAnimationEvent({
                type: 'damage',
                source: attacker.instanceId,
                target: adj.instanceId,
                damage: spreadDmg,
                vfxType: 'spread'
              });
              if (adj.currentHp <= 0) {
                const adjKilled = processUnitDeath(adj, gs.logs);
                if (adjKilled) {
                  this.log(`\ud83d\udc80 ${adj.name} \u3092\u5dfb\u304d\u6dfb\u3048\u3067\u6483\u7834\uff01`);
                  // ここでの on_death 呼び出しと除去は cleanupDeadUnits に任せる
                }
              }
            }
          }
        });
      }

    } else if (targetInfo.type === 'shield') {
      // 演出：シールドへの攻撃開始
      this.queueAnimationEvent({
        type: 'attack',
        source: attacker.instanceId,
        target: targetInfo.id || 'shield',
        targetType: 'shield'
      });

      const result = resolveShieldAttack(attacker, opponent.shields, gs.logs);
      opponent.totalShieldDurability = opponent.shields.reduce((sum, s) => sum + s.currentDurability, 0);

      if (result.shieldDestroyed) {
        opponent.shieldsDestroyed++;
        gs.phase = 'shield_break_anim';
        gs.pendingShieldBreak = {
          shield: result.shield,
          artId: result.shield.artId || result.shield.id, // イラスト表示用に追加
          attackerId: playerId
        };
        this.broadcastTrigger('shield_break', opponent.id);
      }

    } else if (targetInfo.type === 'direct') {
      // 演出：ダイレクトアタック開始
      this.queueAnimationEvent({
        type: 'attack',
        source: attacker.instanceId,
        target: opponent.id,
        targetType: 'direct'
      });

      this.log(`⚡ ${attacker.name} のダイレクトアタック！${opponent.name} に直接攻撃！`);
      gs.winner = playerId;
      gs.phase = 'game_over';
      this.log(`🏆 ${player.name} の勝利！`);
    }

    if (attacker && getBoardUnit(player.board, attackerRow, attackerLane)) {
      attacker.hasActed = true;
    }

    this.cleanupDeadUnits();
    return this.getGameStateForClients();
  }

  resolvePendingShieldBreak() {
    const gs = this.gameState;
    if (gs.phase !== 'shield_break_anim' || !gs.pendingShieldBreak) return { error: 'Invalid state' };

    const { shield, attackerId } = gs.pendingShieldBreak;
    const player = gs.players[attackerId];
    const opponent = Object.values(gs.players).find(p => p.id !== attackerId);

    const skillEvents = processShieldSkill(shield, opponent, player, this.cardMap, gs.logs);
    this.processEvents(skillEvents, opponent, player);

    gs.phase = 'main';
    gs.pendingShieldBreak = null;
    this.cleanupDeadUnits();
    return this.getGameStateForClients();
  }

  activateUnitAbility(playerId, unitRow, unitLane, abilityIndex) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'main') return { error: '\u30a2\u30af\u30b7\u30e7\u30f3\u4e0d\u53ef' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '\u81ea\u5206\u306e\u30bf\u30fc\u30f3\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };

    const unit = getBoardUnit(player.board, unitRow, unitLane);
    if (!unit) return { error: '\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u307e\u305b\u3093' };
    if (unit.hasActed) return { error: '\u3053\u306e\u30e6\u30cb\u30c3\u30c8\u306f\u3059\u3067\u306b\u884c\u52d5\u6e08\u307f\u3067\u3059' };

    const ability = unit.abilities && unit.abilities[abilityIndex];
    if (!ability || ability.trigger !== 'activate') return { error: '\u8d77\u52d5\u80fd\u529b\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093' };

    // \u30b3\u30b9\u30c8\u30c1\u30a7\u30c3\u30af (\u4f8b: condition \u304c "sp:1" \u306e\u5834\u5408)
    if (ability.condition && ability.condition.startsWith('sp:')) {
      const cost = parseInt(ability.condition.split(':')[1]) || 0;
      if (player.sp < cost) return { error: `SP\u304c\u8db3\u308a\u307e\u305b\u3093\uff08\u5fc5\u8981: ${cost}\uff09` };
      player.sp -= cost;
      this.log(`\ud83d\udcb0 ${player.name}: SP \u3092 ${cost} \u6d88\u8cbb\u3057\u3066\u80fd\u529b\u3092\u767a\u52d5`);
    }

    this.log(`\u26a1 ${unit.name} \u306e\u8d77\u52d5\u80fd\u529b\u767a\u52d5\uff01: ${ability.text || ''}`);
    
    // \u51e6\u7406\u5b9f\u884c
    // processAbility \u306f\u30c8\u30ea\u30ac\u30fc\u304c\u4e00\u81f4\u3059\u308b\u3082\u306e\u3059\u3079\u3066\u3092\u51e6\u7406\u3059\u308b\u305f\u3081\u3001\u4e00\u6642\u7684\u306b\u500b\u5225\u306e\u80fd\u529b\u3068\u3057\u3066\u6e21\u3059\u304b\u3001
    // \u3042\u308b\u3044\u306f trigger \u6587\u5b57\u5217\u3092\u5de5\u592b\u3059\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\u3002\u3053\u3053\u3067\u306f\u5bfe\u8c61\u306e1\u3064\u3060\u3051\u3092\u51e6\u7406\u3059\u308b\u3088\u3046\u306b\u30e9\u30c3\u30d7\u3057\u307e\u3059\u3002
    const originalAbilities = unit.abilities;
    unit.abilities = [ability]; // \u4e00\u6642\u7684\u306b\u5bfe\u8c61\u306e\u307f\u306b\u3059\u308b
    const abilityResult = processAbility('activate', unit, gs, player, getOpponentPlayer(gs), this.cardMap, gs.logs);
    if (this.handleAbilityResult(abilityResult, unit, 'activate', player, getOpponentPlayer(gs))) return this.getGameStateForClients();
    unit.abilities = originalAbilities; // \u623b\u3059

    unit.hasActed = true;
    this.cleanupDeadUnits();
    
    return this.getGameStateForClients();
  }

  endTurn(playerId) {
    const gs = this.gameState;
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '\u81ea\u5206\u306e\u30bf\u30fc\u30f3\u3067\u306f\u3042\u308a\u307e\u305b\u3093' };

    const player = gs.players[playerId];

    // \u624b\u672d\u4e0a\u9650\u30c1\u30a7\u30c3\u30af
    if (player.hand.length > MAX_HAND_SIZE) {
      if (player.isAI) {
        // AI\u306e\u5834\u5408\u306f\u81ea\u52d5\u3067\u30e9\u30f3\u30c0\u30e0\u306b\u6368\u3066\u308b
        this.log(`\ud83e\udd16 ${player.name}: \u624b\u672d\u4e0a\u9650\u8d85\u904e\u3002\u81ea\u52d5\u3067\u7834\u68c4\u3057\u307e\u3059\u3002`);
        const discardCount = player.hand.length - MAX_HAND_SIZE;
        for (let i = 0; i < discardCount; i++) {
          const idx = Math.floor(Math.random() * player.hand.length);
          const discarded = player.hand.splice(idx, 1)[0];
          player.graveyard.push(discarded);
          this.log(`\ud83d\uddd1\ufe0f ${player.name}: ${discarded.name} \u3092\u6368\u3066\u305f`);
          this.broadcastTrigger('discard', player.id);
        }
      } else {
        // \u30d7\u30ec\u30a4\u30e4\u30fc\u306e\u5834\u5408\u306f\u7834\u68c4\u30d5\u30a7\u30fc\u30ba\u3078\u79fb\u884c
        gs.phase = 'discarding';
        this.log(`\u26a0\ufe0f ${player.name}: \u624b\u672d\u304c\u591a\u3059\u304e\u307e\u3059\u3002\u6368\u3066\u308b\u30ab\u30fc\u30c9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
        return this.getGameStateForClients();
      }
    }

    return this.completeEndTurn(player);
  }

  completeEndTurn(player) {
    const gs = this.gameState;
    
    // \u30bf\u30fc\u30f3\u7d42\u4e86\u6642\u52b9\u679c\u306e\u51e6\u7406\uff08\u8150\u6557\u30fb\u66b4\u8d70\u306a\u3069\uff09
    forEachUnit(player.board, (unit, row, lane) => {
      // \u8150\u6557 (Decay)
      if (hasKeyword(unit, 'decay')) {
        const { applyDamage } = require('./CombatResolver');
        const actualDamage = applyDamage(unit, 1, gs.logs);
        if (actualDamage > 0) {
          this.queueAnimationEvent({
            type: 'damage',
            target: unit.instanceId,
            damage: actualDamage,
            vfxType: 'decay'
          });
        }
        this.log(`\u2620\ufe0f ${unit.name} \u306f\u8150\u6557\u306b\u3088\u308a ${actualDamage} \u30c0\u30e1\u30fc\u30b8\u3092\u53d7\u3051\u305f (HP: ${unit.currentHp})`);
      }
    });


    this.cleanupDeadUnits();

    gs.phase = 'main'; // \u30d5\u30a7\u30fc\u30ba\u3092\u623b\u3059
    this.log(`\u23ed\ufe0f ${player.name}: \u30bf\u30fc\u30f3\u7d42\u4e86`);

    gs.currentPlayerIndex = gs.currentPlayerIndex === 0 ? 1 : 0;
    if (gs.currentPlayerIndex === 0) gs.turnNumber++;

    return this.startTurn();
  }

  discardCards(playerId, cardIndices) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'discarding') return { error: '\u4e0d\u6b63\u306a\u30a2\u30af\u30b7\u30e7\u30f3' };

    const needed = player.hand.length - MAX_HAND_SIZE;
    if (cardIndices.length !== needed) return { error: `${needed}\u679a\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044` };

    // \u30a4\u30f3\u30c7\u30c3\u30af\u30b9\u306e\u964d\u9806\u3067\u30bd\u30fc\u30c8\uff08\u524a\u9664\u6642\u306e\u4f4d\u7f6e\u305a\u308c\u9632\u6b62\uff09
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
      const discarded = player.hand.splice(idx, 1)[0];
      if (discarded) {
        player.graveyard.push(discarded);
        this.log(`\ud83d\uddd1\ufe0f ${player.name}: ${discarded.name} \u3092\u6368\u3066\u305f`);
        this.broadcastTrigger('discard', player.id);
      }
    });

    return this.completeEndTurn(player);
  }

  // \u30a4\u30d9\u30f3\u30c8\u306e\u51e6\u7406
  processEvents(events, currentPlayer, opponentPlayer) {
    if (!events || events.length === 0) return;
    events.forEach(event => {
      switch (event.type) {
        case 'ability_draw':
        case 'spell_draw':
        case 'shield_skill_draw': {
          const targetPlayer = this.gameState.players[event.player];
          const result = drawCards(targetPlayer, this.cardMap, event.count);
          if (result.deckOut) {
            this.log(`\ud83d\udc80 ${targetPlayer.name}: \u30c7\u30c3\u30ad\u5207\u308c\uff01\u6557\u5317\uff01`);
            this.gameState.winner = Object.keys(this.gameState.players).find(id => id !== targetPlayer.id);
            this.gameState.phase = 'game_over';
          } else {
            this.broadcastTrigger('card_draw', targetPlayer.id);
          }
          break;
        }
        case 'ability_summon': {
          const targetPlayer = this.gameState.players[event.player];
          if (targetPlayer && event.unit && event.row && event.lane !== undefined) {
             targetPlayer.board[event.row][event.lane] = event.unit;
             this.queueAnimationEvent({
               type: 'summon',
               playerId: event.player,
               unit: event.unit
             });
          }
          break;
        }
        case 'ability_bounce':
        case 'spell_bounce':
        case 'shield_skill_bounce': {
          const targetInstanceId = event.target;
          let foundUnit = null;
          let foundPlayer = null;
          let foundPos = null;

          // \u5168\u30d7\u30ec\u30a4\u30e4\u30fc\u306e\u76e4\u9762\u304b\u3089\u5bfe\u8c61\u3092\u63a2\u3059
          const { forEachUnit } = require('./GameState');
          for (const pid of Object.keys(this.gameState.players)) {
            const player = this.gameState.players[pid];
            forEachUnit(player.board, (u, row, lane) => {
              if (u.instanceId === targetInstanceId) {
                foundUnit = u;
                foundPlayer = player;
                foundPos = { row, lane };
              }
            });
            if (foundUnit) break;
          }

          if (foundUnit && foundPlayer && foundPos) {
            // \u76e4\u9762\u304b\u3089\u9664\u53bb
            foundPlayer.board[foundPos.row][foundPos.lane] = null;
            
            // \u6240\u6709\u8005\u306e\u624b\u672d\u306b\u623b\u3059\uff08\u672c\u6765\u306e\u6301\u3061\u4e3b\u306eID\u3092\u4f7f\u7528\uff09
            const owner = this.gameState.players[foundUnit.ownerId];
            if (owner) {
              const cardData = this.cardMap[foundUnit.cardId];
              if (cardData) {
                // \u624b\u672d\u306b\u8ffd\u52a0\uff08\u5143\u306e\u30ab\u30fc\u30c9\u30c7\u30fc\u30bf\u3092\u30b3\u30d4\u30fc\uff09
                owner.hand.push({ ...cardData });
                this.log(`\ud83d\udd04 ${foundUnit.name} \u304c ${owner.name} \u306e\u624b\u672d\u306b\u623b\u3063\u305f`);
                this.broadcastTrigger('card_bounce', owner.id);
                // アニメーションイベントを追加！
                this.queueAnimationEvent({
                  type: 'ability_bounce',
                  target: targetInstanceId
                });
              }
            }
          }
          break;
        }
        case 'ability_damage':
        case 'spell_damage':
        case 'shield_skill_damage': {
          this.queueAnimationEvent({
            type: 'damage',
            source: event.source,
            target: event.target,
            damage: event.damage,
            vfxType: event.type.split('_')[0] // 'ability', 'spell', 'shield'
          });
          break;
        }
        case 'ability_kill':
        case 'spell_kill':
        case 'shield_skill_kill': {
          this.queueAnimationEvent({
            type: 'kill',
            target: event.target
          });
          break;
        }
        case 'ability_freeze':
        case 'spell_freeze':
        case 'shield_skill_freeze': {
          this.queueAnimationEvent({
            type: 'ability_freeze',
            target: event.target
          });
          break;
        }
        case 'ability_silence':
        case 'spell_silence':
        case 'shield_skill_silence': {
          this.queueAnimationEvent({
            type: 'ability_silence',
            target: event.target
          });
          break;
        }
        case 'ability_barrier':
        case 'spell_barrier':
        case 'shield_skill_barrier': {
          this.queueAnimationEvent({
            type: 'ability_barrier',
            target: event.target
          });
          break;
        }
      }
    });
  }

  // \u30a2\u30d3\u30ea\u30c6\u30a3\u7d50\u679c\u306e\u30cf\u30f3\u30c9\u30ea\u30f3\u30b0\uff08\u30bf\u30fc\u30b2\u30c3\u30c8\u8981\u6c42\u5bfe\u5fdc\uff09
  handleAbilityResult(result, unit, trigger, player, opponent) {
    if (result.needsTarget) {
      if (result.effect && result.effect.startsWith('destroy_')) {
          this.log(`\ud83c\udfaf \u30bf\u30a4\u30d6\u30ec\u30fc\u30af\u767a\u751f: ${unit.name} \u306e\u52b9\u679c\u304c\u8907\u6570\u5bfe\u8c61\u306b\u8a72\u5f53\u3057\u305f\u305f\u3081\u3001\u5bfe\u8c61\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002`);
      }
      console.log(`\ud83c\udfaf [GameEngine] Transitioning to targeting phase for: ${unit.name} (${trigger})`);
      this.gameState.phase = 'targeting';
      this.gameState.pendingAbilitySource = {
        unitInstanceId: unit.instanceId,
        unitName: unit.name,
        ability: result.originalAbility,
        abilityIndex: result.abilityIndex || 0, // NEW: \u30a4\u30f3\u30c7\u30c3\u30af\u30b9\u3092\u8ffd\u8de1
        trigger: trigger,
        effect: result.effect, // \u8ffd\u52a0: summons_token \u7b49\u306e\u5224\u5225\u306b\u5fc5\u8981
        targetId: result.targetId,
        ownerId: player.id,
        unit: unit // 死亡後も参照できるようにインスタンスを保持
      };
      return true; // \u30bf\u30fc\u30b2\u30c3\u30c8\u9078\u629e\u304c\u5fc5\u8981
    }
    this.processEvents(result.events, player, opponent);
    return false; // \u7d99\u7d9a\u53ef\u80fd
  }

  queueAnimationEvent(event) {
    if (!this.animationEvents) this.animationEvents = [];
    this.animationEvents.push(event);
  }

  flushAnimationEvents() {
    if (!this.animationEvents) this.animationEvents = [];
    const events = [...this.animationEvents];
    this.animationEvents = [];
    return events;
  }

  cleanupDeadUnits() {
    for (const pid of Object.keys(this.gameState.players)) {
      const player = this.gameState.players[pid];
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          const unit = player.board[row][i];
          if (unit && unit.currentHp <= 0) {
            const opId = Object.keys(this.gameState.players).find(id => id !== pid);
            const opponent = this.gameState.players[opId];
            
            // \u907a\u8a00 (on_death) \u3092\u767a\u52d5
            const { processAbility } = require('./AbilityProcessor');
            const deathResult = processAbility('on_death', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs);
            this.handleAbilityResult(deathResult, unit, 'on_death', player, opponent);

            // \u4e0d\u5c48 (Endure) \u306e\u30c1\u30a7\u30c3\u30af
            const isDead = processUnitDeath(unit, this.gameState.logs);
            if (!isDead) {
              // \u8010\u3048\u305f\u5834\u5408\u306f\u4f55\u3082\u3057\u306a\u3044\uff08processUnitDeath \u5185\u3067HP1/\u30d5\u30e9\u30b0\u6d88\u8cbb\u51e6\u7406\u6e08\u307f\uff09
              continue;
            }

            // \u672c\u5f53\u306b\u6b7b\u4ea1\u3057\u305f\u5834\u5408
            player.friendlyDeathsThisTurn++;
            player.graveyard.push({ id: unit.cardId, name: unit.name });
            player.board[row][i] = null;
            this.log(`\ud83d\udc80 ${unit.name} \u304c\u5834\u304b\u3089\u9664\u53bb\u3055\u308c\u305f`);
            
            // \u5168\u4f53\u306b\u6b7b\u4ea1\u3092\u901a\u77e5
            this.broadcastTrigger('any_unit_death', pid);
          }
        }
      }
    }
  }

  log(message) {
    // ログから絵文字を削除（ダサいというフィードバック対応）
    const cleanMessage = message.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|\uFE0F/g, '').trim();
    if (this.gameState) this.gameState.logs.push(cleanMessage);
    console.log(cleanMessage);
  }

  discardCards(playerId, indices) {
    const player = this.gameState.players[playerId];
    if (!player) return;
    
    // \u30a4\u30f3\u30c7\u30c3\u30af\u30b9\u306e\u964d\u9806\u3067\u524a\u9664\uff08\u524d\u306e\u30a4\u30f3\u30c7\u30c3\u30af\u30b9\u304c\u305a\u308c\u306a\u3044\u3088\u3046\u306b\uff09
    const sortedIndices = [...indices].sort((a, b) => b - a);
    const discardedNames = [];
    
    for (const idx of sortedIndices) {
      if (idx >= 0 && idx < player.hand.length) {
        const card = player.hand.splice(idx, 1)[0];
        player.graveyard.push({ id: (card.cardId || card.id), name: card.name });
        discardedNames.push(card.name);
      }
    }
    
    if (discardedNames.length > 0) {
      this.log(`\ud83d\uddd1\ufe0f ${player.name}: ${discardedNames.length}\u679a\u306e\u30ab\u30fc\u30c9\u3092\u6368\u3066\u305f`);
    }
    
    // \u898f\u5b9a\u679a\u6570\u4ee5\u4e0b\u306a\u3089\u30e1\u30a4\u30f3\u30d5\u30a7\u30fc\u30ba\u3078
    if (player.hand.length <= MAX_HAND_SIZE) {
      this.gameState.phase = 'main';
    }
  }

  getSanitizedLogs(logs, viewerId) {
    return logs.map(msg => {
      if (!viewerId || !this.gameState) return msg;
      
      const playerNames = Object.values(this.gameState.players).map(p => ({ id: p.id, name: p.name }));
      const opponent = playerNames.find(p => p.id !== viewerId);
      
      if (!opponent) return msg;

      // \u76f8\u624b\u306e\u884c\u52d5\u306b\u3088\u308b\u30ed\u30b0\u3067\u79d8\u533f\u304c\u5fc5\u8981\u306a\u3082\u306e\u3092\u7f6e\u63db
      if (msg.includes(opponent.name)) {
        // \u30de\u30ea\u30ac\u30f3\u306e\u65b0\u624b\u672d
        msg = msg.replace(/\(\u65b0\u624b\u672d:.*?\)/, '(\u65b0\u624b\u672d: \u975e\u516c\u958b)');
        // \u30c9\u30ed\u30fc
        if (msg.includes('\u3092\u30c9\u30ed\u30fc')) {
          msg = msg.replace(new RegExp(`\ud83d\udcd6 ${opponent.name}: .* \u3092\u30c9\u30ed\u30fc`), `\ud83d\udcd6 ${opponent.name}: \u30ab\u30fc\u30c9 \u3092\u30c9\u30ed\u30fc`);
        }
        // \u6368\u3066\u308b
        if (msg.includes('\u3092\u6368\u3066\u305f')) {
          msg = msg.replace(new RegExp(`\ud83d\uddd1\ufe0f ${opponent.name}: .* \u3092\u6368\u3066\u305f`), `\ud83d\uddd1\ufe0f ${opponent.name}: \u30ab\u30fc\u30c9 \u3092\u6368\u3066\u305f`);
        }
      }
      return msg;
    });
  }

  getGameStateForClients() {
    const gs = this.gameState;
    if (!gs) return null;
    return {
      gameId: gs.gameId,
      turnNumber: gs.turnNumber,
      phase: gs.phase,
      currentPlayerId: gs.playerOrder[gs.currentPlayerIndex],
      playerOrder: gs.playerOrder,
      winner: gs.winner,
      logs: gs.logs.slice(-50),
    };
  }

  getPlayerView(playerId) {
    const gs = this.gameState;
    if (!gs) return null;
    const player = gs.players[playerId];
    const opponentId = Object.keys(gs.players).find(id => id !== playerId);
    const opponent = gs.players[opponentId];

    // \u30b7\u30fc\u30eb\u30c9\u306e\u79d8\u533f\u5316\uff08\u672a\u7834\u58ca\u306e\u3082\u306e\u306f\u60c5\u5831\u3092\u96a0\u3059\uff09
    // AI\u30d7\u30ec\u30a4\u30e4\u30fc\u306b\u306f\u5b8c\u5168\u306a\u60c5\u5831\u3092\u6e21\u3059\uff08\u653b\u6483\u5224\u5b9a\u306b\u5fc5\u8981\uff09
    const hiddenShields = player.isAI ? opponent.shields : opponent.shields.map(s => {
      if (!s.destroyed) {
        return {
          id: s.id,
          type: 'shield',
          name: '???',
          skill: null,
          maxDurability: s.maxDurability,
          currentDurability: '?',
          rarity: 1,
          destroyed: false
        };
      }
      return s;
    });

    return {
      ...this.getGameStateForClients(),
      logs: this.getSanitizedLogs(gs.logs.slice(-50), playerId),
      pendingAbilitySource: gs.pendingAbilitySource,
      pendingShieldBreak: gs.pendingShieldBreak,
      me: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        hand: player.hand,
        board: player.board,   // { front: [...], back: [...] }
        sp: player.sp,
        tribeLevels: player.tribeLevels,
        shields: player.shields,
        totalShieldDurability: player.totalShieldDurability,
        life: calculateLife(player, gs),
        shieldsDestroyed: player.shieldsDestroyed,
        deckCount: player.deck.length,
        graveyard: player.graveyard,
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        avatar: opponent.avatar,
        handCount: opponent.hand.length,
        board: opponent.board,
        sp: opponent.sp,
        tribeLevels: opponent.tribeLevels,
        shields: hiddenShields,
        totalShieldDurability: opponent.totalShieldDurability,
        life: calculateLife(opponent, gs),
        shieldsDestroyed: opponent.shieldsDestroyed,
        shieldsRemaining: NUM_SHIELDS - opponent.shieldsDestroyed,
        deckCount: opponent.deck.length,
        graveyard: opponent.graveyard,
      },
    };
  }

  getFullState() {
    return this.gameState;
  }
}

module.exports = GameEngine;
