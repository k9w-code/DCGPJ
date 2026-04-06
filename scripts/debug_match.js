const fs = require('fs');
const path = require('path');
const { runFullMatch, cardMap, shields } = require('./match_simulator');

// 平均コスト 4〜6 のモノカラーデッキを作成（ユーザー推奨の構成）
function createBalancedDeck(color) {
    const prefix = { white: 'WH', red: 'RE', blue: 'BL', green: 'GR', black: 'BK' }[color];
    const deck = [];
    
    // コスト分布を調整 (30枚)
    // 1-3コスト: 12枚
    // 4-6コスト: 12枚
    // 7-9コスト: 6枚
    const pool = { small: [], mid: [], large: [] };
    
    for (let i = 1; i <= 30; i++) {
        const id = `${prefix}${String(i).padStart(3, '0')}`;
        const card = cardMap[id];
        if (!card) continue;
        
        if (card.cost <= 3) pool.small.push(id);
        else if (card.cost <= 6) pool.mid.push(id);
        else pool.large.push(id);
    }
    
    // 足りない場合は他のプールから補充
    deck.push(...pool.small.slice(0, 12));
    deck.push(...pool.mid.slice(0, 12));
    deck.push(...pool.large.slice(0, 6));
    
    // まだ30枚に満たない場合は残りを適当に埋める
    const allIds = [...pool.small, ...pool.mid, ...pool.large];
    while (deck.length < 30) {
        const next = allIds.find(id => !deck.includes(id));
        if (next) deck.push(next); else break;
    }
    
    return deck;
}

// テスト用シールド (S001〜S005)
const testShields = ['S001', 'S002', 'S003', 'S011', 'S020'];

console.log('🧪 詳細デバッグ対戦開始 (White vs Red)...');
const deckA = createBalancedDeck('white');
const deckB = createBalancedDeck('red');

const result = runFullMatch(deckA, deckB, testShields);

// ログの保存
const logPath = path.join(__dirname, '../match_debug.log');
fs.writeFileSync(logPath, result.logs.join('\n'), 'utf8');

console.log(`\n========================================`);
console.log(`🏁 対戦終了: ${result.winnerName} の勝利`);
console.log(`⏱ ターン数: ${result.turns}`);
console.log(`📄 ログを保存しました: ${logPath}`);
console.log(`========================================`);

// 最後の10行を表示
console.log('\n--- 終盤のログ ---');
console.log(result.logs.slice(-10).join('\n'));
