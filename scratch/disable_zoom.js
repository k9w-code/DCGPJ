const fs = require('fs');

// 1. CSS Fix: Add touch-action: none to body and game-wrapper
let styleCss = fs.readFileSync('public/css/style.css', 'utf8');
styleCss = styleCss.replace('min-height: 100dvh;', 'min-height: 100dvh; touch-action: none; user-select: none; -webkit-user-select: none;');
styleCss = styleCss.replace('.game-wrapper {', '.game-wrapper {\n  touch-action: none;');
fs.writeFileSync('public/css/style.css', styleCss, 'utf8');
console.log('Applied CSS zoom prevention');

// 2. HTML Fix: Add gesturestart prevention script
const zoomPreventionScript = `
  <script>
    // Prevent Safari pinch zoom
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
    });
    // Prevent Safari double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  </script>`;

function updateHTML(path) {
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('gesturestart')) {
    html = html.replace('</body>', zoomPreventionScript + '\n</body>');
    fs.writeFileSync(path, html, 'utf8');
    console.log('Updated ' + path + ' with zoom prevention');
  }
}

updateHTML('public/game.html');
updateHTML('public/deck-builder.html');
updateHTML('public/index.html');
