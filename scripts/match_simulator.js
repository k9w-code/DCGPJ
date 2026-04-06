const fs = require('fs');
const path = require('path');

// コアロジックの読み込み
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

// データ読み込み用ヘルパー
function parseTsv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
}

function parseCsv(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    if (obj.effect_value) obj.effectValue = parseInt(obj.effect_value);
    if (obj.effect_type) obj.effectType = obj.effect_type;
    return obj;
  });
}

// データのロードとマップ作成
const rawCards = parseTsv(path.join(__dirname, '../data/cards_updated.tsv'));
const cardMap = {};
rawCards.forEach(c => {
  c.cost = parseInt(c.cost);
  c.attack = parseInt(c.atk);
  c.hp = parseInt(c.life);
  c.keywords = c.keywords ? c.keywords.split(',').map(k => k.trim()) : [];
  
  // アビリティを配列形式に変換
  c.abilities = [];
  if (c.trigger && c.trigger !== 'none') {
    c.abilities.push({
      trigger: c.trigger,
      effect: c.effect,
      value: isNaN(parseInt(c.value)) ? (c.value || '') : parseInt(c.value)
    });
  }
  
  cardMap[c.id] = c;
});

const rawShields = parseTsv(path.join(__dirname, '../data/shields_master.tsv'));
const shields = rawShields.map(s => ({
  id: s.id,
  name: s.name,
  durability: parseInt(s.life),
  skill: {
    name: s.name, 
    effectType: s.effect,
    effectValue: parseInt(s.value),
    target: s.target,
    description: s.text
  }
}));

const gameData = { cardMap, cards: Object.values(cardMap), shields, keywordMap: {} };

/**
 * 1試合をシミュレート
 */
function runFullMatch(deckAIds, deckBIds, shieldIds) {
  const engine = new GameEngine(gameData);
  
  // プレイヤー情報
  const p1 = { id: 'p1', name: 'Player_A', isAI: true, avatar: 'AV001', deckCardIds: deckAIds, shieldIds: shieldIds };
  const p2 = { id: 'p2', name: 'Player_B', isAI: true, avatar: 'AV002', deckCardIds: deckBIds, shieldIds: shieldIds };

  // AIインスタンス
  const ai1 = new AIPlayer('p1');
  const ai2 = new AIPlayer('p2');
  const ais = { 'p1': ai1, 'p2': ai2 };

  // ゲーム開始
  engine.initGame(p1, p2);
  engine.processMulligan('p1', false);
  engine.processMulligan('p2', false);
  engine.startTurn();

  let maxIterations = 500; // 無限ループ防止(1ターンに複数回AIが行動するため)
  
  let actionsThisTurn = 0;
  let lastPlayerId = null;

  while (engine.gameState.phase !== 'game_over' && maxIterations > 0) {
    const curId = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
    if (curId !== lastPlayerId) {
      actionsThisTurn = 0;
      lastPlayerId = curId;
    }

    if (actionsThisTurn > 20) {
      engine.log(`⚠️ ${curId} のアクション回数が上限に達したため、強制終了します。`);
      engine.endTurn(curId);
      continue;
    }

    const ai = ais[curId];
    const view = engine.getPlayerView(curId);
    const action = ai.decideNextAction(view);

    if (engine.gameState.phase === 'game_over') break;

    // 指示を実行
    let result = null;
    switch (action.type) {
      case 'raise_tribe':
        result = engine.raiseTribeLevel(curId, action.color);
        break;
      case 'play_card':
        result = engine.playCard(curId, action.handIndex, action.targetRow, action.targetLane);
        break;
      case 'attack':
        result = engine.attackWithUnit(curId, action.attackerRow, action.attackerLane, action.targetInfo);
        break;
      case 'end_turn':
        result = engine.endTurn(curId);
        break;
    }

    if (result && result.error) {
      engine.log(`❌ AIエラー (${curId}): ${result.error}. アクション: ${JSON.stringify(action)}`);
      // エラーが起きた場合は、これ以上そのターンの行動をさせない
      actionsThisTurn = 99; 
    } else {
      actionsThisTurn++;
    }
    maxIterations--;
  }

  return {
    winner: engine.gameState.winner,
    winnerName: engine.gameState.winner ? engine.gameState.players[engine.gameState.winner].name : 'DRAW',
    turns: engine.gameState.turnNumber,
    logs: engine.gameState.logs
  };
}

module.exports = { runFullMatch, cardMap, shields };
