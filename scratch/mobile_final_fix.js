const fs = require('fs');

// 1. Update style.css with dramatic font increases and layout fixes
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

const newMobileStyles = `
  /* Overall Text Scaling */
  .card-name { font-size: 26px !important; }
  .card-text, .ability-text, .cd-ability-desc { font-size: 20px !important; line-height: 1.3 !important; }
  .btn, .btn-primary, .btn-secondary { font-size: 28px !important; padding: 12px 24px !important; }
  .stat-value { font-size: 28px !important; }
  .cost-gem { font-size: 32px !important; }
  
  /* Card Detail Overrides (Dramatic) */
  .cd-name { font-size: 54px !important; }
  .cd-effect-text, .cd-ability-text { font-size: 32px !important; line-height: 1.3 !important; font-weight: 700 !important; }
  .cd-flavor-text { font-size: 24px !important; line-height: 1.4 !important; opacity: 1 !important; color: #fff !important; }
  .cd-type-tag, .cd-tribe-text { font-size: 22px !important; padding: 8px 16px !important; }
  .cd-stat-value { font-size: 42px !important; font-weight: 900 !important; }
  .cd-cost { width: 90px !important; height: 90px !important; font-size: 48px !important; }
  .cd-info-area { gap: 30px !important; }

  /* Mulligan Fix (Shrink cards to fit buttons) */
  .hand-card { width: 140px !important; height: 196px !important; }
  .mulligan-panel { min-height: auto !important; max-height: 95vh !important; padding: 10px !important; }
  .mulligan-actions { margin-top: 10px !important; }
  .mulligan-actions .btn { font-size: 22px !important; padding: 10px 20px !important; }

  /* Result/Settings Fix */
  .result-title { font-size: 60px !important; letter-spacing: 5px !important; }
  .result-content { font-size: 20px !important; }
  .settings-panel, .crystal-confirm-popup { max-width: 95% !important; max-height: 90vh !important; overflow-y: auto !important; }
`;

// Replace the previous mobile overrides block
const oldMobilePattern = /  \.card-name \{ font-size: 22px !important; \}[\s\S]*?\.cd-cost \{ width: 70px !important; height: 70px !important; font-size: 36px !important; \}/;

if (oldMobilePattern.test(styleCss)) {
  styleCss = styleCss.replace(oldMobilePattern, newMobileStyles.trim());
} else {
  styleCss += `\n\n@media (max-width: 1250px) {\n${newMobileStyles}\n}`;
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
console.log('Applied dramatic font and layout fixes for mobile');

// 2. Bump cache version in HTML files
const version = '20260509_v2';
const htmlFiles = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

htmlFiles.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css\?v=[\w_]+"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
  console.log(`Updated ${path} to cache version ${version}`);
});
