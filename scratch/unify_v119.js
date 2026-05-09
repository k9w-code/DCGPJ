const fs = require('fs');

// 1. UNIFY HTML: Move card-detail-overlay OUTSIDE of containers in deck-builder.html
let builderHtml = fs.readFileSync('public/deck-builder.html', 'utf8');
const detailRegex = /<div class="overlay card-detail-overlay"[\s\S]*?<\/div>\s+<\/div>\s+<\/div>\s+<\/div>/;
const detailMatch = builderHtml.match(/<div class="overlay card-detail-overlay" id="card-detail-overlay" style="display: none;">[\s\S]*?<\/div>\s+<\/div>/);

if (detailMatch) {
  let detailHtml = detailMatch[0];
  // Remove the old one (including the closing divs it was inside)
  builderHtml = builderHtml.replace(detailHtml, '');
  // Clean up the trailing extra divs if I removed too many, but here we just need to place it before body
  builderHtml = builderHtml.replace('</body>', detailHtml + '\n</body>');
  
  // Extra safety check: ensure game-container and game-wrapper are closed
  if (builderHtml.split('<div').length > builderHtml.split('</div').length) {
      builderHtml = builderHtml.replace(detailHtml, '    </div>\n  </div>\n' + detailHtml);
  }
}
fs.writeFileSync('public/deck-builder.html', builderHtml, 'utf8');

// 2. MODERATE SIZE: Adjust style.css from 95% down to 80% width for better "PC feel"
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Update size from 95vw/85vh to 80vw/75vh
styleCss = styleCss.replace(/width: 95vw !important;/g, 'width: 80vw !important;');
styleCss = styleCss.replace(/height: 85vh !important;/g, 'height: 75vh !important;');

// Adjust fonts slightly for the smaller modal (4.5vh -> 3.8vh, etc)
styleCss = styleCss.replace(/font-size: 4\.5vh !important;/g, 'font-size: 3.8vh !important;');
styleCss = styleCss.replace(/font-size: 3\.2vh !important;/g, 'font-size: 2.8vh !important;');
styleCss = styleCss.replace(/font-size: 4vh !important;/g, 'font-size: 3.5vh !important;');

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 3. VERSION BUMP: v119
const version = 'v119_unified';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('v119 Unification Complete');
