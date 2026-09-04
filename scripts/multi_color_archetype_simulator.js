// scripts/multi_color_archetype_simulator.js
// 2色デッキの様々な設計パターン（均等低コスト型 vs 主副タッチ型）をシミュレーション検証
'use strict';

const path = require('path');
const fs   = require('fs');
const { loadAllData }  = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

const REPORT_FILE = path.join(__dirname, '../data/multi_color_analysis_result.json');

// ─── 2色アーキタイプの多様なレシピ設計 (各40枚) ──────────────────────────────────────────
const DECK_RECIPES = {
  // ■ 均等低コスト型 (レベル4〜5以下で組むアグロ・テンポ)
  red_green_aggro: {
    name: '【赤緑】速攻SPラッシュ (均等低コスト4:4)',
    concept: '赤の1-2コスト速攻と緑のSP加速を均等4レベルまで上げ、最速でシールドを砕くアグロ型',
    cards: ['RE003','RE003','RE003','RE002','RE002','RE002','GR001','GR001','GR001','GR002','GR002','GR002','RE005','RE005','RE005','GR003','GR003','GR003','GR026','GR026','GR026','RE027','RE027','RE027','GR010','GR010','GR010','GR011','GR011','GR011','RE029','RE029','RE029','GR009','GR009','GR009','RE026','RE026','RE026','RE010']
  },
  red_black_aggro: {
    name: '【赤黒】火炎復讐アグロ (均等低コスト4:4)',
    concept: '赤の速攻・火力と黒の遺言・ハンデスを低コスト帯（レベル4以下）で組み合わせたアグロ型',
    cards: ['RE003','RE003','RE003','BK001','BK001','BK001','BK003','BK003','BK003','RE026','RE026','RE026','RE005','RE005','RE005','BK004','BK004','BK004','BK006','BK006','BK006','RE027','RE027','RE027','RE028','RE028','RE028','BK008','BK008','BK008','RE029','RE029','RE029','BK014','BK014','BK014','RE001','RE001','RE001','BK010']
  },

  // ■ 主色＋副色タッチ型 (主色レベル7＋副色レベル2) ★本命の可能性調査★
  blue_black_control: {
    name: '【青黒】バウンスハンデス (黒主軸7 : 青タッチ2)',
    concept: '青の2コストバウンス(嵐の波濤)で敵を手札に戻し、黒のハンデス(夜の魔女/深淵への誘い)で即叩き落とす確定消滅コンボ型',
    cards: ['BL024','BL024','BL024','BL027','BL027','BL027','BL026','BL026','BL026','BK001','BK001','BK001','BK004','BK004','BK004','BK005','BK005','BK005','BK008','BK008','BK008','BK010','BK010','BK010','BK024','BK024','BK024','BK019','BK019','BK019','BK026','BK026','BK026','BK021','BK021','BK021','BK030','BK030','BK014','BK014']
  },
  white_blue_tempo: {
    name: '【白青】障壁バウンスビート (白主軸7 : 青タッチ2)',
    concept: '白の障壁・挑発・覚醒7で前列を固めつつ、青の2コストバウンス(嵐の波濤)で相手のブロッカーを弾いて顔を叩くテンポ型',
    cards: ['BL024','BL024','BL024','BL027','BL027','BL027','WH001','WH001','WH001','WH004','WH004','WH004','WH003','WH003','WH003','WH006','WH006','WH006','WH007','WH007','WH007','WH009','WH009','WH009','WH011','WH011','WH011','WH025','WH025','WH025','WH021','WH021','WH021','WH026','WH026','WH030','WH030','WH030','BL026','BL026']
  },
  green_red_ramp: {
    name: '【緑赤】SP爆加速バーン (赤主軸7 : 緑タッチ2)',
    concept: '緑の2コストSP加速(豊穣の舞/森の弓兵)でSPを爆速確保し、赤の神族レベル7覚醒(焔の皇女/業火/冥騎士)を早期着地させる型',
    cards: ['GR026','GR026','GR026','GR003','GR003','GR003','RE002','RE002','RE002','RE026','RE026','RE026','RE004','RE004','RE004','RE027','RE027','RE027','RE023','RE023','RE023','RE028','RE028','RE028','RE010','RE010','RE010','RE013','RE013','RE013','RE020','RE020','RE020','RE019','RE019','RE019','GR001','GR001','GR001','RE015']
  },

  // ■ 比較用の単色メタ代表デッキ
  red_burn_mono: {
    name: '【赤単】全体火力バーン (環境王者)',
    concept: '単色レベル7覚醒バーン',
    cards: ['RE002','RE002','RE002','RE026','RE026','RE026','RE003','RE003','RE003','RE004','RE004','RE004','RE027','RE027','RE027','RE023','RE023','RE023','RE028','RE028','RE028','RE010','RE010','RE010','RE009','RE009','RE009','RE013','RE013','RE013','RE030','RE030','RE030','RE011','RE011','RE020','RE020','RE019','RE019','RE015']
  },
  blue_control_mono: {
    name: '【青単】バウンスコントロール',
    concept: '単色レベル7覚醒バウンス',
    cards: ['BL001','BL001','BL001','BL026','BL026','BL026','BL027','BL027','BL027','BL005','BL005','BL005','BL004','BL004','BL004','BL007','BL007','BL007','BL024','BL024','BL024','BL025','BL025','BL010','BL010','BL010','BL029','BL029','BL029','BL011','BL011','BL018','BL018','BL015','BL015','BL017','BL017','BL012','BL012','BL030']
  },
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

async function runAnalysis() {
  console.log('🔄 データロード中...');
  const gameData = await loadAllData({ sync: false });
  const shieldPool = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');

  const deckKeys = Object.keys(DECK_RECIPES);
  console.log(`\n📦 2色アーキタイプ調査シミュレーション (${deckKeys.length}デッキ)`);

  let validationOk = true;
  for (const key of deckKeys) {
    const r = DECK_RECIPES[key];
    if (r.cards.length !== 40) {
      console.error(`❌ "${r.name}": ${r.cards.length}枚 (40枚必要)`);
      validationOk = false;
    }
    for (const id of r.cards) {
      if (!gameData.cardMap[id]) {
        console.error(`❌ "${r.name}": 存在しないID "${id}"`);
        validationOk = false;
      }
    }
    if (validationOk) console.log(`  ✓ ${r.name} (40枚)`);
  }
  if (!validationOk) process.exit(1);

  const MATCHES_PER_PAIR = 60;
  const results = {};
  deckKeys.forEach(k => {
    results[k] = { wins: 0, losses: 0, total: 0, vsMap: {} };
    deckKeys.forEach(j => { results[k].vsMap[j] = { wins: 0, losses: 0, total: 0 }; });
  });

  let totalSimulated = 0;

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
        while (engine.gameState.phase !== 'game_over' && step < 3000) {
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
          winRate: (v.wins/v.total*100).toFixed(1)+'%'
        };
      }
    });
    return { id:key, name:recipe.name, concept:recipe.concept,
      winRate:(r.wins/r.total*100).toFixed(1)+'%',
      wins:r.wins, losses:r.losses, total:r.total, matchups };
  }).sort((a,b)=>parseFloat(b.winRate)-parseFloat(a.winRate));

  const output = {
    simulatedAt: new Date().toISOString(),
    totalMatches: totalSimulated,
    archetypes
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(output,null,2),'utf8');
  console.log(`\n✅ 完了: ${REPORT_FILE}`);
}

runAnalysis().catch(console.error);
