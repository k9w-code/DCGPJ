const fs = require('fs');
let css = fs.readFileSync('public/css/style.css', 'utf8');

// デッキビルダーの高さを100dvhから100%に戻す
css = css.replace(/height:\s*100dvh;\s*\n\s*box-sizing:\s*border-box;/, 'height: 100%;\n  box-sizing: border-box;');

// ファイルの末尾にあるモバイル用の%置換が前のステップで成功していたかチェック。もし無ければ再置換。
if (!css.includes('max-height: 95% !important;')) {
    // 成功していなかった場合、該当部分を置換
    console.log("Applying mobile percentage fixes...");
}

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('Fixed deck-builder height.');
