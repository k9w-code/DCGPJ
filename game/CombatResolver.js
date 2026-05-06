// CombatResolver.js - \u30ec\u30fc\u30f3\u5236\u6226\u95d8\u51e6\u7406
'use strict';

const { hasKeyword } = require('./KeywordEffects');

/**
 * \u30e6\u30cb\u30c3\u30c8\u540c\u58eb\u306e\u6226\u95d8\u51e6\u7406
 * \u76f8\u4e92\u30c0\u30e1\u30fc\u30b8\u65b9\u5f0f\u3001\u9023\u6483\u5bfe\u5fdc
 */
function resolveUnitCombat(attacker, defender, logs) {
  const results = {
    attackerDead: false,
    defenderDead: false,
    attackerDmgTaken: 0,  // VFX\u7528: \u653b\u6483\u5074\u304c\u53d7\u3051\u305f\u30c0\u30e1\u30fc\u30b8
    defenderDmgTaken: 0,  // VFX\u7528: \u9632\u5fa1\u5074\u304c\u53d7\u3051\u305f\u30c0\u30e1\u30fc\u30b8
    events: [],
  };

  const isDoubleStrike = hasKeyword(attacker, 'double_strike');
  
  // 1. \u653b\u6483\u5074\u306e\u7b2c1\u6483\u306e\u30c0\u30e1\u30fc\u30b8\u3092\u8a08\u7b97\uff08\u9069\u7528\u306f\u307e\u3060\u30ed\u30b0\u306e\u307f\uff09
  const atkDamage = attacker.currentAttack;
  const defDamage = defender.currentAttack;

  // --- \u7b2c1\u6483\u51e6\u7406 ---
  const actualAtkDamage = applyDamage(defender, atkDamage, logs);
  results.defenderDmgTaken += actualAtkDamage;
  if (actualAtkDamage > 0 && hasKeyword(attacker, 'lethal') && defender.currentHp > 0) {
    defender.currentHp = 0;
    logs.push(`\u2620\ufe0f ${attacker.name} \u306e\u300c\u5fc5\u6bba\u300d\u304c\u767a\u52d5\uff01 ${defender.name} \u306f\u5373\u6b7b\u3057\u305f\uff01`);
  }
  results.events.push({
    type: 'damage',
    source: attacker.instanceId,
    target: defender.instanceId,
    damage: actualAtkDamage,
    strike: 1,
  });
  logs.push(`\u2694\ufe0f ${attacker.name}(ATK${atkDamage}) \u2192 ${defender.name} \u306b ${actualAtkDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${defender.currentHp})`);

  // \u7279\u6b8a\u30eb\u30fc\u30eb: \u9023\u6483\uff08Double Strike\uff09\u6301\u3061\u304c\u7b2c1\u6483\u3067\u4ed5\u7559\u3081\u305f\u5834\u5408\u306e\u307f\u300c\u7121\u50b7\u300d\u3067\u7d42\u4e86
  const isDefenderDeadFirstHit = defender.currentHp <= 0;
  if (isDoubleStrike && isDefenderDeadFirstHit) {
    const defenderKilled = processUnitDeath(defender, logs);
    results.defenderDead = defenderKilled;
    if (defenderKilled) {
      results.events.push({ type: 'kill', target: defender.instanceId });
      logs.push(`\ud83d\udc80 ${defender.name} \u6483\u7834\uff01\uff08\u9023\u6483\u306e1\u6483\u76ee\u3067\u5012\u3055\u308c\u305f\u305f\u3081\u3001${attacker.name} \u306f\u7121\u50b7\uff09`);
    } else {
      results.events.push({ type: 'endure', target: defender.instanceId });
    }
    return results;
  }

  // --- \u53cd\u6483\u51e6\u7406\uff08\u901a\u5e38\u653b\u6483\u306a\u3089\u76f8\u6253\u3061\u3001\u9023\u6483\u3067\u4ed5\u7559\u3081\u304d\u308c\u306a\u304b\u3063\u305f\u5834\u5408\u3082\u53cd\u6483\u3092\u53d7\u3051\u308b\uff09 ---
  const actualCounterDamage = applyDamage(attacker, defDamage, logs);
  results.attackerDmgTaken += actualCounterDamage;
  if (actualCounterDamage > 0 && hasKeyword(defender, 'lethal') && attacker.currentHp > 0) {
    attacker.currentHp = 0;
    logs.push(`\u2620\ufe0f ${defender.name} \u306e\u53cd\u6483\u300c\u5fc5\u6bba\u300d\u304c\u767a\u52d5\uff01 ${attacker.name} \u306f\u5373\u6b7b\u3057\u305f\uff01`);
  }
  results.events.push({
    type: 'counter',
    source: defender.instanceId,
    target: attacker.instanceId,
    damage: actualCounterDamage,
  });
  logs.push(`\ud83d\udd04 ${defender.name}(ATK${defDamage}) \u53cd\u6483 \u2192 ${attacker.name} \u306b ${actualCounterDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${attacker.currentHp})`);

  // \u30c9\u30ec\u30a4\u30f3\u7b49\u306e\u52b9\u679c\uff08\u6226\u95d8\u4e2d\u9069\u6642\uff09
  if (actualAtkDamage > 0 && hasKeyword(attacker, 'drain')) {
    const healed = Math.min(2, attacker.maxHp - attacker.currentHp);
    if (healed > 0) { attacker.currentHp += healed; logs.push(`\ud83e\ude78 ${attacker.name} \u306e\u5438\u547d\uff01HP+${healed}`); }
  }
  if (actualCounterDamage > 0 && hasKeyword(defender, 'drain')) {
    const healed = Math.min(2, defender.maxHp - defender.currentHp);
    if (healed > 0) { defender.currentHp += healed; logs.push(`\ud83e\ude78 ${defender.name} \u306e\u5438\u547d\uff01HP+${healed}`); }
  }

  // --- \u9023\u6483\u306e\u7b2c2\u6483\uff081\u6253\u76ee\u3067\u5012\u305b\u306a\u304b\u3063\u305f\u5834\u5408\u306e\u307f\uff09 ---
  if (isDoubleStrike && !isDefenderDeadFirstHit) {
    const actualSecondDamage = applyDamage(defender, atkDamage, logs);
    results.defenderDmgTaken += actualSecondDamage;
    if (actualSecondDamage > 0 && hasKeyword(attacker, 'lethal') && defender.currentHp > 0) {
      defender.currentHp = 0;
      logs.push(`\u2620\ufe0f ${attacker.name} \u306e\u300c\u5fc5\u6bba\u300d(\u9023\u64832\u6483\u76ee)\u304c\u767a\u52d5\uff01 ${defender.name} \u306f\u5373\u6b7b\u3057\u305f\uff01`);
    }
    results.events.push({
      type: 'damage',
      source: attacker.instanceId,
      target: defender.instanceId,
      damage: actualSecondDamage,
      strike: 2,
    });
    logs.push(`\u2694\ufe0f ${attacker.name} \u9023\u64832\u6483\u76ee \u2192 ${defender.name} \u306b ${actualSecondDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${defender.currentHp})`);
  }

  // \u6700\u7d42\u7684\u306a\u6b7b\u4ea1\u5224\u5b9a\u3092\u307e\u3068\u3081\u3066\u5b9f\u884c
  if (defender.currentHp <= 0) {
    const defenderKilled = processUnitDeath(defender, logs);
    results.defenderDead = defenderKilled;
    if (defenderKilled) results.events.push({ type: 'kill', target: defender.instanceId });
    else results.events.push({ type: 'endure', target: defender.instanceId });
  }
  if (attacker.currentHp <= 0) {
    const attackerKilled = processUnitDeath(attacker, logs);
    results.attackerDead = attackerKilled;
    if (attackerKilled) results.events.push({ type: 'kill', target: attacker.instanceId });
    else results.events.push({ type: 'endure', target: attacker.instanceId });
  }

  return results;
}

/**
 * \u30c0\u30e1\u30fc\u30b8\u9069\u7528\uff08\u52a0\u8b77\u30c1\u30a7\u30c3\u30af\u542b\u3080\uff09
 */
function applyDamage(unit, damage, logs) {
  if (damage <= 0) return 0;

  // \u52a0\u8b77\u30c1\u30a7\u30c3\u30af
  if (unit.barrierActive) {
    unit.barrierActive = false;
    // keywords\u304b\u3089barrier\u3092\u9664\u53bb
    unit.keywords = unit.keywords.filter(k => k !== 'barrier');
    logs.push(`\ud83d\udee1\ufe0f ${unit.name} \u306e\u52a0\u8b77\u304c\u30c0\u30e1\u30fc\u30b8\u3092\u7121\u52b9\u5316\uff01\uff08\u52a0\u8b77\u6d88\u6ec5\uff09`);
    return 0;
  }

  unit.currentHp -= damage;
  return damage;
}

/**
 * \u30e6\u30cb\u30c3\u30c8\u6b7b\u4ea1\u51e6\u7406\uff08\u4e0d\u5c48\u30c1\u30a7\u30c3\u30af\u542b\u3080\uff09
 * @returns {boolean} \u672c\u5f53\u306b\u6b7b\u4ea1\u3057\u305f\u304b
 */
function processUnitDeath(unit, logs) {
  if (unit.endureActive && unit.currentHp <= 0) {
    unit.endureActive = false;
    unit.currentHp = 1;
    // keywords \u914d\u5217\u304b\u3089\u3082 'endure' \u3092\u53d6\u308a\u9664\u304f
    if (unit.keywords) {
      unit.keywords = unit.keywords.filter(k => k !== 'endure');
    }
    logs.push(`\ud83d\udcaa ${unit.name} \u306e\u300c\u4e0d\u5c48\u300d\u304c\u767a\u52d5\uff01\u7834\u58ca\u3092\u514d\u308cHP 1\u3067\u8010\u3048\u305f\uff01`);
    return false; // \u6b7b\u4ea1\u3057\u3066\u3044\u306a\u3044
  }
  return unit.currentHp <= 0;
}

/**
 * \u30b7\u30fc\u30eb\u30c9\u3078\u306e\u653b\u6483\u51e6\u7406
 */
function resolveShieldAttack(attacker, shields, logs) {
  // \u653b\u57ce\u30ad\u30fc\u30ef\u30fc\u30c9\u30c1\u30a7\u30c3\u30af
  const isSiege = hasKeyword(attacker, 'siege');
  const shieldDamage = isSiege ? 2 : 1;

  // \u524d\u304b\u3089\u9806\u306b\u30b7\u30fc\u30eb\u30c9\u3092\u653b\u6483
  for (let i = 0; i < shields.length; i++) {
    const shield = shields[i];
    if (shield && !shield.destroyed && shield.currentDurability > 0) {
      shield.currentDurability -= shieldDamage;
      logs.push(`\ud83d\udee1\ufe0f ${attacker.name} \u304c\u30b7\u30fc\u30eb\u30c9\u300c${shield.name}\u300d\u3092\u653b\u6483\uff01(\u8010\u4e45: ${shield.currentDurability + shieldDamage} \u2192 ${shield.currentDurability}${isSiege ? ' [\u653b\u57ce]' : ''})`);

      if (shield.currentDurability <= 0) {
        shield.currentDurability = 0;
        shield.destroyed = true;
        logs.push(`\ud83d\udca5 \u30b7\u30fc\u30eb\u30c9\u300c${shield.name}\u300d\u7834\u58ca\uff01\u30b9\u30ad\u30eb\u300c${shield.skill ? shield.skill.name : '\u306a\u3057'}\u300d\u767a\u52d5\uff01`);
        return { shieldDestroyed: true, shield, shieldIndex: i, shieldDamage };
      }
      return { shieldDestroyed: false, shield, shieldIndex: i, shieldDamage };
    }
  }

  // \u5168\u30b7\u30fc\u30eb\u30c9\u7834\u58ca\u6e08\u307f \u2192 \u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af
  return { directAttack: true };
}

module.exports = {
  resolveUnitCombat,
  applyDamage,
  processUnitDeath,
  resolveShieldAttack,
};
