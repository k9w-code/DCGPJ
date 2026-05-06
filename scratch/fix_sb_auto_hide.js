const fs = require('fs');

// 1. game-renderer.js 修正
let r = fs.readFileSync('public/js/game-renderer.js', 'utf8');
const hideModalCode = `
  // シールドブレイク中でなければモーダルを隠す
  const sbOverlay = document.getElementById('shield-break-overlay');
  if (sbOverlay && state.phase !== 'shield_break_anim') {
    sbOverlay.style.display = 'none';
  }
`;
if (!r.includes('state.phase !== \'shield_break_anim\'')) {
    r = r.replace('function renderBoard(state, selectedCard, selectedAttacker, onSlotClick) {', 
                 'function renderBoard(state, selectedCard, selectedAttacker, onSlotClick) {' + hideModalCode);
    fs.writeFileSync('public/js/game-renderer.js', r, 'utf8');
}

// 2. vfx_v6 への更新
let h = fs.readFileSync('public/game.html', 'utf8');
h = h.replace(/\?v=vfx_v5/g, '?v=vfx_v6');
fs.writeFileSync('public/game.html', h, 'utf8');

console.log('Renderer auto-hide logic fixed and version updated to v6.');
