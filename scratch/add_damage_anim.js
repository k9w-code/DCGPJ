const fs = require('fs');

let js = fs.readFileSync('public/js/game-renderer.js', 'utf8');

if (!js.includes('prevMyLife')) {
  js = js.replace('function renderPlayerInfo(state) {', 
`let prevMyLife = null;
let prevOppLife = null;

function renderPlayerInfo(state) {`);

  // my-life
  js = js.replace(
    "const myLifeEl = document.getElementById('my-life');\n  if (myLifeEl) myLifeEl.textContent = state.me.life || 0;",
    `const myLifeEl = document.getElementById('my-life');
  if (myLifeEl) {
    const currentLife = state.me.life || 0;
    if (prevMyLife !== null && currentLife < prevMyLife) {
      const avatarLife = myLifeEl.parentElement;
      avatarLife.classList.remove('damaged');
      void avatarLife.offsetWidth; // trigger reflow
      avatarLife.classList.add('damaged');
    }
    prevMyLife = currentLife;
    myLifeEl.textContent = currentLife;
  }`
  );

  // opp-life
  js = js.replace(
    "const oppLifeEl = document.getElementById('opp-life');\n    if (oppLifeEl) oppLifeEl.textContent = state.opponent.life || 0;",
    `const oppLifeEl = document.getElementById('opp-life');
    if (oppLifeEl) {
      const currentLife = state.opponent.life || 0;
      if (prevOppLife !== null && currentLife < prevOppLife) {
        const avatarLife = oppLifeEl.parentElement;
        avatarLife.classList.remove('damaged');
        void avatarLife.offsetWidth;
        avatarLife.classList.add('damaged');
      }
      prevOppLife = currentLife;
      oppLifeEl.textContent = currentLife;
    }`
  );

  fs.writeFileSync('public/js/game-renderer.js', js, 'utf8');
  console.log('Added damage animation logic.');
} else {
  console.log('Already added.');
}
