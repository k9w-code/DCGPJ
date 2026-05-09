const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.127
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.126</h1>', '<h1>DCG TESTPLAY Vol.127</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS BUG FIX (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');
css = css.replace('.settings-overlay {\n    display: flex !important;', '.settings-overlay {\n    /* fixed in v127 */');
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. DECK BUILDER STRUCTURAL RECONSTRUCTION (deck-builder.html)
let deckHtml = fs.readFileSync('public/deck-builder.html', 'utf8');
const overlayMarker = '<!-- カード詳細モーダル';
if (deckHtml.includes(overlayMarker)) {
  deckHtml = deckHtml.substring(0, deckHtml.indexOf(overlayMarker));
}

const newFooter = `
    </div>
  </div>

  <div class="overlay card-detail-overlay" id="card-detail-overlay" style="display: none; z-index: 999999999 !important; width: 100dvw !important; height: 100dvh !important; position: fixed !important; top: 0 !important; left: 0 !important;">
    <div class="card-detail-modal">
      <div class="cd-close-btn" id="btn-close-detail"></div>
      <div class="cd-image-area" id="cd-image"></div>
      <div class="cd-info-area">
        <div class="cd-header">
          <div class="cd-cost" id="cd-cost">0</div>
          <h2 class="cd-name" id="cd-name">Card Name</h2>
        </div>
        <div class="cd-type-tags">
          <span class="cd-type-tag" id="cd-type">Unit</span>
          <div class="cd-tribe-tag">
            <div class="cd-tribe-icon" id="cd-tribe-icon"></div>
            <span class="cd-tribe-text" id="cd-tribe-text">Neutral</span>
          </div>
          <div class="cd-rarity" id="cd-rarity">Common</div>
        </div>
        <div class="cd-stats" id="cd-stats-container">
          <div class="cd-stat"><span class="cd-stat-icon">⚔️</span><span id="cd-attack">0</span></div>
          <div class="cd-stat"><span class="cd-stat-icon">❤️</span><span id="cd-hp">0</span></div>
        </div>
        <div class="cd-text-box">
          <div class="cd-effect-text" id="cd-text"></div>
          <div class="cd-flavor-text" id="cd-flavor"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/audio-manager.js"></script>
  <script src="/js/game-renderer.js"></script>
  <script src="/js/deck-builder.js"></script>
  <script>
    function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scaleX = windowWidth / 1920;
      const scaleY = windowHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      container.style.transform = "scale(" + scale + ")";
      container.style.position = 'absolute';
      container.style.left = ((windowWidth - 1920 * scale) / 2) + "px";
      container.style.top = ((windowHeight - 1080 * scale) / 2) + "px";
      container.style.transformOrigin = '0 0';
    }
    window.addEventListener('resize', resizeGame);
    window.addEventListener('load', resizeGame);
    document.addEventListener('DOMContentLoaded', resizeGame);
    resizeGame();
    document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    window.addEventListener('load', function() { setTimeout(function() { window.dispatchEvent(new Event('resize')); window.scrollTo(0, 0); }, 500); });
  </script>
</body>
</html>
`;

fs.writeFileSync('public/deck-builder.html', deckHtml.trim() + newFooter, 'utf8');

// 4. CACHE CLEAR
['public/game.html', 'public/index.html', 'public/deck-builder.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, 'href="/css/style.css?v=v127_final_fix"');
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.127 Core Fix Deployed (Clean)');
