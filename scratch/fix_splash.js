const fs = require('fs');

// 1. style.css 修正
let c = fs.readFileSync('public/css/style.css', 'utf8');
c = c.replace(/\.turn-splash\s*\{[\s\S]*?z-index:\s*100000;[\s\S]*?\}/, 
`.turn-splash {
  position: absolute;
  inset: 0;
  display: none !important;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 20px;
  z-index: 20000;
  pointer-events: none;
  background: rgba(0,0,0,0.1);
}`);
fs.writeFileSync('public/css/style.css', c, 'utf8');

// 2. game.html 修正
let h = fs.readFileSync('public/game.html', 'utf8');
const splashStart = h.indexOf('<div id="turn-splash"');
const splashEnd = h.indexOf('</div>', h.indexOf('splash-sub', splashStart)) + 6;
if (splashStart !== -1) {
    const splashBlock = h.substring(splashStart, splashEnd);
    h = h.replace(splashBlock, ''); // body直下から削除
    // game-container内部（vfx-layerの前）に挿入
    h = h.replace('<div id="vfx-layer"', splashBlock + '\n      <div id="vfx-layer"');
}
fs.writeFileSync('public/game.html', h, 'utf8');

// 3. vfx-engine.js 修正
let v = fs.readFileSync('public/js/vfx-engine.js', 'utf8');
v = v.replace(/sub\.textContent\s*=\s*isMyTurn\s*\?\s*'.*?'\s*:\s*'.*?'/, 
    'sub.textContent = isMyTurn ? "作戦を立てよう" : "相手のターンです"');
fs.writeFileSync('public/js/vfx-engine.js', v, 'utf8');

console.log('Turn splash fix applied successfully.');
