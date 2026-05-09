const fs = require('fs');

// 1. UPDATE style.css: Lower Hand Area Position for Mobile
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Find the mobile media query and adjust hand area bottom
const handAreaFixV121 = `
  /* HAND AREA: Lowering position to remove unnatural gap (v121) */
  .hand-area-wrapper { 
    bottom: 1.5vh !important; /* Lowered from previous high value */
    padding-bottom: 0 !important;
  }
  .hand-area {
    gap: -2vh !important; /* Tighten cards slightly */
  }
  .hand-card {
    filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)) !important;
  }
  .hand-card:hover {
    transform: scale(1.4) translateY(-3vh) !important; /* Stronger pop-up from lower position */
    z-index: 500 !important;
  }
`;

// Insert the fix into the existing mobile media query
const mediaPattern = /@media \(max-width: 1250px\), \(max-height: 800px\) \{/;
if (mediaPattern.test(styleCss)) {
  styleCss = styleCss.replace(mediaPattern, '$&\n' + handAreaFixV121.trim());
}

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 2. VERSION BUMP: v121
const version = 'v121_natural_hand';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('v121 Natural Hand Complete');
