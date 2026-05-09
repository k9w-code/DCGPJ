const fs = require('fs');

// 1. Rewrite style.css mobile block with the REVERTED and SLIMMED settings
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const revertedMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: REVERT & SLIM (v105)
   Back to what worked, and slimming the modal
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

  /* SLIMMED MODAL: No more huge black borders */
  html body .card-detail-modal {
    width: 80vw !important;
    max-width: 700px !important;
    height: 88vh !important;
    flex-direction: row !important;
    padding: 20px !important;
    gap: 20px !important;
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
    padding: 10px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 15px !important;
  }

  /* Sane Font Sizes */
  html body .card-detail-overlay .cd-name { font-size: 26px !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 18px !important; line-height: 1.4 !important; }
  html body .card-detail-overlay .cd-cost { width: 55px !important; height: 55px !important; font-size: 28px !important; }

  /* MULLIGAN REVERT: Back to 45vh (the "Good" state) */
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
  .mulligan-panel h2 { font-size: 28px !important; margin: 0 !important; }
  .mulligan-panel p { font-size: 18px !important; margin: 0 !important; }
  .mulligan-cards { gap: 20px !important; margin: 0 !important; }
  .mulligan-actions { margin-top: 1vh !important; gap: 30px !important; }
  .mulligan-actions .btn { font-size: 24px !important; padding: 12px 40px !important; }
}

@media (max-height: 400px) {
  html body .card-detail-modal { height: 95vh !important; }
}
`;

// Replace the previous "Structural Reform" block (v104)
const v104Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v104Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v104Pattern, revertedMobileStyles.trim());
} else {
  styleCss += revertedMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v105
const version = 'v105_revert';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
