const fs = require('fs');

// 1. UPDATE index.html: Add Vol.122 to the header
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY</h1>', '<h1>DCG TESTPLAY Vol.122</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. FORCE CACHE CLEAR: v122_final
const version = 'v122_final_vol122';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.122 Label Added to Top Page');
