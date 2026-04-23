const fs = require('fs');
const path = require('path');

function checkCsv(filename) {
    const filePath = path.join(__dirname, '..', 'data', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }
    
    const buffer = fs.readFileSync(filePath);
    // UTF-8として読み込み
    const content = buffer.toString('utf8');
    
    console.log(`--- Checking ${filename} ---`);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        // 1. UTF-8 置換文字の検出
        // 2. 「【発】」（挑発の文字化け）の検出
        // 3. 意味不明な記号（UTF-8としてパース失敗した際に出やすいもの）の検出
        if (line.includes('\uFFFD') || line.includes('【発】') || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(line)) {
            const id = line.split(',')[0] || 'Unknown';
            console.log(`[Possible Mojibake] Line ${index + 1}: ID=${id} -> "${line.substring(0, 100)}..."`);
        }
    });
}

checkCsv('cards.csv');
checkCsv('shields.csv');
