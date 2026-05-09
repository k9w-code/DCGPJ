const fs = require('fs');

// 1. Repair broken HTML in game.html and deck-builder.html
const fixedOverlayHtml = `
<div class="overlay card-detail-overlay" id="card-detail-overlay" style="display: none;">
    <div class="card-detail-modal">
      <div class="cd-close-btn" id="btn-close-detail"></div>
      <div class="cd-image-area" id="cd-image"></div>
      <div class="cd-info-area">
        <div class="cd-header">
          <div class="cd-cost" id="cd-cost">0</div>
          <h2 class="cd-name" id="cd-name">Card Name</h2>
        </div>
        <div class="cd-type-tags">
          <span class="cd-type-tag" id="cd-type">Unit</span>
          <div class="cd-tribe-tag">
            <div class="cd-tribe-icon" id="cd-tribe-icon"></div>
            <span class="cd-tribe-text" id="cd-tribe-text">Neutral</span>
          </div>
          <div class="cd-rarity" id="cd-rarity">Common</div>
        </div>
        <div class="cd-stats" id="cd-stats-container">
          <div class="cd-stat"><span class="cd-stat-icon">⚔️</span><span id="cd-attack">0</span></div>
          <div class="cd-stat"><span class="cd-stat-icon">❤️</span><span id="cd-hp">0</span></div>
        </div>
        <div class="cd-text-box">
          <div class="cd-effect-text" id="cd-text"></div>
          <div class="cd-flavor-text" id="cd-flavor"></div>
        </div>
      </div>
    </div>
</div>
`;

['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  // Remove any broken card-detail-overlay blocks
  html = html.replace(/<div class="overlay card-detail-overlay"[\s\S]*?(<\/body>)/, '$1');
  // Re-insert correctly before </body>
  html = html.replace('</body>', fixedOverlayHtml + '\n</body>');
  fs.writeFileSync(path, html, 'utf8');
});

// 2. Update style.css: PC Golden Ratio (33%) and v114 version
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const goldenRatioMobileStyles = `
/* ==========================================
   MOBILE STABILIZATION: GOLDEN RATIO (v114)
   33% Image / 67% Info (PC Experience)
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE & STABILITY */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  /* DETAIL MODAL: PC-LIKE PROPORTIONS */
  html body .card-detail-overlay {
    z-index: 2147483647 !important;
    display: flex !important;
    background: rgba(0,0,0,0.9) !important;
  }
  
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
  }

  /* IMAGE AREA: 33% GOLDEN RATIO */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 33% !important; /* PC-like width */
    height: 100% !important; 
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important;
    background-color: transparent !important;
  }

  /* INFO AREA: EXPANDED FOR READABILITY */
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding-right: 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1vh !important;
    overflow-y: auto !important;
  }

  /* Font Adjustments */
  html body .card-detail-overlay .cd-header { gap: 2vh !important; padding-bottom: 1vh !important; margin-bottom: 0 !important; }
  html body .card-detail-overlay .cd-name { font-size: 4.5vh !important; }
  html body .card-detail-overlay .cd-cost { width: 7.5vh !important; height: 7.5vh !important; font-size: 4vh !important; }
  html body .card-detail-overlay .cd-type-tags { gap: 1vh !important; margin-bottom: 1vh !important; }
  html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag { font-size: 2.4vh !important; }
  html body .card-detail-overlay .cd-stats { gap: 5vh !important; margin-bottom: 1.5vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 4vh !important; }
  html body .card-detail-overlay .cd-text-box { padding: 2vh !important; gap: 1vh !important; font-size: 3.2vh !important; flex: 1 !important; }

  /* MULLIGAN: PRESERVING THE STABLE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { height: 45vh !important; width: auto !important; aspect-ratio: 5/7 !important; }
  .mulligan-panel { height: 100vh !important; padding: 2vh !important; gap: 2vh !important; justify-content: center !important; }
}
`;

const v113Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v113Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v113Pattern, goldenRatioMobileStyles.trim());
} else {
  styleCss += goldenRatioMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 3. Final Cache Bump v114
const version = 'v114_final_ratio';
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
