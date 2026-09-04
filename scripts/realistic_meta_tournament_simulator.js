// scripts/realistic_meta_tournament_simulator.js
// 現実的な主要10アーキタイプ（単色＋現実的実用ラインの2色デッキ）の最終環境シミュレーション
'use strict';

const path = require('path');
const fs   = require('fs');
const { loadAllData }  = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

const REPORT_FILE = path.join(__dirname, '../data/realistic_meta_tournament_result.json');

const DECK_RECIPES = {
  // --- 赤系 ---
  d1_red_burn: {
    name: '【赤単】全体火力バーン（覚醒軸）',
    type: '単色',
    cards: ['RE002','RE002','RE002','RE026','RE026','RE026','RE003','RE003','RE003','RE004','RE004','RE004','RE027','RE027','RE027','RE023','RE023','RE023','RE028','RE028','RE028','RE010','RE010','RE010','RE009','RE009','RE009','RE013','RE013','RE013','RE030','RE030','RE030','RE011','RE011','RE020','RE020','RE019','RE019','RE015']
  },
  d2_red_rush: {
    name: '【赤単】速攻ビートダウン',
    type: '単色',
    cards: ['RE003','RE003','RE003','RE002','RE002','RE002','RE026','RE026','RE026','RE005','RE005','RE005','RE001','RE001','RE001','RE027','RE027','RE027','RE028','RE028','RE028','RE029','RE029','RE029','RE010','RE010','RE010','RE007','RE007','RE007','RE013','RE013','RE013','RE009','RE009','RE020','RE020','RE019','RE019','RE015']
  },
  d3_red_green_rush: {
    name: '【赤緑】速攻+SP加速ラッシュ',
    type: '2色(均等4:4)',
    cards: ['RE003','RE003','RE003','RE002','RE002','RE002','GR001','GR001','GR001','GR002','GR002','GR002','RE005','RE005','RE005','GR003','GR003','GR003','GR026','GR026','GR026','RE027','RE027','RE027','GR010','GR010','GR010','GR011','GR011','GR011','RE029','RE029','RE029','GR009','GR009','GR009','RE026','RE026','RE026','RE010']
  },
  d4_green_red_ramp: {
    name: '【緑赤】SP爆加速バーン',
    type: '2色(主赤7:緑2)',
    cards: ['GR026','GR026','GR026','GR003','GR003','GR003','RE002','RE002','RE002','RE026','RE026','RE026','RE004','RE004','RE004','RE027','RE027','RE027','RE023','RE023','RE023','RE028','RE028','RE028','RE010','RE010','RE010','RE013','RE013','RE013','RE020','RE020','RE020','RE019','RE019','RE019','GR001','GR001','GR001','RE015']
  },

  // --- 緑系 ---
  d5_green_ramp: {
    name: '【緑単】SP加速overload展開（覚醒軸）',
    type: '単色',
    cards: ['GR001','GR001','GR001','GR002','GR002','GR002','GR003','GR003','GR003','GR026','GR026','GR026','GR005','GR005','GR005','GR010','GR010','GR010','GR011','GR011','GR011','GR009','GR009','GR009','GR019','GR019','GR019','GR027','GR027','GR027','GR029','GR029','GR029','GR017','GR017','GR017','GR030','GR030','GR020','GR020','GR014']
  },

  // --- 白系 ---
  d6_white_beat: {
    name: '【白単】障壁/挑発耐久ビート',
    type: '単色',
    cards: ['WH001','WH001','WH001','WH003','WH003','WH003','WH026','WH026','WH026','WH006','WH006','WH006','WH007','WH007','WH007','WH009','WH009','WH009','WH011','WH011','WH011','WH025','WH025','WH025','WH014','WH014','WH014','WH021','WH021','WH021','WH027','WH027','WH027','WH019','WH019','WH019','WH030','WH030','WH020','WH020']
  },
  d7_white_legacy: {
    name: '【白単】遺言+沈黙妨害（覚醒軸）',
    type: '単色',
    cards: ['WH001','WH001','WH001','WH002','WH002','WH002','WH026','WH026','WH026','WH004','WH004','WH004','WH003','WH003','WH003','WH007','WH007','WH007','WH010','WH010','WH010','WH011','WH011','WH011','WH028','WH028','WH028','WH021','WH021','WH021','WH029','WH029','WH029','WH019','WH019','WH019','WH030','WH030','WH018','WH018']
  },
  d8_white_blue_tempo: {
    name: '【白青】障壁バウンスビート',
    type: '2色(主白7:青2)',
    cards: ['BL024','BL024','BL024','BL027','BL027','BL027','WH001','WH001','WH001','WH004','WH004','WH004','WH003','WH003','WH003','WH006','WH006','WH006','WH007','WH007','WH007','WH009','WH009','WH009','WH011','WH011','WH011','WH025','WH025','WH025','WH021','WH021','WH021','WH026','WH026','WH030','WH030','WH030','BL026','BL026']
  },

  // --- 黒系 ---
  d9_black_revenge: {
    name: '【黒単】復讐+遺言消耗戦',
    type: '単色',
    cards: ['BK001','BK001','BK001','BK003','BK003','BK003','BK002','BK002','BK002','BK006','BK006','BK006','BK007','BK007','BK007','BK008','BK008','BK008','BK028','BK028','BK028','BK014','BK014','BK014','BK015','BK015','BK015','BK019','BK019','BK019','BK016','BK016','BK016','BK021','BK021','BK021','BK030','BK030','BK020','BK020']
  },
  d10_black_control: {
    name: '【黒単】ハンデス+除去コントロール（覚醒軸）',
    type: '単色',
    cards: ['BK001','BK001','BK001','BK002','BK002','BK002','BK027','BK027','BK027','BK004','BK004','BK004','BK005','BK005','BK005','BK008','BK008','BK008','BK010','BK010','BK010','BK024','BK024','BK024','BK019','BK019','BK019','BK026','BK026','BK026','BK021','BK021','BK021','BK029','BK029','BK029','BK030','BK030','BK018','BK018']
  },

  // --- 青系 ---
  d11_blue_control: {
    name: '【青単】バウンス/フリーズコントロール（覚醒軸）',
    type: '単色',
    cards: ['BL001','BL001','BL001','BL026','BL026','BL026','BL027','BL027','BL027','BL005','BL005','BL005','BL004','BL004','BL004','BL007','BL007','BL007','BL024','BL024','BL024','BL025','BL025','BL010','BL010','BL010','BL029','BL029','BL029','BL011','BL011','BL018','BL018','BL015','BL015','BL017','BL017','BL012','BL012','BL030']
  }
};

function selectShields(pool) {
  const dur1 = pool.filter(s => s.durability === 1);
  const dur3 = pool.filter(s => s.durability === 3);
  const dur2 = pool.filter(s => s.durability === 2);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const s1 = pick(dur1);
  const s2 = pick(dur1.filter(s => s.id !== s1?.id)) || pick(dur1);
  const s3 = pick(dur3) || pick(dur2) || pick(dur1);
  return [s1, s2, s3].filter(Boolean).map(s => s.id);
}

async function runFullTournament() {
  console.log('🔄 データロード中...');
  const gameData = await loadAllData({ sync: false });
  const shieldPool = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');

  const deckKeys = Object.keys(DECK_RECIPES);
  console.log(`\n🏆 現実的11主要アーキタイプ 環境メタトーナメント (${deckKeys.length}デッキ)`);

  const MATCHES_PER_PAIR = 50;
  const results = {};
  deckKeys.forEach(k => {
    results[k] = { wins: 0, losses: 0, total: 0, vsMap: {} };
    deckKeys.forEach(j => { results[k].vsMap[j] = { wins: 0, losses: 0, total: 0 }; });
  });

  let totalSimulated = 0;
  let firstPlayerWins = 0;
  let totalTurns = 0;

  for (let i = 0; i < deckKeys.length; i++) {
    const k1 = deckKeys[i], r1 = DECK_RECIPES[k1];
    for (let j = i; j < deckKeys.length; j++) {
      const k2 = deckKeys[j], r2 = DECK_RECIPES[k2];

      for (let m = 0; m < MATCHES_PER_PAIR; m++) {
        totalSimulated++;
        const isK1First = m % 2 === 0;
        const deck1 = [...r1.cards].sort(() => Math.random() - 0.5);
        const deck2 = [...r2.cards].sort(() => Math.random() - 0.5);

        const p1Info = { id:'p1', name:r1.name, avatar:'1', deckCardIds:deck1, shieldIds:selectShields(shieldPool), isAI:true };
        const p2Info = { id:'p2', name:r2.name, avatar:'2', deckCardIds:deck2, shieldIds:selectShields(shieldPool), isAI:true };

        const engine = new GameEngine(gameData);
        engine.log = () => {};
        const ai1 = new AIPlayer('p1', gameData.cardMap, 'hard');
        const ai2 = new AIPlayer('p2', gameData.cardMap, 'hard');
        const aiFor = id => id === 'p1' ? ai1 : ai2;

        engine.initGame(isK1First ? p1Info : p2Info, isK1First ? p2Info : p1Info);
        const firstId  = engine.gameState.playerOrder[0];
        const secondId = engine.gameState.playerOrder[1];
        engine.processMulligan(firstId,  aiFor(firstId).decideMulligan(engine.gameState.players[firstId].hand));
        engine.processMulligan(secondId, aiFor(secondId).decideMulligan(engine.gameState.players[secondId].hand));
        engine.gameState.phase = 'main';
        engine.startTurn();

        let step = 0;
        while (engine.gameState.phase !== 'game_over' && step < 250) {
          step++;
          const phase = engine.gameState.phase;
          if (phase === 'shield_break_anim') { engine.resolvePendingShieldBreak(); continue; }

          let cid = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
          if (phase === 'targeting' && engine.gameState.pendingAbilitySource) {
            cid = engine.gameState.pendingAbilitySource.ownerId || cid;
          }

          const action = aiFor(cid).decideNextAction(engine.getPlayerView(cid));
          if (!action) { engine.endTurn(cid); continue; }

          let res;
          switch (action.type) {
            case 'raise_tribe':   res = engine.raiseTribeLevel(cid, action.color); break;
            case 'play_card':     res = engine.playCard(cid, action.handIndex, action.targetRow, action.targetLane); break;
            case 'attack':        res = engine.attackWithUnit(cid, action.attackerRow, action.attackerLane, action.targetInfo); break;
            case 'select_target': res = engine.resolvePendingAbility(cid, action.targetRow, action.targetLane); break;
            case 'end_turn':      res = engine.endTurn(cid); break;
            default: res = { error: 'unknown' };
          }
          if (res?.error) engine.endTurn(cid);
        }

        let winnerId = engine.gameState.winner;
        if (!winnerId) {
          const p1 = engine.gameState.players['p1'], p2 = engine.gameState.players['p2'];
          const d1 = p1.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
          const d2 = p2.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
          winnerId = d1 >= d2 ? 'p1' : 'p2';
        }

        if (winnerId === firstId) firstPlayerWins++;
        totalTurns += (engine.gameState.turnNumber || 1);

        results[k1].total++;  results[k2].total++;
        results[k1].vsMap[k2].total++;  results[k2].vsMap[k1].total++;

        const winKey = winnerId === 'p1' ? k1 : k2;
        const losKey = winnerId === 'p1' ? k2 : k1;
        results[winKey].wins++;  results[losKey].losses++;
        results[winKey].vsMap[losKey].wins++;  results[losKey].vsMap[winKey].losses++;
      }
    }
    process.stdout.write(`  [${i+1}/${deckKeys.length}] ${r1.name} 完了\n`);
  }

  const archetypes = deckKeys.map(key => {
    const r = results[key], recipe = DECK_RECIPES[key];
    const matchups = {};
    deckKeys.forEach(opp => {
      const v = r.vsMap[opp];
      if (v.total > 0) {
        matchups[opp] = {
          oppName: DECK_RECIPES[opp].name,
          wins:v.wins, losses:v.losses, total:v.total,
          winRateNum: parseFloat((v.wins/v.total*100).toFixed(1)),
          winRate: (v.wins/v.total*100).toFixed(1)+'%'
        };
      }
    });
    return {
      id: key, name: recipe.name, type: recipe.type,
      winRateNum: parseFloat((r.wins/r.total*100).toFixed(1)),
      winRate: (r.wins/r.total*100).toFixed(1)+'%',
      wins: r.wins, losses: r.losses, total: r.total, matchups
    };
  }).sort((a,b)=>b.winRateNum - a.winRateNum);

  const output = {
    simulatedAt: new Date().toISOString(),
    totalMatches: totalSimulated,
    firstPlayerWinRate: (firstPlayerWins/totalSimulated*100).toFixed(1)+'%',
    avgTurnLength: (totalTurns/totalSimulated).toFixed(1),
    archetypes
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(output,null,2),'utf8');
  console.log(`\n✅ 完了: ${REPORT_FILE}`);
}

runFullTournament().catch(console.error);
