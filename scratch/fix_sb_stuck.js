const fs = require('fs');

// 1. server.js 修正
let s = fs.readFileSync('server.js', 'utf8');
if (!s.includes('resolve_shield_break')) {
    s = s.replace("case 'surrender':", 
`case 'resolve_shield_break':
          result = room.engine.resolvePendingShieldBreak();
          break;
        case 'surrender':`);
    fs.writeFileSync('server.js', s, 'utf8');
}

// 2. game-client.js 修正
let c = fs.readFileSync('public/js/game-client.js', 'utf8');
if (!c.includes('resolve_shield_break')) {
    const clickCode = `
  // --- シールドブレイク演出の続行 ---
  const sbOverlay = document.getElementById('shield-break-overlay');
  if (sbOverlay) {
    sbOverlay.onclick = () => {
      sbOverlay.style.display = 'none';
      socket.emit('game_action', { action: 'resolve_shield_break' });
      if (window.audioManager) window.audioManager.playSE('click');
    };
  }
`;
    c = c.replace('initInteractions();', clickCode + '\ninitInteractions();');
    fs.writeFileSync('public/js/game-client.js', c, 'utf8');
}

console.log('Shield break resolution logic fixed.');
