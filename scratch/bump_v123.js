const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.123
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.122</h1>', '<h1>DCG TESTPLAY Vol.123</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. FORCE CACHE CLEAR: v123
const version = 'v123_manual_fix';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.123 Deployed (Manual Fixes Applied)');
