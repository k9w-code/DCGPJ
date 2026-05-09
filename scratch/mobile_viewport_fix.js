const fs = require('fs');

// 1. Rewrite style.css mobile block with Viewport Units (vw/vh)
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const viewportResponsiveStyles = `
/* ==========================================
   VIEWPORT-BASED RESPONSIVE MOBILE (v102)
   Bypassing JS scaling artifacts
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* Board scaling - Screen relative */
  html body .card-name { font-size: 3.5vw !important; }
  html body .card-text, html body .ability-text { font-size: 3vw !important; }
  html body .btn { font-size: 4vw !important; }
  
  /* Card Detail Modal - Viewport relative ensures no clipping */
  html body .card-detail-modal {
    width: 92vw !important; 
    height: 85vh !important; 
    flex-direction: row !important; 
    padding: 3vw !important;
    gap: 3vw !important;
    max-width: none !important;
    max-height: none !important;
    overflow: hidden !important;
    background: rgba(10, 15, 30, 0.98) !important;
  }
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 35vw !important; 
    height: 100% !important; 
  }
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important; 
    overflow-y: auto !important; 
    padding-right: 1vw !important;
    gap: 2vh !important;
  }
  html body .card-detail-overlay .cd-name { font-size: 5vw !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 3.5vw !important; line-height: 1.3 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2.5vw !important; display: block !important; }
  html body .card-detail-overlay .cd-cost { width: 8vw !important; height: 8vw !important; font-size: 5vw !important; }

  /* Mulligan Screen - Guaranteed Button Visibility using VH */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    height: 45vh !important; 
    width: auto !important; 
    aspect-ratio: 5/7 !important;
  }
  .mulligan-panel { 
    min-height: auto !important; 
    height: 100vh !important;
    padding: 2vh !important; 
    gap: 2vh !important; 
    justify-content: center !important;
  }
  .mulligan-cards { gap: 2vw !important; }
  .mulligan-actions { margin-top: 2vh !important; gap: 4vw !important; }
  .mulligan-actions .btn { font-size: 4vh !important; padding: 1vh 5vw !important; }

  /* Other UI elements */
  .result-title { font-size: 15vh !important; }
  
  @supports (-webkit-touch-callout: none) {
    .overlay, .card-detail-overlay, #shield-break-overlay {
      background: rgba(0,0,0,0.85) !important;
      z-index: 20000 !important;
    }
  }
}

/* Landscape Mobile Fix */
@media (max-height: 450px) {
  html body .card-detail-modal { height: 95vh !important; padding: 2vh !important; }
  html body .card-detail-overlay .cd-name { font-size: 6vh !important; }
  html body .card-detail-overlay .cd-effect-text { font-size: 4vh !important; }
}
`;

// Replace the previous "Fixed" block (v101)
const v101Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 500px\) \{[\s\S]*?\}\n\}/;
if (v101Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v101Pattern, viewportResponsiveStyles.trim());
} else {
  styleCss += viewportResponsiveStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v102
const version = 'v102_viewport';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
