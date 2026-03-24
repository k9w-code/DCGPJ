const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '../public/assets/images');
const cardsDir = path.join(baseDir, 'cards');
const shieldsDir = path.join(baseDir, 'shields');

const rules = {
  'red': 'R',
  'blue': 'U',
  'green': 'G',
  'white': 'W',
  'black': 'K',
  'rainbow': 'N'
};

const counts = {};

// Rename cards
Object.entries(rules).forEach(([color, prefix]) => {
  const dirPath = path.join(cardsDir, color);
  if (!fs.existsSync(dirPath)) return;
  
  let files = fs.readdirSync(dirPath).filter(f => f.match(/\.(png|jpe?g|webp|gif)$/i));
  files.sort(); // 既存の連番などがある場合に順序を保つため
  
  if (files.length === 0) {
    counts[color] = 0;
    return;
  }
  
  // 衝突を避けるために一旦一時ファイル名に変更
  const tempNames = [];
  files.forEach((f, i) => {
    const oldPath = path.join(dirPath, f);
    const tempName = path.join(dirPath, `_temp_${i}${path.extname(f)}`);
    fs.renameSync(oldPath, tempName);
    tempNames.push({ temp: tempName, ext: path.extname(f), index: i });
  });
  
  // プレフィックス付きの連番にリネーム
  tempNames.forEach(item => {
    const newName = prefix + String(item.index + 1).padStart(3, '0') + item.ext;
    fs.renameSync(item.temp, path.join(dirPath, newName));
  });
  
  counts[color] = files.length;
  console.log(`[${color}] リネーム完了: ${files.length}枚 -> ${prefix}001...`);
});

// Rename shields
if (fs.existsSync(shieldsDir)) {
  let files = fs.readdirSync(shieldsDir).filter(f => f.match(/\.(png|jpe?g|webp|gif)$/i));
  files.sort();
  if (files.length > 0) {
    const tempNames = [];
    files.forEach((f, i) => {
      const oldPath = path.join(shieldsDir, f);
      const tempName = path.join(shieldsDir, `_temp_${i}${path.extname(f)}`);
      fs.renameSync(oldPath, tempName);
      tempNames.push({ temp: tempName, ext: path.extname(f), index: i });
    });
    
    tempNames.forEach(item => {
      const newName = 'S' + String(item.index + 1).padStart(3, '0') + item.ext;
      fs.renameSync(item.temp, path.join(shieldsDir, newName));
    });
    counts['shields'] = files.length;
    console.log(`[shields] リネーム完了: ${files.length}枚 -> S001...`);
  }
}

console.log('集計結果:');
console.log(JSON.stringify(counts, null, 2));
