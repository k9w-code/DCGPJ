const fs = require('fs');

// style.css にアニメーションを追加
let css = fs.readFileSync('public/css/style.css', 'utf8');
if (!css.includes('@keyframes card-drop-anim')) {
  css += `\n
@keyframes card-drop-anim {
  0% { transform: scale(1.2) translateY(-20px); opacity: 0; filter: drop-shadow(0 20px 20px rgba(0,0,0,0.8)); }
  100% { transform: scale(1) translateY(0); opacity: 1; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)); }
}
.card-just-dropped {
  animation: card-drop-anim 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
`;
  fs.writeFileSync('public/css/style.css', css, 'utf8');
}

// game-renderer.js で新規ユニットにクラスを付与
let gr = fs.readFileSync('public/js/game-renderer.js', 'utf8');
if (!gr.includes('window.renderedUnitIds')) {
  gr = gr.replace(
    /function renderPlayerBoard\(state, selectedCard, selectedAttacker, onSlotClick\) \{/,
    `window.renderedUnitIds = window.renderedUnitIds || new Set();\nfunction renderPlayerBoard(state, selectedCard, selectedAttacker, onSlotClick) {`
  );
  
  // Player board
  gr = gr.replace(
    /slot\.innerHTML = renderUnitCard\(unit\);/,
    `slot.innerHTML = renderUnitCard(unit);
        // 新規配置時のアニメーション付与
        const cardEl = slot.querySelector('.card');
        if (cardEl && unit.id && !window.renderedUnitIds.has(unit.id)) {
          cardEl.classList.add('card-just-dropped');
          window.renderedUnitIds.add(unit.id);
        }`
  );

  // Opponent board
  gr = gr.replace(
    /function renderOpponentBoard\(state, selectedAttacker, onSlotClick\) \{/,
    `window.renderedOppUnitIds = window.renderedOppUnitIds || new Set();\nfunction renderOpponentBoard(state, selectedAttacker, onSlotClick) {`
  );
  
  gr = gr.replace(
    /slot\.innerHTML = renderUnitCard\(unit, false, true\);/,
    `slot.innerHTML = renderUnitCard(unit, false, true);
        const cardEl = slot.querySelector('.card');
        if (cardEl && unit.id && !window.renderedOppUnitIds.has(unit.id)) {
          cardEl.classList.add('card-just-dropped');
          window.renderedOppUnitIds.add(unit.id);
        }`
  );

  fs.writeFileSync('public/js/game-renderer.js', gr, 'utf8');
  console.log('Drop animation logic added successfully.');
} else {
  console.log('Drop animation logic already added.');
}
