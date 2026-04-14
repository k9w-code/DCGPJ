/**
 * 総合デバッグテスト - ローカルCSVを使ってAI vs AI対戦を実行
 * cards.csv (既存マスタ) + shields.csv を使用
 */
const path = require('path');
const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer = require('../game/AIPlayer');

async function main() {
  console.log('=== 総合デバッグテスト開始 ===\n');

  // 1. データロード
  let gameData;
  try {
    gameData = await loadAllData({ sync: false });
    console.log(`✅ データロード成功: カード ${gameData.cards.length}枚, シールド ${gameData.shields.length}枚\n`);
  } catch (e) {
    console.error('❌ データロード失敗:', e.message);
    process.exit(1);
  }

  // 2. データ整合性チェック
  console.log('=== データ整合性チェック ===');
  let errorCount = 0;

  // 文字化けチェック
  for (const card of gameData.cards) {
    if (!card.name || card.name.includes('ï¿½') || card.name.includes('â€')) {
      console.error(`❌ 文字化け検出: ${card.id} name="${card.name}"`);
      errorCount++;
    }
    if (card.flavorText && (card.flavorText.includes('ï¿½') || card.flavorText.includes('â€'))) {
      console.error(`❌ 文字化け検出 (flavor): ${card.id}`);
      errorCount++;
    }
    // NaN チェック
    if (isNaN(card.cost)) { console.error(`❌ cost NaN: ${card.id}`); errorCount++; }
    if (card.type === 'unit' && isNaN(card.attack)) { console.error(`❌ attack NaN: ${card.id}`); errorCount++; }
    if (card.type === 'unit' && isNaN(card.hp)) { console.error(`❌ hp NaN: ${card.id}`); errorCount++; }
    if (card.type === 'unit' && card.hp <= 0 && card.cost > 0) { console.error(`⚠️ HP 0以下: ${card.id} ${card.name} HP=${card.hp}`); }
    if (card.type === 'unit' && card.attack < 0) { console.error(`⚠️ ATK 負数: ${card.id} ${card.name} ATK=${card.attack}`); }
    
    // keywords のパース確認
    if (card.keywords && card.keywords.length > 0) {
      for (const kw of card.keywords) {
        const validKw = ['rush','speed','taunt','barrier','endure','siege','double_strike','stealth','drain','awaken','intimidate','spread','comeback','search'];
        const kwBase = kw.split(':')[0].split('_')[0];
        // awaken:xxx, search_N 等は許容
      }
    }

    // abilities チェック
    for (const ab of card.abilities) {
      if (ab.trigger && ab.effect) {
        const validEffects = [
          'damage','damage_all','damage_all_enemy','heal','heal_all',
          'draw','buff_attack','buff_attack_all','buff_hp','buff_hp_all',
          'debuff_attack','debuff_hp','destroy','destroy_weakest','destroy_lowest_hp',
          'destroy_highest_hp','destroy_highest_atk','destroy_lowest_atk',
          'freeze','bounce','grant_barrier','drain','damage_shield','heal_shield',
          'sp_gain','discard_random','summon_token'
        ];
        if (!validEffects.includes(ab.effect)) {
          console.error(`❌ 不明なeffect: ${card.id} ${card.name} effect="${ab.effect}"`);
          errorCount++;
        }
      }
    }
  }

  // シールドチェック
  for (const shield of gameData.shields) {
    if (!shield.name || shield.name.includes('ï¿½')) {
      console.error(`❌ シールド文字化け: ${shield.id}`);
      errorCount++;
    }
    if (isNaN(shield.durability) || shield.durability <= 0) {
      console.error(`❌ シールド耐久値不正: ${shield.id} durability=${shield.durability}`);
      errorCount++;
    }
  }

  console.log(`\nデータ整合性チェック: ${errorCount === 0 ? '✅ 問題なし' : `❌ ${errorCount}件のエラー`}\n`);

  // 3. 色別カード枚数統計
  console.log('=== カードプール統計 ===');
  const colorStats = {};
  for (const card of gameData.cards) {
    if (card.isToken) continue;
    const col = card.color || 'unknown';
    if (!colorStats[col]) colorStats[col] = { total: 0, unit: 0, spell: 0, byCost: {} };
    colorStats[col].total++;
    if (card.type === 'unit') colorStats[col].unit++;
    else colorStats[col].spell++;
    const c = card.cost;
    colorStats[col].byCost[c] = (colorStats[col].byCost[c] || 0) + 1;
  }
  for (const [col, stats] of Object.entries(colorStats)) {
    const costLine = Object.entries(stats.byCost).sort((a,b)=>a[0]-b[0]).map(([c,n])=>`C${c}:${n}`).join(' ');
    console.log(`  ${col}: ${stats.total}枚 (unit:${stats.unit}, spell:${stats.spell}) | ${costLine}`);
  }

  // 4. デッキ構築 (白デッキ vs 赤デッキ)
  console.log('\n=== AI vs AI 対戦テスト ===');
  
  function buildColorDeck(color, cardMap) {
    const pool = Object.values(cardMap).filter(c => c.color === color && !c.isToken && c.cost > 0);
    if (pool.length === 0) {
      console.error(`❌ ${color}のカードが0枚です`);
      return [];
    }
    // コスト順にソートして40枚デッキを組む
    pool.sort((a, b) => a.cost - b.cost);
    const deck = [];
    for (const card of pool) {
      const maxCopies = card.maxCopies || 3;
      for (let i = 0; i < maxCopies && deck.length < 40; i++) {
        deck.push(card.id);
      }
    }
    // 足りない場合は低コストから繰り返し追加
    let idx = 0;
    while (deck.length < 40 && pool.length > 0) {
      deck.push(pool[idx % pool.length].id);
      idx++;
    }
    return deck;
  }

  function pickShields(shields) {
    if (shields.length === 0) return [];
    const picked = [];
    for (let i = 0; i < 3 && i < shields.length; i++) {
      picked.push(shields[i].id);
    }
    return picked;
  }

  const whiteDeck = buildColorDeck('white', gameData.cardMap);
  const redDeck = buildColorDeck('red', gameData.cardMap);
  const shieldIds = pickShields(gameData.shields);

  console.log(`白デッキ: ${whiteDeck.length}枚, 赤デッキ: ${redDeck.length}枚, シールド: ${shieldIds.length}枚`);

  if (whiteDeck.length < 40 || redDeck.length < 40 || shieldIds.length < 3) {
    console.error('❌ デッキまたはシールドの枚数が不足しています。対戦テストをスキップします。');
    return;
  }

  // 5. 対戦実行
  const engine = new GameEngine(gameData);
  const p1 = { id: 'p1', name: '白プレイヤー', isAI: true, avatar: 'AV001', deckCardIds: whiteDeck, shieldIds };
  const p2 = { id: 'p2', name: '赤プレイヤー', isAI: true, avatar: 'AV002', deckCardIds: redDeck, shieldIds };
  const ai1 = new AIPlayer('p1', gameData.cardMap);
  const ai2 = new AIPlayer('p2', gameData.cardMap);
  const ais = { p1: ai1, p2: ai2 };

  // ログ抑制（console.logを一時的にバッファリング）
  const originalLog = console.log;
  const logBuffer = [];
  console.log = (...args) => logBuffer.push(args.join(' '));

  try {
    engine.initGame(p1, p2);
    engine.processMulligan('p1', false);
    engine.processMulligan('p2', false);
    engine.startTurn();

    let maxIter = 1000;
    let actionsThisTurn = 0;
    let lastPid = null;
    let errors = [];

    while (engine.gameState.phase !== 'game_over' && maxIter > 0) {
      const curId = engine.gameState.playerOrder[engine.gameState.currentPlayerIndex];
      if (curId !== lastPid) { actionsThisTurn = 0; lastPid = curId; }
      if (actionsThisTurn > 30) {
        engine.endTurn(curId);
        continue;
      }

      const ai = ais[curId];
      const view = engine.getPlayerView(curId);

      // shield_break_anim 自動解決
      if (engine.gameState.phase === 'shield_break_anim') {
        engine.resolvePendingShieldBreak();
        continue;
      }

      const action = ai.decideNextAction(view);
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
      } catch (e) {
        errors.push(`💥 例外発生 T${engine.gameState.turnNumber} ${curId}: ${e.message}\n${e.stack}`);
        engine.endTurn(curId);
      }

      if (result && result.error) {
        errors.push(`❌ T${engine.gameState.turnNumber} ${curId}: ${result.error} | action=${JSON.stringify(action)}`);
        actionsThisTurn = 99;
      } else {
        actionsThisTurn++;
      }
      maxIter--;
    }

    // 結果出力
    console.log = originalLog;
    
    console.log(`\n=== 対戦結果 ===`);
    console.log(`勝者: ${engine.gameState.winner ? engine.gameState.players[engine.gameState.winner].name : '引き分け/タイムアウト'}`);
    console.log(`ターン数: ${engine.gameState.turnNumber}`);
    console.log(`残りイテレーション: ${maxIter}`);

    if (errors.length > 0) {
      console.log(`\n=== 対戦中のエラー (${errors.length}件) ===`);
      // 重複排除  
      const unique = [...new Set(errors)];
      unique.slice(0, 20).forEach(e => console.log(e));
      if (unique.length > 20) console.log(`... 他 ${unique.length - 20}件`);
    } else {
      console.log('\n✅ 対戦中のエラー: なし');
    }

    // 最後の数ログ出力
    const gameLogs = engine.gameState.logs;
    console.log(`\n=== 最終10行のログ ===`);
    gameLogs.slice(-10).forEach(l => console.log(`  ${l}`));

  } catch (e) {
    console.log = originalLog;
    console.error(`💥 致命的エラー: ${e.message}`);
    console.error(e.stack);
  }
}

main().catch(console.error);
