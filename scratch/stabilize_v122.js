const fs = require('fs');

// 1. FIX deck-builder.html: Correct the broken card-detail structure
let builderHtml = fs.readFileSync('public/deck-builder.html', 'utf8');

// The COMPLETE structure we want (based on game.html)
const completeDetailHtml = `
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
`;

// Remove the broken one at the bottom (lines 188+)
builderHtml = builderHtml.replace(/<div class="overlay card-detail-overlay" id="card-detail-overlay" style="display: none;">[\s\S]*?<\/div>\s+<\/div>\s+<\/div>\s+<\/div>/, '');
// Also remove the old partial one inside the container (if it exists)
builderHtml = builderHtml.replace(/<div class="overlay card-detail-overlay"[\s\S]*?<\/div>\s+<\/div>\s+<\/div>/g, '');

// Clean up: Insert the complete one before </body>
builderHtml = builderHtml.replace('</body>', completeDetailHtml + '\n</body>');

fs.writeFileSync('public/deck-builder.html', builderHtml, 'utf8');

// 2. UPDATE style.css: Hand position to absolute bottom (0) and enforce unification
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');

// Lower hand area to the very bottom
styleCss = styleCss.replace(/bottom: 1\.5vh !important;/g, 'bottom: 0 !important;');
// Tighten the gap even more to make it natural
styleCss = styleCss.replace(/gap: -2vh !important;/g, 'gap: -3vh !important;');

fs.writeFileSync('public/css/style.css', styleCss, 'utf8');

// 3. UPDATE audio-manager.js: Better handling for silent mode
let audioJs = fs.readFileSync('public/js/audio-manager.js', 'utf8');
// Inject a silent mode check/fix in the playBGM method
if (!audioJs.includes('if (this.audioCtx.state === \'suspended\')')) {
  audioJs = audioJs.replace('this.bgmAudio.play().catch(() => {', 
    'if (this.audioCtx.state === "suspended") this.audioCtx.resume();\n    this.bgmAudio.play().catch(() => {');
}
fs.writeFileSync('public/js/audio-manager.js', audioJs, 'utf8');

// 4. VERSION BUMP: v122
const version = 'v122_final_stable';
['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=${version}"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('v122 Final Stabilization Complete');
