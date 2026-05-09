const fs = require('fs');

// 1. Rewrite style.css: Override global paddings and gaps for mobile to fit everything in one view
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const trueOneViewStyles = `
/* ==========================================
   MOBILE STABILIZATION: TRUE ONE-VIEW (v111)
   No more hiding content. Fitting it by shrinking gaps.
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

  /* DETAIL MODAL: COMPACT ONE-VIEW */
  html body .card-detail-overlay {
    z-index: 100000 !important;
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: auto !important;
    max-width: 96vw !important;
    height: 85vh !important; /* Slightly more space */
    flex-direction: row !important;
    padding: 1.5vh !important; /* Tight padding */
    gap: 1.5vh !important; /* Tight gap */
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
  }

  /* IMAGE AREA: 5:7 ratio maintained */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    height: 100% !important; 
    aspect-ratio: 5 / 7 !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important;
  }

  /* INFO AREA: Eliminate all global PX gaps */
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1vh !important; /* Tight internal gap */
    overflow-y: auto !important; /* Re-enable scroll JUST IN CASE, but aim for none */
  }

  /* Header Overrides: Kill the 20px gaps */
  html body .card-detail-overlay .cd-header { 
    gap: 1vh !important; 
    padding-bottom: 1vh !important; 
    margin-bottom: 0 !important; 
    border-bottom-width: 1px !important;
  }
  
  html body .card-detail-overlay .cd-name { 
    font-size: 3.5vh !important; 
    margin: 0 !important;
  }
  
  html body .card-detail-overlay .cd-cost { 
    width: 6vh !important; height: 6vh !important; 
    font-size: 3vh !important; 
    border-width: 2px !important;
  }

  /* Tags & Stats Overrides: Kill margins */
  html body .card-detail-overlay .cd-type-tags { gap: 0.5vh !important; margin-bottom: 0.5vh !important; }
  html body .card-detail-overlay .cd-type-tag,
  html body .card-detail-overlay .cd-color-tag { font-size: 2.2vh !important; padding: 0.2vh 1vh !important; }
  html body .card-detail-overlay .cd-color-icon { width: 3vh !important; height: 3vh !important; }

  html body .card-detail-overlay .cd-stats { gap: 2vh !important; margin-bottom: 1vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 3vh !important; gap: 0.5vh !important; }
  html body .card-detail-overlay .cd-stat-icon { font-size: 3.2vh !important; }

  /* Text Box Overrides: Kill the 30px padding */
  html body .card-detail-overlay .cd-text-box { 
    padding: 1.2vh !important; 
    gap: 0.8vh !important; 
    font-size: 2.8vh !important; 
    border-radius: 8px !important;
  }
  html body .card-detail-overlay .cd-effect-text { margin-bottom: 0 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2vh !important; padding-top: 0.5vh !important; margin-top: 0 !important; }

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
}
`;

// Replace the previous "One View Final" block (v110)
const v110Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v110Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v110Pattern, trueOneViewStyles.trim());
} else {
  styleCss += trueOneViewStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v111
const version = 'v111_true_oneview';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
