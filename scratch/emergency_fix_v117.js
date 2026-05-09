const fs = require('fs');

// --- 1. FIX style.css (The root cause of the black screen) ---
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Remove the disastrous 'display: flex !important' from media queries
styleCss = styleCss.replace(/display: flex !important;\s+background: rgba\(0,0,0,0\.9\) !important;/g, 'background: rgba(0,0,0,0.9) !important;');

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// --- 2. FIX game.html (Tag inconsistency) ---
let gameHtml = fs.readFileSync('public/game.html', 'utf8');
if (!gameHtml.includes('<!-- FIXED TAG -->')) {
    // Add the missing closing div for game-wrapper
    gameHtml = gameHtml.replace(
        '<div id="vfx-layer" style="position:absolute; inset:0; pointer-events:none; z-index:15000; overflow:hidden;"></div>\n    </div>',
        '<div id="vfx-layer" style="position:absolute; inset:0; pointer-events:none; z-index:15000; overflow:hidden;"></div>\n    </div>\n  </div><!-- FIXED TAG -->'
    );
}
// Also fix the card-detail closing tags if broken
if (gameHtml.includes('      </div>\n</body>')) {
    gameHtml = gameHtml.replace(
        '      </div>\n</body>',
        '      </div>\n    </div>\n</div>\n</body>'
    );
}

fs.writeFileSync('public/game.html', gameHtml, 'utf8');

// --- 3. FORCE REFRESH v117 ---
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v117_fix_black_screen"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Emergency Fix v117 complete.');
