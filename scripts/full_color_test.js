/**
 * 5色全組み合わせ対戦テスト + フロントエンド文字化けチェック
 */
const path = require('path');
const fs = require('fs');
const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

async function main() {
  const gameData = await loadAllData({ sync: false });

  // デッキ構築ヘルパー
  function buildColorDeck(color) {
    const pool = Object.values(gameData.cardMap).filter(c => c.color === color && !c.isToken && c.cost > 0);
    pool.sort((a, b) => a.cost - b.cost);
    const deck = [];
    for (const card of pool) {
      for (let i = 0; i < (card.maxCopies || 3) && deck.length < 40; i++) deck.push(card.id);
    }
    let idx = 0;
    while (deck.length < 40 && pool.length > 0) { deck.push(pool[idx % pool.length].id); idx++; }
    return deck;
  }

  const shieldIds = gameData.shields.slice(0, 3).map(s => s.id);
  const colors = ['white', 'red', 'blue', 'green', 'black'];
  const results = [];

  // 全10組み合わせ対戦
  console.log('=== 5色全組み合わせ対戦テスト ===\n');
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i], c2 = colors[j];
      const deck1 = buildColorDeck(c1), deck2 = buildColorDeck(c2);

      const engine = new GameEngine(gameData);
      const p1 = { id: 'p1', name: c1, isAI: true, avatar: 'AV001', deckCardIds: deck1, shieldIds };
      const p2 = { id: 'p2', name: c2, isAI: true, avatar: 'AV002', deckCardIds: deck2, shieldIds };
      const ai1 = new AIPlayer('p1', gameData.cardMap);
      const ai2 = new AIPlayer('p2', gameData.cardMap);
      const ais = { p1: ai1, p2: ai2 };

      const origLog = console.log;
      console.log = () => {};

      try {
        engine.initGame(p1, p2);
        engine.processMulligan('p1', false);
        engine.processMulligan('p2', false);
        engine.startTurn();

        let maxIter = 1000, actionsThisTurn = 0, lastPid = null, errors = 0, exceptions = 0;

        while (engine.gameState.phase !== 'game_over' && maxIter > 0) {
          const curId = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
          if (curId !== lastPid) { actionsThisTurn = 0; lastPid = curId; }
          if (actionsThisTurn > 30) { engine.endTurn(curId); continue; }

          if (engine.gameState.phase === 'shield_break_anim') {
            engine.resolvePendingShieldBreak(); continue;
          }

          const view = engine.getPlayerView(curId);
          const action = ais[curId].decideNextAction(view);
          if (engine.gameState.phase === 'game_over') break;

          let result = null;
          try {
            switch (action.type) {
              case 'raise_tribe': result = engine.raiseTribeLevel(curId, action.color); break;
              case 'play_card': result = engine.playCard(curId, action.handIndex, action.targetRow, action.targetLane); break;
              case 'attack': result = engine.attackWithUnit(curId, action.attackerRow, action.attackerLane, action.targetInfo); break;
              case 'select_target': result = engine.resolvePendingAbility(curId, action.targetRow, action.targetLane); break;
              case 'end_turn': result = engine.endTurn(curId); break;
            }
          } catch (e) { exceptions++; engine.endTurn(curId); }

          if (result && result.error) { errors++; actionsThisTurn = 99; }
          else actionsThisTurn++;
          maxIter--;
        }

        console.log = origLog;
        const winner = engine.gameState.winner ? engine.gameState.players[engine.gameState.winner].name : 'TIMEOUT';
        const turns = engine.gameState.turnNumber;
        results.push({ match: `${c1} vs ${c2}`, winner, turns, errors, exceptions, timeout: maxIter <= 0 });

        const status = exceptions > 0 ? '💥' : errors > 0 ? '⚠️' : '✅';
        process.stdout.write(`${status} ${c1.padEnd(6)} vs ${c2.padEnd(6)} → 勝者:${winner.padEnd(6)} T${turns} err:${errors} exc:${exceptions}${maxIter<=0?' TIMEOUT':''}\n`);

      } catch (e) {
        console.log = origLog;
        process.stderr.write(`💥 ${c1} vs ${c2}: 致命エラー: ${e.message}\n`);
        results.push({ match: `${c1} vs ${c2}`, winner: 'CRASH', turns: 0, errors: 0, exceptions: 1 });
      }
    }
  }

  // サマリー
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  const totalExc = results.reduce((s, r) => s + r.exceptions, 0);
  const timeouts = results.filter(r => r.timeout).length;
  console.log(`\n=== サマリー ===`);
  console.log(`対戦数: ${results.length}`);
  console.log(`エラー合計: ${totalErrors}`);
  console.log(`例外合計: ${totalExc}`);
  console.log(`タイムアウト: ${timeouts}`);

  // フロントエンド文字化けチェック
  console.log('\n=== フロントエンド文字化けチェック ===');
  const frontFiles = [
    'public/js/game-client.js', 'public/js/game-renderer.js', 'public/js/deck-builder.js',
    'public/js/lobby.js', 'public/js/audio-manager.js',
    'public/game.html', 'public/deck-builder.html', 'public/index.html',
    'server.js'
  ];
  let fileErrors = 0;
  for (const f of frontFiles) {
    const fp = path.join(__dirname, '..', f);
    if (!fs.existsSync(fp)) { process.stderr.write(`⚠️ ファイル未検出: ${f}\n`); continue; }
    const content = fs.readFileSync(fp, 'utf8');
    // BOM check
    if (content.charCodeAt(0) === 0xFEFF) { process.stderr.write(`⚠️ BOM付き: ${f}\n`); }
    // 文字化けパターン
    const badPatterns = ['ï¿½', 'â€', 'Ã¯', 'Ã¤', 'Ã¨', 'Ã£', '繧', '繝', '閻', '邱'];
    for (const pat of badPatterns) {
      if (content.includes(pat)) {
        process.stderr.write(`❌ 文字化け検出: ${f} パターン="${pat}"\n`);
        fileErrors++;
      }
    }
    // console.log 内の日本語が正常か（サンプリング）
    const jpMatches = content.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+/g);
    if (jpMatches && jpMatches.length > 0) {
      process.stdout.write(`  ✅ ${f}: 日本語テキスト ${jpMatches.length}箇所 正常\n`);
    } else {
      process.stdout.write(`  ℹ️ ${f}: 日本語テキストなし\n`);
    }
  }
  console.log(`\nフロントエンド文字化け: ${fileErrors === 0 ? '✅ 問題なし' : `❌ ${fileErrors}件`}`);
}

main().catch(e => { console.error('致命エラー:', e); process.exit(1); });
