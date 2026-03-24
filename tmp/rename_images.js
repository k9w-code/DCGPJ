const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '../public/assets/images/cards');
const dirs = ['black', 'blue', 'green', 'rainbow', 'red', 'white'];
const counts = {};

dirs.forEach(d => {
  const dirPath = path.join(baseDir, d);
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.match(/\.(png|jpe?g|webp|gif)$/i));
  counts[d] = files.length;
  if (files.length === 0) return;
  
  // To avoid naming collisions during rename, first rename to a temp name
  const tempNames = [];
  files.forEach((f, i) => {
    const oldPath = path.join(dirPath, f);
    const tempName = path.join(dirPath, `_temp_${i}${path.extname(f)}`);
    fs.renameSync(oldPath, tempName);
    tempNames.push({ temp: tempName, ext: path.extname(f), index: i });
  });
  
  // Then rename to 001.png format
  tempNames.forEach(item => {
    const newName = String(item.index + 1).padStart(3, '0') + item.ext;
    fs.renameSync(item.temp, path.join(dirPath, newName));
  });
  
  console.log(`[${d}] リネーム完了: ${files.length}枚`);
});

console.log('集計結果:');
console.log(JSON.stringify(counts, null, 2));
