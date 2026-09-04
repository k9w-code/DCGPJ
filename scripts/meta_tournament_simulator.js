// scripts/meta_tournament_simulator.js v5
// 【覚醒:7】の神族レベル到達とシールドスキル多様性を担保した確定シミュレーション
'use strict';
const path = require('path');
const fs   = require('fs');
const { loadAllData }  = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

const REPORT_FILE = path.join(__dirname, '../data/meta_tournament_result.json');

// ─── 固定デッキレシピ（すべて basicプールのカードIDのみ・各40枚）───────────────
// 【覚醒】持ち（RE004, RE023, BL004, BK005, WH004, GR005, GR027）が入っているデッキには
// 神族レベル7到達に見合う強力な7コストカード（RE019, RE020, BL012, BK021, WH021, GR021等）を組み込みシナジーを担保
const DECK_RECIPES = {
  red_rush: {
    name: '【赤単】速攻ビート',
    concept: '速攻ユニットで序盤を制圧し、damage呪文・連鎖バフで圧力をかけ続けるアグロデッキ',
    cards: [
      'RE003','RE003','RE003', // 宵闇の暗殺者 cost1 速攻
      'RE002','RE002','RE002', // 荒野の斥候 cost1 遺言
      'RE026','RE026','RE026', // 灼熱の刃 cost1 spell
      'RE005','RE005','RE005', // 鉄拳の闘士 cost2 速攻
      'RE001','RE001','RE001', // 炎熱の魔導士 cost2 damage
      'RE024','RE024','RE024', // 残火の楽士 cost2 連鎖/buff_attack
      'RE006','RE006',         // お転婆な看板娘 cost2 連鎖/draw
      'RE027','RE027','RE027', // 轟雷の魔導士 cost3 damage
      'RE017','RE017','RE017', // 紅花の若武者 cost3 潜伏
      'RE028','RE028','RE028', // 灼熱の竜巻 cost3 spell/damage
      'RE010','RE010',         // 戦旗の防人 cost3 draw
      'RE029','RE029','RE029', // 紅蓮の速槍ツバキ cost4 速攻+攻城
      'RE009','RE009',         // 月夜の狩人 cost4 狙撃
      'RE012','RE012',         // 蒼の令嬢カサンドラ cost4 連鎖/buff_attack_all
      'RE007','RE007',         // 紅蓮の重装騎士 cost4 挑発+遺言
    ]
  },
  red_burn: {
    name: '【赤単】全体火力バーン（覚醒軸）',
    concept: '神族レベル7へ伸ばして【覚醒:火】(焔の皇女/業火の術師)を解禁し、全体火力と7コスト重騎士で制圧',
    cards: ['RE002','RE002','RE002','RE026','RE026','RE026','RE003','RE003','RE003','RE004','RE004','RE004','RE027','RE027','RE027','RE023','RE023','RE023','RE028','RE028','RE028','RE010','RE010','RE010','RE009','RE009','RE009','RE013','RE013','RE013','RE030','RE030','RE030','RE011','RE011','RE020','RE020','RE019','RE019','RE015']
  },
  blue_control: {
    name: '【青単】バウンス/フリーズコントロール（覚醒軸）',
    concept: '星読みの少女の【覚醒:水7】バウンスと高コストフリーズ・呪文で相手を縛り上げるコントロール',
    cards: ['BL001','BL001','BL001','BL026','BL026','BL026','BL027','BL027','BL027','BL005','BL005','BL005','BL004','BL004','BL004','BL007','BL007','BL007','BL024','BL024','BL024','BL025','BL025','BL010','BL010','BL010','BL029','BL029','BL029','BL011','BL011','BL018','BL018','BL015','BL015','BL017','BL017','BL012','BL012','BL030']
  },
  blue_resonance: {
    name: '【青単】共鳴呪文コンボ',
    concept: '呪文連打で共鳴ユニットを急成長させ、大提督メリディス等の高コストで押し切るコンボ',
    cards: ['BL027','BL027','BL027','BL026','BL026','BL026','BL001','BL001','BL001','BL003','BL003','BL003','BL005','BL005','BL005','BL006','BL006','BL006','BL009','BL009','BL009','BL024','BL024','BL024','BL013','BL013','BL029','BL029','BL029','BL014','BL014','BL022','BL022','BL012','BL012','BL023','BL023','BL030','BL025','BL025']
  },
  green_ramp: {
    name: '【緑単】SP加速overload展開（覚醒軸）',
    concept: '豊穣の舞・風駆けの乙女でSPを爆速で溜めて神族レベル7に到達。戦場の吟遊詩人の【覚醒:地7】バフと大型で圧殺',
    cards: ['GR001','GR001','GR001','GR002','GR002','GR002','GR003','GR003','GR003','GR005','GR005','GR005','GR026','GR026','GR026','GR010','GR010','GR010','GR011','GR011','GR011','GR012','GR012','GR012','GR009','GR009','GR009','GR027','GR027','GR020','GR020','GR019','GR019','GR021','GR021','GR015','GR015','GR022','GR030','GR006']
  },
  white_beat: {
    name: '【白単】障壁/挑発耐久ビート',
    concept: '障壁・挑発で前列を強固に保ちつつバフで打点を底上げし、中盤以降に大型竜騎士で圧殺',
    cards: [
      'WH001','WH001','WH001', // 聖都の見習い剣士 cost1
      'WH003','WH003','WH003', // 光の盾兵 cost2 障壁
      'WH005','WH005','WH005', // 修道院の護り手 cost2 buff_hp
      'WH006','WH006','WH006', // 聖鎖の騎士 cost2 buff_attack
      'WH030','WH030','WH030', // 信仰の盾 cost2 障壁付与
      'WH007','WH007','WH007', // 不壊の騎士 cost3 挑発+障壁
      'WH008','WH008','WH008', // 獅子心王の騎士 cost3 buff_hp
      'WH009','WH009','WH009', // 銀翼の騎士 cost3 buff_attack
      'WH010','WH010',         // 紅の乙女 cost3
      'WH025','WH025','WH025', // 聖都の竜騎士 cost5 挑発/全体ATKバフ
      'WH024','WH024',         // 眩耀の貴族 cost5 障壁/全体HPバフ
      'WH014','WH014',         // 天弓の天使 cost5 狙撃+魔盾
      'WH017','WH017',         // 聖都の司教 cost6 敵最狂破壊
      'WH015','WH015',         // 裁きの聖女 cost5
      'WH026',                 // 黎明の創世竜ルミナリア cost9
      'WH018','WH018',         // 聖都の祈祷師 cost6
    ]
  },
  white_legacy: {
    name: '【白単】遺言+沈黙妨害（覚醒軸）',
    concept: '教会の守護騎士の遺言や聖域の戦乙女の沈黙で妨害し、聖都の天騎士の【覚醒:光7】で盤面崩壊を起こす',
    cards: [
      'WH001','WH001','WH001', // 聖都の見習い剣士 cost1
      'WH004','WH004','WH004', // 聖都の天騎士 cost2 【覚醒:光7】最弱敵破壊
      'WH006','WH006','WH006', // 聖鎖の騎士 cost2
      'WH030','WH030','WH030', // 信仰の盾 cost2
      'WH010','WH010','WH010', // 紅の乙女 cost3
      'WH028','WH028','WH028', // 浄化の剣 cost3
      'WH011','WH011','WH011', // 聖域の戦乙女 cost4 沈黙
      'WH012','WH012','WH012', // 教会の守護騎士 cost4 挑発+遺言
      'WH029','WH029','WH029', // 聖域展開 cost4
      'WH016','WH016','WH016', // 聖剣の継承者 cost5 遺言
      'WH014','WH014',         // 天弓の天使 cost5
      'WH017','WH017',         // 聖都の司教 cost6
      'WH021','WH021','WH021', // 神人の騎士スフィア cost7 挑発+遺言 (覚醒用コスト7)
      'WH020','WH020',         // 聖法王の代行者 cost7 遺言/SP+2 (覚醒用コスト7)
      'WH026',                 // 黎明の創世竜ルミナリア cost9
    ]
  },
  black_control: {
    name: '【黒単】ハンデス+除去コントロール（覚醒軸）',
    concept: '路地裏の暗殺者の【覚醒:闇7】最弱破壊と夜の魔女のハンデス・呪文除去で相手の手札と盤面を削り尽くす',
    cards: [
      'BK001','BK001','BK001', // 嘲笑う霊魂 cost1 遺言/SP削り
      'BK003','BK003','BK003', // 急襲する霊魂 cost1 速攻
      'BK004','BK004','BK004', // 夜の魔女 cost2 ハンデス
      'BK005','BK005','BK005', // 路地裏の暗殺者 cost2 【覚醒:闇7】最弱敵破壊
      'BK006','BK006','BK006', // 影縫いの魔導士 cost2 遺言
      'BK010','BK010','BK010', // 屋根伝いの妖魔 cost3
      'BK024','BK024','BK024', // 廃都の魔王 cost3 ハンデス
      'BK008','BK008','BK008', // 影の執行人 cost3 必殺
      'BK019','BK019','BK019', // 暗黒の騎士 cost4 最弱敵破壊
      'BK026','BK026','BK026', // 深淵への誘い cost4 ハンデス
      'BK028','BK028','BK028', // 魂の昇華 cost4 破壊
      'BK014','BK014',         // 黒鎧の重装兵 cost4 挑発+遺言
      'BK021','BK021',         // 古代の剣姫 cost7 速攻+トークン召喚 (覚醒用コスト7)
      'BK018','BK018',         // 断罪者オーギュスト cost6 破壊
      'BK030',                 // 終焉の黒龍ファフニール cost9
    ]
  },
  black_grind: {
    name: '【黒単】復讐+遺言消耗戦',
    concept: '復讐/遺言の粘り強いゾンビ性能で損害を打ち消し、腐敗ダメージでじわじわ追い詰める消耗型',
    cards: [
      'BK001','BK001','BK001', // 嘲笑う霊魂 cost1
      'BK003','BK003','BK003', // 急襲する霊魂 cost1 速攻
      'BK006','BK006','BK006', // 影縫いの魔導士 cost2 遺言
      'BK002','BK002','BK002', // 月光に呪われた戦士 cost2 腐敗
      'BK007','BK007','BK007', // 燃える骸骨兵 cost3 復讐
      'BK009','BK009','BK009', // 狂乱の合成魔獣 cost3 腐敗
      'BK010','BK010','BK010', // 屋根伝いの妖魔 cost3
      'BK013','BK013','BK013', // 呪詛を秘めし槍使い cost4 腐敗+復讐
      'BK014','BK014','BK014', // 黒鎧の重装兵 cost4 挑発+遺言
      'BK016','BK016',         // 紫炎の呪術師 cost5 復讐
      'BK017','BK017',         // 漆黒の魔剣士 cost5 速攻+遺言
      'BK022','BK022',         // 奈落に舞う泡沫 cost7 挑発+遺言/全敵2点
      'BK020','BK020',         // 白銀の処刑刃 cost6 忍耐+攻城
      'BK011','BK011',         // 剣の夜叉 cost4 忍耐
      'BK030',                 // 終焉の黒龍ファフニール cost9
      'BK025',                 // 邪教の儀式 cost2
      'BK027',                 // 存在を喰らう影 cost2
    ]
  },
  red_green: {
    name: '【赤緑】速攻+SP加速ラッシュ',
    concept: '赤の速攻と緑のSP加速を合体させ、早期に攻城ユニットや高コスト即死ダメージを叩き込む',
    cards: [
      'RE003','RE003','RE003', // 宵闇の暗殺者 cost1 速攻
      'RE002','RE002','RE002', // 荒野の斥候 cost1
      'GR001','GR001','GR001', // 森の修行僧 cost1
      'GR002','GR002','GR002', // 霊峰の拳士 cost1 超過
      'RE005','RE005','RE005', // 鉄拳の闘士 cost2 速攻
      'GR003','GR003','GR003', // 森の弓兵 cost2 遺言/SP+1
      'GR026','GR026','GR026', // 豊穣の舞 cost2 SP+2
      'RE027','RE027','RE027', // 轟雷の魔導士 cost3
      'GR010','GR010','GR010', // 風駆けの乙女 cost3 SP+1
      'GR011','GR011',         // 妖精の盾騎士 cost3 挑発
      'RE029','RE029',         // 紅蓮の速槍ツバキ cost4 速攻+攻城
      'GR009','GR009',         // 深緑の剣士 cost4 超過
      'RE013','RE013',         // 煉獄の骸将 cost5 全敵1点
      'GR020','GR020',         // 翡翠の姫リーチェ cost5 狙撃/SP+1
      'RE025',                 // 原初の炎神ヴェスタ cost9 フィニッシャー
      'RE026','RE026',         // 灼熱の刃 cost1
    ]
  },
  blue_white: {
    name: '【青白】共鳴+障壁妨害コントロール',
    concept: '青呪文で共鳴をバフしつつ白の障壁/沈黙で完全に足止めし、後半の創世竜・巨龍で安全に勝つ',
    cards: [
      'BL027','BL027','BL027', // 黄金の旋律 cost1
      'BL026','BL026','BL026', // 蒼炎の剣 cost1
      'BL003','BL003','BL003', // 海底神殿の舞姫 cost2 共鳴
      'WH003','WH003','WH003', // 光の盾兵 cost2 障壁
      'WH030','WH030','WH030', // 信仰の盾 cost2 障壁付与
      'BL006','BL006','BL006', // 紫翼の魔導剣士 cost3 共鳴
      'BL009','BL009','BL009', // 盾鱗の人魚 cost3 挑発+共鳴
      'BL024','BL024','BL024', // 嵐の波濤 cost3 バウンス
      'WH007','WH007',         // 不壊の騎士 cost3 挑発+障壁
      'WH011','WH011',         // 聖域の戦乙女 cost4 沈黙
      'BL029','BL029',         // 破滅の大洪水 cost4
      'BL014','BL014',         // 深海の歌姫 cost5 共鳴
      'WH014','WH014',         // 天弓の天使 cost5 狙撃+魔盾
      'BL022','BL022',         // 大海原の命令 cost5
      'BL030',                 // 深海蒼龍レヴァイア cost9
      'WH026',                 // 黎明の創世竜ルミナリア cost9
      'BL025','BL025',         // 海底遺跡の人魚 cost3
    ]
  },
};

// シールド選択（全19種から耐久 1-1-3 を多様に選定）
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

async function runTournament() {
  console.log('🔄 データロード中...');
  const gameData = await loadAllData({ sync: false });
  const shieldPool = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');

  const deckKeys = Object.keys(DECK_RECIPES);
  console.log(`\n📦 カードプール: basicのみ / 🎴 シールド: 耐久1-1-3ランダム(全19種) / 🏆 アーキタイプ: ${deckKeys.length}`);

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

  const MATCHES_PER_PAIR = 50;

  const results = {};
  deckKeys.forEach(k => {
    results[k] = { wins: 0, losses: 0, total: 0, vsMap: {} };
    deckKeys.forEach(j => { results[k].vsMap[j] = { wins: 0, losses: 0, total: 0 }; });
  });

  let totalSimulated = 0, firstPlayerWins = 0, totalTurnsSum = 0, maxTurnGame = 0, stepTimeouts = 0;
  const cardUsageWins = {}, cardUsageTotal = {};

  console.log(`\n▶ シミュレーション開始 (${MATCHES_PER_PAIR}試合/ペア, 合計${Math.ceil(deckKeys.length*(deckKeys.length+1)/2)*MATCHES_PER_PAIR}試合)`);

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
        if (step >= 3000) stepTimeouts++;

        let winnerId = engine.gameState.winner;
        if (!winnerId) {
          const p1 = engine.gameState.players['p1'], p2 = engine.gameState.players['p2'];
          const d1 = p1.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
          const d2 = p2.shields.reduce((s,sh)=>s+(sh.destroyed?0:(sh.currentDurability||0)),0);
          winnerId = d1 >= d2 ? 'p1' : 'p2';
        }

        const tc = engine.gameState.turnNumber || 0;
        totalTurnsSum += tc;
        if (tc > maxTurnGame) maxTurnGame = tc;
        if (winnerId === firstId) firstPlayerWins++;

        results[k1].total++;  results[k2].total++;
        results[k1].vsMap[k2].total++;  results[k2].vsMap[k1].total++;

        const winKey = winnerId === 'p1' ? k1 : k2;
        const losKey = winnerId === 'p1' ? k2 : k1;
        const winDeck = winnerId === 'p1' ? deck1 : deck2;
        results[winKey].wins++;  results[losKey].losses++;
        results[winKey].vsMap[losKey].wins++;  results[losKey].vsMap[winKey].losses++;
        winDeck.forEach(id => { cardUsageWins[id] = (cardUsageWins[id]||0)+1; });
        deck1.forEach(id => { cardUsageTotal[id] = (cardUsageTotal[id]||0)+1; });
        deck2.forEach(id => { cardUsageTotal[id] = (cardUsageTotal[id]||0)+1; });
      }
    }
    process.stdout.write(`  [${i+1}/${deckKeys.length}] ${r1.name} 完了\n`);
  }

  const cardStats = Object.keys(cardUsageTotal)
    .filter(id => cardUsageTotal[id] >= 20)
    .map(id => {
      const c = gameData.cardMap[id];
      if (!c) return null;
      return { id, name:c.name, color:c.color, type:c.type, cost:c.cost,
        winRate: ((cardUsageWins[id]||0)/cardUsageTotal[id]*100).toFixed(1),
        total: cardUsageTotal[id] };
    }).filter(Boolean).sort((a,b)=>parseFloat(b.winRate)-parseFloat(a.winRate));

  const archetypes = deckKeys.map(key => {
    const r = results[key], recipe = DECK_RECIPES[key];
    const counts = {};
    recipe.cards.forEach(id => { counts[id] = (counts[id]||0)+1; });
    const deckList = Object.entries(counts)
      .map(([id,cnt]) => { const c=gameData.cardMap[id]; return {id,name:c?.name||id,cost:c?.cost||0,type:c?.type||'',count:cnt}; })
      .sort((a,b)=>a.cost-b.cost || a.name.localeCompare(b.name));

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
      wins:r.wins, losses:r.losses, total:r.total,
      deckList, matchups };
  }).sort((a,b)=>parseFloat(b.winRate)-parseFloat(a.winRate));

  const output = {
    simulatedAt: new Date().toISOString(),
    totalMatches: totalSimulated, stepTimeouts,
    firstPlayerWinRate: (firstPlayerWins/totalSimulated*100).toFixed(1)+'%',
    avgTurnLength: (totalTurnsSum/totalSimulated).toFixed(1),
    maxTurnLength: maxTurnGame,
    matchesPerPair: MATCHES_PER_PAIR,
    archetypes, topCards:cardStats.slice(0,15), bottomCards:cardStats.slice(-10).reverse()
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(output,null,2),'utf8');
  console.log(`\n✅ 完了: ${REPORT_FILE}`);
}

runTournament().catch(console.error);
