const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.132
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.131</h1>', '<h1>DCG TESTPLAY Vol.132</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. EMERGENCY CSS REPAIR (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

// Remove the disastrous v131 block
const v131Marker = 'MOBILE STABILIZATION: LAYOUT OVERHAUL (v131)';
if (css.includes(v131Marker)) {
    css = css.split(v131Marker)[0];
    // Remove the potential trailing curly brace from previous split if any
    css = css.trim();
    if (css.endsWith('@media (max-width: 1250px), (max-height: 800px) {')) {
        css += '\n}';
    }
}

// Ensure the CSS file isn't broken
if (!css.endsWith('}')) css += '\n}';

const stableMobileUX = `
/* ==========================================
   MOBILE STABILIZATION: STABLE EXPANSION (v132)
   Safe, non-destructive UI enlargement
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  
  /* Reset Grid to stable proportions */
  .game-container {
    grid-template-columns: 480px 1fr 420px !important;
  }
  
  /* Increase Font Sizes and Padding instead of Scaling */
  .log-panel {
    height: 280px !important;
    font-size: 16px !important;
  }
  .log-content {
    line-height: 1.4 !important;
  }
  
  /* Larger Buttons (Non-destructive) */
  .crystal-btn {
    width: 70px !important;
    height: 70px !important;
  }
  
  .btn-end-turn {
    height: 70px !important;
    font-size: 22px !important;
  }

  /* Stabilize Hand */
  .hand-area-wrapper {
    bottom: -1dvh !important;
  }
  
  /* Ensure Battlefield stays visible */
  .battlefield-3d {
    transform: scale(1.1) !important;
    transform-origin: center center !important;
  }

  /* Avatar Info Visibility */
  .player-name { font-size: 26px !important; }
  .status-row { font-size: 16px !important; }
}
`;

css += stableMobileUX;

// Clean up duplicated media queries if they exist (safe measure)
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v132_emergency_fix"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.132 Emergency Fix Deployed');
