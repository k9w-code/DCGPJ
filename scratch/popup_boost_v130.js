const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.130
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.129</h1>', '<h1>DCG TESTPLAY Vol.130</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS POPUP ENLARGEMENT (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const popupEnlarge = `
  @media (max-width: 1250px) {
    /* Level-up confirmation popup enlargement */
    .crystal-confirm-popup {
      width: 420px !important;
      bottom: 120px !important; /* Move higher to not overlap with enlarged buttons below */
      padding: 30px !important;
      border-width: 3px !important;
      border-radius: 20px !important;
    }
    .crystal-confirm-popup p {
      font-size: 24px !important; /* Bigger text */
      margin-bottom: 25px !important;
    }
    .crystal-confirm-popup #confirm-tribe-icon {
      width: 48px !important; /* Bigger icon */
      height: 48px !important;
    }
    .popup-actions {
      gap: 20px !important;
    }
    .popup-actions .btn-mini {
      padding: 15px 40px !important; /* Huge touch targets */
      font-size: 20px !important;
      min-width: 120px !important;
      border-radius: 12px !important;
    }
    #btn-crystal-confirm {
      background: var(--accent) !important;
      color: #fff !important;
      font-weight: bold !important;
    }
  }
`;

css += popupEnlarge;
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. CACHE CLEAR
['public/game.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v130_popup_boost"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.130 Popup Boost Deployed');
