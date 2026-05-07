const fs = require('fs');

// 1. CSS Fix: Add .panel to iOS solid background list
let css = fs.readFileSync('public/css/style.css', 'utf8');
const iosCheckRegex = /\.deck-builder-header, \.collection-header, \.deck-panel-header, \.glass-panel \{/;
if (iosCheckRegex.test(css)) {
  css = css.replace(iosCheckRegex, '.deck-builder-header, .collection-header, .deck-panel-header, .glass-panel, .panel {');
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('Added .panel to iOS CSS fix');
}

// 2. HTML Script Fix: Revert to innerWidth/Height with robust orientation swap
const newScript = `<script>
    function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      
      let windowWidth = window.innerWidth;
      let windowHeight = window.innerHeight;
      
      // Orientation check
      const isLandscape = window.matchMedia("(orientation: landscape)").matches || Math.abs(window.orientation) === 90;
      
      // Fix for iOS reporting wrong dimensions on orientation change
      if (isLandscape && windowHeight > windowWidth) {
        const temp = windowWidth;
        windowWidth = windowHeight;
        windowHeight = temp;
      }

      const scaleX = windowWidth / 1920;
      const scaleY = windowHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      
      if (scale <= 0) return;

      container.style.transform = \`scale(\${scale})\`;
      container.style.position = 'absolute';
      container.style.left = \`\${(windowWidth - 1920 * scale) / 2}px\`;
      container.style.top = \`\${(windowHeight - 1080 * scale) / 2}px\`;
      container.style.transformOrigin = '0 0';
    }
    
    if (!window._resizeFixed) {
      window._resizeFixed = true;
      const resizeHandler = () => {
        resizeGame();
        setTimeout(resizeGame, 100);
        setTimeout(resizeGame, 500);
      };
      window.addEventListener('orientationchange', resizeHandler);
      window.addEventListener('resize', resizeHandler);
      setInterval(resizeGame, 2000);
    }
    window.addEventListener('load', resizeGame);
    document.addEventListener('DOMContentLoaded', resizeGame);
    resizeGame();
  </script>`;

function updateHTML(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const scriptRegex = /<script>\s*function resizeGame\(\)[\s\S]*?<\/script>/;
  if (scriptRegex.test(content)) {
    content = content.replace(scriptRegex, newScript);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + filePath);
  }
}

updateHTML('public/game.html');
updateHTML('public/deck-builder.html');
