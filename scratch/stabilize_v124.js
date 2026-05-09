const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.124
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.123</h1>', '<h1>DCG TESTPLAY Vol.124</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS STABILIZATION (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

// Global zoom prevention
css = css.replace('html, body {', 'html, body {\n  touch-action: manipulation !important;\n  -webkit-text-size-adjust: none !important;');

// Hand area wrapper fix (Center it)
css = css.replace('.hand-area-wrapper {', '.hand-area-wrapper {\n    display: flex !important;\n    justify-content: center !important;');

// Settings Panel mobile fix
const settingsMobileStyle = `
  .settings-panel {
    max-width: 90vw !important;
    max-height: 85vh !important;
    overflow-y: auto !important;
    padding: 20px !important;
  }
  .settings-panel h2 { font-size: 24px !important; margin-bottom: 10px !important; }
  .setting-item { margin-bottom: 10px !important; }
`;

// Detail Modal Enlarge and Protection
css = css.replace('width: 75vw !important; /* Narrowed from 82vw to avoid over-stretching */', 'width: 85vw !important; /* Enlarged in v124 */');
css = css.replace('height: 75vh !important;', 'height: 80vh !important;');
css = css.replace('gap: 1.5vh !important; /* Tight gaps */', 'gap: 2vh !important; padding: 2vh !important;');

// Protect icons from crushing
css = css.replace('html body .card-detail-overlay .cd-name {', 'html body .card-detail-overlay .cd-name {\n    min-height: 4vh !important; flex-shrink: 0 !important;');
css = css.replace('html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag {', 'html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag {\n    font-size: 2.5vh !important; min-width: 8vh !important; text-align: center !important; flex-shrink: 0 !important;');

// Close button fix
css = css.replace('html body .cd-close-btn { width: 5.5vh !important; height: 5.5vh !important; top: -1.5vh !important; right: -1.5vh !important; }', 
                  'html body .cd-close-btn { width: 7vh !important; height: 7vh !important; top: 1vh !important; right: 1vh !important; }');

// Add settings mobile style to the end of media query
css = css.replace('aspect-ratio: 5/7 !important; }', 'aspect-ratio: 5/7 !important; }\n' + settingsMobileStyle);

fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. AUDIO MANAGER (audio-manager.js)
let audioJs = fs.readFileSync('public/js/audio-manager.js', 'utf8');
// Connect BGM to AudioContext and fix volume
audioJs = audioJs.replace('this.bgmAudio = new Audio();', 
  'this.bgmAudio = new Audio();\n    this.bgmSource = null;');

// Better update methods
audioJs = audioJs.replace('updateBGMVolume(val) {', 
  'updateBGMVolume(val) {\n    this.bgmVolume = parseFloat(val);\n    this.bgmAudio.volume = this.bgmVolume;\n    if (this.mainGain) this.mainGain.gain.setTargetAtTime(this.bgmVolume, this.audioCtx.currentTime, 0.1);');

fs.writeFileSync('public/js/audio-manager.js', audioJs, 'utf8');

// 4. HTML SCRIPT INJECTION (Zoom Prevention)
const antiZoomScript = `
  <script>
    // Force prevent pinch zoom and double tap zoom
    document.addEventListener('touchstart', function(event) {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    document.addEventListener('wheel', function(event) {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }, { passive: false });
  </script>
`;

['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('Force prevent pinch zoom')) {
    html = html.replace('</body>', antiZoomScript + '\n</body>');
  }
  // Force cache clear
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=v124_stable_fix"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.124 Stabilization Complete');
