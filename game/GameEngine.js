// GameEngine.js - ゲームエンジン（3レーン×前後列対応）
'use strict';

const {
  NUM_LANES, ROWS, INITIAL_HAND_SIZE, MAX_HAND_SIZE, SP_PER_TURN,
  FIRST_TURN_SECOND_PLAYER_SP, MAX_TRIBE_LEVEL, NUM_SHIELDS,
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

    this.log(`🎮 ゲーム開始！先攻: ${this.gameState.players[this.gameState.playerOrder[0]].name}, 後攻: ${this.gameState.players[this.gameState.playerOrder[1]].name}`);

    for (const pid of this.gameState.playerOrder) {
      const player = this.gameState.players[pid];
      drawCards(player, this.cardMap, INITIAL_HAND_SIZE);
      this.log(`📖 ${player.name}: 初期手札 ${INITIAL_HAND_SIZE} 枚ドロー`);
    }

    this.gameState.phase = 'mulligan';
    return this.getGameStateForClients();
  }

  processMulligan(playerId, doMulligan) {
    const player = this.gameState.players[playerId];
    if (!player) {
      console.warn(`⚠️ processMulligan: プレイヤー ${playerId} が見つかりません`);
      return null;
    }

    if (doMulligan) {
      const handCardIds = player.hand.map(c => c.id);
      player.deck = shuffleDeck([...player.deck, ...handCardIds]);
      player.hand = [];
      drawCards(player, this.cardMap, INITIAL_HAND_SIZE);
      this.log(`🔄 ${player.name}: フルマリガン実行！ (新手札: ${player.hand.map(c => c.name).join(', ')})`);
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

    this.log(`\n═══ ターン ${gs.turnNumber} - ${current.name} ═══`);

    const isFirstPlayerFirstTurn = gs.playerOrder[0] === current.id && isFirstTurn;
    if (!isFirstPlayerFirstTurn) {
      const result = drawCards(current, this.cardMap, 1);
      if (result.deckOut) {
        this.log(`💀 ${current.name}: デッキ切れ！敗北！`);
        gs.winner = gs.playerOrder[gs.currentPlayerIndex === 0 ? 1 : 0];
        gs.phase = 'game_over';
        return this.getGameStateForClients();
      }
      if (result.drawn.length > 0) {
        this.log(`📖 ${current.name}: ${result.drawn[0].name} をドロー`);
      }
    } else {
      this.log(`📖 ${current.name}: 先攻1ターン目のためドローなし`);
    }

    const baseSpGain = (isSecondPlayer && isFirstTurn) ? FIRST_TURN_SECOND_PLAYER_SP : SP_PER_TURN;
    const spGain = Math.max(0, baseSpGain + (current.spModifiers || 0));
    current.spModifiers = 0; // 一時的なモディファイア（暴走など）をリセット
    current.sp += spGain;
    this.log(`💰 ${current.name}: SP+${spGain} (SP: ${current.sp})`);

    // ターン開始時にフラグを更新
    gs.isFirstTurn[current.id] = false;
    current.cardsPlayedThisTurn = 0;
    current.friendlyDeathsThisTurn = 0;

    // ユニットの行動可能状態をリセット（全列走査）
    forEachUnit(current.board, (unit) => {
      if (unit.frozen) {
        unit.frozen = false; // 凍結状態を消費
        unit.hasActed = true; // 行動済み状態を維持
        unit.canAttack = false; // 攻撃不可を維持
        this.log(`❄️ ${unit.name} は凍結されているため、このターンは行動できません`);
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
    if (!player || gs.phase !== 'main') return { error: 'アクション不可' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };
    if (player.sp < 1) return { error: 'SPが足りません' };
    if (player.tribeLevels[color] >= MAX_TRIBE_LEVEL) return { error: `${color}は最大レベルです` };

    player.sp -= 1;
    player.tribeLevels[color]++;
    this.log(`⬆️ ${player.name}: ${color}の神族レベル+1 (Lv.${player.tribeLevels[color]}, SP: ${player.sp})`);
    
    // 覚醒チェック
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
                      this.log(`✨ ${unit.name} が覚醒条件を満たした！ (${keyword})`);
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
    if (!player) return { error: 'プレイヤーが見つかりません' };

    this.log(`🏳️ ${player.name}が投了しました`);
    gs.phase = 'game_over';
    gs.winner = gs.playerOrder.find(id => id !== playerId);
    return this.getGameStateForClients();
  }

  playCard(playerId, handIndex, targetRow, targetLane) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'main') return { error: 'アクション不可' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };
    if (handIndex < 0 || handIndex >= player.hand.length) return { error: '無効なカード' };

    const card = player.hand[handIndex];
    if (player.sp < card.cost) return { error: `SPが足りません（必要: ${card.cost}, 現在: ${player.sp}）` };
    
    // 多色神族レベルチェック
    const requiredColors = card.colors || [card.color];
    for (const col of requiredColors) {
      if (player.tribeLevels[col] < card.cost) {
        return { error: `${col}の神族レベルが足りません（必要: ${card.cost}, 現在: Lv.${player.tribeLevels[col]}）` };
      }
    }

    // 代償 (Sacrifice) コストのバリデーション: 味方が1体もいなければ失敗
    if (card.keywords && card.keywords.some(k => k.startsWith('sacrifice'))) {
      let alliesCount = 0;
      for (const r of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          if (player.board[r][i]) alliesCount++;
        }
      }
      if (alliesCount === 0) return { error: '代償（生け贄）にする味方ユニットがいないためプレイできません' };
    }

    // シールド自傷コストのバリデーション: シールドがなければ失敗
    if (card.abilities) {
      const isShieldSacrifice = card.abilities.some(a => a.effect === 'damage_shield' && (a.target === 'self' || a.target === 'self_shield'));
      if (isShieldSacrifice) {
        const activeShields = player.shields.filter(s => !s.destroyed && s.currentDurability > 0);
        if (activeShields.length === 0) {
          return { error: '破壊可能な自分のシールドがないためプレイできません' };
        }
      }
    }

    const opponent = getOpponentPlayer(gs);

    if (card.type === 'unit') {
      if (!targetRow || !ROWS.includes(targetRow)) return { error: '列を指定してください（前列/後列）' };
      if (targetLane === undefined || targetLane === null || targetLane < 0 || targetLane >= NUM_LANES) {
        return { error: '無効なレーン' };
      }
      if (player.board[targetRow][targetLane] !== null) return { error: 'そのスロットにはすでにユニットがいます' };

      // ユニットプレイ確定。ここで 1 回だけコストを支払う
      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      player.cardsPlayedThisTurn++;

      // 暴走 (Overload) ペナルティの適用
      if (card.keywords && card.keywords.includes('overload')) {
        player.spModifiers -= 1;
        this.log(`⚡ ${card.name} の「暴走」！ 次ターンの獲得SPが1減少する（確定）`);
      }

      const unit = createUnitInstance(card, playerId);
      unit.canAttack = hasKeyword(unit, 'rush');
      unit.barrierActive = hasKeyword(unit, 'barrier');
      unit.endureActive = hasKeyword(unit, 'endure');
      unit.stealthActive = hasKeyword(unit, 'stealth');

      // 本体を盤面に配置（アビリティ解決前に存在を確定させる）
      player.board[targetRow][targetLane] = unit;
      const rowLabel = targetRow === 'front' ? '前列' : '後列';
      this.log(`🃏 ${player.name}: ${card.name} を${rowLabel}レーン${targetLane + 1}に配置 (SP: ${player.sp})`);

      // アビリティ処理
      const abilityResult = processAbility('on_play', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs, null, null);
      if (this.handleAbilityResult(abilityResult, unit, 'on_play', player, opponent)) {
        // ターゲット選択が必要な場合はここで一旦停止（クライアントに通知）
        // 既に盤面にいるため、resolveTargeting で instanceId から再検索可能
        return this.getGameStateForClients();
      }

      this.processEvents(abilityResult.events, player, opponent);
      
      // プレイ直後の覚醒チェック（既に条件を満たしている場合）
      this.checkAwakening(player);
      
      // 威圧（intimidate）処理: 正面の敵ユニット1体を凍結
      if (hasKeyword(unit, 'intimidate')) {
        let frontEnemy = opponent.board.front[targetLane];
        if (!frontEnemy && targetRow === 'back') {
          frontEnemy = opponent.board.back[targetLane];
        }
        if (frontEnemy && !frontEnemy.stealthActive) {
          frontEnemy.hasActed = true;
          frontEnemy.canAttack = false;
          this.log(`❄️ ${unit.name} の「威圧」！正面の ${frontEnemy.name} を凍結（次ターン行動不可）`);
          // Note: events push not strictly needed for basic intimidate, just status change + log is enough for client update
        }
      }

    } else if (card.type === 'spell') {
      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs, 0);
      
      if (result.needsTarget) {
        // スペル発動中にターゲット選択（召喚場所など）が必要な場合
        gs.phase = 'targeting';
        gs.pendingAbilitySource = {
          spellCardId: card.id,
          unitName: card.name, // 共通表示用
          trigger: 'on_play',
          effect: result.effect,
          targetId: result.targetId,
          abilityIndex: result.abilityIndex || 0,
          ownerId: player.id
        };
        this.log(`✨ スペル「${card.name}」の発動対象を選択してください...`);
        return this.getGameStateForClients();
      }

      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      player.cardsPlayedThisTurn++;
      
      // 暴走 (Overload) ペナルティの適用
      if (card.keywords && card.keywords.includes('overload')) {
        player.spModifiers -= 1;
        this.log(`⚡ ${card.name} の「暴走」！ 次ターンの獲得SPが1減少する（確定）`);
      }
      
      this.log(`✨ ${player.name}: スペル「${card.name}」を発動 (SP: ${player.sp})`);

      this.processEvents(result.events, player, opponent);
      player.graveyard.push(card);
      this.broadcastTrigger('spell_play', playerId);
    }

    this.cleanupDeadUnits();
    return this.getGameStateForClients();
  }

  // --- グローバルトリガー機構 ---
  // 指定したイベントを盤面の全ユニットに通知し、条件に合うトリガーを発動させる
  broadcastTrigger(triggerType, sourcePlayerId) {
    const gs = this.gameState;
    const p1 = gs.players[gs.playerOrder[0]];
    const p2 = gs.players[gs.playerOrder[1]];

    const triggerForBoard = (owner, opponent, isOwnerTrigger) => {
      const specificTrigger = isOwnerTrigger ? `on_friendly_${triggerType}` : `on_enemy_${triggerType}`;
      forEachUnit(owner.board, u => {
        // 例: on_friendly_death, on_enemy_spell_play など
        const res1 = processAbility(specificTrigger, u, gs, owner, opponent, this.cardMap, gs.logs);
        this.handleAbilityResult(res1, u, specificTrigger, owner, opponent);
        
        // 分け隔てない汎用トリガー 例: on_spell_play, on_card_draw
        const res2 = processAbility(`on_${triggerType}`, u, gs, owner, opponent, this.cardMap, gs.logs);
        this.handleAbilityResult(res2, u, `on_${triggerType}`, owner, opponent);
      });
    };

    triggerForBoard(p1, p2, p1.id === sourcePlayerId);
    triggerForBoard(p2, p1, p2.id === sourcePlayerId);
  }

  resolvePendingAbility(playerId, targetRow, targetLane) {
    const gs = this.gameState;
    if (gs.phase !== 'targeting') return { error: 'ターゲット選択フェーズではありません' };
    
    const sourceInfo = gs.pendingAbilitySource;
    if (!sourceInfo) {
       gs.phase = 'main';
       return this.getGameStateForClients();
    }

    // 自分のターンかどうかではなく、アビリティの持ち主かどうかをチェック
    if (sourceInfo.ownerId && playerId !== sourceInfo.ownerId) {
      return { error: '対象を選択する権限がありません' };
    }

    const player = gs.players[playerId];
    const opId = Object.keys(gs.players).find(id => id !== playerId);
    const opponent = gs.players[opId];

    // 共通のユニットアビリティ解決（既に盤面に配置されている前提）
    if (sourceInfo.unitInstanceId) {
      let unit = null;
      let owner = gs.players[sourceInfo.ownerId] || player;
      forEachUnit(owner.board, u => { if (u.instanceId === sourceInfo.unitInstanceId) unit = u; });
      
      if (!unit) {
        gs.phase = 'main';
        gs.pendingAbilitySource = null;
        return this.getGameStateForClients();
      }

      // 解決前のバリデーション (empty_slot の場合)
      if (sourceInfo.targetId === 'empty_slot') {
          if (gs.players[playerId].board[targetRow][targetLane] !== null) {
              console.warn(`⚠️ [GameEngine] Invalid target: ${targetRow},${targetLane} is occupied.`);
              return this.getGameStateForClients();
          }
      }

      // 残響 (Echo) の解決
      if (sourceInfo.effect === 'echo_summon') {
        const cost = unit.cost || 0;
        if (player.sp < cost) {
          this.log(`⚠️ SPが足りないため「残響」は不発に終わりました`);
        } else {
          player.sp -= cost;
          const cardData = this.cardMap[unit.cardId];
          const copy = createUnitInstance(cardData, player.id);
          copy.hasActed = true; // 出したターンは攻撃不可
          copy.canAttack = false;
          // コピーからは残響キーワードを消去（無限連鎖防止）
          if (copy.keywords) {
            copy.keywords = copy.keywords.filter(k => k !== 'echo');
          }
          player.board[targetRow][targetLane] = copy;
          this.log(`✨ ${unit.name} の「残響」！SPを ${cost} 消費してコピーを召喚した (残SP: ${player.sp})`);
          
          // コピー配置後のアビリティ処理（残響は付与されないように調整済み）
          const { processAbility } = require('./AbilityProcessor');
          const abilityResult = processAbility('on_play', copy, gs, player, opponent, this.cardMap, gs.logs);
          this.handleAbilityResult(abilityResult, copy, 'on_play', player, opponent);
        }
        
        this.cleanupDeadUnits();
        return this.getGameStateForClients();
      }

      // 代償 (Sacrifice) の解決
      if (sourceInfo.effect === 'sacrifice_destruction') {
        const targetUnit = getBoardUnit(player.board, targetRow, targetLane);
        if (targetUnit && targetUnit.instanceId !== unit.instanceId) {
          const { processUnitDeath } = require('./CombatResolver');
          targetUnit.currentHp = 0;
          this.log(`⚖️ ${unit.name} の「代償」！味方の ${targetUnit.name} を生け贄に捧げた`);
          this.cleanupDeadUnits();
        }

        // 代償の後は、本来のアビリティ処理を継続（startIndex=0から。targetRow指定ありなのでSacrificeはスキップされる）
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
              return { error: '対象のカードは潜伏、または魔盾の効果により能力の対象になりません' };
          }
      }

      // 1. まず該当の（現在待機中だった）アビリティのみを解決する
      const originalAbilities = unit.abilities;
      const targetAbilityIndex = sourceInfo.abilityIndex || 0;
      
      // 対象アビリティのみに絞って実行（startIndexは0として扱う）
      if (originalAbilities && originalAbilities.length > targetAbilityIndex) {
          unit.abilities = [originalAbilities[targetAbilityIndex]];
      }
      
      const abilityResult = processAbility(sourceInfo.trigger, unit, gs, player, opponent, this.cardMap, gs.logs, targetRow, targetLane, 0);
      this.processEvents(abilityResult.events, player, opponent);
      
      // 元に戻す
      unit.abilities = originalAbilities;

      // 2. 残りのアビリティがある場合、引き続き処理を試みる
      if (unit.abilities && targetAbilityIndex + 1 < unit.abilities.length) {
          const nextIndex = targetAbilityIndex + 1;
          const nextResult = processAbility(sourceInfo.trigger, unit, gs, player, opponent, this.cardMap, gs.logs, null, null, nextIndex);
          if (this.handleAbilityResult(nextResult, unit, sourceInfo.trigger, player, opponent)) {
              // 再び targeting になった場合は、リターンして入力を待つ
              return this.getGameStateForClients();
          }
      }

      gs.phase = 'main';
      gs.pendingAbilitySource = null;
      this.cleanupDeadUnits();
      return this.getGameStateForClients();
    }

    if (sourceInfo.spellCardId) {
      // スペル（プレイ待機中）の解決
      let card = player.hand.find(c => c.id === sourceInfo.spellCardId);
      const isContinuation = (sourceInfo.abilityIndex !== undefined && sourceInfo.abilityIndex > 0) || sourceInfo.isPaid;

      if (!card && isContinuation) {
        // すでに手札から消えている場合、sourceInfo または墓地から取得
        card = sourceInfo.cardData || player.graveyard.find(c => c.id === sourceInfo.spellCardId);
      }

      if (!card) {
          console.error(`❌ [GameEngine] Spell card not found: ${sourceInfo.spellCardId}`);
          gs.phase = 'main';
          gs.pendingAbilitySource = null;
          return this.getGameStateForClients();
      }

      // 手動ターゲットの場合の魔盾・潜伏チェック
      const targetPlayer = sourceInfo.targetId.includes('enemy') ? opponent : player;
      const targetUnit = getBoardUnit(targetPlayer.board, targetRow, targetLane);
      if (targetUnit && targetPlayer.id !== player.id) {
          if (targetUnit.stealthActive || hasKeyword(targetUnit, 'spellshield')) {
              this.log(`💨 ${targetUnit.name} は対象にならない効果を持つため、スペルは不発に終わった！`);
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
        this.log(`✨ ${player.name}: スペル「${card.name}」を確定発動 (SP: ${player.sp})`);
      }

      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs, sourceInfo.abilityIndex || 0);
      
      if (result.needsTarget) {
        // 次のターゲット選択が必要な場合
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
    if (!player || gs.phase !== 'main') return { error: 'アクション不可' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };

    const attacker = getBoardUnit(player.board, attackerRow, attackerLane);
    if (!attacker) return { error: 'そのスロットにユニットがいません' };
    if (!attacker.canAttack) return { error: 'このユニットは攻撃できません（召喚酔い）' };
    if (attacker.hasActed) return { error: 'このユニットはすでに行動済みです' };

    const opponent = getOpponentPlayer(gs);
    const validTargets = getValidAttackTargets(attackerRow, attackerLane, attacker, opponent.board, opponent.shields);
    if (validTargets.length === 0) return { error: '攻撃対象がありません' };

    // ターゲットの妥当性チェック
    const isTargetValid = validTargets.some(t => {
      if (t.type !== targetInfo.type) return false;
      if (t.type === 'unit') {
        return t.row === targetInfo.row && t.lane === targetInfo.lane;
      }
      if (t.type === 'shield') {
        return t.id === targetInfo.id || !targetInfo.id; // 旧AIとの互換性のために !targetInfo.id も許容
      }
      return true; // direct
    });

    if (!isTargetValid) {
      return { error: '無効な攻撃対象です（挑発ユニットがいるか、正面の敵を優先する必要があります）' };
    }
    // 潜伏解除
    if (attacker.stealthActive) {
      attacker.stealthActive = false;
      attacker.keywords = attacker.keywords.filter(k => k !== 'stealth');
      this.log(`👁️ ${attacker.name} が潜伏を解除！`);
    }

    const abilityResult = processAbility('on_attack', attacker, gs, player, opponent, this.cardMap, gs.logs);
    if (this.handleAbilityResult(abilityResult, attacker, 'on_attack', player, opponent)) return this.getGameStateForClients();

    // 攻撃時効果による死亡判定（ここで死亡したユニットは戦闘を行えない）
    // 先にクリーンアップを実行して死亡したユニットの情報を反映
    this.cleanupDeadUnits();

    // クリーンアップにより攻撃者または防御者が盤面から消滅したかチェック
    const isAttackerAlive = getBoardUnit(player.board, attackerRow, attackerLane) !== null;
    let isDefenderDeadByAbility = false;

    if (targetInfo.type === 'unit') {
      const defRow = targetInfo.row || 'front';
      const defLane = targetInfo.lane;
      const defender = getBoardUnit(opponent.board, defRow, defLane);

      if (!defender) {
         // 防御側が攻撃時効果で死亡した場合
         isDefenderDeadByAbility = true;
      } else {
         if (defender.stealthActive) return { error: 'このユニットは潜伏中で攻撃対象にできません' };

         if (isAttackerAlive) {
           // 通常戦闘の解決
           const result = resolveUnitCombat(attacker, defender, gs.logs);

           if (result.defenderDead) {
             const killResult = processAbility('on_kill', attacker, gs, player, opponent, this.cardMap, gs.logs);
             if (this.handleAbilityResult(killResult, attacker, 'on_kill', player, opponent)) return this.getGameStateForClients();

             const deathResult = processAbility('on_death', defender, gs, opponent, player, this.cardMap, gs.logs);
             if (this.handleAbilityResult(deathResult, defender, 'on_death', opponent, player)) return this.getGameStateForClients();
           }
           if (result.attackerDead) {
             const deathResult = processAbility('on_death', attacker, gs, player, opponent, this.cardMap, gs.logs);
             if (this.handleAbilityResult(deathResult, attacker, 'on_death', player, opponent)) return this.getGameStateForClients();
           }
         }
      }

      // 拡散（spread）処理: 攻撃時、隣接レーンにも1ダメージ
      if (hasKeyword(attacker, 'spread') && !attacker.stealthActive) { // stealth check just in case, though attacking breaks stealth
        const spreadDmg = 1;
        const adjLanes = [defLane - 1, defLane + 1];
        adjLanes.forEach(l => {
          if (l >= 0 && l < 3) {
            const adj = opponent.board[defRow][l];
            if (adj) {
              adj.currentHp -= spreadDmg;
              this.log(`💥 ${attacker.name} の「拡散」！隣接する ${adj.name} に ${spreadDmg} ダメージ (HP: ${adj.currentHp})`);
              if (adj.currentHp <= 0) {
                const adjKilled = processUnitDeath(adj, gs.logs);
                if (adjKilled) {
                  this.log(`💀 ${adj.name} を巻き添えで撃破！`);
                  const deathResult = processAbility('on_death', adj, gs, opponent, player, this.cardMap, gs.logs);
                  this.handleAbilityResult(deathResult, adj, 'on_death', opponent, player);
                  opponent.board[defRow][l] = null;
                  opponent.graveyard.push({ id: adj.cardId, name: adj.name });
                }
              }
            }
          }
        });
      }

    } else if (targetInfo.type === 'shield') {
      const result = resolveShieldAttack(attacker, opponent.shields, gs.logs);
      opponent.totalShieldDurability = opponent.shields.reduce((sum, s) => sum + s.currentDurability, 0);

      if (result.shieldDestroyed) {
        opponent.shieldsDestroyed++;
        gs.phase = 'shield_break_anim';
        gs.pendingShieldBreak = {
          shield: result.shield,
          attackerId: playerId
        };
        this.broadcastTrigger('shield_break', opponent.id);
      }

    } else if (targetInfo.type === 'direct') {
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
    if (!player || gs.phase !== 'main') return { error: 'アクション不可' };
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };

    const unit = getBoardUnit(player.board, unitRow, unitLane);
    if (!unit) return { error: 'ユニットがいません' };
    if (unit.hasActed) return { error: 'このユニットはすでに行動済みです' };

    const ability = unit.abilities && unit.abilities[abilityIndex];
    if (!ability || ability.trigger !== 'activate') return { error: '起動能力が見つかりません' };

    // コストチェック (例: condition が "sp:1" の場合)
    if (ability.condition && ability.condition.startsWith('sp:')) {
      const cost = parseInt(ability.condition.split(':')[1]) || 0;
      if (player.sp < cost) return { error: `SPが足りません（必要: ${cost}）` };
      player.sp -= cost;
      this.log(`💰 ${player.name}: SP を ${cost} 消費して能力を発動`);
    }

    this.log(`⚡ ${unit.name} の起動能力発動！: ${ability.text || ''}`);
    
    // 処理実行
    // processAbility はトリガーが一致するものすべてを処理するため、一時的に個別の能力として渡すか、
    // あるいは trigger 文字列を工夫する必要があります。ここでは対象の1つだけを処理するようにラップします。
    const originalAbilities = unit.abilities;
    unit.abilities = [ability]; // 一時的に対象のみにする
    const abilityResult = processAbility('activate', unit, gs, player, getOpponentPlayer(gs), this.cardMap, gs.logs);
    if (this.handleAbilityResult(abilityResult, unit, 'activate', player, getOpponentPlayer(gs))) return this.getGameStateForClients();
    unit.abilities = originalAbilities; // 戻す

    unit.hasActed = true;
    this.cleanupDeadUnits();
    
    return this.getGameStateForClients();
  }

  endTurn(playerId) {
    const gs = this.gameState;
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };

    const player = gs.players[playerId];

    // 手札上限チェック
    if (player.hand.length > MAX_HAND_SIZE) {
      if (player.isAI) {
        // AIの場合は自動でランダムに捨てる
        this.log(`🤖 ${player.name}: 手札上限超過。自動で破棄します。`);
        const discardCount = player.hand.length - MAX_HAND_SIZE;
        for (let i = 0; i < discardCount; i++) {
          const idx = Math.floor(Math.random() * player.hand.length);
          const discarded = player.hand.splice(idx, 1)[0];
          player.graveyard.push(discarded);
          this.log(`🗑️ ${player.name}: ${discarded.name} を捨てた`);
          this.broadcastTrigger('discard', player.id);
        }
      } else {
        // プレイヤーの場合は破棄フェーズへ移行
        gs.phase = 'discarding';
        this.log(`⚠️ ${player.name}: 手札が多すぎます。捨てるカードを選択してください。`);
        return this.getGameStateForClients();
      }
    }

    return this.completeEndTurn(player);
  }

  completeEndTurn(player) {
    const gs = this.gameState;
    
    // ターン終了時効果の処理（腐敗・暴走など）
    forEachUnit(player.board, (unit, row, lane) => {
      // 腐敗 (Decay)
      if (hasKeyword(unit, 'decay')) {
        const { applyDamage } = require('./CombatResolver');
        const actualDamage = applyDamage(unit, 1, gs.logs);
        this.log(`☠️ ${unit.name} は腐敗により ${actualDamage} ダメージを受けた (HP: ${unit.currentHp})`);
      }
    });


    this.cleanupDeadUnits();

    gs.phase = 'main'; // フェーズを戻す
    this.log(`⏭️ ${player.name}: ターン終了`);

    gs.currentPlayerIndex = gs.currentPlayerIndex === 0 ? 1 : 0;
    if (gs.currentPlayerIndex === 0) gs.turnNumber++;

    return this.startTurn();
  }

  discardCards(playerId, cardIndices) {
    const gs = this.gameState;
    const player = gs.players[playerId];
    if (!player || gs.phase !== 'discarding') return { error: '不正なアクション' };

    const needed = player.hand.length - MAX_HAND_SIZE;
    if (cardIndices.length !== needed) return { error: `${needed}枚選択してください` };

    // インデックスの降順でソート（削除時の位置ずれ防止）
    const sortedIndices = [...cardIndices].sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
      const discarded = player.hand.splice(idx, 1)[0];
      if (discarded) {
        player.graveyard.push(discarded);
        this.log(`🗑️ ${player.name}: ${discarded.name} を捨てた`);
        this.broadcastTrigger('discard', player.id);
      }
    });

    return this.completeEndTurn(player);
  }

  // イベントの処理
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
            this.log(`💀 ${targetPlayer.name}: デッキ切れ！敗北！`);
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
             // 必要に応じて追加のキーワード初期化（トークンの場合は基本初期化済みのため代入のみでOK）
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

          // 全プレイヤーの盤面から対象を探す
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
            // 盤面から除去
            foundPlayer.board[foundPos.row][foundPos.lane] = null;
            
            // 所有者の手札に戻す（本来の持ち主のIDを使用）
            const owner = this.gameState.players[foundUnit.ownerId];
            if (owner) {
              const cardData = this.cardMap[foundUnit.cardId];
              if (cardData) {
                // 手札に追加（元のカードデータをコピー）
                owner.hand.push({ ...cardData });
                this.log(`🔄 ${foundUnit.name} が ${owner.name} の手札に戻った`);
                this.broadcastTrigger('card_bounce', owner.id);
              }
            }
          }
          break;
        }
      }
    });
  }

  // アビリティ結果のハンドリング（ターゲット要求対応）
  handleAbilityResult(result, unit, trigger, player, opponent) {
    if (result.needsTarget) {
      if (result.effect && result.effect.startsWith('destroy_')) {
          this.log(`🎯 タイブレーク発生: ${unit.name} の効果が複数対象に該当したため、対象を選択してください。`);
      }
      console.log(`🎯 [GameEngine] Transitioning to targeting phase for: ${unit.name} (${trigger})`);
      this.gameState.phase = 'targeting';
      this.gameState.pendingAbilitySource = {
        unitInstanceId: unit.instanceId,
        unitName: unit.name,
        ability: result.originalAbility,
        abilityIndex: result.abilityIndex || 0, // NEW: インデックスを追跡
        trigger: trigger,
        effect: result.effect, // 追加: summons_token 等の判別に必要
        targetId: result.targetId,
        ownerId: player.id
      };
      return true; // ターゲット選択が必要
    }
    this.processEvents(result.events, player, opponent);
    return false; // 継続可能
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
            
            // 遺言 (on_death) を発動
            const { processAbility } = require('./AbilityProcessor');
            const deathResult = processAbility('on_death', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs);
            this.handleAbilityResult(deathResult, unit, 'on_death', player, opponent);

            // 不屈 (Endure) のチェック
            const isDead = processUnitDeath(unit, this.gameState.logs);
            if (!isDead) {
              // 耐えた場合は何もしない（processUnitDeath 内でHP1/フラグ消費処理済み）
              continue;
            }

            // 本当に死亡した場合
            player.friendlyDeathsThisTurn++;
            player.graveyard.push({ id: unit.cardId, name: unit.name });
            player.board[row][i] = null;
            this.log(`💀 ${unit.name} が場から除去された`);
            
            // 全体に死亡を通知
            this.broadcastTrigger('any_unit_death', pid);
          }
        }
      }
    }
  }

  log(message) {
    if (this.gameState) this.gameState.logs.push(message);
    console.log(message);
  }

  getSanitizedLogs(logs, viewerId) {
    return logs.map(msg => {
      if (!viewerId || !this.gameState) return msg;
      
      const playerNames = Object.values(this.gameState.players).map(p => ({ id: p.id, name: p.name }));
      const opponent = playerNames.find(p => p.id !== viewerId);
      
      if (!opponent) return msg;

      // 相手の行動によるログで秘匿が必要なものを置換
      if (msg.includes(opponent.name)) {
        // マリガンの新手札
        msg = msg.replace(/\(新手札:.*?\)/, '(新手札: 非公開)');
        // ドロー
        if (msg.includes('をドロー')) {
          msg = msg.replace(new RegExp(`📖 ${opponent.name}: .* をドロー`), `📖 ${opponent.name}: カード をドロー`);
        }
        // 捨てる
        if (msg.includes('を捨てた')) {
          msg = msg.replace(new RegExp(`🗑️ ${opponent.name}: .* を捨てた`), `🗑️ ${opponent.name}: カード を捨てた`);
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

    // シールドの秘匿化（未破壊のものは情報を隠す）
    // AIプレイヤーには完全な情報を渡す（攻撃判定に必要）
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
