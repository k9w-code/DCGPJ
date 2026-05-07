const fs = require('fs');

const cssPath = 'public/css/style.css';
let css = fs.readFileSync(cssPath, 'utf8');

// /* ... */ の形式のコメントをすべて削除（文字化け除去）
// 改行コードだけ残って無駄な空行ができるのを防ぐため、前後の空白や改行も少し整理します
const newCss = css.replace(/\/\*[\s\S]*?\*\/\s*/g, '');

fs.writeFileSync(cssPath, newCss, 'utf8');
console.log('Removed all comments from style.css successfully.');
