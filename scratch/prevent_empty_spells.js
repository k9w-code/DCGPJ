const fs = require('fs');

// 1. game-client.js 修正: スペル使用前のターゲットチェックを追加
let c = fs.readFileSync('public/js/game-client.js', 'utf8');

const targetCheckCode = `
// スペルの使用可否チェック
function canPlaySpell(card) {
  if (!card || card.type !== 'spell') return true;
  if (!card.abilities || card.abilities.length === 0) return true;
  
  const state = window.gameState;
  if (!state) return true;

  const opponent = state.opponent;
  const player = state.me;

  // 全てのアビリティをチェックし、一つでも対象が必要なものがあればチェック
  for (const ability of card.abilities) {
    const target = ability.target || '';
    if (target.includes('enemy_unit')) {
      // 敵ユニットが必要な場合
      let hasEnemy = false;
      const board = opponent.board || [];
      for (const row of ['front', 'back']) {
        if (board[row] && board[row].some(u => u !== null)) hasEnemy = true;
      }
      if (!hasEnemy) return false;
    }
    // 必要に応じて他のターゲット（自分のユニットなど）も追加可能
  }
  return true;
}

function showWarning(message) {
  // 簡易的なアラート表示（既存のUIに合わせて調整可能）
  const toast = document.createElement('div');
  toast.className = 'vfx-toast-warning';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed; top:20%; left:50%; transform:translateX(-50%); background:rgba(220,38,38,0.9); color:white; padding:15px 40px; border-radius:30px; z-index:100000; font-weight:bold; box-shadow:0 0 20px rgba(0,0,0,0.5); pointer-events:none; animation: toast-in-out 2s forwards;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
  if (window.audioManager) window.audioManager.playSE('error');
}
`;

// ファイルの先頭（socket定義の後など）に挿入
c = c.replace("const socket = io();", "const socket = io();\n" + targetCheckCode);

// play_card 送信前にチェックを挟む (handleCardPointerDown や onPointerUp の中)
c = c.replace(/if\s*\(window\.selectedCardIndex\s*!==\s*null\)\s*\{/, 
              "if (window.selectedCardIndex !== null) {\n      const card = window.gameState.me.hand[window.selectedCardIndex];\n      if (!canPlaySpell(card)) {\n        showWarning('有効な対象がいません');\n        window.selectedCardIndex = null;\n        if (typeof window.updateUI === 'function') window.updateUI();\n        return;\n      }");

fs.writeFileSync('public/js/game-client.js', c, 'utf8');

// 2. style.css にアニメーションを追加
let css = fs.readFileSync('public/css/style.css', 'utf8');
if (!css.includes('@keyframes toast-in-out')) {
    css += `
@keyframes toast-in-out {
  0% { transform: translate(-50%, -20px); opacity: 0; }
  15% { transform: translate(-50%, 0); opacity: 1; }
  85% { transform: translate(-50%, 0); opacity: 1; }
  100% { transform: translate(-50%, -20px); opacity: 0; }
}
`;
    fs.writeFileSync('public/css/style.css', css, 'utf8');
}

console.log('Spell target validation added.');
