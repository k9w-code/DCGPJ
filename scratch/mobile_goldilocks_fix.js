const fs = require('fs');

// 1. Update style.css with "Goldilocks" font sizes and mulligan shrink
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const goldilocksStyles = `
  /* Overall Text Scaling - Adjusted to Sane Values */
  .card-name { font-size: 22px !important; }
  .card-text, .ability-text, .cd-ability-desc { font-size: 18px !important; line-height: 1.3 !important; }
  .btn, .btn-primary, .btn-secondary { font-size: 24px !important; padding: 10px 20px !important; }
  .stat-value { font-size: 24px !important; }
  .cost-gem { font-size: 28px !important; }
  
  /* Card Detail Overrides (The Goldilocks Zone) */
  .cd-name { font-size: 32px !important; line-height: 1.1 !important; word-break: break-all !important; }
  .cd-effect-text, .cd-ability-text { font-size: 22px !important; line-height: 1.3 !important; font-weight: 700 !important; }
  .cd-flavor-text { font-size: 16px !important; line-height: 1.4 !important; opacity: 0.9 !important; color: #d4c8a8 !important; }
  .cd-type-tag, .cd-tribe-text { font-size: 16px !important; padding: 6px 12px !important; }
  .cd-stat-value { font-size: 28px !important; font-weight: 900 !important; }
  .cd-cost { width: 70px !important; height: 70px !important; font-size: 36px !important; }
  .cd-info-area { gap: 15px !important; padding: 20px 15px !important; }

  /* Mulligan Fix (Aggressive Shrink for visibility) */
  .hand-card { width: 110px !important; height: 154px !important; }
  .mulligan-panel { min-height: auto !important; max-height: 98vh !important; padding: 5px !important; gap: 10px !important; }
  .mulligan-cards { gap: 10px !important; }
  .mulligan-actions { margin-top: 5px !important; gap: 15px !important; }
  .mulligan-actions .btn { font-size: 20px !important; padding: 8px 16px !important; }

  /* Result/Settings/Popup Fix */
  .result-title { font-size: 52px !important; }
  .result-content { font-size: 18px !important; }
  .settings-panel, .crystal-confirm-popup { max-width: 98% !important; max-height: 95vh !important; }
`;

// Replace the previous extreme mobile overrides
const extremeMobilePattern = /\/\* Overall Text Scaling \*\/[\s\S]*?\.settings-panel, \.crystal-confirm-popup \{ max-width: 95% !important; max-height: 90vh !important; overflow-y: auto !important; \}/;

if (extremeMobilePattern.test(styleCss)) {
  styleCss = styleCss.replace(extremeMobilePattern, goldilocksStyles.trim());
} else {
  // Fallback
  styleCss += `\n\n@media (max-width: 1250px) {\n${goldilocksStyles}\n}`;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
console.log('Applied Goldilocks font and layout fixes for mobile');

// 2. Bump cache version in HTML files to v3
const version = '20260509_v3';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
  console.log(`Updated ${path} to cache version ${version}`);
});
