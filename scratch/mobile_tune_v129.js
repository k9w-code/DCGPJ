const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.129
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.128</h1>', '<h1>DCG TESTPLAY Vol.129</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS FINE-TUNING (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const mobileFineTune = `
  @media (max-width: 1250px) {
    /* Lower hand position slightly more */
    .hand-area-wrapper {
      bottom: -1dvh !important; /* Sink it just a bit more into the bottom */
    }
    
    /* Fix oversized drag ghost */
    .drag-ghost {
      transform: scale(0.6) !important; /* Scale down to match mobile hand cards */
      transform-origin: center center !important;
      opacity: 0.9 !important;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,0.6)) !important;
    }
  }
`;

css += mobileFineTune;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v129_fine_tune"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.129 Mobile Fine-tune Deployed');
