const fs = require('fs');

// 1. Fix game-renderer.js image path
let rendererJs = fs.readFileSync('public/js/game-renderer.js', 'utf8');
const oldPath = /sbCard\.style\.backgroundImage = `url\('\/assets\/images\/cards\/\$\{shield\.id\}\.webp'\)`;/g;
const newPath = "if (window.getCardImagePath) { sbCard.style.backgroundImage = `url('${window.getCardImagePath(shield)}')`; } else { sbCard.style.backgroundImage = `url('/assets/images/shields/${shield.id.replace('SH','S')}.webp')`; }";
rendererJs = rendererJs.replace(oldPath, newPath);
fs.writeFileSync('public/js/game-renderer.js', rendererJs, 'utf8');
console.log('Fixed shield break image path in game-renderer.js');

// 2. Adjust CSS for font sizes and shield overlay visibility
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Update iOS supports block for shield overlay visibility
const oldIosBlock = /\.overlay, \.card-detail-overlay, #shield-break-overlay \{[\s\S]*?background: rgba\(0,0,0,0\.95\) !important;/;
const newIosBlock = ".overlay, .card-detail-overlay, #shield-break-overlay {\n    background: rgba(0,0,0,0.85) !important;\n    z-index: 20000 !important;";
styleCss = styleCss.replace(oldIosBlock, newIosBlock);

// Add mobile font overrides inside media query
const mediaQueryRegex = /@media\s*\(max-width:\s*1250px\),\s*\(max-height:\s*800px\)\s*\{/;
const fontOverrides = `
  .card-name { font-size: 18px !important; }
  .card-text, .ability-text, .cd-ability-desc { font-size: 16px !important; line-height: 1.4 !important; }
  .btn, .btn-primary, .btn-secondary { font-size: 22px !important; }
  .stat-value { font-size: 20px !important; }
  .cost-gem { font-size: 24px !important; }
`;

if (mediaQueryRegex.test(styleCss)) {
  styleCss = styleCss.replace(mediaQueryRegex, `$&${fontOverrides}`);
  console.log('Added mobile font overrides to style.css');
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
