const fs = require('fs');

// 1. Rewrite style.css: Slim Image Area & Priority for Info Area
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const infoPriorityMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: INFO PRIORITY (v113)
   Slimming image to give text more width
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE & STABILITY */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  /* DETAIL MODAL: INFO PRIORITY LAYOUT */
  html body .card-detail-overlay {
    z-index: 2147483647 !important; /* MAX INT32 */
    display: flex !important;
    background: rgba(0,0,0,0.9) !important;
  }
  
  html body .card-detail-modal {
    width: 94vw !important; /* Use almost full width */
    height: 85vh !important;
    flex-direction: row !important;
    padding: 1.5vh !important;
    gap: 2vh !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  /* IMAGE AREA: SLIMMED TO 38% WIDTH */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 38% !important; /* Slimmer horizontally */
    height: 100% !important; 
    background-size: contain !important; /* Keep ratio, gaps allowed */
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important;
    background-color: transparent !important;
  }

  /* INFO AREA: EXPANDED TO ~60% WIDTH */
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1vh !important;
    overflow-y: auto !important; /* Safely handle very long text */
  }

  /* Font Adjustments for wider info area */
  html body .card-detail-overlay .cd-header { gap: 1.5vh !important; padding-bottom: 1vh !important; margin-bottom: 0 !important; }
  html body .card-detail-overlay .cd-name { font-size: 4vh !important; white-space: normal !important; line-height: 1.1 !important; }
  html body .card-detail-overlay .cd-cost { width: 7vh !important; height: 7vh !important; font-size: 3.5vh !important; }
  html body .card-detail-overlay .cd-type-tags { gap: 1vh !important; margin-bottom: 0.5vh !important; flex-wrap: wrap !important; }
  html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag { font-size: 2.5vh !important; padding: 0.3vh 1.5vh !important; }
  html body .card-detail-overlay .cd-stats { gap: 4vh !important; margin-bottom: 1vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 3.5vh !important; }
  html body .card-detail-overlay .cd-text-box { padding: 1.5vh !important; gap: 1vh !important; font-size: 3.2vh !important; background: rgba(0,0,0,0.5) !important; flex: 1 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2.2vh !important; padding-top: 1vh !important; }

  /* MULLIGAN: PRESERVING THE STABLE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { height: 45vh !important; width: auto !important; aspect-ratio: 5/7 !important; }
  .mulligan-panel { height: 100vh !important; padding: 2vh !important; gap: 2vh !important; justify-content: center !important; }
}
`;

// Replace the previous "Max Z-Index" block (v112)
const v112Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v112Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v112Pattern, infoPriorityMobileStyles.trim());
} else {
  styleCss += infoPriorityMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v113
const version = 'v113_info_priority';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
