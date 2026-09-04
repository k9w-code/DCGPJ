// scripts/verify_game_mechanics.js
// 1試合の毎ターンの「盤面」「シールド耐久」「AIのアクション選択」を詳細にトラッキング
'use strict';

const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

async function verifyMechanics() {
  const gameData = await loadAllData({ sync: false });
  const shieldPool = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');

  const redRushCards = ['RE003','RE003','RE003','RE002','RE002','RE002','RE026','RE026','RE026','RE005','RE005','RE005','RE001','RE001','RE001','RE024','RE024','RE024','RE006','RE006','RE027','RE027','RE027','RE017','RE017','RE017','RE028','RE028','RE028','RE010','RE010','RE029','RE029','RE029','RE009','RE009','RE012','RE012','RE007','RE007'];
  const whiteBeatCards = ['WH001','WH001','WH001','WH003','WH003','WH003','WH005','WH005','WH005','WH006','WH006','WH006','WH030','WH030','WH030','WH007','WH007','WH007','WH008','WH008','WH008','WH009','WH009','WH009','WH010','WH010','WH025','WH025','WH025','WH024','WH024','WH014','WH014','WH017','WH017','WH015','WH015','WH026','WH018','WH018'];

  const selectShields = pool => {
    const d1 = pool.filter(s => s.durability === 1);
    const d3 = pool.filter(s => s.durability === 3);
    return [d1[0].id, d1[1].id, d3[0].id];
  };

  const p1Info = { id:'p1', name:'【赤単】ラッシュ', avatar:'1', deckCardIds:redRushCards, shieldIds:selectShields(shieldPool), isAI:true };
  const p2Info = { id:'p2', name:'【白単】耐久ビート', avatar:'2', deckCardIds:whiteBeatCards, shieldIds:selectShields(shieldPool), isAI:true };

  const engine = new GameEngine(gameData);
  engine.log = (msg) => console.log('  [LOG]', msg);

  const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
  const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');
  const aiFor = id => id === 'p1' ? ai1 : ai2;

  engine.initGame(p1Info, p2Info);
  const firstId  = engine.gameState.playerOrder[0];
  const secondId = engine.gameState.playerOrder[1];

  engine.processMulligan(firstId,  aiFor(firstId).decideMulligan(engine.gameState.players[firstId].hand));
  engine.processMulligan(secondId, aiFor(secondId).decideMulligan(engine.gameState.players[secondId].hand));
  engine.gameState.phase = 'main';
  engine.startTurn();

  let step = 0;
  while (engine.gameState.phase !== 'game_over' && step < 1000) {
    step++;
    const phase = engine.gameState.phase;
    if (phase === 'shield_break_anim') {
      console.log('⚡ [シールド破壊アニメ処理]');
      engine.resolvePendingShieldBreak();
      continue;
    }

    let cid = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
    if (phase === 'targeting' && engine.gameState.pendingAbilitySource) {
      cid = engine.gameState.pendingAbilitySource.ownerId || cid;
    }

    const action = aiFor(cid).decideNextAction(engine.getPlayerView(cid));
    if (!action) { engine.endTurn(cid); continue; }

    const curPlayerName = engine.gameState.players[cid].name;
    console.log(`\n▶ [Action Step ${step}] ${curPlayerName}:`, JSON.stringify(action));

    let res;
    switch (action.type) {
      case 'raise_tribe':   res = engine.raiseTribeLevel(cid, action.color); break;
      case 'play_card':     res = engine.playCard(cid, action.handIndex, action.targetRow, action.targetLane); break;
      case 'attack':        res = engine.attackWithUnit(cid, action.attackerRow, action.attackerLane, action.targetInfo); break;
      case 'select_target': res = engine.resolvePendingAbility(cid, action.targetRow, action.targetLane); break;
      case 'end_turn':      res = engine.endTurn(cid); break;
      default: res = { error: 'unknown' };
    }
    if (res?.error) console.log('  ⚠️ アクションエラー:', res.error);

    // 各アクション後のシールド状況を表示
    const p1ShieldsStr = engine.gameState.players.p1.shields.map(s => `${s.name}(${s.currentDurability}/${s.maxDurability}${s.destroyed?':破':''})`).join(', ');
    const p2ShieldsStr = engine.gameState.players.p2.shields.map(s => `${s.name}(${s.currentDurability}/${s.maxDurability}${s.destroyed?':破':''})`).join(', ');
    console.log(`  📊 P1(赤)シールド: [${p1ShieldsStr}] | P2(白)シールド: [${p2ShieldsStr}]`);
  }

  console.log('\n=== 最終結果 ===');
  console.log('勝者:', engine.gameState.winner);
  console.log('ターン数:', engine.gameState.turnNumber);
}

verifyMechanics().catch(console.error);
