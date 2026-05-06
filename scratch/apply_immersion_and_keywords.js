const fs = require('fs');

// 1. style.css 修正 (グラスモーフィズムと背景)
let css = fs.readFileSync('public/css/style.css', 'utf8');

// 背景画像の適用
css = css.replace(
  /body\s*\{[\s\S]*?background-color:\s*#0b132b;/,
  `body {\n  margin: 0;\n  padding: 0;\n  height: 100vh;\n  background: url('/assets/images/background/epic_fantasy_board.png') no-repeat center center fixed;\n  background-size: cover;`
);

// .board-half のグラスモーフィズム
css = css.replace(
  /\.board-half\s*\{[\s\S]*?background:\s*rgba\(30,\s*41,\s*59,\s*0\.4\);[\s\S]*?\}/,
  `.board-half {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 15px;
  background: rgba(15, 23, 42, 0.4) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  padding: 10px;
  position: relative;
}`
);

// .avatar-block のグラスモーフィズム
css = css.replace(
  /\.avatar-block\s*\{[\s\S]*?background:\s*rgba\(30,\s*41,\s*59,\s*0\.4\);[\s\S]*?\}/,
  `.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.5) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  padding: 15px;
}`
);

// .shield-area のグラスモーフィズム
if (!css.includes('backdrop-filter: blur(10px)')) {
  css = css.replace(
    /\.shield-area\s*\{[\s\S]*?\}/,
    `.shield-area {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 10px;
  padding: 10px;
  background: rgba(15, 23, 42, 0.5) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
}`
  );
}

fs.writeFileSync('public/css/style.css', css, 'utf8');


// 2. AbilityProcessor.js 修正 (comeback 追加とトリガー許可)
let ap = fs.readFileSync('game/AbilityProcessor.js', 'utf8');

// condKeys に comeback を追加
ap = ap.replace(
  /const condKeys = \['link', 'crisis', 'vanguard', 'rearguard', 'loner', 'avenger'\];/,
  `const condKeys = ['link', 'crisis', 'vanguard', 'rearguard', 'loner', 'avenger', 'comeback'];`
);

// comeback の条件判定追加
if (!ap.includes("cond === 'comeback'")) {
  ap = ap.replace(
    /else if \(cond === 'avenger' && currentPlayer\.friendlyDeathsThisTurn === 0\) conditionMet = false;/,
    `else if (cond === 'avenger' && currentPlayer.friendlyDeathsThisTurn === 0) conditionMet = false;
      else if (cond === 'comeback') {
        const activeShields = currentPlayer.shields.filter(s => !s.destroyed && s.currentDurability > 0).length;
        if (activeShields > 1) conditionMet = false;
      }`
  );
}

fs.writeFileSync('game/AbilityProcessor.js', ap, 'utf8');


// 3. GameEngine.js 修正 (triggerFriendlySpellPlay 実装)
let ge = fs.readFileSync('game/GameEngine.js', 'utf8');

if (!ge.includes('triggerFriendlySpellPlay(playerId)')) {
  // triggerFriendlySpellPlay メソッドの追加
  ge = ge.replace(
    /cleanupDeadUnits\(\) \{/,
    `triggerFriendlySpellPlay(playerId) {
    const player = this.gameState.players[playerId];
    const opponentId = Object.keys(this.gameState.players).find(id => id !== playerId);
    const opponent = this.gameState.players[opponentId];
    const { processAbility } = require('./AbilityProcessor');
    const { forEachUnit } = require('./GameState');
    let triggeredAny = false;
    forEachUnit(player.board, (unit) => {
      if (unit.keywords && unit.keywords.includes('resonance')) {
        const res = processAbility('on_friendly_spell_play', unit, this.gameState, player, opponent, this.cardMap, this.gameState.logs);
        if (this.handleAbilityResult(res, unit, 'on_friendly_spell_play', player, opponent)) {
            // Note: Since resonance might theoretically require a target, we just ignore complex interactions for now or handle them if needed. 
            // In the current design resonance is usually auto-target (like debuff_attack enemy_unit_1).
        }
        triggeredAny = true;
      }
    });
    // Let event loop catch any death from resonance
    if (triggeredAny) {
       this.cleanupDeadUnits();
    }
  }

  cleanupDeadUnits() {`
  );

  // playCard 内で即時解決スペルの後に trigger を呼ぶ
  ge = ge.replace(
    /if \(result\.events\) this\.processEvents\(result\.events, player, opponent\);/,
    `if (result.events) this.processEvents(result.events, player, opponent);
        
        // スペル発動完了時に共鳴トリガーを発火
        this.triggerFriendlySpellPlay(player.id);`
  );

  // resolveTargeting 内で対象選択スペル解決後に trigger を呼ぶ
  ge = ge.replace(
    /this\.cleanupDeadUnits\(\);\n\s*return this\.getGameStateForClients\(\);\n\s*\}/g,
    `this.cleanupDeadUnits();
      if (sourceInfo && sourceInfo.trigger === 'on_play' && sourceInfo.spellCardId) {
        this.triggerFriendlySpellPlay(player.id);
      }
      return this.getGameStateForClients();
    }`
  );
}

fs.writeFileSync('game/GameEngine.js', ge, 'utf8');
console.log('UI and Engine fixes applied successfully.');
