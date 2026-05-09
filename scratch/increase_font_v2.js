const fs = require('fs');

let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Target the existing mobile media query and update/add font overrides
const mediaQueryRegex = /(@media\s*\(max-width:\s*1250px\),\s*\(max-height:\s*800px\)\s*\{[\s\S]*?)(html, body)/;

const newFontOverrides = `
  .card-name { font-size: 22px !important; }
  .card-text, .ability-text, .cd-ability-desc { font-size: 18px !important; line-height: 1.4 !important; }
  .btn, .btn-primary, .btn-secondary { font-size: 26px !important; }
  .stat-value { font-size: 24px !important; }
  .cost-gem { font-size: 28px !important; }
  
  /* Card Detail Overrides */
  .cd-name { font-size: 42px !important; }
  .cd-effect-text, .cd-ability-text { font-size: 24px !important; line-height: 1.4 !important; font-weight: 500 !important; }
  .cd-flavor-text { font-size: 18px !important; line-height: 1.5 !important; opacity: 0.9 !important; }
  .cd-type-tag, .cd-tribe-text { font-size: 18px !important; padding: 6px 12px !important; }
  .cd-stat-value { font-size: 32px !important; font-weight: 900 !important; }
  .cd-cost { width: 70px !important; height: 70px !important; font-size: 36px !important; }
`;

// Replace the old overrides with the new ones inside the media query
// First, remove the previous simple overrides I added
const oldOverridesPattern = /  \.card-name \{ font-size: 18px !important; \}\n  \.card-text, \.ability-text, \.cd-ability-desc \{ font-size: 16px !important; line-height: 1\.4 !important; \}\n  \.btn, \.btn-primary, \.btn-secondary \{ font-size: 22px !important; \}\n  \.stat-value \{ font-size: 20px !important; \}\n  \.cost-gem \{ font-size: 24px !important; \}/;

styleCss = styleCss.replace(oldOverridesPattern, newFontOverrides.trim());

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
console.log('Successfully increased mobile font sizes and added card detail overrides');
