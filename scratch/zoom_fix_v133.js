const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.133
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.132</h1>', '<h1>DCG TESTPLAY Vol.133</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. MOBILE UX REFINEMENT (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const battlefieldZoom = `
/* ==========================================
   MOBILE STABILIZATION: BATTLEFIELD ZOOM (v133)
   Fixing clipped HUD and enlarging board
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  
  /* Fix clipped NPC icons */
  .side-area {
    overflow: visible !important; /* Allow scaled icons to be seen */
  }
  
  .tribe-hud {
    transform: scale(1.1) !important; /* Slightly smaller scale to fit better */
    gap: 8px !important;
  }
  
  /* BATTLEFIELD ZOOM: Make cards physically larger */
  .battlefield-3d {
    transform: scale(1.22) !important; /* Zoom in on the board */
    transform-origin: center center !important;
  }

  /* Optimize vertical space for the zoomed board */
  .battlefield-divider {
    height: 40px !important;
    margin: 5px 0 !important;
  }
  .board-half {
    gap: 6px !important;
  }
  
  /* Hand position adjustment to avoid board overlap */
  .hand-area-wrapper {
    bottom: -2dvh !important;
  }

  /* Ensure card slots are distinct */
  .card-slot {
    border-width: 2px !important;
  }

  /* NPC specific fix */
  .opponent-block .avatar-info {
    padding-left: 5px !important;
  }
}
`;

css += battlefieldZoom;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v133_zoom_fix"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.133 Battlefield Zoom Deployed');
