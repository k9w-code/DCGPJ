const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.128
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.127</h1>', '<h1>DCG TESTPLAY Vol.128</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS UX IMPROVEMENTS (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const battleUXCSS = `
  @media (max-width: 1250px) {
    /* Enlarge Tribe HUD (Avatar side) */
    .tribe-hud {
      gap: 10px !important;
      margin-top: 5px !important;
      transform: scale(1.2) !important;
      transform-origin: left center !important;
    }
    .tribe-hud .tribe-icon-mini {
      width: 32px !important;
      height: 32px !important;
      border-width: 2px !important;
    }
    
    /* Enlarge Level-up Buttons (Right panel) */
    .crystal-buttons {
      gap: 15px !important;
      margin: 25px 0 !important;
      padding: 5px !important;
    }
    .crystal-btn {
      width: 80px !important;
      height: 80px !important;
      border-width: 3px !important;
      position: relative !important;
    }
    /* Invisible touch padding */
    .crystal-btn::after {
      content: '';
      position: absolute;
      inset: -15px;
      z-index: 1;
    }
    
    /* Enlarge Battle Log */
    .log-panel {
      height: 250px !important; /* Increase height */
      font-size: 16px !important;
    }
    .log-content {
      line-height: 1.5 !important;
    }
    .log-entry {
      margin-bottom: 8px !important;
      padding: 4px 8px !important;
    }

    /* Enlarge SP and Life */
    .life-value {
      font-size: 28px !important;
    }
    .sp-orbs-container {
      transform: scale(1.2) !important;
      transform-origin: left center !important;
      margin-top: 8px !important;
    }
    
    /* Panel Adjustments */
    .action-panel {
      padding: 20px !important;
    }
    .panel-subtitle {
      font-size: 14px !important;
      margin-bottom: 15px !important;
    }
    .btn-end-turn {
      height: 80px !important;
      font-size: 24px !important;
    }
  }
`;

css += battleUXCSS;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v128_ux_boost"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.128 Battle UX Boost Deployed');
