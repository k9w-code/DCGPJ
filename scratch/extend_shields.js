const fs = require('fs');
const path = 'c:/Users/imai/workspace/dcgpj/data/shields.csv';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const newLines = lines.map((line, index) => {
  if (line.trim() === '') return line;
  const parts = line.split(',');
  if (index === 0) {
    // ヘッダー: target(6) の後に挿入
    parts.splice(7, 0, 'effect2', 'value2', 'target2');
  } else {
    // データ行: target(6) の後に空のカラムを3つ挿入
    parts.splice(7, 0, '', '', '');
  }
  return parts.join(',');
});

fs.writeFileSync(path, newLines.join('\n'));
console.log('shields.csv extended successfully.');
