const { runFullMatch, cardMap, shields } = require('./match_simulator');

// デッキの定義（モノカラー30枚）
const colors = ['white', 'red', 'blue', 'green', 'black'];
const prefixMap = { white: 'WH', red: 'RE', blue: 'BL', green: 'GR', black: 'BK' };

function createMonoDeck(color) {
  const prefix = prefixMap[color];
  const deck = [];
  // 各属性のID 001〜030を集める
  for (let i = 1; i <= 30; i++) {
    const id = `${prefix}${String(i).padStart(3, '0')}`;
    if (cardMap[id]) deck.push(id);
  }
  return deck;
}

// シールド構成（共通プールから戦略的に選択：D1x2, D2x2, D3x1 の構成）
const testShieldIds = [
  'S001', // 耐久3: 無し
  'S002', // 耐久1: 火炎
  'S003', // 耐久2: ドロー
  'S006', // 耐久2: SP獲得
  'S011'  // 耐久1: 凍結
];

const matchesPerPair = 20; // テストのため、まずは各20試合（合計500試合）に調整。後で増やす。
const results = {};

console.log(`🚀 バッチシミュレーション開始... (${matchesPerPair} 試合/ペア)`);

for (const p1Color of colors) {
  for (const p2Color of colors) {
    const pairKey = `${p1Color} vs ${p2Color}`;
    results[pairKey] = { p1Wins: 0, p2Wins: 0, draws: 0, totalTurns: 0 };

    process.stdout.write(`⚔️ ${pairKey} 実行中... `);

    for (let i = 0; i < matchesPerPair; i++) {
      const match = runFullMatch(createMonoDeck(p1Color), createMonoDeck(p2Color), testShieldIds);
      if (match.winner === 'p1') results[pairKey].p1Wins++;
      else if (match.winner === 'p2') results[pairKey].p2Wins++;
      else results[pairKey].draws++;
      results[pairKey].totalTurns += match.turns;
    }
    
    const winRate = ((results[pairKey].p1Wins / matchesPerPair) * 100).toFixed(1);
    const avgTurns = (results[pairKey].totalTurns / matchesPerPair).toFixed(1);
    console.log(`完了! (Win Rate: ${winRate}%, Avg Turns: ${avgTurns})`);
  }
}

// 最終レポート出力
console.log('\n================================================');
console.log('📊 バッチシミュレーション 最終レポート');
console.log('================================================');
console.log('Pair\t\t\t| Win Rate\t| Avg Turns');
console.log('------------------------------------------------');
for (const [pair, res] of Object.entries(results)) {
  const winRate = ((res.p1Wins / matchesPerPair) * 100).toFixed(1) + '%';
  const avgTurns = (res.totalTurns / matchesPerPair).toFixed(1);
  console.log(`${pair.padEnd(20)}\t| ${winRate.padEnd(8)}\t| ${avgTurns}`);
}
console.log('================================================');
