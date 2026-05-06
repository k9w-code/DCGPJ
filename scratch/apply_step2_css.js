const fs = require('fs');

let css = fs.readFileSync('public/css/style.css', 'utf8');

// デッキ・手札枚数のUI改善（絵文字を使わず、洗練されたテキストベースに）
if (!css.includes('.status-badge')) {
  css += `\n
/* Status Badges Enhancement */
.status-badge {
  display: inline-block;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: var(--font-fantasy);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-secondary);
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.status-badge span {
  color: #fff;
  font-weight: 900;
  font-size: 14px;
  margin-left: 4px;
}
`;
} else {
  css = css.replace(
    /\.status-badge \{[\s\S]*?\}/,
    `.status-badge {
  display: inline-block;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
  font-family: var(--font-fantasy);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #a09880;
  box-shadow: 0 2px 5px rgba(0,0,0,0.8);
}`
  );
  if (!css.includes('.status-badge span')) {
    css += `\n.status-badge span { color: #fff; font-weight: 900; font-size: 14px; margin-left: 4px; text-shadow: 0 1px 2px #000; }`;
  }
}

// プレイヤーと対戦相手の色分け
if (!css.includes('.player-block .avatar-frame')) {
  css += `\n
/* Player/Opponent Differentiation */
.player-block .avatar-info {
  background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.1));
  border-right: 2px solid rgba(37, 99, 235, 0.3);
  padding: 10px 15px;
  border-radius: 8px;
}
.opponent-block .avatar-info {
  background: linear-gradient(-90deg, transparent, rgba(220, 38, 38, 0.1));
  border-left: 2px solid rgba(220, 38, 38, 0.3);
  padding: 10px 15px;
  border-radius: 8px;
}
`;
}

// 神族アイコン（レベル）の視認性向上
css = css.replace(
  /\.tribe-level \{[\s\S]*?\}/,
  `.tribe-level {
  position: absolute;
  bottom: -4px; right: -4px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  font-family: var(--font-fantasy);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  box-shadow: 0 2px 4px rgba(0,0,0,0.8);
  text-shadow: 0 0 4px var(--accent);
}`
);

// ログUIの整理
if (css.includes('#game-log {')) {
  css = css.replace(
    /#game-log \{[\s\S]*?\}/,
    `#game-log {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  background: rgba(0,0,0,0.4);
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.8;
  color: #d1d5db;
  border: 1px inset rgba(255,255,255,0.05);
}`
  );
}

if (!css.includes('.log-entry')) {
  css += `\n
/* Log Entries */
.log-entry { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.log-entry:last-child { border-bottom: none; }
.log-highlight { color: #facc15; font-weight: bold; }
.log-damage { color: #f87171; font-weight: bold; }
.log-heal { color: #4ade80; font-weight: bold; }
.log-system { color: #9ca3af; font-size: 12px; }
`;
}

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('Step 2 CSS applied successfully.');
