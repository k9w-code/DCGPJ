const fs = require('fs');

// 1. Rewrite style.css mobile block with fixed coordinate system logic
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const fixedCoordinateMobileStyles = `
/* ==========================================
   FIXED COORDINATE MOBILE ADJUSTMENTS (v101)
   Optimized for 1920x1080 Virtual Canvas
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* Board scaling - Keep it readable */
  html body .card-name { font-size: 24px !important; }
  html body .card-text, html body .ability-text { font-size: 18px !important; }
  html body .btn { font-size: 24px !important; }
  
  /* Card Detail Modal - Fix within 1920x1080 */
  html body .card-detail-modal {
    width: 1400px !important; 
    height: 800px !important; 
    flex-direction: row !important; 
    padding: 40px !important;
    gap: 40px !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    background: rgba(10, 15, 30, 0.98) !important;
  }
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 500px !important; 
    height: 700px !important; 
    min-height: auto !important;
  }
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important; 
    overflow-y: auto !important; 
    max-height: 700px !important; 
    padding: 0 !important;
    gap: 20px !important;
  }
  html body .card-detail-overlay .cd-name { font-size: 42px !important; }
  html body .card-detail-overlay .cd-effect-text { font-size: 26px !important; line-height: 1.4 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 20px !important; display: block !important; }
  html body .card-detail-overlay .cd-cost { width: 80px !important; height: 80px !important; font-size: 40px !important; }

  /* Mulligan Screen - Comfortable Spacing */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    width: 180px !important; 
    height: 252px !important; 
  }
  .mulligan-panel { 
    min-height: auto !important; 
    max-height: none !important; 
    padding: 40px !important; 
    gap: 60px !important; /* Space between title, cards, and buttons */
  }
  .mulligan-cards { gap: 40px !important; }
  .mulligan-actions { margin-top: 20px !important; gap: 40px !important; }
  .mulligan-actions .btn { font-size: 32px !important; padding: 20px 60px !important; }

  /* Global UI elements in 1920x1080 */
  .result-title { font-size: 120px !important; }
  .result-content { font-size: 32px !important; }
}
`;

// Replace the previous "Ultimate" block (v100)
const v100Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 500px\) \{[\s\S]*?\}\n\}/;
if (v100Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v100Pattern, fixedCoordinateMobileStyles.trim());
} else {
  // If pattern failed, just append (safest for now)
  styleCss += fixedCoordinateMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v101
const version = 'v101_final';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
