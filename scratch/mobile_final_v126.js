const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.126
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.125</h1>', '<h1>DCG TESTPLAY Vol.126</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS FINAL STABILIZATION (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

// Ensure card-detail-overlay is absolute unit on mobile
css = css.replace('.card-detail-overlay {', '.card-detail-overlay {\n    width: 100dvw !important;\n    height: 100dvh !important;\n    left: 0 !important;\n    top: 0 !important;');

// Settings Scroll Fix
css = css.replace('.settings-overlay {', '.settings-overlay {\n    display: flex !important;\n    justify-content: center !important;');
const settingsMobileScroll = `
  @media (max-width: 1250px) {
    .settings-overlay {
      align-items: flex-start !important;
      padding-top: 5dvh !important;
      overflow-y: auto !important;
    }
    .settings-panel {
      margin-bottom: 5dvh !important;
      max-height: none !important; /* Allow panel to grow and scroll via overlay */
      flex-shrink: 0 !important;
    }
  }
`;
css += settingsMobileScroll;

fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. AUDIO MANAGER - Volume & Silent Mode logic finish
let audioJs = fs.readFileSync('public/js/audio-manager.js', 'utf8');
// Fix updateBGMVolume to ensure mainGain is updated
audioJs = audioJs.replace('this.mainGain.gain.setTargetAtTime(this.bgmVolume, this.audioCtx.currentTime, 0.1);',
  'if (this.mainGain && this.mainGain.gain) this.mainGain.gain.setTargetAtTime(this.bgmVolume, this.audioCtx.currentTime, 0.05);');

fs.writeFileSync('public/js/audio-manager.js', audioJs, 'utf8');

// 4. SAFARI TOP CUT-OFF & RESIZE FIX (Script Injection)
const safariResizeFix = `
  <script>
    // Safari Layout Bug Fix: Trigger resize after toolbar state stabilizes
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.dispatchEvent(new Event('resize'));
        // Scroll to top to reset any viewport shifts
        window.scrollTo(0, 0);
      }, 500);
    });
    
    // Settings Scroll Support for iOS
    const settingsOverlay = document.getElementById('settings-overlay');
    if (settingsOverlay) {
      settingsOverlay.addEventListener('touchmove', function(e) {
        if (e.target === settingsOverlay) e.preventDefault();
      }, { passive: false });
    }
  </script>
`;

['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('Safari Layout Bug Fix')) {
    html = html.replace('</body>', safariResizeFix + '\n</body>');
  }
  // Cache clear
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=v126_mobile_final"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.126 Mobile Final Deployed');
