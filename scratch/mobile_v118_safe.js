const fs = require('fs');

// 1. UPDATE style.css: Apply PC Golden Ratio (33:67) to Mobile Media Query
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const goldenRatioV118 = `
/* ==========================================
   MOBILE STABILIZATION: PC GOLDEN RATIO (v118)
   33% Image / 67% Info - Complete PC Experience
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE: Disable heavy effects on small viewports */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  /* DETAIL OVERLAY: Ensure top-level visibility */
  html body .card-detail-overlay {
    z-index: 2147483647 !important; /* Max INT32 */
    background: rgba(0,0,0,0.9) !important;
  }
  
  /* DETAIL MODAL: Scale with Viewport Height (vh) */
  html body .card-detail-modal {
    width: 95vw !important;
    height: 85vh !important;
    flex-direction: row !important;
    padding: 1.5vh !important;
    gap: 2.5vh !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important;
    background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%) !important;
  }

  /* IMAGE AREA: 33% (MATCHES PC RATIO) */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 33% !important; 
    height: 100% !important; 
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important;
    background-color: transparent !important;
  }

  /* INFO AREA: 67% (MAXIMIZED FOR TEXT) */
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding-right: 1.5vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1vh !important;
    overflow-y: auto !important;
    border: none !important;
  }

  /* FONT SCALING: Mimic PC Balance */
  html body .card-detail-overlay .cd-header { gap: 2vh !important; padding-bottom: 1vh !important; border-bottom: 1px solid var(--gold) !important; margin-bottom: 0 !important; }
  html body .card-detail-overlay .cd-name { font-size: 4.5vh !important; white-space: nowrap !important; }
  html body .card-detail-overlay .cd-cost { width: 7.5vh !important; height: 7.5vh !important; font-size: 4vh !important; }
  html body .card-detail-overlay .cd-type-tags { gap: 1vh !important; margin-bottom: 1vh !important; }
  html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag { font-size: 2.4vh !important; padding: 0.3vh 1.5vh !important; }
  html body .cd-tribe-icon { width: 3vh !important; height: 3vh !important; }
  html body .card-detail-overlay .cd-stats { gap: 5vh !important; margin-bottom: 1.5vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 4vh !important; }
  html body .cd-stat-icon { font-size: 3.5vh !important; }
  html body .card-detail-overlay .cd-text-box { padding: 2vh !important; gap: 1vh !important; font-size: 3.2vh !important; flex: 1 !important; background: rgba(0,0,0,0.4) !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2.2vh !important; padding-top: 1.5vh !important; }

  /* CLOSE BUTTON: Sizable for mobile touch */
  html body .cd-close-btn { width: 6vh !important; height: 6vh !important; top: 1vh !important; right: 1vh !important; }

  /* MULLIGAN: STABLE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { height: 45vh !important; width: auto !important; aspect-ratio: 5/7 !important; }
  .mulligan-panel { height: 100vh !important; padding: 2vh !important; gap: 2vh !important; justify-content: center !important; }
}
`;

// Find and replace the existing media query block
const mediaPattern = /@media \(max-width: 1250px\), \(max-height: 800px\) \{[\s\S]*?\n\}/;
if (mediaPattern.test(styleCss)) {
  styleCss = styleCss.replace(mediaPattern, goldenRatioV118.trim());
} else {
  styleCss += goldenRatioV118;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. SAFE VERSION BUMP: Update links in HTML files (No structural change)
const version = 'v118_pc_port';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('v118 Upgrade Complete (CSS Only)');
