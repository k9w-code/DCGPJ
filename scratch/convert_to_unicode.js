const fs = require('fs');
const path = require('path');

function toUnicodeEscape(str) {
    return str.replace(/[^\x00-\x7f]/g, function (match) {
        if (match.length > 1) {
            // Surrogate pairs (like emojis)
            let high = match.charCodeAt(0).toString(16).padStart(4, '0');
            let low = match.charCodeAt(1).toString(16).padStart(4, '0');
            return '\\u' + high + '\\u' + low;
        }
        return '\\u' + match.charCodeAt(0).toString(16).padStart(4, '0');
    });
}

function processFile(filePath) {
    console.log(`Processing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 文字列リテラル（ダブルクォート、シングルクォート、バッククォート）
    // およびコメント行内の日本語を変換する
    // 非常にシンプルな実装として、非ASCII文字をすべて置換する（コード部分は元々ASCIIのため安全）
    const converted = toUnicodeEscape(content);
    
    fs.writeFileSync(filePath, converted, 'utf8');
    console.log(`Successfully converted ${filePath}`);
}

const files = [
    'game/AbilityProcessor.js',
    'game/CombatResolver.js',
    'game/GameEngine.js',
    'game/DataLoader.js',
    'game/GameState.js',
    'game/KeywordEffects.js',
    'public/js/game-client.js',
    'public/js/game-renderer.js',
    'public/js/audio-manager.js'
];

files.forEach(file => {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        processFile(fullPath);
    } else {
        console.warn(`File not found: ${file}`);
    }
});
