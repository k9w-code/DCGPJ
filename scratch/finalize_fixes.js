const fs = require('fs');

// 1. AbilityProcessor.js 修正 (processShieldSkill 内に沈黙を追加)
let ap = fs.readFileSync('game/AbilityProcessor.js', 'utf8');
if (!ap.includes("case 'silence':") || ap.split("case 'silence':").length < 3) {
    const shieldSilenceCode = `
      case 'silence':
        const targetsS = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null);
        targetsS.forEach(target => {
          target.keywords = [];
          target.abilities = [];
          target.barrierActive = false;
          target.stealthActive = false;
          target.silenced = true;
          logs.push("🔇 シールドスキル「" + abilityName + "」: " + target.name + " は沈黙した！全ての能力を失う");
        });
        break;
`;
    // processShieldSkill 内の適当な場所（damage の前など）に挿入
    ap = ap.replace("case 'damage':", shieldSilenceCode + "\n      case 'damage':");
    fs.writeFileSync('game/AbilityProcessor.js', ap, 'utf8');
}

// 2. server.js 修正 (クリック後にAIを再開させるロジックの強化)
let s = fs.readFileSync('server.js', 'utf8');
// resolve_shield_break 成功後に AIチェックを行うようにする
if (s.includes("case 'resolve_shield_break':")) {
    const aiResumeCode = `
        case 'resolve_shield_break':
          result = room.engine.resolvePendingShieldBreak();
          // 手動解決後、もしAIのターンなら思考を再開させる
          setTimeout(() => {
            const gs = room.engine.gameState;
            const currentId = gs.playerOrder[gs.currentPlayerIndex];
            const aiPlayer = room.players.find(p => p.id === currentId);
            if (aiPlayer && aiPlayer.isAI && gs.phase === 'main') {
              executeAITurn(room, aiPlayer);
            }
          }, 500);
          break;`;
    
    // 既存の case を置換
    const regex = /case 'resolve_shield_break':[\s\S]*?break;/;
    s = s.replace(regex, aiResumeCode);
    fs.writeFileSync('server.js', s, 'utf8');
}

// 3. game-client.js 修正 (クリックリスナーを addEventListener に変更)
let c = fs.readFileSync('public/js/game-client.js', 'utf8');
c = c.replace('sbOverlay.onclick = () => {', "sbOverlay.addEventListener('click', () => {");
fs.writeFileSync('public/js/game-client.js', c, 'utf8');

console.log('Silence skill added to shields and AI resume logic updated.');
