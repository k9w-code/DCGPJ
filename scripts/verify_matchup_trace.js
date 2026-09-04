// scripts/verify_matchup_trace.js
'use strict';

const path = require('path');
const fs   = require('fs');
const { loadAllData }  = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

const DECK_RED_RUSH  = ['RE003','RE003','RE003','RE002','RE002','RE002','RE026','RE026','RE026','RE005','RE005','RE005','RE001','RE001','RE001','RE027','RE027','RE027','RE028','RE028','RE028','RE029','RE029','RE029','RE010','RE010','RE010','RE007','RE007','RE007','RE013','RE013','RE013','RE009','RE009','RE020','RE020','RE019','RE019','RE015'];
const DECK_WHITE_TAUNT = ['WH001','WH001','WH001','WH003','WH003','WH003','WH026','WH026','WH026','WH006','WH006','WH006','WH007','WH007','WH007','WH009','WH009','WH009','WH011','WH011','WH011','WH025','WH025','WH025','WH014','WH014','WH014','WH021','WH021','WH021','WH027','WH027','WH027','WH019','WH019','WH019','WH030','WH030','WH020','WH020'];

async function runVerification() {
  const gameData = await loadAllData({ sync: false });
  const shieldPool = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');
  const shieldIds = [shieldPool[0].id, shieldPool[1].id, shieldPool[2].id];

  console.log('================================================================');
  console.log('📜【完全対戦棋譜】赤単速攻 vs 白単挑発耐久 代表試合（1ターン毎のログ）');
  console.log('================================================================\n');
  traceMatchClean(gameData, shieldIds, DECK_RED_RUSH, '赤単速攻', DECK_WHITE_TAUNT, '白単挑発');

  console.log('\n================================================================');
  console.log('📊【シナリオ検証】赤単速攻 vs 白単挑発耐久 200試合の状況別統計');
  console.log('================================================================\n');
  runScenarioStatsClean(gameData, shieldIds, DECK_RED_RUSH, DECK_WHITE_TAUNT, 200);
}

function traceMatchClean(gameData, shieldIds, d1, name1, d2, name2) {
  const engine = new GameEngine(gameData);
  engine.log = () => {}; // エンジン内部ログ非表示

  const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
  const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');

  const p1Info = { id:'p1', name:name1, avatar:'1', deckCardIds:[...d1].sort(()=>Math.random()-0.5), shieldIds, isAI:true };
  const p2Info = { id:'p2', name:name2, avatar:'2', deckCardIds:[...d2].sort(()=>Math.random()-0.5), shieldIds, isAI:true };

  engine.initGame(p1Info, p2Info);
  engine.processMulligan('p1', ai1.decideMulligan(engine.gameState.players.p1.hand));
  engine.processMulligan('p2', ai2.decideMulligan(engine.gameState.players.p2.hand));
  engine.gameState.phase = 'main';
  engine.startTurn();

  let step = 0;
  let lastTurn = 0;

  while (engine.gameState.phase !== 'game_over' && step < 200) {
    step++;
    const phase = engine.gameState.phase;
    if (phase === 'shield_break_anim') { engine.resolvePendingShieldBreak(); continue; }

    let cid = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
    if (phase === 'targeting' && engine.gameState.pendingAbilitySource) {
      cid = engine.gameState.pendingAbilitySource.ownerId || cid;
    }
    const ai = cid === 'p1' ? ai1 : ai2;
    const action = ai.decideNextAction(engine.getPlayerView(cid));
    if (!action) { engine.endTurn(cid); continue; }

    const pName = cid === 'p1' ? name1 : name2;
    const playerState = engine.gameState.players[cid];
    const turn = engine.gameState.turnNumber;

    if (turn !== lastTurn) {
      lastTurn = turn;
      console.log(`\n--- ターン ${turn} (手番: ${pName}) ---`);
    }

    let detail = action.type;
    if (action.type === 'raise_tribe') detail += ` -> 神族属性[${action.color}]のレベルアップ`;
    if (action.type === 'play_card') {
      const c = playerState.hand[action.handIndex];
      detail += ` -> カードプレイ: 「${c ? c.name : '?'}(コスト${c ? c.cost : '?'})」 位置:${action.targetRow}_${action.targetLane}`;
    }
    if (action.type === 'attack') {
      const att = playerState.board[action.attackerRow][action.attackerLane];
      const tgt = action.targetInfo.type === 'shield' ? `シールド#${action.targetInfo.shieldIndex}` : (action.targetInfo.type === 'unit' ? `敵ユニット(${action.targetInfo.row}_${action.targetInfo.lane})` : 'プレイヤー直撃');
      detail += ` -> 攻撃: 「${att ? att.name : '?'}(${action.attackerRow}_${action.attackerLane})」 ターゲット: ${tgt}`;
    }
    if (action.type === 'end_turn') detail += ` -> ターン終了`;

    console.log(`  [SP:${playerState.sp} / Lv:${JSON.stringify(playerState.tribeLevels)}] ${detail}`);

    let res;
    switch (action.type) {
      case 'raise_tribe': res = engine.raiseTribeLevel(cid, action.color); break;
      case 'play_card': res = engine.playCard(cid, action.handIndex, action.targetRow, action.targetLane); break;
      case 'attack': res = engine.attackWithUnit(cid, action.attackerRow, action.attackerLane, action.targetInfo); break;
      case 'select_target': res = engine.resolvePendingAbility(cid, action.targetRow, action.targetLane); break;
      case 'end_turn': res = engine.endTurn(cid); break;
    }
    if (res && res.error) console.log(`    ⚠️ エラー: ${res.error}`);
  }

  const winner = engine.gameState.winner;
  console.log(`\n🏁 試合決着! 勝者: ${winner === 'p1' ? name1 : name2} (全${engine.gameState.turnNumber}ターン)`);
}

function runScenarioStatsClean(gameData, shieldIds, d1, d2, totalMatches) {
  let redWins = 0, whiteWins = 0;
  let totalTurns = 0;
  let tauntPlayedT3Matches = 0;
  let redBrokeShieldT3Matches = 0;
  let redBrokeShieldWhenTauntMatches = 0;

  for (let m = 0; m < totalMatches; m++) {
    const engine = new GameEngine(gameData);
    engine.log = () => {};

    const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
    const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');

    const isP1First = m % 2 === 0;
    const p1Info = { id:'p1', name:'赤単速攻', avatar:'1', deckCardIds:[...d1].sort(()=>Math.random()-0.5), shieldIds, isAI:true };
    const p2Info = { id:'p2', name:'白単挑発', avatar:'2', deckCardIds:[...d2].sort(()=>Math.random()-0.5), shieldIds, isAI:true };

    engine.initGame(isP1First ? p1Info : p2Info, isP1First ? p2Info : p1Info);
    const firstId  = engine.gameState.playerOrder[0];
    const secondId = engine.gameState.playerOrder[1];

    engine.processMulligan(firstId,  (firstId==='p1'?ai1:ai2).decideMulligan(engine.gameState.players[firstId].hand));
    engine.processMulligan(secondId, (secondId==='p1'?ai1:ai2).decideMulligan(engine.gameState.players[secondId].hand));
    engine.gameState.phase = 'main';
    engine.startTurn();

    let tauntByT3 = false;
    let shieldBrokeByT3 = false;

    let step = 0;
    while (engine.gameState.phase !== 'game_over' && step < 250) {
      step++;
      const phase = engine.gameState.phase;
      if (phase === 'shield_break_anim') { engine.resolvePendingShieldBreak(); continue; }

      let cid = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
      if (phase === 'targeting' && engine.gameState.pendingAbilitySource) {
        cid = engine.gameState.pendingAbilitySource.ownerId || cid;
      }
      const ai = cid === 'p1' ? ai1 : ai2;
      const action = ai.decideNextAction(engine.getPlayerView(cid));
      if (!action) { engine.endTurn(cid); continue; }

      const turn = engine.gameState.turnNumber;

      // 判定：白単（p2）が3ターン目までに挑発持ちカードを出したか
      if (cid === 'p2' && turn <= 3 && action.type === 'play_card') {
        const card = engine.gameState.players.p2.hand[action.handIndex];
        if (card && (card.keywords || []).includes('taunt')) {
          tauntByT3 = true;
        }
      }

      // 判定：赤単（p1）が3ターン目までに相手のシールドを攻撃・破壊したか
      if (cid === 'p1' && turn <= 3 && action.type === 'attack') {
        if (action.targetInfo && action.targetInfo.type === 'shield') {
          shieldBrokeByT3 = true;
        }
      }

      let res;
      switch (action.type) {
        case 'raise_tribe': res = engine.raiseTribeLevel(cid, action.color); break;
        case 'play_card': res = engine.playCard(cid, action.handIndex, action.targetRow, action.targetLane); break;
        case 'attack': res = engine.attackWithUnit(cid, action.attackerRow, action.attackerLane, action.targetInfo); break;
        case 'select_target': res = engine.resolvePendingAbility(cid, action.targetRow, action.targetLane); break;
        case 'end_turn': res = engine.endTurn(cid); break;
      }
      if (res && res.error) engine.endTurn(cid);
    }

    let winnerId = engine.gameState.winner;
    if (!winnerId) {
      const p1 = engine.gameState.players['p1'], p2 = engine.gameState.players['p2'];
      const d1S = p1.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
      const d2S = p2.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
      winnerId = d1S >= d2S ? 'p1' : 'p2';
    }

    if (winnerId === 'p1') redWins++; else whiteWins++;
    if (tauntByT3) tauntPlayedT3Matches++;
    if (shieldBrokeByT3) redBrokeShieldT3Matches++;
    if (tauntByT3 && shieldBrokeByT3) redBrokeShieldWhenTauntMatches++;
    totalTurns += (engine.gameState.turnNumber || 1);
  }

  console.log(`・検証試合数: ${totalMatches} 試合`);
  console.log(`・【赤単速攻】の勝率: ${(redWins/totalMatches*100).toFixed(1)}% (${redWins}勝)`);
  console.log(`・【白単挑発】の勝率: ${(whiteWins/totalMatches*100).toFixed(1)}% (${whiteWins}勝)`);
  console.log(`・平均決着ターン数: ${(totalTurns/totalMatches).toFixed(1)} ターン`);
  console.log(`・白単が3ターン目までに【挑発】の設置に成功した確率: ${(tauntPlayedT3Matches/totalMatches*100).toFixed(1)}% (${tauntPlayedT3Matches}/${totalMatches}回)`);
  console.log(`・赤単が3ターン目までにシールドを攻撃・破壊できた割合: ${(redBrokeShieldT3Matches/totalMatches*100).toFixed(1)}% (${redBrokeShieldT3Matches}/${totalMatches}回)`);
  console.log(`・白単が【挑発】を設置した際、赤単がシールド突破に成功した確率: ${tauntPlayedT3Matches>0?(redBrokeShieldWhenTauntMatches/tauntPlayedT3Matches*100).toFixed(1):0}% (${redBrokeShieldWhenTauntMatches}/${tauntPlayedT3Matches}回)`);
}

runVerification().catch(console.error);
