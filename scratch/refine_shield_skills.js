const fs = require('fs');

let ap = fs.readFileSync('game/AbilityProcessor.js', 'utf8');

// 1. 破壊効果での不屈対応 (processShieldSkill 内)
// 修正前: target.currentHp = 0;
// 修正後: target.currentHp = 0; processUnitDeath(target, logs);
if (!ap.includes('const { processUnitDeath } = require(\'./CombatResolver\');') && !ap.includes('require(\'./CombatResolver\')')) {
    // 冒頭にインポートを追加（既にあるはずだが念のため）
}

const destroyFix = `
        targets.forEach(target => {
          if (target.instanceId) {
            const { processUnitDeath } = require('./CombatResolver');
            target.currentHp = 0;
            const isDead = processUnitDeath(target, logs);
            if (isDead) {
              logs.push("☠️ シールドスキル「" + abilityName + "」: " + target.name + " を破壊！");
              events.push({ type: 'shield_skill_kill', target: target.instanceId });
            }
          }
        });
`;
// 既存の case 'destroy' 系のループ部分を置換
ap = ap.replace(/targets\.forEach\(target => \{\s*if \(target\.instanceId\) \{\s*target\.currentHp = 0;[\s\S]*?\}\s*\}\);/, destroyFix);

// 2. バウンス処理の追加 (もし processShieldSkill になければ追加)
if (!ap.includes("case 'bounce':")) {
    const bounceCode = `
      case 'bounce':
      case 'bounce_lowest_enemy':
      case 'bounce_highest_enemy': {
        const targetsB = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value, null);
        targetsB.forEach(target => {
          logs.push("🔄 シールドスキル「" + abilityName + "」: " + target.name + " を手札に戻した");
          events.push({ type: 'ability_bounce', target: target.instanceId });
        });
        break;
      }
`;
    ap = ap.replace("case 'silence':", bounceCode + "\n      case 'silence':");
}

// 3. レベルアップの上限チェック
ap = ap.replace('targetPlayer.tribeLevels[targetPlayer.tribeLevelingColor]++;', 
               'if (targetPlayer.tribeLevels[targetPlayer.tribeLevelingColor] < 10) targetPlayer.tribeLevels[targetPlayer.tribeLevelingColor]++;');

// 4. トークン召喚の盤面チェック
if (ap.includes('createUnitInstance(value, targetPlayer.id)')) {
    ap = ap.replace('targetPlayer.board[row][lane] = createUnitInstance(value, targetPlayer.id);',
                   'if (!targetPlayer.board[row][lane]) targetPlayer.board[row][lane] = createUnitInstance(value, targetPlayer.id);');
}

fs.writeFileSync('game/AbilityProcessor.js', ap, 'utf8');
console.log('Shield skill logic refined.');
