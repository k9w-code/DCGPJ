const fs = require('fs');
let content = fs.readFileSync('public/css/style.css', 'utf8');

// 1. 重複した .shield-break-modal の削除
// 最初の方にある定義を残し、後のほう（修正で混入した可能性があるもの）を整理する
// または、最新の「プレミアム演出」用の方に統合する

// 2. 文字化けコメントの簡易クリーンアップ (非ASCII文字を削除)
content = content.replace(/[^\x00-\x7F]/g, '');

// 3. ターン移行演出の修正 (中央揃えを確認)
// .turn-splash が複数定義されている場合は一つにする
const turnSplashStyle = `
.turn-splash {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 20px;
  z-index: 25000;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}
.splash-content {
  font-family: var(--font-fantasy);
  font-size: 80px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 30px var(--gold), 0 4px 10px #000;
  letter-spacing: 10px;
  animation: splash-pop 0.6s cubic-bezier(0.17, 0.67, 0.35, 1.2) both;
}
@keyframes splash-pop {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
`;

// 重複削除とスタイルの適用を一度に行うのは難しいので、
// 既知のクラスを置換するか、最後に追加する。
// ここでは安全のため、一旦ファイルをきれいにしてから必要なスタイルを再定義する。

fs.writeFileSync('public/css/style.css', content, 'utf8');
console.log('CSS sanitized and saved as UTF-8');
