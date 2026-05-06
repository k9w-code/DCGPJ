const fs = require('fs');

let gr = fs.readFileSync('public/js/game-renderer.js', 'utf8');

if (!gr.includes('if (card.type === \\\'spell\\\')')) {
  gr = gr.replace(
    /cardEl\.innerHTML = renderUnitCard\(card, true\);\s*cardEl\.dataset\.index = index;/,
    `cardEl.innerHTML = renderUnitCard(card, true); 
    cardEl.dataset.index = index;
    
    // スペルの場合、スタッツを非表示にする
    if (card.type === 'spell') {
      const stats = cardEl.querySelector('.hc-stats');
      if (stats) stats.style.display = 'none';
    }

    // カード詳細を開けるようにする（右クリック等で詳細が出るようイベント付与）
    if (typeof attachCardDetailEvent === 'function') {
      attachCardDetailEvent(cardEl, card);
    }`
  );
  fs.writeFileSync('public/js/game-renderer.js', gr, 'utf8');
  console.log('Discard screen fixed successfully.');
} else {
  console.log('Discard screen already fixed.');
}
