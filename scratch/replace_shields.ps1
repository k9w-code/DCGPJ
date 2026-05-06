$c = Get-Content "c:\Users\imai\workspace\dcgpj\public\js\game-renderer.js"
$newLines = @'
function renderShields(containerId, shields, isMine) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  const shieldList = shields || [];
  shieldList.forEach((shield, index) => {
    const el = document.createElement('div');
    const rarityClass = shield.rarity ? ` rarity-${shield.rarity}` : ' rarity-1';
    
    // 破壊済みかどうかのクラス
    el.className = `shield-gem${shield.destroyed ? ' destroyed' : ''}${rarityClass}`;
    
    if (!shield.destroyed) {
      // 耐久値表示
      const dur = document.createElement('div');
      dur.className = 'shield-durability-overlay';
      dur.textContent = shield.currentDurability;
      el.appendChild(dur);
    } else {
      // 破壊済みは X アイコンなどを表示
      el.innerHTML = '<div class="destroyed-mark">×</div>';
    }
    
    attachCardDetailEvent(el, shield);
    container.appendChild(el);
  });
}

function renderOpponentShields(containerId, opponent, selectedAttacker) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // 攻撃選択中ならコンテナに can-attack を付与（矢印のスナップ用）
  if (selectedAttacker !== null) {
    container.classList.add('can-attack');
  } else {
    container.classList.remove('can-attack');
  }

  const shields = opponent.shields || [];
  // もしshields配列が空なら（古いデータ構造対策）、以前の簡易表示にフォールバック
  if (!shields || shields.length === 0) {
    const totalShields = 3;
    const destroyed = opponent.shieldsDestroyed || 0;
    for (let i = 0; i < totalShields; i++) {
      const el = document.createElement('div');
      el.className = i < destroyed ? 'shield-gem destroyed' : 'shield-gem hidden';
      container.appendChild(el);
    }
    return;
  }

  shields.forEach((shield, index) => {
    const el = document.createElement('div');
    const rarityClass = shield.rarity ? ` rarity-${shield.rarity}` : ' rarity-1';
    
    // 相手のシールドは「裏面」を強調するクラスを付与
    el.className = `shield-gem opponent-shield${shield.destroyed ? ' destroyed' : ' hidden'}${rarityClass}`;
    
    if (!shield.destroyed) {
      const dur = document.createElement('div');
      dur.className = 'shield-durability-overlay';
      dur.textContent = shield.currentDurability || '?';
      el.appendChild(dur);
    } else {
      el.innerHTML = '<div class="destroyed-mark">×</div>';
    }

    // 詳細表示（???と表示されるはず）
    attachCardDetailEvent(el, shield);
    container.appendChild(el);
  });
}
'@ -split "\r?\n"

$before = $c[0..759]
$after = $c[809..($c.Length - 1)]
$final = $before + $newLines + $after
$final | Set-Content "c:\Users\imai\workspace\dcgpj\public\js\game-renderer.js" -Encoding UTF8
