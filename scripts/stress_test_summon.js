const { runFullMatch, cardMap } = require('./match_simulator');

async function runStressTest(iterations = 50) {
  console.log(`🚀 召喚機能 50連戦ストレス試験開始 (${iterations}回)...`);
  
  // マスタの確認
  if (cardMap['WH005']) {
    console.log('✅ マスタ確認: WH005 (アーク) は正常にロードされています。');
    console.log('   能力:', cardMap['WH005'].abilityEffect, '値:', cardMap['WH005'].abilityValue);
  } else {
    console.error('❌ エラー: マスタに WH005 が見当たりません！');
    return;
  }

  let totalSummons = 0;
  let totalErrors = 0;
  let matchesCompleted = 0;
  let winA = 0;
  let winB = 0;

  // 強制的に WH005 のみの「召喚特化デッキ」を作成
  const createTestDeck = () => {
    const deck = [];
    while(deck.length < 30) deck.push('WH005');
    return deck;
  };

  const testShields = ['S001', 'S002', 'S003', 'S011', 'S020'];

  for (let i = 1; i <= iterations; i++) {
    try {
      const deckA = createTestDeck('white');
      const deckB = createTestDeck('red');
      
      const result = runFullMatch(deckA, deckB, testShields);
      
      // ログから召喚成功をカウント
      const summonLogs = result.logs.filter(l => l.includes('を召喚'));
      totalSummons += summonLogs.length;

      matchesCompleted++;
      if (result.winnerName === 'Player_A') winA++;
      else winB++;

      if (i % 10 === 0) {
        console.log(`  Progress: ${i}/${iterations} matches done. Current Summons: ${totalSummons}`);
      }
    } catch (err) {
      console.error(`  ❌ Match ${i} failed:`, err.message);
      totalErrors++;
    }
  }

  console.log(`\n========================================`);
  console.log(`🏁 検証完了レポート`);
  console.log(`----------------------------------------`);
  console.log(`✅ 完了試合数: ${matchesCompleted}`);
  console.log(`⚔️ トークン召喚総数: ${totalSummons} 回`);
  console.log(`💥 エラー発生数: ${totalErrors} 回`);
  console.log(`🏆 Player_A 勝利: ${winA} / Player_B 勝利: ${winB}`);
  console.log(`========================================\n`);

  if (totalSummons > 0 && totalErrors === 0) {
    console.log('✅ 判定: 正常（召喚機能は安定して動作しています）');
  } else if (totalErrors > 0) {
    console.log('❌ 判定: 異常（エラーが発生しました。ログを確認してください）');
  } else {
    console.log('⚠️ 判定: 検証不十分（召喚が一度も発生しませんでした）');
  }
}

runStressTest(50);
