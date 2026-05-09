const fs = require('fs');

// 1. Rewrite style.css mobile block with ASPECT-RATIO and SLIMMER TEXT
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const noBlackBarsMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: NO BLACK BARS (v108)
   Fixing Aspect Ratio to eliminate vertical gaps
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

  /* DETAIL MODAL: NO BLACK BARS STRATEGY */
  html body .card-detail-overlay {
    z-index: 100000 !important;
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: auto !important; /* Fit to content */
    max-width: 92vw !important;
    height: auto !important; /* Fit to content */
    max-height: 90vh !important;
    flex-direction: row !important;
    padding: 12px !important;
    gap: 12px !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
  }

  /* IMAGE AREA: FORCED 5:7 RATIO TO ELIMINATE GAPS */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    height: 70vh !important; /* Base height */
    aspect-ratio: 5 / 7 !important; /* Match physical card */
    background-size: cover !important; /* Fill the 5:7 box perfectly */
    background-repeat: no-repeat !important;
    background-position: center !important;
    border-radius: 8px !important;
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    max-width: 350px !important;
    overflow-y: auto !important;
    padding: 0 10px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }

  /* Font Sizes: Reduced to prevent stretching the whole modal */
  html body .card-detail-overlay .cd-name { font-size: 20px !important; margin: 0 !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 16px !important; line-height: 1.3 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 13px !important; opacity: 0.7 !important; }
  
  /* Icon adjustments */
  html body .card-detail-overlay .cd-cost { 
    width: 40px !important; height: 40px !important; 
    font-size: 20px !important; 
  }
  html body .card-detail-overlay .cd-stat-icon { width: 18px !important; height: 18px !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 20px !important; }

  /* MULLIGAN: KEEPING THE 45VH STATE THAT WORKED */
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

/* Landscape orientation optimization */
@media (max-height: 400px) {
  html body .card-detail-overlay .cd-image-area { height: 60vh !important; }
}
`;

// Replace the previous "Merged" block (v107)
const v107Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v107Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v107Pattern, noBlackBarsMobileStyles.trim());
} else {
  styleCss += noBlackBarsMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v108
const version = 'v108_nobars';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
