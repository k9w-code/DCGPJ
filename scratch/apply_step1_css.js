const fs = require('fs');

let css = fs.readFileSync('public/css/style.css', 'utf8');

// 1. HPの強化
css = css.replace(
  /width: 70px; height: 70px;/g,
  'width: 84px; height: 84px;'
);
css = css.replace(
  /bottom: -5px; right: -5px;/g,
  'bottom: -10px; right: -10px;'
);
css = css.replace(
  /filter: drop-shadow\(0 4px 10px rgba\(0,0,0,0\.6\)\);/g,
  'filter: drop-shadow(0 0 15px rgba(225, 29, 72, 0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.8));'
);
if (!css.includes('.avatar-life.damaged')) {
  css = css.replace(
    /@keyframes pulse-heart/g,
    `.avatar-life.damaged {
  animation: damage-shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
  filter: drop-shadow(0 0 25px rgba(255, 0, 0, 0.9)) drop-shadow(0 8px 16px rgba(0,0,0,0.8));
}

@keyframes damage-shake {
  10%, 90% { transform: translate3d(-2px, 0, 0) scale(1.1); }
  20%, 80% { transform: translate3d(4px, 0, 0) scale(1.1); }
  30%, 50%, 70% { transform: translate3d(-6px, 0, 0) scale(1.1); color: #ff0000; }
  40%, 60% { transform: translate3d(6px, 0, 0) scale(1.1); }
}

@keyframes pulse-heart`
  );
}

css = css.replace(
  /font-size: 28px; font-weight: 900;/g,
  'font-size: 34px; font-weight: 900;'
);
css = css.replace(
  /text-shadow: 0 0 5px #000, 0 2px 4px #000;/g,
  'text-shadow: 0 0 10px rgba(255,0,0,0.8), 0 2px 4px #000;'
);

// 2. 手札UIの強化
css = css.replace(
  /margin: 0 -10px;[\s\S]*?filter: drop-shadow\(0 4px 8px rgba\(0,0,0,0\.5\)\);/g,
  `margin: 0 -5px;
  transition: transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1), z-index 0s, filter 0.2s;
  cursor: pointer;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));`
);

css = css.replace(
  /\.hand-card:hover \{\s*filter: drop-shadow\(0 15px 30px rgba\(0,0,0,0\.8\)\);\s*\}/g,
  `.hand-card:hover {
  transform: scale(1.3) translateY(-25px);
  filter: drop-shadow(0 15px 30px rgba(0,0,0,0.8)) drop-shadow(0 0 15px rgba(218, 165, 32, 0.5));
  z-index: 100;
}
.hand-card.selected, .hand-card.dragging {
  transform: scale(1.1) translateY(-10px);
  filter: drop-shadow(0 0 20px var(--gold)) drop-shadow(0 10px 20px rgba(0,0,0,0.8));
  border-radius: 12px;
}`
);

// 3. SP表示の再設計 & 4. 盤面の強化
if (!css.includes('@keyframes pulse-sp')) {
  css += `\n
@keyframes pulse-sp {
  0% { box-shadow: 0 0 5px var(--accent-glow); }
  50% { box-shadow: 0 0 15px var(--accent), 0 0 5px white; }
  100% { box-shadow: 0 0 5px var(--accent-glow); }
}
.sp-orb.active {
  animation: pulse-sp 2s infinite;
}

@keyframes board-slot-glow {
  0% { box-shadow: inset 0 0 5px rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
  50% { box-shadow: inset 0 0 15px rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.5); }
  100% { box-shadow: inset 0 0 5px rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
}
.board-slot.empty {
  animation: board-slot-glow 3s infinite;
}
.can-place {
  animation: pulse-sp 1.5s infinite;
}
`;
}

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('Step 1 CSS applied successfully.');
