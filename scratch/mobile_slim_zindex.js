const fs = require('fs');

// 1. Rewrite style.css mobile block with SLIMMER settings and HIGH Z-INDEX
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const slimmerMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: SLIM & Z-INDEX (v106)
   Further font reduction to fix vertical gaps
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE: Full removal of blurs */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  /* DETAIL MODAL: Slimmer to fit portrait illustrations perfectly */
  html body .card-detail-overlay {
    z-index: 100000 !important; /* Ensure it stays above mulligan */
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: 75vw !important;
    max-width: 600px !important;
    height: 80vh !important;
    flex-direction: row !important;
    padding: 15px !important;
    gap: 15px !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    position: fixed !important;
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
    gap: 10px !important; /* Tighten internal gaps */
  }

  /* Font Sizes: Reduced to fix vertical height pull */
  html body .card-detail-overlay .cd-name { font-size: 22px !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 16px !important; line-height: 1.3 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 14px !important; }
  html body .card-detail-overlay .cd-cost { width: 45px !important; height: 45px !important; font-size: 24px !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 22px !important; }
}
`;

// Replace the previous "Revert & Slim" block (v105)
const v105Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v105Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v105Pattern, slimmerMobileStyles.trim());
} else {
  styleCss += slimmerMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v106
const version = 'v106_slim';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
