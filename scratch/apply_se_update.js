const fs = require('fs');

let js = fs.readFileSync('public/js/audio-manager.js', 'utf8');

js = js.replace(
  /case 'click':[\s\S]*?break;/,
  `case 'click':
        // 軽く澄んだタップ音（クリスタル風）
        this._playSynthSound('sine', 1200, 800, 0.02, 0.1, masterGain, now);
        break;`
);

js = js.replace(
  /case 'summon':[\s\S]*?break;/,
  `case 'summon':
        // 魔法的な召喚音（柔らかく広がる）
        this._playSynthSound('sine', 400, 800, 0.15, 0.5, masterGain, now);
        this._playSynthSound('triangle', 600, 1200, 0.1, 0.6, masterGain, now);
        break;`
);

js = js.replace(
  /case 'attack':[\s\S]*?case 'impact':[\s\S]*?break;/,
  `case 'attack':
      case 'impact':
        // 重みのある打撃音（少し丸みを持たせる）
        this._playSynthSound('triangle', 200, 50, 0.02, 0.3, masterGain, now);
        this._playSynthSound('sine', 100, 20, 0.01, 0.4, masterGain, now);
        break;`
);

js = js.replace(
  /case 'error':[\s\S]*?break;/,
  `case 'error':
        // 短く鈍いエラー音
        this._playSynthSound('triangle', 200, 150, 0.05, 0.2, masterGain, now);
        break;`
);

fs.writeFileSync('public/js/audio-manager.js', js, 'utf8');
console.log('SE updated successfully.');
