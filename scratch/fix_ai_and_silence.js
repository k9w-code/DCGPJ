const fs = require('fs');

// 1. server.js 修正 (AIターン時のシールドブレイク対応)
let s = fs.readFileSync('server.js', 'utf8');
if (!s.includes('room.engine.gameState.phase === \'shield_break_anim\'') || s.split('shield_break_anim').length < 3) {
    const aiShieldFix = `
        // AIのアクション後、シールドブレイク演出フェーズに入った場合の自動進行
        if (room.engine.gameState.phase === 'shield_break_anim') {
          setTimeout(() => {
            if (room.engine && room.engine.gameState.phase === 'shield_break_anim') {
              room.engine.resolvePendingShieldBreak();
              sendGameStateToAll(room);
              // 解決後、まだAIの手番なら再開
              if (room.engine.gameState.currentPlayerId === aiPlayerObj.id) {
                setTimeout(() => executeAITurn(room, aiPlayerObj), 1000);
              }
            }
          }, 4500);
          return; // タイマー側で再帰呼び出しするのでここでは終了
        }
`;
    // 最初の sendGameStateToAll(room); の直後に挿入 (executeAITurn内)
    const anchor = 'sendGameStateToAll(room);';
    const index = s.indexOf(anchor, s.indexOf('function executeAITurn'));
    if (index !== -1) {
        s = s.substring(0, index + anchor.length) + aiShieldFix + s.substring(index + anchor.length);
        fs.writeFileSync('server.js', s, 'utf8');
    }
}

// 2. AbilityProcessor.js 修正 (沈黙スキルの修正)
// 沈黙は能力を空にするか、フラグを立てる必要がある。
// 現在の hasKeyword は keywords 配列を見ているので、keywords をクリアするのが確実。
let ap = fs.readFileSync('game/AbilityProcessor.js', 'utf8');
if (ap.includes("case 'silence':")) {
    // 既存の沈黙処理を確認（もしあれば）
} else {
    // case 'freeze' の後あたりに追加
    const silenceCode = `
      case 'silence': {
        if (manualTarget) {
          manualTarget.keywords = [];
          manualTarget.abilities = [];
          manualTarget.silenced = true;
          logs.push("🔇 " + manualTarget.name + " は沈黙した！全ての能力を失う");
          events.push({ type: 'ability_silence', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null);
          targets.forEach(target => {
            target.keywords = [];
            target.abilities = [];
            target.silenced = true;
            logs.push("🔇 " + target.name + " は沈黙した！全ての能力を失う");
            events.push({ type: 'ability_silence', target: target.instanceId });
          });
        }
        break;
      }
`;
    ap = ap.replace("case 'freeze': {", silenceCode + "\n      case 'freeze': {");
    fs.writeFileSync('game/AbilityProcessor.js', ap, 'utf8');
}

console.log('AI shield fix and Silence logic updated.');
