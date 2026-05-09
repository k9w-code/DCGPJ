const fs = require('fs');

// 1. Rewrite style.css mobile block to MERGE Mulligan Fix (v105) and Detail Slimming (v106)
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const mergedMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: MERGED FIX (v107)
   Restoring Mulligan (45vh) and keeping Detail Slimming
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

  /* DETAIL MODAL: SLIM & ACCESSIBLE (v106 settings) */
  html body .card-detail-overlay {
    z-index: 100000 !important;
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: 75vw !important;
    max-width: 600px !important;
    height: 85vh !important;
    flex-direction: row !important;
    padding: 15px !important;
    gap: 15px !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
  }

  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 45% !important;
    height: 100% !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 5px !important;
    gap: 10px !important;
  }

  html body .card-detail-overlay .cd-name { font-size: 22px !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 16px !important; line-height: 1.3 !important; }
  html body .card-detail-overlay .cd-cost { width: 45px !important; height: 45px !important; font-size: 24px !important; }

  /* MULLIGAN RECOVERY: Restoring the 45vh setting that worked (v105 settings) */
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
  .mulligan-panel h2 { font-size: 26px !important; margin: 0 !important; }
  .mulligan-panel p { font-size: 16px !important; margin: 0 !important; }
  .mulligan-cards { gap: 15px !important; margin: 0 !important; }
  .mulligan-actions { margin-top: 1vh !important; gap: 30px !important; }
  .mulligan-actions .btn { font-size: 22px !important; padding: 10px 30px !important; }
}

@media (max-height: 400px) {
  html body .card-detail-modal { height: 95vh !important; }
}
`;

// Replace the previous "Slim & Z-Index" block (v106)
const v106Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v106Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v106Pattern, mergedMobileStyles.trim());
} else {
  styleCss += mergedMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v107
const version = 'v107_merged';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
