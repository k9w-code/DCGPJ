const fs = require('fs');

// 1. UPDATE index.html: Bump to Vol.125
let indexHtml = fs.readFileSync('public/index.html', 'utf8');
indexHtml = indexHtml.replace('<h1>DCG TESTPLAY Vol.124</h1>', '<h1>DCG TESTPLAY Vol.125</h1>');
fs.writeFileSync('public/index.html', indexHtml, 'utf8');

// 2. CSS iOS SPECIFIC FIXES (style.css)
let css = fs.readFileSync('public/css/style.css', 'utf8');

// Use dynamic vh for overlays to fix Safari address bar issues
css = css.replace(/height: 100vh/g, 'height: 100dvh');
css = css.replace(/height: 75vh/g, 'height: 75dvh');

// Hand area wrapper - iPhone XS Centering Fix
css = css.replace('.hand-area-wrapper {', '.hand-area-wrapper {\n    display: flex !important;\n    justify-content: center !important;\n    align-items: flex-end !important;\n    margin: 0 auto !important;\n    left: 0 !important;\n    right: 0 !important;');

// Protect icons from crushing (Enforce minimum sizes)
css = css.replace('html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag {', 
                  'html body .card-detail-overlay .cd-type-tag, html body .card-detail-overlay .cd-color-tag {\n    min-width: 60px !important; white-space: nowrap !important;');

// Settings Panel - iOS Scroll Fix
css = css.replace('.settings-panel {', '.settings-panel {\n    -webkit-overflow-scrolling: touch !important;\n    transform: translateZ(0); /* Force hardware acceleration */');

fs.writeFileSync('public/css/style.css', css, 'utf8');

// 3. AUDIO MANAGER - FULL WEB AUDIO INTEGRATION
let audioJs = fs.readFileSync('public/js/audio-manager.js', 'utf8');

// Complete playBGM to use MediaElementSource
const newPlayBGM = `
  playBGM(key, force = false) {
    const src = this.files.bgm[key];
    if (!src) return;
    if (!force && this.bgmAudio.src.endsWith(src) && !this.bgmAudio.paused) return;
    
    this.bgmAudio.src = src;
    this.bgmAudio.crossOrigin = "anonymous";
    
    if (!this.bgmSource) {
      this.bgmSource = this.audioCtx.createMediaElementSource(this.bgmAudio);
      this.bgmSource.connect(this.mainGain);
    }
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    this.bgmAudio.play().catch(() => {
      const playOnce = () => {
        this.bgmAudio.play();
        document.removeEventListener('pointerdown', playOnce);
      };
      document.addEventListener('pointerdown', playOnce);
    });
  }
`;

audioJs = audioJs.replace(/playBGM\(key, force = false\) \{[\s\S]*?\}\n\s+updateBGMVolume/, newPlayBGM + '\n  updateBGMVolume');

// Fix updateSEVolume to affect mainGain if needed, or just keep individual control
audioJs = audioJs.replace('updateSEVolume(val) {', 'updateSEVolume(val) {\n    this.seVolume = parseFloat(val);');

fs.writeFileSync('public/js/audio-manager.js', audioJs, 'utf8');

// 4. iOS GESTURE PREVENTION (game.html, deck-builder.html, index.html)
const iosZoomFix = `
  <script>
    // iOS Safari Specific: Disable double-tap zoom and pinch zoom
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
    });
    
    // Physical hardware silent mode check is impossible, but Web Audio helps.
    // Ensure AudioContext is resumed on first interaction.
    document.addEventListener('pointerdown', function() {
      if (window.audioManager && window.audioManager.audioCtx) {
        if (window.audioManager.audioCtx.state === 'suspended') {
          window.audioManager.audioCtx.resume();
        }
      }
    }, { once: false });
  </script>
`;

['public/game.html', 'public/deck-builder.html', 'public/index.html'].forEach(path => {
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('gesturestart')) {
    html = html.replace('</body>', iosZoomFix + '\n</body>');
  }
  // New version string
  html = html.replace(/href="\/css\/style\.css(\?v=[\w_]+)?"/g, `href="/css/style.css?v=v125_ios_physical"`);
  fs.writeFileSync(path, html, 'utf8');
});

console.log('Vol.125 iOS Physical Support Deployed');
