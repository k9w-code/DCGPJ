// scripts/simulate_match.js - AI同士の高速自動対戦によるバグ網羅検証スクリプト
'use strict';

const path = require('path');
const fs = require('fs');
const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

const LOG_FILE = path.join(__dirname, '../data/simulation_error.log');

// デッキの自動構築（server.js からコピー）
function buildRandomDeck(cardPool, color1, color2) {
  const validCards = cardPool.filter(c => c.color === color1 || c.color === color2 || c.color === 'neutral');
  const deck = [];
  for (const card of validCards) {
    const copies = Math.min(card.maxCopies || 3, 3);
    for (let i = 0; i < copies; i++) {
      deck.push(card.id);
    }
  }
  while (deck.length > 40) {
    deck.splice(Math.floor(Math.random() * deck.length), 1);
  }
  while (deck.length < 40) {
    const randomCard = validCards[Math.floor(Math.random() * validCards.length)];
    deck.push(randomCard.id);
  }
  return deck;
}

function getRandomShields(shieldPool, count) {
  const shuffled = [...shieldPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(s => s.id);
}

async function runSimulation() {
  console.log('🔄 シミュレーションデータのロード中...');
  let gameData;
  try {
    gameData = await loadAllData({ sync: false });
  } catch (err) {
    console.error('❌ データロード失敗:', err);
    process.exit(1);
  }

  const cardPool = gameData.cards;
  cardPool.forEach(c => {
    if (c.abilities && c.abilities.length > 1) {
      console.log(`[DEBUG] Card ${c.name} (${c.id}) has ${c.abilities.length} abilities:`, JSON.stringify(c.abilities));
    }
  });
  const shieldPool = gameData.shields;

  const totalMatches = 100;
  let p1Wins = 0;
  let p2Wins = 0;
  let totalTurns = 0;
  let errorCount = 0;
  const errorsList = [];

  console.log(`🎮 AI自動対戦シミュレーション開始 (計 ${totalMatches} 試合)`);
  fs.writeFileSync(LOG_FILE, `=== SIMULATION START at ${new Date().toISOString()} ===\n`, 'utf8');

  for (let match = 1; match <= totalMatches; match++) {
    // 属性のランダム決定
    const colors = ['red', 'blue', 'green', 'white', 'black'];
    const p1c1 = colors[Math.floor(Math.random() * colors.length)];
    const p1c2 = colors[colors.indexOf(p1c1) === 0 ? 1 : 0] || 'neutral'; // 異なる色
    const p2c1 = colors[Math.floor(Math.random() * colors.length)];
    const p2c2 = colors[colors.indexOf(p2c1) === 0 ? 1 : 0] || 'neutral';

    const p1Deck = buildRandomDeck(cardPool, p1c1, p1c2);
    const p2Deck = buildRandomDeck(cardPool, p2c1, p2c2);
    const p1Shields = getRandomShields(shieldPool, 3);
    const p2Shields = getRandomShields(shieldPool, 3);

    const p1Info = { id: 'p1', name: `AI_1_${p1c1}_${p1c2}`, avatar: '1', deckCardIds: p1Deck, shieldIds: p1Shields, isAI: true };
    const p2Info = { id: 'p2', name: `AI_2_${p2c1}_${p2c2}`, avatar: '2', deckCardIds: p2Deck, shieldIds: p2Shields, isAI: true };

    const engine = new GameEngine(gameData);
    const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
    const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');

    let state = engine.initGame(p1Info, p2Info);

    // AIマリガン
    const ai1Decision = ai1.decideMulligan(engine.gameState.players['p1'].hand);
    engine.processMulligan('p1', ai1Decision);
    const ai2Decision = ai2.decideMulligan(engine.gameState.players['p2'].hand);
    engine.processMulligan('p2', ai2Decision);

    engine.gameState.phase = 'main';
    state = engine.startTurn();

    let stepCount = 0;
    const maxSteps = 400; // フリーズ検知（無限ループガード）

    try {
      while (state && state.phase !== 'game_over' && stepCount < maxSteps) {
        stepCount++;
        
        // 通常は現在の手番プレイヤーだが、ターゲット選択フェーズの時はその能力の所有者が意思決定する
        let currentId = state.currentPlayerId;
        if (state.phase === 'targeting' && engine.gameState.pendingAbilitySource) {
          currentId = engine.gameState.pendingAbilitySource.ownerId;
        }

        const currentAI = currentId === 'p1' ? ai1 : ai2;
        const view = engine.getPlayerView(currentId);
        const action = currentAI.decideNextAction(view);

        if (!action) {
          // 何もやることがなければターン終了
          state = engine.endTurn(currentId);
          continue;
        }

        let result;
        switch (action.type) {
          case 'raise_tribe':
            result = engine.raiseTribeLevel(currentId, action.color);
            break;
          case 'play_card':
            result = engine.playCard(currentId, action.handIndex, action.targetRow, action.targetLane);
            break;
          case 'attack':
            result = engine.attackWithUnit(currentId, action.attackerRow, action.attackerLane, action.targetInfo);
            break;
          case 'select_target':
            result = engine.resolvePendingAbility(currentId, action.targetRow, action.targetLane);
            break;
          case 'end_turn':
            result = engine.endTurn(currentId);
            break;
          default:
            result = { error: `不明なアクション: ${action.type}` };
        }

        // アクションエラー時のリカバリ
        if (result && result.error) {
          engine.log(`[SIMULATION WARNING] Action error: ${result.error}. Action: ${JSON.stringify(action)}`);
          // state は変更せず、最新の状態を復旧
          state = engine.getPlayerView(currentId);
          
          // 無限フリーズ防止策：同じターンでアクションエラーが多発する場合は強制ターン終了
          if (stepCount % 20 === 0) {
            engine.gameState.phase = 'main';
            engine.gameState.pendingAbilitySource = null;
            const forcedState = engine.endTurn(currentId);
            if (forcedState && !forcedState.error) {
              state = forcedState;
            } else {
              state = engine.getPlayerView(currentId);
            }
          }
        } else {
          state = result;
        }

        // 状態がシールドブレイク演出中の場合は自動解決
        if (state && state.phase === 'shield_break_anim') {
          state = engine.resolvePendingShieldBreak();
        }

        // 状態が手札超過（discarding）の場合は自動で捨てる
        if (state && state.phase === 'discarding') {
          const player = engine.gameState.players[currentId];
          const needed = player.hand.length - 7;
          if (needed > 0) {
            const indices = [];
            for (let i = 0; i < needed; i++) indices.push(i);
            state = engine.discardCards(currentId, indices);
          }
        }
      }

      if (stepCount >= maxSteps) {
        throw new Error('無限ループ/フリーズを検知しました（ステップ数が400を超えました）');
      }

      // 勝敗のカウント
      if (engine.gameState.winner === 'p1') {
        p1Wins++;
      } else if (engine.gameState.winner === 'p2') {
        p2Wins++;
      }
      totalTurns += engine.gameState.turnNumber;

    } catch (err) {
      errorCount++;
      const errInfo = `Match ${match} - Error: ${err.message}\n` +
                      `Stack: ${err.stack}\n` +
                      `Last GameState Log:\n${engine.gameState.logs.slice(-10).join('\n')}\n` +
                      `=========================================\n`;
      errorsList.push(errInfo);
      fs.appendFileSync(LOG_FILE, errInfo, 'utf8');
      console.error(`❌ Match ${match} で例外クラッシュを検知しました:`, err.message);
    }
  }

  // 結果の表示
  const winRate1 = ((p1Wins / totalMatches) * 100).toFixed(1);
  const avgTurns = (totalTurns / (totalMatches - errorCount)).toFixed(1);
  const successRate = (((totalMatches - errorCount) / totalMatches) * 100).toFixed(1);

  console.log('\n=========================================');
  console.log(`📊 シミュレーション完了レポート (計 ${totalMatches} 試合)`);
  console.log(`・正常完了率: ${successRate}% (${totalMatches - errorCount} / ${totalMatches})`);
  console.log(`・エラー発生件数: ${errorCount} 件`);
  console.log(`・AI_1 勝率: ${winRate1}% (${p1Wins}勝)`);
  console.log(`・AI_2 勝率: ${(100 - winRate1).toFixed(1)}% (${p2Wins}勝)`);
  console.log(`・平均ターン数: ${avgTurns} ターン`);
  console.log(`※ 詳細なエラーログは ${LOG_FILE} を参照してください。`);
  console.log('=========================================\n');
}

runSimulation();
