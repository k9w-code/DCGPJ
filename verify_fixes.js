const fs = require('fs');
const path = require('path');
const GameEngine = require('./game/GameEngine');

// データのロード
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

const rawCards = parseTsv(path.join(__dirname, './data/cards_updated.tsv'));
const cardMap = {};
rawCards.forEach(c => {
  c.cost = parseInt(c.cost);
  c.attack = parseInt(c.atk);
  c.hp = parseInt(c.life);
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

const gameData = { cardMap, cards: Object.values(cardMap), shields: [], keywordMap: {} };

async function verify() {
  console.log('🧪 最終検証開始...');
  const engine = new GameEngine(gameData);
  
  // テスト用初期化
  const p1 = { id: 'p1', name: 'Player', deck: [], hand: [], board: {front:[null,null,null], back:[null,null,null]}, shieldIds: [], sp: 10, tribeLevels: {white: 10, red: 10, blue: 10, green: 10, black: 10}, graveyard: [], isAI: false, avatar: 'AV001' };
  const p2 = { id: 'p2', name: 'Opponent', deck: [], hand: [], board: {front:[null,null,null], back:[null,null,null]}, shieldIds: [], sp: 10, tribeLevels: {white: 10, red: 10, blue: 10, green: 10, black: 10}, graveyard: [], isAI: false, avatar: 'AV002' };
  engine.gameState = {
    gameId: 'test',
    players: { p1, p2 },
    playerOrder: ['p1', 'p2'],
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: 'main',
    winner: null,
    logs: []
  };
  
  // --- 検証1: アーク(on_play)の場所選択要求 ---
  console.log('\n--- 検証1: アーク(on_play)の召喚場所選択 ---');
  p1.hand = [cardMap['WH005']];
  engine.playCard('p1', 0, 'front', 1);
  if (engine.gameState.phase === 'targeting' && engine.gameState.pendingAbilitySource) {
    console.log('✅ 成功: アーク(on_play)でターゲット（召喚場所）の選択が要求されました。');
  } else {
    console.log(`❌ 失敗: アーク(on_play)で場所選択が要求されませんでした。(Phase: ${engine.gameState.phase})`);
  }

  // --- 検証2: 死亡時(on_death)の場所選択要求 ---
  console.log('\n--- 検証2: 死亡時(on_death)の場所選択要求 ---');
  engine.gameState.phase = 'main';
  engine.gameState.pendingAbilitySource = null;
  engine.gameState.pendingAbility = null;
  
  const dyingUnit = { 
    instanceId: 'dying-unit-001', 
    name: 'Dying Unit',
    abilities: [{ trigger: 'on_death', effect: 'summon_token', value: 'T001' }],
    currentHp: 1,
    maxHp: 5,
    currentAttack: 1,
    canAttack: true, // 攻撃可能にする
    hasActed: false,
    ownerId: 'p1',
    keywords: [],
    modifiers: []
  };
  
  p1.board['front'][0] = dyingUnit;
  p2.board['front'][0] = { instanceId: 'enemy-1', name: 'Enemy', currentAttack: 2, currentHp: 5, maxHp: 5, ownerId: 'p2', keywords: [], canAttack: true, hasActed: false, modifiers: [] };
  
  console.log('ユニットを攻撃させて死亡させます...');
  engine.attackWithUnit('p1', 'front', 0, { type: 'unit', row: 'front', lane: 0 });
  
  if (engine.gameState.phase === 'targeting' && engine.gameState.pendingAbilitySource) {
    console.log('✅ 成功: 死亡時(on_death)トリガーでもターゲット選択が要求されました！');
  } else {
    console.log(`❌ 失敗: 死亡時トリガーでターゲット選択が発生しませんでした。(Phase: ${engine.gameState.phase})`);
  }

  // --- 検証3: 戦闘の同時ダメージ（相打ち） ---
  console.log('\n--- 検証3: 戦闘の同時ダメージ（相打ち） ---');
  engine.gameState.phase = 'main';
  engine.gameState.pendingAbilitySource = null;
  engine.gameState.pendingAbility = null;

  const attacker = { instanceId: 'atk-1', name: 'Atk', currentHp: 5, maxHp: 5, currentAttack: 3, ownerId: 'p1', keywords: [], canAttack: true, hasActed: false, modifiers: [] };
  const defender = { instanceId: 'def-1', name: 'Def', currentHp: 5, maxHp: 5, currentAttack: 2, ownerId: 'p2', keywords: [], canAttack: true, hasActed: false, modifiers: [] };
  
  p1.board['front'][1] = attacker;
  p2.board['front'][1] = defender;
  
  console.log(`戦闘前: アタッカーHP=${attacker.currentHp}, ディフェンダーHP=${defender.currentHp}`);
  engine.attackWithUnit('p1', 'front', 1, { type: 'unit', row: 'front', lane: 1 });
  
  if (attacker.currentHp === 3 && defender.currentHp === 2) {
    console.log(`✅ 成功: お互いにダメージを受けました。(アタッカー: ${attacker.currentHp}, ディフェンダー: ${defender.currentHp})`);
  } else {
    console.log(`❌ 失敗: ダメージ計算が不正です。(アタッカー: ${attacker.currentHp}, ディフェンダー: ${defender.currentHp})`);
  }

  console.log('\n✨ 全検証完了。');
}

verify().catch(console.error);
