// CombatResolver.js - レーン制戦闘処理
'use strict';

const { hasKeyword } = require('./KeywordEffects');

/**
 * ユニット同士の戦闘処理
 * 相互ダメージ方式、連撃対応
 */
function resolveUnitCombat(attacker, defender, logs) {
  const results = {
    attackerDead: false,
    defenderDead: false,
    events: [],
  };

  const isDoubleStrike = hasKeyword(attacker, 'double_strike');

  // --- 1撃目 ---
  const firstDamage = attacker.currentAttack;
  const actualFirstDamage = applyDamage(defender, firstDamage, logs);
  results.events.push({
    type: 'damage',
    source: attacker.instanceId,
    target: defender.instanceId,
    damage: actualFirstDamage,
    strike: 1,
  });
  logs.push(`⚔️ ${attacker.name}(ATK${attacker.currentAttack}) → ${defender.name} に ${actualFirstDamage} ダメージ (HP: ${defender.currentHp})`);

  // 1撃目で撃破チェック
  if (defender.currentHp <= 0) {
    const defenderKilled = processUnitDeath(defender, logs);
    results.defenderDead = defenderKilled;
    if (defenderKilled) {
      results.events.push({ type: 'kill', target: defender.instanceId });
      logs.push(`💀 ${defender.name} 撃破！（1撃目で撃破のため反撃なし）`);
      // 1撃目で撃破 → 反撃なし
      return results;
    }
  }

  // --- 2撃目（連撃） ---
  if (isDoubleStrike && !results.defenderDead) {
    const secondDamage = attacker.currentAttack;
    const actualSecondDamage = applyDamage(defender, secondDamage, logs);
    results.events.push({
      type: 'damage',
      source: attacker.instanceId,
      target: defender.instanceId,
      damage: actualSecondDamage,
      strike: 2,
    });
    logs.push(`⚔️ ${attacker.name} 連撃2撃目 → ${defender.name} に ${actualSecondDamage} ダメージ (HP: ${defender.currentHp})`);

    if (defender.currentHp <= 0) {
      const defenderKilled = processUnitDeath(defender, logs);
      results.defenderDead = defenderKilled;
      if (defenderKilled) {
        results.events.push({ type: 'kill', target: defender.instanceId });
        logs.push(`💀 ${defender.name} 連撃で撃破！（反撃なし）`);
        return results;
      }
    }
  }

  // --- 反撃 ---
  const counterDamage = defender.currentAttack;
  const actualCounterDamage = applyDamage(attacker, counterDamage, logs);
  results.events.push({
    type: 'counter',
    source: defender.instanceId,
    target: attacker.instanceId,
    damage: actualCounterDamage,
  });
  logs.push(`🔄 ${defender.name}(ATK${defender.currentAttack}) 反撃 → ${attacker.name} に ${actualCounterDamage} ダメージ (HP: ${attacker.currentHp})`);

  if (attacker.currentHp <= 0) {
    const attackerKilled = processUnitDeath(attacker, logs);
    results.attackerDead = attackerKilled;
    if (attackerKilled) {
      results.events.push({ type: 'kill', target: attacker.instanceId });
      logs.push(`💀 ${attacker.name} 反撃により撃破！`);
    }
  }

  return results;
}

/**
 * ダメージ適用（加護チェック含む）
 */
function applyDamage(unit, damage, logs) {
  if (damage <= 0) return 0;

  // 加護チェック
  if (unit.barrierActive) {
    unit.barrierActive = false;
    // keywordsからbarrierを除去
    unit.keywords = unit.keywords.filter(k => k !== 'barrier');
    logs.push(`🛡️ ${unit.name} の加護がダメージを無効化！（加護消滅）`);
    return 0;
  }

  unit.currentHp -= damage;
  return damage;
}

/**
 * ユニット死亡処理（不屈チェック含む）
 * @returns {boolean} 本当に死亡したか
 */
function processUnitDeath(unit, logs) {
  if (unit.currentHp > 0) return false;

  // 不屈チェック
  if (unit.endureActive) {
    unit.endureActive = false;
    unit.currentHp = 1;
    unit.keywords = unit.keywords.filter(k => k !== 'endure');
    logs.push(`💪 ${unit.name} の不屈が発動！HP1で復活！`);
    return false;
  }

  return true;
}

/**
 * シールドへの攻撃処理
 */
function resolveShieldAttack(attacker, shields, logs) {
  // 攻城キーワードチェック
  const isSiege = hasKeyword(attacker, 'siege');
  const shieldDamage = isSiege ? 2 : 1;

  // 前から順にシールドを攻撃
  for (let i = 0; i < shields.length; i++) {
    const shield = shields[i];
    if (shield && !shield.destroyed && shield.currentDurability > 0) {
      shield.currentDurability -= shieldDamage;
      logs.push(`🛡️ ${attacker.name} がシールド「${shield.name}」を攻撃！(耐久: ${shield.currentDurability + shieldDamage} → ${shield.currentDurability}${isSiege ? ' [攻城]' : ''})`);

      if (shield.currentDurability <= 0) {
        shield.currentDurability = 0;
        shield.destroyed = true;
        logs.push(`💥 シールド「${shield.name}」破壊！スキル「${shield.skill ? shield.skill.name : 'なし'}」発動！`);
        return { shieldDestroyed: true, shield, shieldIndex: i, shieldDamage };
      }
      return { shieldDestroyed: false, shield, shieldIndex: i, shieldDamage };
    }
  }

  // 全シールド破壊済み → ダイレクトアタック
  return { directAttack: true };
}

module.exports = {
  resolveUnitCombat,
  applyDamage,
  processUnitDeath,
  resolveShieldAttack,
};
