const fs = require('fs');

// --- 1. SURGICAL REPAIR OF game.html ---
let gameHtml = fs.readFileSync('public/game.html', 'utf8');

// Fix the missing closing tags for game containers (Line 250 area)
// and the missing closing tags for card-detail (Line 351 area)
gameHtml = gameHtml.replace(
  '<div id="vfx-layer" style="position:absolute; inset:0; pointer-events:none; z-index:15000; overflow:hidden;"></div>\n    </div>',
  '<div id="vfx-layer" style="position:absolute; inset:0; pointer-events:none; z-index:15000; overflow:hidden;"></div>\n    </div>\n  </div>'
);

gameHtml = gameHtml.replace(
  '<div class="cd-text-box">\n          <div class="cd-effect-text" id="cd-text"></div>\n          <div class="cd-flavor-text" id="cd-flavor"></div>\n        </div>\n      </div>\n</body>',
  '<div class="cd-text-box">\n          <div class="cd-effect-text" id="cd-text"></div>\n          <div class="cd-flavor-text" id="cd-flavor"></div>\n        </div>\n      </div>\n    </div>\n</div>\n</body>'
);

fs.writeFileSync('public/game.html', gameHtml, 'utf8');

// --- 2. SURGICAL REPAIR OF deck-builder.html ---
// I need to RESTORE the missing UI components I deleted
// I'll take the "v115" rewrite but ADD back the missing parts from the diff
const restoredBuilderHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>DCG - デッキ編成</title>
  <link rel="stylesheet" href="/css/style.css?v=v116_final">
</head>
<body>
  <div class="builder-container">
    <div class="builder-main">
      <div class="card-library-panel panel glass-panel">
        <div class="panel-header">
          <h2>カードライブラリ</h2>
          <div class="type-cost-filters">
            <div class="pill-group type-filters">
              <button class="pill active" data-type="all">ALL</button>
              <button class="pill" data-type="unit">UNIT</button>
              <button class="pill" data-type="spell">SPELL</button>
              <button class="pill" data-type="shield">SHIELD</button>
            </div>
          </div>
          <div class="search-filter-bar">
            <input type="text" id="search-input" class="glass-input" placeholder="カード名・テキスト検索...">
            <select id="color-filter" class="glass-select">
              <option value="all">全色</option>
              <option value="red">赤 (火)</option>
              <option value="blue">青 (水)</option>
              <option value="green">緑 (自然)</option>
              <option value="white">白 (光)</option>
              <option value="black">黒 (闇)</option>
              <option value="neutral">無色</option>
            </select>
          </div>
        </div>
        <div class="card-grid" id="card-grid"></div>
        <div class="card-grid" id="shield-grid" style="display:none;"></div>
      </div>

      <div class="deck-panel panel glass-panel">
        <div class="deck-builder-header">
          <div class="header-left">
            <button class="btn btn-secondary" onclick="window.location.href='/'">🏠 ロビー</button>
            <h1>DECK BUILDER</h1>
          </div>
          <div class="header-actions">
            <div class="deck-slots" id="deck-slots"></div>
            <button class="btn btn-primary" id="btn-save-deck">💾 保存</button>
          </div>
        </div>

        <div class="deck-panel-header">
          <h2>YOUR DECK (<span id="deck-count">0</span>/40)</h2>
          <span class="shield-badge">SHIELDS: <span id="shield-count">0</span>/3</span>
        </div>
        
        <div class="deck-list-container" id="deck-list"></div>
        
        <button class="btn btn-primary btn-start-game" id="btn-submit-deck" disabled style="width: 100%; margin-top: 20px; font-weight: 900; height: 60px; font-size: 24px;">START GAME</button>
      </div>
    </div>
  </div>

  <div class="overlay card-detail-overlay" id="card-detail-overlay" style="display: none;">
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
  <script src="/js/audio-manager.js?v=v116"></script>
  <script src="/js/deck-builder.js?v=v116"></script>
</body>
</html>`;

fs.writeFileSync('public/deck-builder.html', restoredBuilderHtml, 'utf8');

console.log('Surgical repair complete.');
