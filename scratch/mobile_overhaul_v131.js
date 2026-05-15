const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.131
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.130</h1>', '<h1>DCG TESTPLAY Vol.131</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS LAYOUT OVERHAUL (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const mobileOverhaul = `
/* ==========================================
   MOBILE STABILIZATION: LAYOUT OVERHAUL (v131)
   Smartphone-specific zoom-in for battle UI
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  
  /* 1. Grid Compression */
  .game-container {
    grid-template-columns: 440px 1fr 360px !important;
  }
  
  .left-side {
    min-width: 440px !important;
    padding: 10px !important;
  }
  
  .right-side {
    min-width: 360px !important;
    padding: 10px !important;
  }

  /* 2. Scale Up UI Elements */
  /* Avatar Blocks */
  .avatar-block {
    transform: scale(1.25) !important;
  }
  .player-block {
    transform-origin: left bottom !important;
  }
  .opponent-block {
    transform-origin: left top !important;
  }

  /* Right Side Panels */
  .log-panel {
    transform: scale(1.15) !important;
    transform-origin: right top !important;
    height: 300px !important;
  }
  
  .action-panel {
    transform: scale(1.2) !important;
    transform-origin: right bottom !important;
  }
  
  .turn-indicator {
    transform: scale(1.3) !important;
    transform-origin: right top !important;
    margin-bottom: 25px !important;
  }

  /* 3. Scale Up Battlefield (Cards on Board) */
  .center-area {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
  }

  .battlefield-3d {
    transform: scale(1.2) !important;
    transform-origin: center center !important;
  }

  /* Reduce vertical gaps to prevent overflow when scaled */
  .board-half {
    gap: 8px !important;
  }
  .battlefield-divider {
    height: 60px !important;
  }
  
  /* 4. Hand Cards Optimization */
  .hand-area-wrapper {
    bottom: -4dvh !important; /* Sink further to make room for larger battlefield */
  }
  .hand-card {
    transform: scale(1.1) !important;
    transform-origin: bottom center !important;
  }
  .hand-card:hover {
    transform: scale(1.5) translateY(-4vh) !important;
  }
}
`;

css += mobileOverhaul;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v131_mobile_overhaul"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.131 Mobile Overhaul Deployed');
