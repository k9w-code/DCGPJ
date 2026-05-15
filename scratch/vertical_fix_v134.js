const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.134
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.133</h1>', '<h1>DCG TESTPLAY Vol.134</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. MOBILE VERTICAL OPTIMIZATION (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const verticalOptimization = `
/* ==========================================
   MOBILE STABILIZATION: VERTICAL OPTIMIZATION (v134)
   Compress board gaps, anchor top, clear hand space
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {

  /* Compress Battlefield Gaps */
  .battlefield-3d {
    padding: 15px !important;
    gap: 8px !important;
    transform: scale(1.15) !important;
    transform-origin: top center !important; /* Anchor to top to free bottom space */
  }

  /* Compress Card Slots */
  .board-half {
    grid-template-rows: repeat(2, 202px) !important; /* Barely larger than 196px card */
    gap: 8px !important;
    min-height: auto !important;
  }

  .battlefield-divider {
    height: 2px !important;
    margin: 5px 0 !important;
  }

  /* Push Battlefield Container up */
  .battlefield-container {
    align-items: flex-start !important; /* Align to top */
    padding-top: 15px !important;
  }

  /* Optimize Hand Positioning */
  .hand-area-wrapper {
    bottom: 0 !important;
    padding-bottom: calc(env(safe-area-inset-bottom) + 15px) !important; /* Safe area + extra clearance */
  }
  
  .hand-card {
    transform: scale(0.9) !important; /* Shrink to avoid covering board stats */
    transform-origin: bottom center !important;
  }
  
  .hand-card:hover {
    transform: scale(1.4) translateY(-30px) !important; /* Pop up over the board when touched */
    z-index: 1000 !important;
  }
}
`;

css += verticalOptimization;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v134_vertical_fix"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.134 Vertical Optimization Deployed');
