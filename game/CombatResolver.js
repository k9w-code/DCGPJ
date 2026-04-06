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
  
  // 1. 攻撃側の第1撃のダメージを計算（適用はまだログのみ）
  const atkDamage = attacker.currentAttack;
  const defDamage = defender.currentAttack;

  // --- 第1撃処理 ---
  const actualAtkDamage = applyDamage(defender, atkDamage, logs);
  results.events.push({
    type: 'damage',
    source: attacker.instanceId,
    target: defender.instanceId,
    damage: actualAtkDamage,
    strike: 1,
  });
  logs.push(`⚔️ ${attacker.name}(ATK${atkDamage}) → ${defender.name} に ${actualAtkDamage} ダメージ (HP: ${defender.currentHp})`);

  // 特殊ルール: 連撃（Double Strike）持ちが第1撃で仕留めた場合のみ「無傷」で終了
  const isDefenderDeadFirstHit = defender.currentHp <= 0;
  if (isDoubleStrike && isDefenderDeadFirstHit) {
    const defenderKilled = processUnitDeath(defender, logs);
    results.defenderDead = defenderKilled;
    if (defenderKilled) {
      results.events.push({ type: 'kill', target: defender.instanceId });
      logs.push(`💀 ${defender.name} 撃破！（連撃の1撃目で倒されたため、${attacker.name} は無傷）`);
    }
    return results;
  }

  // --- 反撃処理（通常攻撃なら相打ち、連撃で仕留めきれなかった場合も反撃を受ける） ---
  const actualCounterDamage = applyDamage(attacker, defDamage, logs);
  results.events.push({
    type: 'counter',
    source: defender.instanceId,
    target: attacker.instanceId,
    damage: actualCounterDamage,
  });
  logs.push(`🔄 ${defender.name}(ATK${defDamage}) 反撃 → ${attacker.name} に ${actualCounterDamage} ダメージ (HP: ${attacker.currentHp})`);

  // ドレイン等の効果（戦闘中適時）
  if (actualAtkDamage > 0 && hasKeyword(attacker, 'drain')) {
    const healed = Math.min(2, attacker.maxHp - attacker.currentHp);
    if (healed > 0) { attacker.currentHp += healed; logs.push(`🩸 ${attacker.name} の吸命！HP+${healed}`); }
  }
  if (actualCounterDamage > 0 && hasKeyword(defender, 'drain')) {
    const healed = Math.min(2, defender.maxHp - defender.currentHp);
    if (healed > 0) { defender.currentHp += healed; logs.push(`🩸 ${defender.name} の吸命！HP+${healed}`); }
  }

  // --- 連撃の第2撃（1打目で倒せなかった場合のみ） ---
  if (isDoubleStrike && !isDefenderDeadFirstHit) {
    const actualSecondDamage = applyDamage(defender, atkDamage, logs);
    results.events.push({
      type: 'damage',
      source: attacker.instanceId,
      target: defender.instanceId,
      damage: actualSecondDamage,
      strike: 2,
    });
    logs.push(`⚔️ ${attacker.name} 連撃2撃目 → ${defender.name} に ${actualSecondDamage} ダメージ`);
  }

  // 最終的な死亡判定をまとめて実行
  if (defender.currentHp <= 0) {
    const defenderKilled = processUnitDeath(defender, logs);
    results.defenderDead = defenderKilled;
    if (defenderKilled) results.events.push({ type: 'kill', target: defender.instanceId });
  }
  if (attacker.currentHp <= 0) {
    const attackerKilled = processUnitDeath(attacker, logs);
    results.attackerDead = attackerKilled;
    if (attackerKilled) results.events.push({ type: 'kill', target: attacker.instanceId });
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
