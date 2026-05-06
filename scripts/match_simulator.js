const fs = require('fs');
const path = require('path');

// コアロジックの読み込み
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

// データ読み込み用
const { loadAllData } = require('../game/DataLoader');

// データのロード（本来はasyncだが、シミュレーター用に同期的に処理するか、あるいは初期化を待つ）
// ここでは、プロジェクトの標準に従い一括ロードを行う
let gameData = null;

async function initialize() {
  const allData = await loadAllData();
  gameData = allData;
  return allData;
}

// 同期的に利用するためのラッパー（シミュレーター起動時に一度だけ呼ぶ）
function getGameDataSync() {
  // loadLocalCSV を直接使う簡易版
  const { loadAllData } = require('../game/DataLoader');
  // 実際には top-level await が使えない環境を考慮し、
  // ここでは暫定的に require 内のロジックを模倣、または async I/F を提供する
  // 幸い、現在の環境では async/await が利用可能
}

/**
 * 1試合をシミュレート
 */
async function runFullMatch(deckAIds, deckBIds, shieldIds) {
  if (!gameData) {
    gameData = await loadAllData();
  }
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

module.exports = { 
  runFullMatch, 
  getCardMap: async () => {
    if (!gameData) gameData = await loadAllData();
    return gameData.cardMap;
  },
  getShields: async () => {
    if (!gameData) gameData = await loadAllData();
    return gameData.shields;
  }
};

