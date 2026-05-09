const fs = require('fs');

// 1. Rewrite style.css mobile block with ONE-VIEW (VH-BASED) settings
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const oneViewMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: ONE-VIEW (v109)
   VH-based scaling to ensure NO SCROLLING
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE & STABILITY */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .glass-panel, .panel, .overlay, .modal { background: rgba(15, 20, 35, 0.95) !important; }

  /* FIX: iPhone Home Indicator collision */
  .player-hand { 
    bottom: 25px !important; 
    padding-bottom: env(safe-area-inset-bottom) !important;
  }

  /* DETAIL MODAL: ONE-VIEW STRATEGY (Fits within 80vh) */
  html body .card-detail-overlay {
    z-index: 100000 !important;
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: auto !important;
    max-width: 95vw !important;
    height: 80vh !important; /* Fixed to 80% of screen height */
    flex-direction: row !important;
    padding: 2vh !important;
    gap: 2vh !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important; /* NO SCROLLING */
  }

  /* IMAGE AREA: Full view, no cropping */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    height: 100% !important; /* Fill modal height */
    aspect-ratio: 5 / 7 !important;
    background-size: contain !important; /* Full card visible */
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-color: transparent !important;
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1.5vh !important; /* Scaling gap */
    overflow: hidden !important;
  }

  /* Font Sizes: Scale with Viewport Height (vh) to ensure fit */
  html body .card-detail-overlay .cd-name { 
    font-size: 4.5vh !important; 
    margin: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { 
    font-size: 3.2vh !important; 
    line-height: 1.3 !important; 
  }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2.5vh !important; opacity: 0.6 !important; }
  
  /* Icon Scaling with VH */
  html body .card-detail-overlay .cd-cost { 
    width: 8vh !important; height: 8vh !important; 
    font-size: 4vh !important; 
  }
  html body .card-detail-overlay .cd-stat-icon { width: 3.5vh !important; height: 3.5vh !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 4vh !important; }
  
  html body .card-detail-overlay .cd-type-badge,
  html body .card-detail-overlay .cd-color-badge,
  html body .card-detail-overlay .cd-rarity-badge {
    padding: 0.5vh 2vh !important;
    font-size: 2.5vh !important;
  }

  /* MULLIGAN: PRESERVING THE STABLE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    height: 45vh !important; 
    width: auto !important; 
    aspect-ratio: 5/7 !important;
  }
  .mulligan-panel { 
    height: 100vh !important;
    padding: 2vh !important; 
    gap: 2vh !important; 
    justify-content: center !important;
  }
  .mulligan-panel h2 { font-size: 24px !important; margin: 0 !important; }
  .mulligan-panel p { font-size: 16px !important; margin: 0 !important; }
  .mulligan-cards { gap: 15px !important; }
  .mulligan-actions { margin-top: 2vh !important; gap: 30px !important; }
  .mulligan-actions .btn { font-size: 22px !important; padding: 10px 35px !important; }
}

/* Specific fix for ultra-short phones */
@media (max-height: 400px) {
  html body .card-detail-modal { height: 90vh !important; }
  html body .card-detail-overlay .cd-name { font-size: 6vh !important; }
}
`;

// Replace the previous "No Black Bars" block (v108)
const v108Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v108Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v108Pattern, oneViewMobileStyles.trim());
} else {
  styleCss += oneViewMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v109
const version = 'v109_oneview';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
