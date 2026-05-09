const fs = require('fs');

// 1. Rewrite style.css: Force MAX z-index and clean up duplicate definitions
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// A. Clean up duplicate global definitions and set MAX z-index
// We use a regex that matches both occurrences we found
styleCss = styleCss.replace(
  /\.card-detail-overlay \{[\s\S]*?z-index: [\d]+ !important;[\s\S]*?\}/g,
  '' // Remove them all first to normalize
);

// Add the ONE TRUE GLOBAL DEFINITION at a stable place (around line 1200)
const globalMaxZ = `
.card-detail-overlay {
  position: fixed !important; 
  inset: 0 !important; 
  background: rgba(0,0,0,0.85) !important;
  z-index: 2147483647 !important; /* ABSOLUTE MAXIMUM INT32 */
  display: flex; 
  align-items: center; 
  justify-content: center;
  backdrop-filter: blur(10px);
}
`;

// Insert it before the first modal definition
styleCss = styleCss.replace('.card-detail-modal {', globalMaxZ + '\n.card-detail-modal {');

// B. Mobile Refinement (v112) - Ensure Max Z here too
const maxZMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: MAX Z-INDEX (v112)
   Card detail is now physically the highest layer possible
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE & STABILITY */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  /* DETAIL MODAL: MAX Z-INDEX & ONE-VIEW */
  html body .card-detail-overlay {
    z-index: 2147483647 !important; /* MAX INT32 */
    display: flex !important;
    background: rgba(0,0,0,0.9) !important;
  }
  
  html body .card-detail-modal {
    width: auto !important;
    max-width: 96vw !important;
    height: 85vh !important;
    flex-direction: row !important;
    padding: 1.5vh !important;
    gap: 1.5vh !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    height: 100% !important; 
    aspect-ratio: 5 / 7 !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1vh !important;
    overflow-y: auto !important;
  }

  /* Font Scaling Refined */
  html body .card-detail-overlay .cd-header { gap: 1vh !important; padding-bottom: 1vh !important; margin-bottom: 0 !important; border-bottom: 1px solid rgba(184, 134, 11, 0.5) !important; }
  html body .card-detail-overlay .cd-name { font-size: 3.5vh !important; margin: 0 !important; }
  html body .card-detail-overlay .cd-cost { width: 6vh !important; height: 6vh !important; font-size: 3vh !important; border: 2px solid #fff !important; }
  html body .card-detail-overlay .cd-type-tags { gap: 0.5vh !important; margin-bottom: 0.5vh !important; }
  html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag { font-size: 2.2vh !important; padding: 0.2vh 1vh !important; }
  html body .card-detail-overlay .cd-stats { gap: 2vh !important; margin-bottom: 1vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 3vh !important; }
  html body .card-detail-overlay .cd-text-box { padding: 1.2vh !important; gap: 0.8vh !important; font-size: 2.8vh !important; background: rgba(0,0,0,0.5) !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2vh !important; padding-top: 0.5vh !important; }

  /* MULLIGAN: PRESERVING THE STABLE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { height: 45vh !important; width: auto !important; aspect-ratio: 5/7 !important; }
  .mulligan-panel { height: 100vh !important; padding: 2vh !important; gap: 2vh !important; justify-content: center !important; }
}
`;

// Replace the previous "True One View" block (v111)
const v111Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v111Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v111Pattern, maxZMobileStyles.trim());
} else {
  styleCss += maxZMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v112
const version = 'v112_max_z';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
