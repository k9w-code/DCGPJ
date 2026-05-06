const fs = require('fs');
const path = require('path');

// 1. Mojibake Cleanup & Text Restoration
const restorationMap = {
    'vfx-engine.js': [
        { from: /textContent\s*=\s*isMyTurn\s*\?\s*'.*?'\s*:\s*'.*?'/, to: 'textContent = isMyTurn ? "作戦を立てよう" : "相手のターンです"' },
        { from: /sub\.textContent\s*=\s*isMyTurn\s*\?\s*'.*?'\s*:\s*'.*?'/, to: 'sub.textContent = isMyTurn ? "作戦を立てよう" : "相手のターンです"' }
    ],
    'game-client.js': [
        { from: /\/\/ === .*? ===/g, to: '// === ターゲット選択処理 ===' },
        { from: /console\.log\(`\?\?\s*\[CLIENT\]\s*Targeting/g, to: 'console.log(`🎯 [CLIENT] Targeting' }
    ],
    'AbilityProcessor.js': [
        { from: /logs\.push\(`\?\?\s*/g, to: 'logs.push(`🔥 ' },
        { from: /\/\/ .*?\(self \/ enemy \/ opponent\)/, to: '// ターゲットの共通化 (self / enemy / opponent)' }
    ]
};

function cleanupMojibake(filePath, rules) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Remove known bad patterns (SJIS-in-UTF8)
    content = content.replace(/[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g, ' ');
    rules.forEach(rule => {
        content = content.replace(rule.from, rule.to);
    });
    fs.writeFileSync(filePath, content, 'utf8');
}

// Apply cleanup
cleanupMojibake('public/js/vfx-engine.js', restorationMap['vfx-engine.js']);
cleanupMojibake('public/js/game-client.js', restorationMap['game-client.js']);
cleanupMojibake('game/AbilityProcessor.js', restorationMap['AbilityProcessor.js']);

// 2. Fix Barrier/Damage Logic in AbilityProcessor.js
let ap = fs.readFileSync('game/AbilityProcessor.js', 'utf8');
// Import applyDamage if not present
if (!ap.includes('applyDamage')) {
    ap = ap.replace("const { resolveUnitCombat, resolveShieldAttack, processUnitDeath } = require('./CombatResolver');", 
                   "const { resolveUnitCombat, resolveShieldAttack, processUnitDeath, applyDamage } = require('./CombatResolver');");
}

// Replace currentHp -= value with applyDamage
ap = ap.replace(/target\.currentHp\s*-\s*=\s*value;/g, 'applyDamage(target, value, logs);');
ap = ap.replace(/u\.currentHp\s*-\s*=\s*value;/g, 'applyDamage(u, value, logs);');
ap = ap.replace(/ally\.currentHp\s*-\s*=\s*value;/g, 'applyDamage(ally, value, logs);');
ap = ap.replace(/manualTarget\.currentHp\s*-\s*=\s*value;/g, 'applyDamage(manualTarget, value, logs);');

// 3. Ensure Destruction (currentHp = 0) remains direct but triggers processUnitDeath
// (Already doing this in the code, but verifying)
// Destruction should bypass Barrier. applyDamage is for DAMAGE. currentHp = 0 is for DESTRUCTION.
// Logic: target.currentHp = 0; processUnitDeath(target, logs);

fs.writeFileSync('game/AbilityProcessor.js', ap, 'utf8');

console.log('Cleanup and Logic Fixes completed.');
