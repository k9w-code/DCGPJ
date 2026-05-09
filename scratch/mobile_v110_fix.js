const fs = require('fs');

// 1. Rewrite style.css: Global z-index fix AND Mobile One-View refinement
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// A. Global Fix (PC & Mobile Common)
styleCss = styleCss.replace(
  /\.card-detail-overlay \{[\s\S]*?z-index: [\d]+ !important;/,
  '.card-detail-overlay {\\n  position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);\\n  z-index: 100000 !important;'
);

// B. Mobile Refinement (v110)
const oneViewRefinementStyles = `
/* ==========================================
   MOBILE STABILIZATION: ONE-VIEW FINAL (v110)
   Full visibility, no scroll, PC-like experience
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE & STABILITY */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .glass-panel, .panel, .overlay, .modal { background: rgba(15, 20, 35, 0.95) !important; }

  /* FIX: iPhone Home Indicator collision */
  .player-hand { 
    bottom: 25px !important; 
    padding-bottom: env(safe-area-inset-bottom) !important;
  }

  /* DETAIL MODAL: PERFECT ONE-VIEW (Fixed 80vh) */
  html body .card-detail-overlay {
    z-index: 100001 !important; /* One step above global */
    background: rgba(0,0,0,0.85) !important;
  }
  
  html body .card-detail-modal {
    width: auto !important;
    max-width: 95vw !important;
    height: 80vh !important; /* Locked height to prevent scrolling */
    flex-direction: row !important;
    padding: 2vh !important;
    gap: 2vh !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    overflow: hidden !important; /* NO SCROLLING */
    box-sizing: border-box !important;
  }

  /* IMAGE AREA: Scaled but contained, no black gaps */
  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 auto !important;
    height: 100% !important; 
    aspect-ratio: 5 / 7 !important;
    background-size: contain !important; /* 100% card visible */
    background-repeat: no-repeat !important;
    background-position: center !important;
    border: none !important; /* Remove thick border to save space */
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    height: 100% !important;
    padding: 0 1vh !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 1.2vh !important;
    overflow: hidden !important;
  }

  /* Font Sizes: Precise VH scaling for "No Scroll" */
  html body .card-detail-overlay .cd-name { 
    font-size: 4.5vh !important; 
    margin: 0 !important;
    white-space: nowrap !important;
  }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { 
    font-size: 3.0vh !important; 
    line-height: 1.3 !important; 
  }
  html body .card-detail-overlay .cd-flavor-text { font-size: 2.2vh !important; opacity: 0.6 !important; }
  
  /* Icon Scaling */
  html body .card-detail-overlay .cd-cost { 
    width: 7vh !important; height: 7vh !important; 
    font-size: 3.5vh !important; 
  }
  html body .card-detail-overlay .cd-stat-icon { width: 3vh !important; height: 3vh !important; }
  html body .card-detail-overlay .cd-stat-value { font-size: 3.5vh !important; }

  /* MULLIGAN: PRESERVING THE 45VH STATE */
  #mulligan-overlay .card,
  #mulligan-overlay .hand-card { 
    height: 45vh !important; 
    width: auto !important; 
    aspect-ratio: 5/7 !important;
  }
  .mulligan-panel { 
    height: 100vh !important;
    padding: 2vh !important; 
    gap: 2vh !important; 
    justify-content: center !important;
  }
  .mulligan-actions .btn { font-size: 22px !important; padding: 10px 35px !important; }
}
`;

// Replace the previous "One View" block (v109)
const v109Pattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (v109Pattern.test(styleCss)) {
  styleCss = styleCss.replace(v109Pattern, oneViewRefinementStyles.trim());
} else {
  styleCss += oneViewRefinementStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. Bump cache version to v110
const version = 'v110_global_z';
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});
