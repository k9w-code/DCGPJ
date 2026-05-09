const fs = require('fs');

const version = '20260509_v1';
const files = ['public/index.html', 'public/game.html', 'public/deck-builder.html'];

files.forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  // Replace existing style.css link with versioned one
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
  console.log(`Updated ${path} with version ${version}`);
});
