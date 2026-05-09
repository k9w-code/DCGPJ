const fs = require('fs');

// 1. Structural Fix: Move card-detail-overlay to be direct child of body in all HTML files
const htmlFiles = ['public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  
  // Extract the overlay HTML
  const overlayPattern = /<div class="overlay card-detail-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
  const match = html.match(overlayPattern);
  
  if (match) {
    let overlayHtml = match[0];
    // Remove it from current location
    html = html.replace(overlayPattern, '');
    // Insert it right before </body>
    html = html.replace('</body>', overlayHtml + '\n</body>');
    
    // Bump cache version while at it
    html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, 'href="/css/style.css?v=v104_structural"');
    
    fs.writeFileSync(path, html, 'utf8');
    console.log(`Structurally fixed ${path}`);
  }
});

// 2. CSS Overhaul: Simplification and Performance (Removing blur, fixing layout)
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const structuralMobileStyles = `
/* ==========================================
   STRUCTURAL MOBILE STABILIZATION (v104)
   Ensures modal is outside scaled container
   ========================================== */
@media (max-width: 1250px), (max-height: 800px) {
  /* PERFORMANCE: Disable expensive blurs on mobile */
  * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
  .glass-panel, .panel, .overlay, .modal { background: rgba(15, 20, 35, 0.95) !important; }

  /* FIX: iPhone Home Indicator collision */
  .player-hand { 
    bottom: 25px !important; /* Lift it up */
    padding-bottom: env(safe-area-inset-bottom) !important;
  }

  /* UNIFIED MODAL: Fixed size relative to REAL viewport, not scaled container */
  html body .card-detail-overlay {
    z-index: 99999 !important;
    background: rgba(0,0,0,0.8) !important;
  }
  
  html body .card-detail-modal {
    width: 90vw !important;
    max-width: 800px !important;
    height: 90vh !important;
    flex-direction: row !important; /* Side-by-side for landscape */
    padding: 20px !important;
    gap: 20px !important;
    position: fixed !important;
    left: 50% !important; top: 50% !important;
    transform: translate(-50%, -50%) !important;
    border: 1px solid var(--accent) !important;
    box-shadow: 0 0 30px rgba(0,0,0,0.5) !important;
  }

  html body .card-detail-overlay .cd-image-area { 
    flex: 0 0 40% !important;
    height: 100% !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  html body .card-detail-overlay .cd-info-area { 
    flex: 1 !important;
    overflow-y: auto !important;
    padding: 10px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 15px !important;
  }

  /* Font Sizes - Standard for mobile screen */
  html body .card-detail-overlay .cd-name { font-size: 28px !important; }
  html body .card-detail-overlay .cd-effect-text,
  html body .card-detail-overlay .cd-ability-text { font-size: 18px !important; line-height: 1.4 !important; }
  html body .card-detail-overlay .cd-cost { width: 60px !important; height: 60px !important; font-size: 32px !important; }

  /* Mulligan spacing fix */
  .mulligan-panel { gap: 10px !important; padding: 10px !important; }
  .mulligan-cards { gap: 10px !important; margin-bottom: 5px !important; }
}
`;

// Replace the previous "Absolute/Nuclear" blocks
const prevPattern = /\/\* ==========================================[\s\S]*?@media \(max-height: 400px\) \{[\s\S]*?\}\n\}/;
if (prevPattern.test(styleCss)) {
  styleCss = styleCss.replace(prevPattern, structuralMobileStyles.trim());
} else {
  styleCss += structuralMobileStyles;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
console.log('Applied structural CSS fixes');
