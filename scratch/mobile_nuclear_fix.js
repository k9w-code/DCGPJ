const fs = require('fs');

// 1. Nuclear cleanup of style.css media queries
let lines = fs.readFileSync('public/css/style.css', 'utf8').split('\n');
// Find the first occurrence of @media (max-width: 1250px)
const cutPoint = lines.findIndex(l => l.includes('@media (max-width: 1250px)') || l.includes('@media (max-height: 500px)'));

if (cutPoint !== -1) {
  lines = lines.slice(0, cutPoint);
}
let styleCss = lines.join('\n');

const nuclearMobileStyles = `
/* ==========================================
   ULTIMATE MOBILE STANDARDIZATION (v100)
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* Higher specificity selectors to guarantee reflection */
  html body .card-name { font-size: 24px !important; }
  html body .card-text, 
  html body .ability-text, 
  html body .cd-ability-desc { font-size: 18px !important; line-height: 1.3 !important; }
  
  html body .btn, 
  html body .btn-primary, 
  html body .btn-secondary { font-size: 24px !important; padding: 10px 20px !important; }
  
  /* Card Detail Overlay - Absolute Specificity */
  html body .card-detail-overlay .cd-name { font-size: 36px !important; line-height: 1.1 !important; }
  html body .card-detail-overlay .cd-effect-text, 
  html body .card-detail-overlay .cd-ability-text { font-size: 24px !important; line-height: 1.3 !important; font-weight: 700 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 18px !important; line-height: 1.4 !important; }
  html body .card-detail-overlay .cd-cost { width: 70px !important; height: 70px !important; font-size: 36px !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 32px !important; }
  
  /* Mulligan Absolute Shrink */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    width: 90px !important; 
    height: 126px !important; 
    min-width: auto !important;
    min-height: auto !important;
  }
  .mulligan-panel { 
    min-height: auto !important; 
    max-height: 100vh !important; 
    padding: 0 !important; 
    justify-content: flex-start !important;
    padding-top: 10px !important;
  }
  .mulligan-cards { gap: 5px !important; margin-bottom: 10px !important; }
  .mulligan-actions { margin-top: 0 !important; padding-bottom: 10px !important; }

  /* iOS specific stabilizing overrides */
  @supports (-webkit-touch-callout: none) {
    .overlay, .card-detail-overlay, #shield-break-overlay {
      background: rgba(0,0,0,0.85) !important;
      z-index: 20000 !important;
    }
    .deck-builder-header, .collection-header, .deck-panel-header, .glass-panel, .panel {
      background: rgba(25, 35, 65, 0.98) !important;
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
    }
  }
}

/* Landscape constraint */
@media (max-height: 500px) {
  .card-detail-modal { flex-direction: row !important; height: 95% !important; }
  .cd-image-area { flex: 0 0 35% !important; height: 100% !important; }
  .cd-info-area { overflow-y: auto !important; }
}
`;

styleCss += nuclearMobileStyles;
fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v100_final
const version = 'v100_final';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
  console.log(`Updated ${path} to cache version ${version}`);
});
