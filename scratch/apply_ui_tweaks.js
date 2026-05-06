const fs = require('fs');

// 1. style.css: 対戦相手情報の位置調整
let css = fs.readFileSync('public/css/style.css', 'utf8');
if (!css.includes('transform: translateX(-40px);')) {
  css = css.replace('.opponent-block { flex-direction: row; }', '.opponent-block { flex-direction: row; margin-left: -30px; }');
  fs.writeFileSync('public/css/style.css', css, 'utf8');
}

// 2. vfx-engine.js: シールドイラスト修正、ターンチェンジのサブタイトル削除
let vfx = fs.readFileSync('public/js/vfx-engine.js', 'utf8');
if (!vfx.includes("shieldData.type = 'shield';")) {
  vfx = vfx.replace(
    /const imagePath = window.getCardImagePath\(shieldData\);/,
    "shieldData.type = 'shield';\n      const imagePath = window.getCardImagePath(shieldData);"
  );
}
vfx = vfx.replace(/if \(sub\) sub\.textContent = .*?;/, 'if (sub) sub.style.display = "none";');
fs.writeFileSync('public/js/vfx-engine.js', vfx, 'utf8');

// 3. game.html: ディスカード画面のタイトル重複、サブタイトルの不要なHTML削除
let html = fs.readFileSync('public/game.html', 'utf8');
html = html.replace('DISCARD CARDS', 'DISCARD');
fs.writeFileSync('public/game.html', html, 'utf8');

// 4. game-renderer.js: SP表示の「+X」削除、絵文字の強力な除去
let gr = fs.readFileSync('public/js/game-renderer.js', 'utf8');
// remove +X for player
gr = gr.replace(
  /if \(sp > MAX_SP_DISPLAY\) \{[\s\S]*?mySpOrbs\.appendChild\(plus\);\n\s*\}/,
  ''
);
// remove +X for opponent
gr = gr.replace(
  /if \(sp > MAX_SP_DISPLAY\) \{[\s\S]*?oppSpOrbs\.appendChild\(plus\);\n\s*\}/,
  ''
);
// improve emoji stripping
gr = gr.replace(
  /const cleanLog = log\.replace\(\/\[✨⚔️🛡️🔥⚡🤖👤🏠📋💥🎯\]\/g, ''\)\.trim\(\);/,
  "const cleanLog = log.replace(/[\\u2700-\\u27BF]|[\\uE000-\\uF8FF]|\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|[\\u2011-\\u26FF]|\\uD83E[\\uDD10-\\uDDFF]/g, '').trim();"
);
fs.writeFileSync('public/js/game-renderer.js', gr, 'utf8');

// 5. game-client.js: ディスカード画面でのカード詳細とスペルスタッツ非表示
let gc = fs.readFileSync('public/js/game-client.js', 'utf8');
if (!gc.includes('if (typeof attachCardDetailEvent === \'function\') attachCardDetailEvent(el, card);')) {
  gc = gc.replace(
    /el\.onclick = \(\) => \{[\s\S]*?\}\);/,
    `// スペルにはスタッツを表示しない
    if (card.type === 'spell') {
      const stats = el.querySelector('.hc-stats');
      if (stats) stats.style.display = 'none';
    }
    
    // 詳細表示イベントを付与（右クリックを詳細に割り当てなど。今回は通常の左クリックを破棄選択、右クリック詳細にする）
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (typeof showPreview === 'function') {
        showPreview('card', card); // デッキビルダー用のプレビュー関数がある場合
      } else if (typeof attachCardDetailEvent === 'function') {
        // detail event
      }
    });

    el.onclick = () => {
      el.classList.toggle('selected-to-discard');
      const selectedCount = Array.from(container.querySelectorAll('.selected-to-discard')).length;
      btn.disabled = selectedCount !== requiredCount;
    };`
  );
  fs.writeFileSync('public/js/game-client.js', gc, 'utf8');
}

console.log('UI fixes applied successfully.');
