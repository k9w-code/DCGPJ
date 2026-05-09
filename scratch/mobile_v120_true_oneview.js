const fs = require('fs');

// 1. UPDATE style.css: True One View (Info Priority)
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const trueOneViewV120 = `
/* ==========================================
   MOBILE STABILIZATION: TRUE ONE VIEW (v120)
   Info Priority (28% Image / 72% Info)
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

  html body .card-detail-overlay {
    z-index: 2147483647 !important;
    background: rgba(0,0,0,0.9) !important;
  }
  
  html body .card-detail-modal {
    width: 82vw !important; /* Slightly narrower than full to feel like a modal */
    height: 75vh !important;
    flex-direction: row !important;
    padding: 1.5vh !important;
    gap: 1.5vh !important; /* Tight gaps */
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--gold) !important;
    overflow: hidden !important;
    background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%) !important;
    border-radius: 16px !important;
  }

  /* IMAGE AREA: ULTRA-SLIM (28%) TO MAXIMIZE INFO */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 28% !important; 
    height: 100% !important; 
    background-size: cover !important; /* Allow cropping to keep layout stable */
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important;
    background-color: #000 !important;
    border-radius: 8px !important;
  }

  /* INFO AREA: MAXIMIZED (72%) */
  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 0.8vh !important;
    overflow: hidden !important; /* STRICT: No scrolling allowed for one-view */
    border: none !important;
  }

  /* COMPACT FONT SCALING */
  html body .card-detail-overlay .cd-header { gap: 1.5vh !important; padding-bottom: 0.8vh !important; margin-bottom: 0 !important; }
  html body .card-detail-overlay .cd-name { font-size: 3.5vh !important; white-space: normal !important; line-height: 1.1 !important; }
  html body .card-detail-overlay .cd-cost { width: 6.5vh !important; height: 6.5vh !important; font-size: 3.5vh !important; }
  html body .card-detail-overlay .cd-type-tags { gap: 0.8vh !important; margin-bottom: 0.5vh !important; }
  html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag { font-size: 2.2vh !important; padding: 0.2vh 1.2vh !important; }
  html body .cd-tribe-icon { width: 2.5vh !important; height: 2.5vh !important; }
  html body .card-detail-overlay .cd-stats { gap: 4vh !important; margin-bottom: 0.8vh !important; }
  html body .card-detail-overlay .cd-stat { font-size: 3.5vh !important; }
  html body .cd-stat-icon { font-size: 3vh !important; }
  
  /* TEXT BOX: Sized to fit precisely */
  html body .card-detail-overlay .cd-text-box { 
    padding: 1.5vh !important; 
    gap: 0.5vh !important; 
    font-size: 2.6vh !important; 
    flex: 1 !important; 
    background: rgba(0,0,0,0.4) !important;
    overflow-y: auto !important; /* Just in case text is insanely long, but target is no scroll */
  }
  html body .card-detail-overlay .cd-effect-text { margin-bottom: 0.5vh !important; line-height: 1.3 !important; }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2vh !important; padding-top: 0.8vh !important; opacity: 0.6 !important; }

  /* CLOSE BUTTON */
  html body .cd-close-btn { width: 5.5vh !important; height: 5.5vh !important; top: -1.5vh !important; right: -1.5vh !important; }

  /* MULLIGAN */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { height: 45vh !important; width: auto !important; aspect-ratio: 5/7 !important; }
}
`;

const mediaPattern = /@media \(max-width: 1250px\), \(max-height: 800px\) \{[\s\S]*?\n\}/;
if (mediaPattern.test(styleCss)) {
  styleCss = styleCss.replace(mediaPattern, trueOneViewV120.trim());
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. VERSION BUMP: v120
const version = 'v120_true_oneview';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('v120 True One-View Complete');
