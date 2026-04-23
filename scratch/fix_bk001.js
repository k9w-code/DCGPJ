const fs = require('fs');
const path = 'c:/Users/imai/workspace/dcgpj/data/cards.csv';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const newLines = lines.map(line => {
  if (line.startsWith('BK001,BK001,')) {
    // 壊れた行を正しいフォーマットで再構築
    return 'BK001,BK001,彷徨える亡霊,black,1,1,unit,3,1,1,legacy,on_death,discard_random,1,enemy,,,,,"現世に未練を残し、夜を飛ぶ霊体。 【遺言】相手の手札を1枚破棄する。",basic,basic';
  }
  return line;
});

fs.writeFileSync(path, newLines.join('\n'));
console.log('BK001 fixed successfully.');
