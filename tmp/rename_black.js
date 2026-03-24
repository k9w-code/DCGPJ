const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, '../public/assets/images/cards/black');

if (!fs.existsSync(dirPath)) {
  console.log('black dir not found');
  process.exit(0);
}

let files = fs.readdirSync(dirPath).filter(f => f.match(/\.(png|jpe?g|webp|gif)$/i));
files.sort();

if (files.length === 0) {
  console.log('no files in black dir');
  process.exit(0);
}

const tempNames = [];
files.forEach((f, i) => {
  const oldPath = path.join(dirPath, f);
  const tempName = path.join(dirPath, `_temp_${i}${path.extname(f)}`);
  fs.renameSync(oldPath, tempName);
  tempNames.push({ temp: tempName, ext: path.extname(f), index: i });
});

tempNames.forEach(item => {
  const newName = 'B' + String(item.index + 1).padStart(3, '0') + item.ext;
  fs.renameSync(item.temp, path.join(dirPath, newName));
});

console.log(`[black] リネーム完了: ${files.length}枚 -> B001...`);
