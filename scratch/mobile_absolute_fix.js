const fs = require('fs');

// 1. Rewrite style.css mobile block with Absolute Pixel Units for stability
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const absolutePixelMobileStyles = `
/* ==========================================
   ABSOLUTE PIXEL MOBILE STABILIZATION (v103)
   Fixed sizes for reliable display on all screens
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* Board Elements */
  html body .card-name { font-size: 18px !important; }
  html body .card-text, html body .ability-text { font-size: 14px !important; }
  
  /* Detail Modal - Absolute constraint to prevent "Huge/Tiny" shifts */
  html body .card-detail-modal {
    width: 85vw !important;
    max-width: 550px !important; /* Cap it for larger screens */
    height: auto !important;
    max-height: 90vh !important;
    flex-direction: column !important; /* Stack on mobile */
    padding: 15px !important;
    gap: 15px !important;
    overflow-y: auto !important;
    background: rgba(10, 15, 30, 0.98) !important;
    border: 2px solid var(--accent) !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    position: fixed !important;
  }
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    width: 100% !important;
    height: 35vh !important; /* Reasonable image height */
    background-size: contain !important;
    background-repeat: no-repeat !important;
  }
  html body .card-detail-overlay .cd-info-area { 
    flex: 0 0 auto !important;
    width: 100% !important;
    padding: 10px 0 !important;
    gap: 15px !important;
  }
  html body .card-detail-overlay .cd-name { font-size: 24px !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 18px !important; line-height: 1.4 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 14px !important; display: block !important; opacity: 0.8 !important; }
  html body .card-detail-overlay .cd-cost { width: 50px !important; height: 50px !important; font-size: 24px !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 24px !important; }

  /* Mulligan Screen - Tightened and Centered */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    height: 38vh !important; /* Slightly smaller for more space */
    width: auto !important; 
    aspect-ratio: 5/7 !important;
  }
  .mulligan-panel { 
    height: 100vh !important;
    padding: 1vh !important; 
    gap: 1vh !important; /* Tighten vertical gap */
  }
  .mulligan-panel h2 { font-size: 24px !important; margin-bottom: 5px !important; }
  .mulligan-panel p { font-size: 16px !important; margin-bottom: 5px !important; }
  .mulligan-cards { gap: 15px !important; }
  .mulligan-actions { margin-top: 10px !important; gap: 20px !important; }
  .mulligan-actions .btn { font-size: 20px !important; padding: 10px 30px !important; }

  /* Result Screen */
  .result-title { font-size: 8vh !important; }
}

/* Landscape orientation tweak */
@media (max-height: 400px) {
  html body .card-detail-modal { height: 95vh !important; }
  html body .card-detail-overlay .cd-image-area { height: 25vh !important; }
}
`;

// Replace the previous "Viewport" block (v102)
const v102Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 450px\) \{[\s\S]*?\}\n\}/;
if (v102Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v102Pattern, absolutePixelMobileStyles.trim());
} else {
  styleCss += absolutePixelMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v103
const version = 'v103_absolute';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
