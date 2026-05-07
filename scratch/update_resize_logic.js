const fs = require('fs');

const newScript = `<script>
    function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      
      // Use visualViewport if available, fallback to innerWidth/Height
      let windowWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      let windowHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      if (windowWidth <= 0) windowWidth = window.innerWidth;
      if (windowHeight <= 0) windowHeight = window.innerHeight;

      // iOS Safari landscape orientation fix
      if (typeof window.orientation !== 'undefined' && (window.orientation === 90 || window.orientation === -90)) {
        if (windowHeight > windowWidth) {
          const temp = windowWidth;
          windowWidth = windowHeight;
          windowHeight = temp;
        }
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
    
    // Setup robust resize listeners
    if (!window._resizeFixed) {
      window._resizeFixed = true;
      
      const resizeHandler = () => {
        resizeGame();
        // iOS Safari delay fixes
        setTimeout(resizeGame, 100);
        setTimeout(resizeGame, 300);
        setTimeout(resizeGame, 800);
      };

      window.addEventListener('orientationchange', resizeHandler);
      window.addEventListener('resize', resizeHandler);
      
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', resizeHandler);
        window.visualViewport.addEventListener('scroll', resizeGame);
      }
      
      // Fallback poller
      setInterval(resizeGame, 1500);
    }
    window.addEventListener('load', resizeGame);
    document.addEventListener('DOMContentLoaded', resizeGame);
    resizeGame();
  </script>`;

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find the existing script block that contains resizeGame
  const scriptRegex = /<script>\s*function resizeGame\(\)[\s\S]*?<\/script>/;
  
  if (scriptRegex.test(content)) {
    content = content.replace(scriptRegex, newScript);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + filePath);
  } else {
    console.log('Could not find script block in ' + filePath);
  }
}

updateFile('public/game.html');
updateFile('public/deck-builder.html');
