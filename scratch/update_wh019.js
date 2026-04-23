const fs = require('fs');
const path = 'c:/Users/imai/workspace/dcgpj/data/cards.csv';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const newLines = lines.map(line => {
  if (line.startsWith('WH019,')) {
    // ID, art_id, name, color, rarity, cost, type, limit, atk, life, keywords, trigger, effect, value, target, ...
    const parts = line.split(',');
    parts[8] = '6'; // atk
    parts[9] = '6'; // life
    parts[13] = '2'; // value
    // 説明文の修正 (+1 -> +2)
    let newLine = parts.join(',');
    newLine = newLine.replace('+1', '+2');
    return newLine;
  }
  return line;
});

fs.writeFileSync(path, newLines.join('\n'));
console.log('WH019 updated successfully.');
