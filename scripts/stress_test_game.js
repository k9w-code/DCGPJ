const fs = require('fs');
const path = require('path');
const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

async function runStressTest(matchCount = 100) {
    console.log(`🚀 ストレステスト開始: ${matchCount} 試合のシミュレーションを行います...`);
    
    // データロード
    const gameData = await loadAllData();
    console.log(`✅ データ読み込み完了: カード${gameData.cards.length}枚, シールド${gameData.shields.length}種`);
    
    const errors = [];
    let winsA = 0;
    let winsB = 0;
    let draws = 0;

    for (let i = 1; i <= matchCount; i++) {
        process.stdout.write(`\r試合中: ${i}/${matchCount} ... `);
        
        try {
            const engine = new GameEngine(gameData);
            
            // ランダムに選ばれた2つの色でデッキを作成
            const colors = ['red', 'blue', 'green', 'white', 'black'];
            const colorA1 = colors[Math.floor(Math.random() * colors.length)];
            let colorA2 = colors[Math.floor(Math.random() * colors.length)];
            const colorB1 = colors[Math.floor(Math.random() * colors.length)];
            let colorB2 = colors[Math.floor(Math.random() * colors.length)];
            
            const deckA = buildRandomDeck(gameData.cards, colorA1, colorA2);
            const deckB = buildRandomDeck(gameData.cards, colorB1, colorB2);
            const shields = gameData.shields.map(s => s.id).sort(() => 0.5 - Math.random()).slice(0, 3);
            
            const p1 = { id: 'p1', name: 'AI_A', isAI: true, avatar: '1', deckCardIds: deckA, shieldIds: shields };
            const p2 = { id: 'p2', name: 'AI_B', isAI: true, avatar: '2', deckCardIds: deckB, shieldIds: shields };
            
            engine.initGame(p1, p2);
            // マリガン
            engine.processMulligan('p1', Math.random() > 0.5);
            engine.processMulligan('p2', Math.random() > 0.5);
            engine.startTurn();

            const ais = { 'p1': new AIPlayer('p1'), 'p2': new AIPlayer('p2') };
            
            let turnLimit = 500;
            let actionLimit = 20;
            let currentActions = 0;
            let lastPlayer = null;

            while (engine.gameState.phase !== 'game_over' && turnLimit > 0) {
                const curId = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
                if (curId !== lastPlayer) {
                    currentActions = 0;
                    lastPlayer = curId;
                }
                
                if (currentActions > actionLimit) {
                    engine.endTurn(curId);
                    continue;
                }

                const view = engine.getPlayerView(curId);
                const action = ais[curId].decideNextAction(view);
                
                let result = null;
                switch (action.type) {
                    case 'raise_tribe': result = engine.raiseTribeLevel(curId, action.color); break;
                    case 'play_card': result = engine.playCard(curId, action.handIndex, action.targetRow, action.targetLane); break;
                    case 'attack': result = engine.attackWithUnit(curId, action.attackerRow, action.attackerLane, action.targetInfo); break;
                    case 'end_turn': result = engine.endTurn(curId); break;
                }

                if (result && result.error) {
                    currentActions = 99; // エラー時はそのターンの行動停止
                } else {
                    currentActions++;
                }
                turnLimit--;
            }

            if (engine.gameState.winner === 'p1') winsA++;
            else if (engine.gameState.winner === 'p2') winsB++;
            else draws++;

        } catch (err) {
            console.error(`\n❌ 試合 ${i} でクラッシュ発生:`, err.message);
            errors.push({ match: i, error: err.message, stack: err.stack });
            // クラッシュした際のログを保存
            const errorLogPath = path.join(__dirname, `../error_match_${i}.log`);
            fs.writeFileSync(errorLogPath, `ERROR: ${err.message}\nSTACK: ${err.stack}\n`, 'utf8');
        }
    }

    console.log(`\n\n=== 📊 ストレステスト結果サマリー ===`);
    console.log(`総試合数: ${matchCount}`);
    console.log(`AI_A勝利: ${winsA} / AI_B勝利: ${winsB} / 引き分け: ${draws}`);
    console.log(`クラッシュ件数: ${errors.length} / 成功率: ${((matchCount - errors.length) / matchCount * 100).toFixed(1)}%`);
    
    if (errors.length > 0) {
        console.log(`\n⚠️ 修正が必要なエラーが ${errors.length} 件見つかりました。`);
    } else {
        console.log(`\n✨ パーフェクト！全てのシミュレーションが正常に完了しました。`);
    }
}

function buildRandomDeck(allCards, c1, c2) {
    const pool = allCards.filter(c => (c.colors.includes(c1) || c.colors.includes(c2)) && !c.isToken);
    const deck = [];
    for (let i = 0; i < 30; i++) {
        deck.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    return deck;
}

runStressTest(100).catch(console.error);
