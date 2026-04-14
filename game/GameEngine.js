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

    const spGain = (isSecondPlayer && isFirstTurn) ? FIRST_TURN_SECOND_PLAYER_SP : SP_PER_TURN;
    current.sp += spGain;
    this.log(`💰 ${current.name}: SP+${spGain} (SP: ${current.sp})`);

    // ターン開始時にフラグを更新
    gs.isFirstTurn[current.id] = false;

    // ユニットの行動可能状態をリセット（全列走査）
    forEachUnit(current.board, (unit) => {
      unit.hasActed = false;
      unit.summonedThisTurn = false; 
      unit.canAttack = true;
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
    return this.getGameStateForClients();
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

      if (hasKeyword(unit, 'search')) {
        processSearch(unit, player, this.cardMap, gs.logs);
      }
      
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
      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs);
      
      if (result.needsTarget) {
        // スペル発動中にターゲット選択（召喚場所など）が必要な場合
        gs.phase = 'targeting';
        gs.pendingAbilitySource = {
          spellCardId: card.id,
          unitName: card.name, // 共通表示用
          trigger: 'on_play',
          effect: result.effect,
          targetId: result.targetId,
          ownerId: player.id
        };
        this.log(`✨ スペル「${card.name}」の発動対象を選択してください...`);
        return this.getGameStateForClients();
      }

      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      this.log(`✨ ${player.name}: スペル「${card.name}」を発動 (SP: ${player.sp})`);

      this.processEvents(result.events, player, opponent);
      player.graveyard.push(card);
    }

    this.cleanupDeadUnits();
    return this.getGameStateForClients();
  }

  resolvePendingAbility(playerId, targetRow, targetLane) {
    const gs = this.gameState;
    if (gs.phase !== 'targeting') return { error: 'ターゲット選択フェーズではありません' };
    
    const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
    if (playerId !== currentPlayerId) return { error: '自分のターンではありません' };

    const sourceInfo = gs.pendingAbilitySource;
    if (!sourceInfo) {
       gs.phase = 'main';
       return this.getGameStateForClients();
    }

    const player = gs.players[playerId];
    const opponent = getOpponentPlayer(gs);

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

      // 能力解決の実行
      const { events } = processAbility(sourceInfo.trigger, unit, gs, player, opponent, this.cardMap, gs.logs, targetRow, targetLane);
      this.processEvents(events, player, opponent);

      gs.phase = 'main';
      gs.pendingAbilitySource = null;
      this.cleanupDeadUnits();
      return this.getGameStateForClients();
    }

    if (sourceInfo.spellCardId) {
      // スペル（プレイ待機中）の解決
      const card = player.hand.find(c => c.id === sourceInfo.spellCardId);
      if (!card) {
          gs.phase = 'main';
          gs.pendingAbilitySource = null;
          return this.getGameStateForClients();
      }

      const handIndex = player.hand.indexOf(card);
      player.sp -= card.cost;
      player.hand.splice(handIndex, 1);
      this.log(`✨ ${player.name}: スペル「${card.name}」を確定発動 (SP: ${player.sp})`);

      const result = processSpellEffect(card, gs, player, opponent, targetRow, targetLane, this.cardMap, gs.logs);
      this.processEvents(result.events, player, opponent);
      player.graveyard.push(card);

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

    if (targetInfo.type === 'unit') {
      const defRow = targetInfo.row || 'front';
      const defLane = targetInfo.lane;
      const defender = getBoardUnit(opponent.board, defRow, defLane);
      if (!defender) return { error: '対象のユニットがいません' };
      if (defender.stealthActive) return { error: 'このユニットは潜伏中で攻撃対象にできません' };

      const result = resolveUnitCombat(attacker, defender, gs.logs);

      if (result.defenderDead) {
        const killResult = processAbility('on_kill', attacker, gs, player, opponent, this.cardMap, gs.logs);
        if (this.handleAbilityResult(killResult, attacker, 'on_kill', player, opponent)) return this.getGameStateForClients();

        const deathResult = processAbility('on_death', defender, gs, opponent, player, this.cardMap, gs.logs);
        if (this.handleAbilityResult(deathResult, defender, 'on_death', opponent, player)) return this.getGameStateForClients();

        opponent.board[defRow][defLane] = null;
        opponent.graveyard.push({ id: defender.cardId, name: defender.name });
      }
      if (result.attackerDead) {
        const deathResult = processAbility('on_death', attacker, gs, player, opponent, this.cardMap, gs.logs);
        if (this.handleAbilityResult(deathResult, attacker, 'on_death', player, opponent)) return this.getGameStateForClients();

        player.board[attackerRow][attackerLane] = null;
        player.graveyard.push({ id: attacker.cardId, name: attacker.name });
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
      }
    });
  }

  // アビリティ結果のハンドリング（ターゲット要求対応）
  handleAbilityResult(result, unit, trigger, player, opponent) {
    if (result.needsTarget) {
      console.log(`🎯 [GameEngine] Transitioning to targeting phase for: ${unit.name} (${trigger})`);
      this.gameState.phase = 'targeting';
      this.gameState.pendingAbilitySource = {
        unitInstanceId: unit.instanceId,
        unitName: unit.name,
        ability: result.originalAbility,
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
            if (unit.endureActive) {
              unit.endureActive = false;
              unit.currentHp = 1;
              unit.keywords = unit.keywords.filter(k => k !== 'endure');
              this.log(`💪 ${unit.name} の不屈が発動！HP1で復活！`);
            } else {
              const opId = Object.keys(this.gameState.players).find(id => id !== pid);
              const opponent = this.gameState.players[opId];
              const deathResult = processAbility('on_death', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs);
              this.handleAbilityResult(deathResult, unit, 'on_death', player, opponent);

              player.graveyard.push({ id: unit.cardId, name: unit.name });
              player.board[row][i] = null;
              this.log(`💀 ${unit.name} が場から除去された`);
            }
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
