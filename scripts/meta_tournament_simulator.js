// scripts/meta_tournament_simulator.js
'use strict';

const path = require('path');
const fs = require('fs');
const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

const REPORT_FILE = path.join(__dirname, '../data/meta_tournament_result.json');

// デッキビルド関数
function buildArchetypeDeck(cardPool, primaryColor, secondaryColor = 'neutral', archetypeStyle = 'balanced') {
  const availableCards = cardPool.filter(c => 
    c.color === primaryColor || c.color === secondaryColor || c.color === 'neutral'
  );

  let sorted = [...availableCards];
  if (archetypeStyle === 'aggro') {
    // 低コストかつ攻撃力重視
    sorted.sort((a, b) => (a.cost - b.cost) || (b.attack - a.attack));
  } else if (archetypeStyle === 'control') {
    // スペル、バウンス、加護、高コスト重視
    sorted.sort((a, b) => (b.cost - a.cost));
  } else if (archetypeStyle === 'ramp') {
    // 中コスト、SPブースト、連携重視
    sorted.sort((a, b) => Math.abs(a.cost - 3) - Math.abs(b.cost - 3));
  } else {
    // バランス型（ランダムベース）
    sorted.sort(() => Math.random() - 0.5);
  }

  const deck = [];
  for (const card of sorted) {
    if (deck.length >= 40) break;
    const copies = Math.min(card.maxCopies || 3, 3);
    for (let i = 0; i < copies; i++) {
      if (deck.length < 40) deck.push(card.id);
    }
  }

  while (deck.length < 40) {
    const rCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    deck.push(rCard.id);
  }

  return deck.sort(() => Math.random() - 0.5);
}

function getRandomShields(shieldPool, count) {
  const shuffled = [...shieldPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(s => s.id);
}

async function runTournament() {
  console.log('🔄 データロード中...');
  const gameData = await loadAllData({ sync: false });
  const cardPool = gameData.cards;
  const shieldPool = gameData.shields;

  // 定義する10個のアーキタイプ
  const ARCHETYPES = [
    { id: 'red_mono', name: '【赤単】炎アグロ', color1: 'red', color2: 'neutral', style: 'aggro' },
    { id: 'blue_mono', name: '【青単】水コントロール', color1: 'blue', color2: 'neutral', style: 'control' },
    { id: 'green_mono', name: '【緑単】風ランプ・展開', color1: 'green', color2: 'neutral', style: 'ramp' },
    { id: 'white_mono', name: '【白単】光ビート・耐久', color1: 'white', color2: 'neutral', style: 'balanced' },
    { id: 'black_mono', name: '【黒単】闇リアニメイト', color1: 'black', color2: 'neutral', style: 'control' },
    { id: 'red_black_dual', name: '【赤黒】炎闇自傷アグロ (2色)', color1: 'red', color2: 'black', style: 'aggro' },
    { id: 'blue_white_dual', name: '【水光】水光絶対防御 (2色)', color1: 'blue', color2: 'white', style: 'control' },
    { id: 'red_green_dual', name: '【赤緑】炎風ラッシュランプ (2色)', color1: 'red', color2: 'green', style: 'aggro' },
    { id: 'blue_black_dual', name: '【青黒】沈黙ハンデス (2色)', color1: 'blue', color2: 'black', style: 'control' },
    { id: 'white_green_dual', name: '【白緑】大型守護ランプ (2色)', color1: 'white', color2: 'green', style: 'ramp' },
  ];

  console.log(`🏆 アーキタイプ全対全トーナメントシミュレーション開始 (アーキタイプ数: ${ARCHETYPES.length})`);

  const MATCHES_PER_PAIR = 25; // 10アーキタイプ × 10アーキタイプ × 25試合 = 2500試合
  const results = {};
  const cardUsageWins = {};
  const cardUsageTotal = {};

  ARCHETYPES.forEach(a => {
    results[a.id] = {
      name: a.name,
      wins: 0,
      total: 0,
      firstWins: 0,
      firstTotal: 0,
      vsMap: {}
    };
  });

  let totalSimulated = 0;
  let firstPlayerWins = 0;
  let totalTurnsSum = 0;

  for (let i = 0; i < ARCHETYPES.length; i++) {
    const arch1 = ARCHETYPES[i];
    for (let j = 0; j < ARCHETYPES.length; j++) {
      const arch2 = ARCHETYPES[j];

      if (!results[arch1.id].vsMap[arch2.id]) {
        results[arch1.id].vsMap[arch2.id] = { wins: 0, total: 0 };
      }

      for (let m = 0; m < MATCHES_PER_PAIR; m++) {
        totalSimulated++;
        const deck1 = buildArchetypeDeck(cardPool, arch1.color1, arch1.color2, arch1.style);
        const deck2 = buildArchetypeDeck(cardPool, arch2.color1, arch2.color2, arch2.style);
        const shield1 = getRandomShields(shieldPool, 3);
        const shield2 = getRandomShields(shieldPool, 3);

        const p1Info = { id: 'p1', name: arch1.name, avatar: '1', deckCardIds: deck1, shieldIds: shield1, isAI: true };
        const p2Info = { id: 'p2', name: arch2.name, avatar: '2', deckCardIds: deck2, shieldIds: shield2, isAI: true };

        const engine = new GameEngine(gameData);
        engine.log = () => {}; // ログ出力抑制で超高速化
        const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
        const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');

        let state = engine.initGame(p1Info, p2Info);
        const ai1Decision = ai1.decideMulligan(engine.gameState.players['p1'].hand);
        engine.processMulligan('p1', ai1Decision);
        const ai2Decision = ai2.decideMulligan(engine.gameState.players['p2'].hand);
        engine.processMulligan('p2', ai2Decision);

        engine.gameState.phase = 'main';
        state = engine.startTurn();

        let stepCount = 0;
        const maxSteps = 2000;

        while (engine.gameState.phase !== 'game_over' && stepCount < maxSteps) {
          stepCount++;
          let currentId = engine.gameState.currentPlayerId;
          if (engine.gameState.phase === 'targeting' && engine.gameState.pendingAbilitySource) {
            currentId = engine.gameState.pendingAbilitySource.ownerId;
          }

          const currentAI = currentId === 'p1' ? ai1 : ai2;
          const view = engine.getPlayerView(currentId);
          const action = currentAI.decideNextAction(view);

          if (!action) {
            engine.endTurn(currentId);
            continue;
          }

          let res;
          switch (action.type) {
            case 'raise_tribe': res = engine.raiseTribeLevel(currentId, action.color); break;
            case 'play_card': res = engine.playCard(currentId, action.handIndex, action.targetRow, action.targetLane); break;
            case 'attack': res = engine.attackWithUnit(currentId, action.attackerRow, action.attackerLane, action.targetInfo); break;
            case 'select_target': res = engine.resolvePendingAbility(currentId, action.targetRow, action.targetLane); break;
            case 'end_turn': res = engine.endTurn(currentId); break;
            default: res = { error: 'unknown' };
          }

          if (res && res.error) {
            engine.endTurn(currentId);
          }
        }

        let winnerId = engine.gameState.winner;
        // 万が一、決着が着いていない場合はHP/シールド数で判定
        if (!winnerId) {
          const p1Hp = engine.gameState.players['p1'].hp || 0;
          const p2Hp = engine.gameState.players['p2'].hp || 0;
          winnerId = p1Hp >= p2Hp ? 'p1' : 'p2';
        }

        const turnCount = engine.gameState.turn || 0;
        totalTurnsSum += turnCount;

        results[arch1.id].total++;
        results[arch2.id].total++;
        results[arch1.id].vsMap[arch2.id].total++;

        if (winnerId === 'p1') {
          results[arch1.id].wins++;
          results[arch1.id].firstWins++;
          results[arch1.id].vsMap[arch2.id].wins++;
          firstPlayerWins++;
          deck1.forEach(cId => { cardUsageWins[cId] = (cardUsageWins[cId] || 0) + 1; });
        } else if (winnerId === 'p2') {
          results[arch2.id].wins++;
          deck2.forEach(cId => { cardUsageWins[cId] = (cardUsageWins[cId] || 0) + 1; });
        }

        deck1.forEach(cId => { cardUsageTotal[cId] = (cardUsageTotal[cId] || 0) + 1; });
        deck2.forEach(cId => { cardUsageTotal[cId] = (cardUsageTotal[cId] || 0) + 1; });
      }
    }
    console.log(`  ✓ アーキタイプ [${arch1.name}] シミュレーション完了 (${(i + 1)} / ${ARCHETYPES.length})`);
  }

  // カード別勝率の算出
  const cardStats = [];
  Object.keys(cardUsageTotal).forEach(cId => {
    const total = cardUsageTotal[cId];
    const wins = cardUsageWins[cId] || 0;
    const cardObj = gameData.cardMap[cId];
    if (cardObj && total >= 50) {
      cardStats.push({
        id: cId,
        name: cardObj.name,
        color: cardObj.color,
        cost: cardObj.cost,
        winRate: (wins / total * 100).toFixed(1),
        total
      });
    }
  });

  cardStats.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));

  const outputData = {
    totalMatches: totalSimulated,
    firstPlayerWinRate: (firstPlayerWins / totalSimulated * 100).toFixed(1),
    avgTurnLength: (totalTurnsSum / totalSimulated).toFixed(1),
    archetypes: Object.values(results).map(r => ({
      name: r.name,
      winRate: (r.wins / r.total * 100).toFixed(1),
      wins: r.wins,
      total: r.total,
      vsMap: r.vsMap
    })),
    topOpCards: cardStats.slice(0, 15),
    bottomCards: cardStats.slice(-10).reverse()
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`✅ モンテカルロシミュレーション完了！結果を ${REPORT_FILE} に保存しました。`);
}

runTournament().catch(console.error);
