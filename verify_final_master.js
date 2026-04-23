const { loadAllData } = require('./game/DataLoader');
const { processAbility } = require('./game/AbilityProcessor');

async function test() {
  console.log('--- Verification: Final Master Data and Engine ---');
  const data = await loadAllData({ sync: false });
  const { cardMap } = data;

  // 1. DataLoader の継承ロジック確認 (BK025)
  const bk025 = cardMap['BK025'];
  console.log(`\n[1] Checking BK025 (Spell: sacrifice sequence):`);
  console.log(`  Abilities count: ${bk025.abilities.length}`);
  bk025.abilities.forEach((a, i) => {
    console.log(`  Ability ${i+1}: trigger=${a.trigger}, effect=${a.effect}, target=${a.target}`);
  });
  if (bk025.abilities.length === 2 && bk025.abilities[1].trigger === 'on_play') {
    console.log('  ✅ SUCCESS: trigger2 inherited successfully.');
  } else {
    console.log('  ❌ FAILURE: Inheritance failed.');
  }

  // 2. WH017 の自動ターゲット選別確認
  console.log(`\n[2] Checking WH017 (Unit: destroy strongest):`);
  const wh017 = cardMap['WH017'];
  const currentPlayer = { id: 'p1', board: { front: [null, null, null], back: [null, null, null] }, tribeLevels: { white: 0 } };
  const opponentPlayer = { 
    id: 'p2', 
    board: { 
      front: [
        { name: 'Weak Unit', currentAttack: 1, currentHp: 2, instanceId: 'u1', keywords: [] },
        { name: 'Strong Unit', currentAttack: 10, currentHp: 5, instanceId: 'u2', keywords: [] },
        null
      ], 
      back: [null, null, null] 
    } 
  };
  const logs = [];
  const gameState = { phase: 'main' };

  // 候補が異なる場合（自動選択）
  console.log('  Case A: Candidates have different ATK (1 vs 10)');
  const resultA = processAbility('on_play', wh017, gameState, currentPlayer, opponentPlayer, cardMap, logs);
  console.log(`  ResultA needsTarget: ${resultA.needsTarget}`);
  if (resultA.needsTarget === false && opponentPlayer.board.front[1].currentHp === 0) {
    console.log('  ✅ SUCCESS: Strongest unit was automatically destroyed.');
  } else {
    console.log('  ❌ FAILURE: Auto-destruction failed.');
  }

  // 候補が同じ場合（手動選択）
  console.log('\n  Case B: Candidates have SAME ATK (10 vs 10)');
  opponentPlayer.board.front[0].currentAttack = 10;
  opponentPlayer.board.front[1].currentHp = 5; // リセット
  const resultB = processAbility('on_play', wh017, gameState, currentPlayer, opponentPlayer, cardMap, logs);
  console.log(`  ResultB needsTarget: ${resultB.needsTarget}, targetId: ${resultB.targetId}`);
  if (resultB.needsTarget === true && resultB.targetId === 'enemy_unit_strongest') {
    console.log('  ✅ SUCCESS: User input requested for tie-break.');
  } else {
    console.log('  ❌ FAILURE: Manual targeting not requested for tie.');
  }
}

test().catch(console.error);
