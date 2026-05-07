const fs = require('fs');

// 1. CSS Fix: Force GPU rendering and adjust background for visibility on iOS
let css = fs.readFileSync('public/css/style.css', 'utf8');
const iosStyles = `@supports (-webkit-touch-callout: none) {
  * {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .overlay, .card-detail-overlay, #shield-break-overlay {
    background: rgba(0,0,0,0.95) !important;
  }
  .deck-builder-header, .collection-header, .deck-panel-header, .glass-panel, .panel {
    background: rgba(25, 35, 65, 0.98) !important; /* Slightly lighter to verify existence */
    transform: translateZ(0); /* Force GPU layer */
    -webkit-transform: translateZ(0);
  }
}`;

// Replace the old @supports block at the end
const supportsRegex = /@supports \(-webkit-touch-callout: none\) \{[\s\S]*?\}\s*$/;
if (supportsRegex.test(css)) {
  css = css.replace(supportsRegex, iosStyles);
} else {
  css += '\n' + iosStyles;
}
fs.writeFileSync('public/css/style.css', css, 'utf8');

// 2. HTML Fix: Bulletproof resize logic using Math.max/min for mobile
const bulletproofScript = `<script>
    function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      
      let w = window.innerWidth;
      let h = window.innerHeight;
      
      // For mobile devices, the larger dimension is ALWAYS width in landscape
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const isLandscape = window.matchMedia("(orientation: landscape)").matches || Math.abs(window.orientation) === 90;
      
      if (isMobile && isLandscape) {
        let actualW = Math.max(w, h);
        let actualH = Math.min(w, h);
        w = actualW;
        h = actualH;
      }

      const scaleX = w / 1920;
      const scaleY = h / 1080;
      const scale = Math.min(scaleX, scaleY);
      
      if (scale <= 0) return;

      container.style.transform = \`scale(\${scale})\`;
      container.style.position = 'absolute';
      container.style.left = \`\${(w - 1920 * scale) / 2}px\`;
      container.style.top = \`\${(h - 1080 * scale) / 2}px\`;
      container.style.transformOrigin = '0 0';
      
      // Force repaint for iOS
      container.style.opacity = '0.999';
      setTimeout(() => { container.style.opacity = '1'; }, 50);
    }
    
    if (!window._resizeFixed) {
      window._resizeFixed = true;
      const handler = () => {
        resizeGame();
        setTimeout(resizeGame, 100);
        setTimeout(resizeGame, 500);
        setTimeout(resizeGame, 1000);
      };
      window.addEventListener('resize', handler);
      window.addEventListener('orientationchange', handler);
      setInterval(resizeGame, 2000);
    }
    window.addEventListener('load', resizeGame);
    document.addEventListener('DOMContentLoaded', resizeGame);
    resizeGame();
  </script>`;

function updateHTML(path) {
  let html = fs.readFileSync(path, 'utf8');
  // Revert 100vh to 100dvh in HTML wrapper for better iOS behavior
  html = html.replace('height: 100vh;', 'height: 100dvh;');
  const scriptRegex = /<script>\s*function resizeGame\(\)[\s\S]*?<\/script>/;
  html = html.replace(scriptRegex, bulletproofScript);
  fs.writeFileSync(path, html, 'utf8');
}

updateHTML('public/game.html');
updateHTML('public/deck-builder.html');
console.log('Bulletproof fix applied.');
