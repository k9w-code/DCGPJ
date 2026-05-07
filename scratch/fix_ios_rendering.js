const fs = require('fs');

// 1. CSSの修正 (すべての要素の backdrop-filter を強制無効化)
let css = fs.readFileSync('public/css/style.css', 'utf8');

const oldSupportsBlock = /@supports \(-webkit-touch-callout: none\) \{[\s\S]*?\n\}/;

const newSupportsBlock = `@supports (-webkit-touch-callout: none) {
  * {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .overlay, .card-detail-overlay, #shield-break-overlay {
    background: rgba(0,0,0,0.98) !important;
  }
  .deck-builder-header, .collection-header, .deck-panel-header, .glass-panel {
    background: rgba(13, 19, 38, 0.98) !important;
  }
}`;

if (oldSupportsBlock.test(css)) {
  css = css.replace(oldSupportsBlock, newSupportsBlock);
  fs.writeFileSync('public/css/style.css', css, 'utf8');
  console.log('CSS updated successfully.');
} else {
  console.log('Could not find old @supports block in CSS.');
}

// 2. JSの修正 (リサイズロジックの強化)
function injectResizeLogic(filePath) {
  let js = fs.readFileSync(filePath, 'utf8');
  
  const oldResize = `function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scaleX = windowWidth / 1920;
      const scaleY = windowHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      container.style.transform = \`scale(\${scale})\`;
      container.style.position = 'absolute';
      container.style.left = \`\${(windowWidth - 1920 * scale) / 2}px\`;
      container.style.top = \`\${(windowHeight - 1080 * scale) / 2}px\`;
      container.style.transformOrigin = '0 0';
    }`;
    
  const newResize = `function resizeGame() {
      const container = document.getElementById('game-container');
      if (!container) return;
      let windowWidth = window.innerWidth;
      let windowHeight = window.innerHeight;
      
      // iOS Safari landscape orientation fix
      if (typeof window.orientation !== 'undefined' && (window.orientation === 90 || window.orientation === -90)) {
        if (windowHeight > windowWidth) {
          // Portrait dimensions returned incorrectly, swap them
          const temp = windowWidth;
          windowWidth = windowHeight;
          windowHeight = temp;
        }
      }

      const scaleX = windowWidth / 1920;
      const scaleY = windowHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      container.style.transform = \`scale(\${scale})\`;
      container.style.position = 'absolute';
      container.style.left = \`\${(windowWidth - 1920 * scale) / 2}px\`;
      container.style.top = \`\${(windowHeight - 1080 * scale) / 2}px\`;
      container.style.transformOrigin = '0 0';
    }
    
    // Setup robust resize listeners
    if (!window._resizeFixed) {
      window._resizeFixed = true;
      window.addEventListener('orientationchange', () => {
        setTimeout(resizeGame, 100);
        setTimeout(resizeGame, 300);
        setTimeout(resizeGame, 800);
      });
    }`;

  if (js.includes(oldResize)) {
    js = js.replace(oldResize, newResize);
    fs.writeFileSync(filePath, js, 'utf8');
    console.log(`Updated resize logic in ${filePath}`);
  } else {
    // If it's already updated or slightly different, try to just replace the inner part
    console.log(`Could not find exact resizeGame in ${filePath}, trying regex...`);
    const regex = /function resizeGame\(\) \{[\s\S]*?transformOrigin = '0 0';\n    \}/;
    if (regex.test(js)) {
      js = js.replace(regex, newResize);
      fs.writeFileSync(filePath, js, 'utf8');
      console.log(`Updated resize logic via regex in ${filePath}`);
    } else {
      console.log(`Failed to update ${filePath}`);
    }
  }
}

// game.html and deck-builder.html contain the resizeGame function in script tags
injectResizeLogic('public/game.html');
injectResizeLogic('public/deck-builder.html');
