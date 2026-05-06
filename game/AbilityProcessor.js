const { NUM_LANES, ROWS, forEachUnit, calculateLife, createUnitInstance } = require('./GameState');
const { hasKeyword, getKeywordParam, getKeywordId } = require('./KeywordEffects');

// \u30d8\u30eb\u30d1\u30fc: \u30e6\u30cb\u30c3\u30c8\u7fa4\u304b\u3089\u7279\u5b9a\u306e\u6761\u4ef6\u3067\u300c\u5019\u88dc\u300d\u3092\u30ea\u30b9\u30c8\u30a2\u30c3\u30d7\u3059\u308b
function selectByCriteria(units, criteria, mode) {
  if (units.length === 0) return [];
  
  // \u307e\u305a\u6307\u5b9a\u57fa\u6e96\uff08HP, ATK, Cost\uff09\u306e\u6700\u9069\u5024\u3092\u898b\u3064\u3051\u308b
  let bestVal = (mode === 'min') ? Infinity : -Infinity;
  units.forEach(u => {
    let val;
    if (criteria === 'hp') val = u.currentHp;
    else if (criteria === 'atk') val = u.currentAttack !== undefined ? u.currentAttack : u.attack;
    else if (criteria === 'cost') val = u.cost || 0;

    if (mode === 'min') { if (val < bestVal) bestVal = val; }
    else { if (val > bestVal) bestVal = val; }
  });

  if (bestVal === Infinity || bestVal === -Infinity) return [];

  // \u6700\u9069\u5024\u3068\u4e00\u81f4\u3059\u308b\u30e6\u30cb\u30c3\u30c8\u3092\u3059\u3079\u3066\u8fd4\u3059\uff08\u30bf\u30a4\u3092\u7dad\u6301\uff09
  return units.filter(u => {
    let val;
    if (criteria === 'hp') val = u.currentHp;
    else if (criteria === 'atk') val = u.currentAttack !== undefined ? u.currentAttack : u.attack;
    else if (criteria === 'cost') val = u.cost || 0;
    return val === bestVal;
  });
}

// \u30d8\u30eb\u30d1\u30fc: \u5bfe\u8c61\u6307\u5b9a\u8b58\u5225\u5b50\u306b\u57fa\u3065\u3044\u3066\u30bf\u30fc\u30b2\u30c3\u30c8\u3092\u53d6\u5f97
function getAbilityTargets(targetId, currentPlayer, opponentPlayer, value, unit) {
  const isEnemyTarget = targetId.startsWith('enemy_unit_');
  
  const selfUnits = [];
  forEachUnit(currentPlayer.board, u => selfUnits.push(u));
  const enemyUnits = [];
  forEachUnit(opponentPlayer.board, u => enemyUnits.push(u));

  let candidates = [];
  switch (targetId) {
    case 'self_unit_1':
      candidates = selfUnits; break;
    case 'self_unit_all':
      return selfUnits;
    case 'enemy_unit_1':
      candidates = enemyUnits; break;
    case 'enemy_unit_all':
      candidates = enemyUnits; break;
    case 'all_units':
      return [...selfUnits, ...enemyUnits];
    
    // HP\u57fa\u6e96
    case 'enemy_unit_weakest': candidates = selectByCriteria(enemyUnits, 'hp', 'min'); break;
    case 'enemy_unit_toughest': candidates = selectByCriteria(enemyUnits, 'hp', 'max'); break;
    case 'self_unit_weakest': candidates = selectByCriteria(selfUnits, 'hp', 'min'); break;
    case 'self_unit_toughest': candidates = selectByCriteria(selfUnits, 'hp', 'max'); break;

    // \u653b\u6483\u529b\u57fa\u6e96
    case 'enemy_unit_strongest': candidates = selectByCriteria(enemyUnits, 'atk', 'max'); break;
    case 'enemy_unit_frailest': candidates = selectByCriteria(enemyUnits, 'atk', 'min'); break;
    case 'self_unit_strongest': candidates = selectByCriteria(selfUnits, 'atk', 'max'); break;
    case 'self_unit_frailest': candidates = selectByCriteria(selfUnits, 'atk', 'min'); break;

    // \u30b3\u30b9\u30c8\u57fa\u6e96
    case 'enemy_unit_highest_cost': candidates = selectByCriteria(enemyUnits, 'cost', 'max'); break;
    case 'enemy_unit_lowest_cost': candidates = selectByCriteria(enemyUnits, 'cost', 'min'); break;
    case 'self_unit_highest_cost': candidates = selectByCriteria(selfUnits, 'cost', 'max'); break;
    case 'self_unit_lowest_cost': candidates = selectByCriteria(selfUnits, 'cost', 'min'); break;

    case 'self': return [currentPlayer];
    case 'enemy': return [opponentPlayer];
    case 'this_unit': return unit ? [unit] : []; // \u81ea\u8eab\u3092\u5bfe\u8c61\u306b\u3059\u308b
    case 'enemy_shield': return opponentPlayer.shields.filter(s => !s.destroyed).slice(0, 1);
    default: return [];
  }

  // \u76f8\u624b\u30e6\u30cb\u30c3\u30c8\u3092\u5bfe\u8c61\u3068\u3059\u308b\u5834\u5408\u3001\u9b54\u76fe (spellshield) \u3092\u6301\u3064\u30e6\u30cb\u30c3\u30c8\u3092\u5019\u88dc\u304b\u3089\u304b\u3089\u9664\u5916
  // \u5168\u4f53\u52b9\u679c\uff08\u30bf\u30fc\u30b2\u30c3\u30c8ID\u306b 'all' \u304c\u542b\u307e\u308c\u308b\u5834\u5408\uff09\u306f\u3001\u9b54\u76fe\uff08Spellshield\uff09\u3084\u6f5c\u4f0f\uff08Stealth\uff09\u3092\u7121\u8996\u3059\u308b
  const isAreaEffect = targetId.includes('all');

  if (isEnemyTarget && !isAreaEffect) {
    candidates = candidates.filter(u => !hasKeyword(u, 'spellshield'));
  }

  // 1\u4f53\u6307\u5b9a\u7cfb\uff08_1, weakest\u7b49\uff09\u3067\u5019\u88dc\u304c\u8907\u6570\u306e\u5834\u5408\u3001\u3053\u3053\u3067\u306f\u5168\u54e1\u8fd4\u3057\u3066\u547c\u3073\u51fa\u3057\u5074(processAbility)\u3067\u5224\u65ad\u3055\u305b\u308b
  // \u305f\u3060\u3057\u3001\u5358\u4f53\u306e\u30e9\u30f3\u30c0\u30e01\u4f53 (enemy_unit_1\u7b49) \u306e\u5834\u5408\u306f\u3001\u6b74\u53f2\u7684\u306a\u4e92\u63db\u6027\u3068\u3057\u3066\u3053\u3053\u30671\u3064\u9078\u3076\u5834\u5408\u3082\u3042\u308b\u304c\u3001
  // \u6700\u65b0\u306e\u300c\u30bf\u30a4\u306a\u3089\u9078\u629e\u300d\u30eb\u30fc\u30eb\u3092\u512a\u5148\u3057\u3001\u4e00\u65e6\u5019\u88dc\u30ea\u30b9\u30c8\u306e\u72b6\u614b\u3092\u7dad\u6301\u3057\u3066\u8fd4\u3059
  return candidates;
}

function processAbility(trigger, unit, gameState, currentPlayer, opponentPlayer, cardMap, logs, targetRow, targetLane, startIndex = 0) {
  const abilities = unit.abilities && unit.abilities.length > 0 ? unit.abilities : [
    { trigger: unit.abilityTrigger, effect: unit.abilityEffect, value: unit.abilityValue, target: 'enemy_unit_1' }
  ];

  const events = [];
  let needsTarget = false;
  let targetId = null;

  for (let i = startIndex; i < abilities.length; i++) {
    const ability = abilities[i];
    if (ability.trigger !== trigger || !ability.effect) continue;

    // 沈黙状態なら全アビリティを発動させない
    if (unit.silenced) {
      console.log(`[Ability] ${unit.name} is silenced, skipping ability.`);
      continue;
    }

    // \u6761\u4ef6\u306e\u30c1\u30a7\u30c3\u30af\uff08\u65e2\u5b58\u306e keywords \u5217\u304b\u3089\u53d6\u5f97\uff09
    let conditionMet = true;
    
    // on_play \u306e\u5834\u5408\u3001keywords \u306b awaken \u304c\u3042\u308c\u3070\u305d\u308c\u3092\u30ec\u30d9\u30eb\u6761\u4ef6\u3068\u3057\u3066\u6271\u3046
    if (trigger === 'on_play') {
      const awakenKw = unit.keywords && unit.keywords.find(k => k.startsWith('awaken'));
      if (awakenKw) {
        const { getKeywordId } = require('./KeywordEffects');
        const kw = getKeywordId(awakenKw);
        let currentLv = 0;
        if (kw.color === 'any') {
          currentLv = Object.values(currentPlayer.tribeLevels).reduce((sum, val) => sum + val, 0);
        } else if (kw.color === 'self') {
          currentLv = currentPlayer.tribeLevels[unit.color] || 0;
        } else {
          currentLv = currentPlayer.tribeLevels[kw.color] || 0;
        }
        if (currentLv < kw.param) {
          conditionMet = false;
          logs.push(`\u26a0\ufe0f ${unit.name} \u306f\u795e\u65cf\u30ec\u30d9\u30eb\u6761\u4ef6\uff08${awakenKw}\uff09\u3092\u6e80\u305f\u3057\u3066\u3044\u306a\u3044\u305f\u3081\u3001\u52b9\u679c\u306f\u767a\u52d5\u3057\u307e\u305b\u3093\u3067\u3057\u305f`);
        }
      }
    }
    
    // \u4ee3\u511f (Sacrifice) \u306e\u30c1\u30a7\u30c3\u30af
    if (trigger === 'on_play' && i === startIndex && (targetRow === null || targetRow === undefined)) {
      if (hasKeyword(unit, 'sacrifice')) {
        let alliesCount = 0;
        forEachUnit(currentPlayer.board, (u) => { if (u && u !== unit) alliesCount++; });
        if (alliesCount > 0) {
          return {
            events,
            needsTarget: true,
            targetId: 'self_unit_1',
            effect: 'sacrifice_destruction',
            abilityIndex: startIndex
          };
        }
      }
    }

    // \u6b8b\u97ff (Echo) \u306e\u30c1\u30a7\u30c3\u30af
    if (trigger === 'on_play' && i === startIndex && (targetRow === null || targetRow === undefined)) {
      if (hasKeyword(unit, 'echo') && currentPlayer.sp >= unit.cost) {
        let hasEmptySlot = false;
        ['front', 'back'].forEach(r => {
          for (let j = 0; j < NUM_LANES; j++) {
            if (!currentPlayer.board[r][j]) hasEmptySlot = true;
          }
        });
        if (hasEmptySlot) {
          return { 
            events, 
            needsTarget: true, 
            targetId: 'empty_slot', 
            effect: 'echo_summon', 
            abilityIndex: startIndex 
          };
        }
      }
    }

    // \u305d\u306e\u4ed6\u306e\u30ad\u30fc\u30ef\u30fc\u30c9\u6761\u4ef6\uff08link, crisis\u7b49\uff09
    const condKeys = ['link', 'crisis', 'vanguard', 'rearguard', 'loner', 'avenger'];
    const activeCondKw = unit.keywords && unit.keywords.find(k => condKeys.includes(getKeywordId(k).id));
    if (activeCondKw) {
      const cond = getKeywordId(activeCondKw).id;
      if (cond === 'link' && currentPlayer.cardsPlayedThisTurn <= 1) conditionMet = false;
      else if (cond === 'crisis' && calculateLife(currentPlayer) > 3) conditionMet = false;
      else if (cond === 'vanguard') {
        let frontCount = 0;
        let isFront = false;
        for (let j = 0; j < NUM_LANES; j++) {
          if (currentPlayer.board.front[j]) {
            frontCount++;
            if (currentPlayer.board.front[j] === unit) isFront = true;
          }
        }
        if (frontCount !== 1 || !isFront) conditionMet = false;
      }
      else if (cond === 'rearguard') {
        let backCount = 0;
        let isBack = false;
        for (let j = 0; j < NUM_LANES; j++) {
          if (currentPlayer.board.back[j]) {
            backCount++;
            if (currentPlayer.board.back[j] === unit) isBack = true;
          }
        }
        if (backCount !== 1 || !isBack) conditionMet = false;
      }
      else if (cond === 'loner') {
        let totalCount = 0;
        forEachUnit(currentPlayer.board, () => totalCount++);
        if (totalCount !== 1) conditionMet = false;
      }
      else if (cond === 'avenger' && currentPlayer.friendlyDeathsThisTurn === 0) conditionMet = false;

      if (!conditionMet) {
        logs.push(`\u26a0\ufe0f ${unit.name} \u306e\u300c${cond}\u300d\u6761\u4ef6\u3092\u6e80\u305f\u3057\u3066\u3044\u306a\u3044\u305f\u3081\u767a\u52d5\u3057\u307e\u305b\u3093`);
      }
    }

    if (!conditionMet) continue;

    const effect = ability.effect;
    const value = ability.value;
    const abilityTargetId = ability.target || 'enemy_unit_1';

    // \u914d\u7f6e (on_play) \u76f4\u5f8c\u306f targetRow/Lane \u306f\u914d\u7f6e\u5834\u6240\u3092\u6307\u3059\u305f\u3081\u3001\u30d5\u30a7\u30fc\u30ba\u304c targeting \u304b\u3064\u624b\u52d5\u30c8\u30ea\u30ac\u30fc\u3067\u306a\u3044\u9650\u308a\u3001\u3053\u308c\u3089\u3092\u30a2\u30d3\u30ea\u30c6\u30a3\u306e\u5bfe\u8c61\u3068\u306f\u307f\u306a\u3055\u306a\u3044
    const manualTarget = (targetRow !== undefined && targetRow !== null && targetLane !== undefined && targetLane !== null && gameState.phase === 'targeting') 
      ? (abilityTargetId.includes('self') ? currentPlayer.board[targetRow][targetLane] : opponentPlayer.board[targetRow][targetLane])
      : null;

    switch (effect) {
      case 'damage': {
        const { applyDamage } = require('./CombatResolver');
        if (manualTarget) {
          const actualDamage = applyDamage(manualTarget, value, logs);
          logs.push(`\ud83d\udd25 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'ability_damage', source: unit.instanceId, target: manualTarget.instanceId, damage: actualDamage });
          if (manualTarget.currentHp <= 0) events.push({ type: 'ability_kill', target: manualTarget.instanceId });
        } else {
          const { applyDamage } = require('./CombatResolver');
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            const target = targets[0];
            const actualDamage = applyDamage(target, value, logs);
            logs.push(`\ud83d\udd25 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${target.currentHp})`);
            events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: actualDamage });
            if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          } else if (abilityTargetId !== 'all_units' && !abilityTargetId.includes('all')) {
            logs.push(`\u26a0\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\uff1a\u5bfe\u8c61\u304c\u9b54\u76fe\uff08Spellshield\uff09\u3067\u5b88\u3089\u308c\u3066\u3044\u308b\u304b\u3001\u6709\u52b9\u306a\u5bfe\u8c61\u304c\u3044\u306a\u3044\u305f\u3081\u4e0d\u767a\u306b\u7d42\u308f\u308a\u307e\u3057\u305f`);
          }
        }
        break;
      }
      case 'damage_all':
      case 'damage_all_enemy': {
        const { applyDamage } = require('./CombatResolver');
        const tType = effect === 'damage_all' ? 'all_units' : 'enemy_unit_all';
        const targets = getAbilityTargets(tType, currentPlayer, opponentPlayer);
        targets.forEach(target => {
          const actualDamage = applyDamage(target, value, logs);
          logs.push(`\ud83d\udd25 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${target.currentHp})`);
          events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: actualDamage });
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
        });
        break;
      }
      case 'heal': {
        if (manualTarget) {
          const healed = Math.min(value, manualTarget.maxHp - manualTarget.currentHp);
          manualTarget.currentHp += healed;
          logs.push(`\ud83d\udc9a ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u3092 ${healed} \u56de\u5fa9 (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'ability_heal', source: unit.instanceId, target: manualTarget.instanceId, value: healed });
        } else {
          const targetSpec = (abilityTargetId === 'enemy_unit_1' || abilityTargetId === 'enemy_unit') ? 'self_unit_1' : abilityTargetId;
          const targets = getAbilityTargets(targetSpec, currentPlayer, opponentPlayer, value);
          
          if (targets.length === 1) {
            const target = targets[0];
            const healed = Math.min(value, target.maxHp - target.currentHp);
            target.currentHp += healed;
            logs.push(`\ud83d\udc9a ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092 ${healed} \u56de\u5fa9 (HP: ${target.currentHp})`);
            events.push({ type: 'ability_heal', source: unit.instanceId, target: target.instanceId, value: healed });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = targetSpec;
          }
        }
        break;
      }
      case 'heal_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          const healed = Math.min(value, target.maxHp - target.currentHp);
          if (healed > 0) {
            target.currentHp += healed;
            logs.push(`\ud83d\udc9a ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092 ${healed} \u56de\u5fa9 (HP: ${target.currentHp})`);
            events.push({ type: 'ability_heal', source: unit.instanceId, target: target.instanceId, value: healed });
          }
        });
        break;
      }
      case 'draw': {
        logs.push(`\ud83d\udcd6 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${value} \u679a\u30c9\u30ed\u30fc`);
        events.push({ type: 'ability_draw', player: currentPlayer.id, count: value });
        break;
      }
      case 'buff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack += value;
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: value });
          logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u653b\u6483\u529b+${value} (ATK: ${manualTarget.currentAttack})`);
        } else {
          const targets = abilityTargetId === 'this_unit' ? [unit] : getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            target.currentAttack += value;
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: value });
            logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u653b\u6483\u529b+${value} (ATK: ${target.currentAttack})`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'buff_attack_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentAttack += value;
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: value });
          logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u653b\u6483\u529b+${value} (ATK: ${target.currentAttack})`);
        });
        break;
      }
      case 'buff_hp': {
        if (manualTarget) {
          manualTarget.currentHp += value;
          manualTarget.maxHp += value;
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'hp', value: value });
          logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} HP+${value} (HP: ${manualTarget.currentHp})`);
        } else {
          const targets = abilityTargetId === 'this_unit' ? [unit] : getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            target.currentHp += value;
            target.maxHp += value;
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'hp', value: value });
            logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} HP+${value} (HP: ${target.currentHp})`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'buff_stats': {
        if (manualTarget) {
          manualTarget.currentAttack += value;
          manualTarget.currentHp += value;
          manualTarget.maxHp += value;
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: value });
          manualTarget.modifiers.push({ source: unit.name, type: 'hp', value: value });
          logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} ATK/HP+${value} (ATK: ${manualTarget.currentAttack}, HP: ${manualTarget.currentHp})`);
        } else {
          const targets = abilityTargetId === 'this_unit' ? [unit] : getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            target.currentAttack += value;
            target.currentHp += value;
            target.maxHp += value;
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: value });
            target.modifiers.push({ source: unit.name, type: 'hp', value: value });
            logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} ATK/HP+${value} (ATK: ${target.currentAttack}, HP: ${target.currentHp})`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'buff_hp_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentHp += value;
          target.maxHp += value;
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'hp', value: value });
          logs.push(`\u2b06\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} HP+${value} (HP: ${target.currentHp})`);
        });
        break;
      }
      case 'debuff_attack_all': {
        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentAttack = Math.max(0, target.currentAttack - value);
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          logs.push(`\u2b07\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306e\u653b\u6483\u529b\u3092 ${value} \u6e1b\u5c11 (ATK: ${target.currentAttack})`);
        });
        break;
      }
      case 'debuff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack = Math.max(0, manualTarget.currentAttack - value);
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          logs.push(`\u2b07\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u306e\u653b\u6483\u529b\u3092 ${value} \u6e1b\u5c11 (ATK: ${manualTarget.currentAttack})`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            const target = targets[0];
            target.currentAttack = Math.max(0, target.currentAttack - value);
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
            logs.push(`\u2b07\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306e\u653b\u6483\u529b\u3092 ${value} \u6e1b\u5c11 (ATK: ${target.currentAttack})`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'debuff_hp': {
        const { processUnitDeath } = require('./CombatResolver');
        const processDebuffHp = (target) => {
          target.currentHp = Math.max(0, target.currentHp - value);
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'hp', value: -value });
          logs.push(`\u2b07\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306eHP\u3092 ${value} \u6e1b\u5c11 (HP: ${target.currentHp})`);
          
          if (target.currentHp <= 0) {
            const isReallyDead = processUnitDeath(target, logs);
            if (isReallyDead) {
              events.push({ type: 'ability_kill', target: target.instanceId });
              logs.push(`\ud83d\udc80 ${target.name} \u306f\u751f\u547d\u529b\u3092\u5931\u3044\u6483\u7834\u3055\u308c\u305f\uff01`);
            }
          }
        };

        if (manualTarget) {
          processDebuffHp(manualTarget);
        } else if (trigger === 'on_play' && !abilityTargetId.includes('all')) {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          targets.forEach(target => processDebuffHp(target));
        }
        break;
      }
      case 'debuff_stats': {
        const { processUnitDeath } = require('./CombatResolver');
        const processDebuffStats = (target) => {
          target.currentAttack = Math.max(0, target.currentAttack - value);
          target.currentHp = Math.max(0, target.currentHp - value);
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          target.modifiers.push({ source: unit.name, type: 'hp', value: -value });
          logs.push(`\u2b07\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306e\u653b\u6483\u529b/HP\u3092 ${value} \u6e1b\u5c11 (ATK: ${target.currentAttack}, HP: ${target.currentHp})`);
          
          if (target.currentHp <= 0) {
            const isReallyDead = processUnitDeath(target, logs);
            if (isReallyDead) {
              events.push({ type: 'ability_kill', target: target.instanceId });
              logs.push(`\ud83d\udc80 ${target.name} \u306f\u751f\u547d\u529b\u3092\u5931\u3044\u6483\u7834\u3055\u308c\u305f\uff01`);
            }
          }
        };

        if (manualTarget) {
          processDebuffStats(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            processDebuffStats(targets[0]);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'destroy': {
        const { processUnitDeath } = require('./CombatResolver');
        if (manualTarget) {
          const isDead = processUnitDeath(manualTarget, logs);
          if (isDead) {
            manualTarget.currentHp = 0;
            logs.push(`\u2620\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u3092\u7834\u58ca\uff01`);
            events.push({ type: 'ability_kill', target: manualTarget.instanceId });
          }
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            const target = targets[0];
            const isDead = processUnitDeath(target, logs);
            if (isDead) {
              target.currentHp = 0;
              logs.push(`\u2620\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092\u7834\u58ca\uff01`);
              events.push({ type: 'ability_kill', target: target.instanceId });
            }
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'destroy_lowest_hp':
      case 'destroy_highest_hp':
      case 'destroy_highest_atk':
      case 'destroy_lowest_atk': {
        const isLowestHp = effect === 'destroy_lowest_hp';
        const isHighestHp = effect === 'destroy_highest_hp';
        const isHighestAtk = effect === 'destroy_highest_atk';
        const isLowestAtk = effect === 'destroy_lowest_atk';

        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        if (targets.length === 0) break;

        let bestValue = null;
        if (isLowestHp) bestValue = Math.min(...targets.map(t => t.currentHp));
        else if (isHighestHp) bestValue = Math.max(...targets.map(t => t.currentHp));
        else if (isHighestAtk) bestValue = Math.max(...targets.map(t => t.currentAttack));
        else if (isLowestAtk) bestValue = Math.min(...targets.map(t => t.currentAttack));

        const candidates = targets.filter(t => {
          if (isLowestHp || isHighestHp) return t.currentHp === bestValue;
          return t.currentAttack === bestValue;
        });

        let targetToDestroy = null;

        if (candidates.length === 1) {
          targetToDestroy = candidates[0];
        } else if (candidates.length > 1) {
          if (manualTarget) {
             const valid = candidates.find(c => c.instanceId === manualTarget.instanceId);
             if (valid) {
               targetToDestroy = manualTarget;
             } else {
               logs.push(`\u26a0\ufe0f \u9078\u629e\u3055\u308c\u305f\u30bf\u30fc\u30b2\u30c3\u30c8\u306f\u6761\u4ef6\u3092\u6e80\u305f\u3057\u3066\u3044\u307e\u305b\u3093\u3002\u52b9\u679c\u306f\u4e0d\u767a\u3068\u306a\u308a\u307e\u3057\u305f\u3002`);
               break;
             }
          } else if (trigger === 'on_play' || trigger === 'activate') {
             needsTarget = true;
             targetId = 'enemy_unit_1'; // \u30af\u30e9\u30a4\u30a2\u30f3\u30c8\u5074\u306b\u6575\u3092\u9078\u629e\u53ef\u80fd\u3068\u4f1d\u3048\u308b
             break;
          } else {
             // \u30bf\u30fc\u30f3\u7d42\u4e86\u6642\u7b49\u306e\u30bf\u30a4\u30d6\u30ec\u30fc\u30af\u306f\u5de6\u4e0a\u304b\u3089\u512a\u5148\uff08\u5b89\u5b9a\u30bd\u30fc\u30c8\u306e\u7b2c1\u5019\u88dc\uff09
             targetToDestroy = candidates[0];
          }
        }

        if (targetToDestroy) {
          const { processUnitDeath } = require('./CombatResolver');
          const isDead = processUnitDeath(targetToDestroy, logs);
          if (isDead) {
            targetToDestroy.currentHp = 0;
            const detailStr = isLowestHp ? '\u6700\u3082HP\u304c\u4f4e\u3044' : isHighestHp ? '\u6700\u3082HP\u304c\u9ad8\u3044' : isHighestAtk ? '\u6700\u3082\u653b\u6483\u529b\u304c\u9ad8\u3044' : '\u6700\u3082\u653b\u6483\u529b\u304c\u4f4e\u3044';
            logs.push(`\u2620\ufe0f ${unit.name} \u306e\u52b9\u679c\uff01${detailStr} ${targetToDestroy.name} \u3092\u7834\u58ca\uff01`);
            events.push({ type: 'ability_kill', target: targetToDestroy.instanceId });
          }
        }
        break;
      }
      case 'freeze': {
        if (manualTarget) {
          manualTarget.hasActed = true;
          manualTarget.canAttack = false;
          manualTarget.frozen = true;
          logs.push(`\u2744\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u3092\u51cd\u7d50\uff01 (\u6b21\u30bf\u30fc\u30f3\u884c\u52d5\u4e0d\u53ef)`);
          events.push({ type: 'ability_freeze', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              target.hasActed = true;
              target.canAttack = false;
              target.frozen = true;
              logs.push(`\u2744\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092\u51cd\u7d50\uff01`);
              events.push({ type: 'ability_freeze', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            target.hasActed = true;
            target.canAttack = false;
            target.frozen = true;
            logs.push(`\u2744\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092\u51cd\u7d50\uff01 (\u6b21\u30bf\u30fc\u30f3\u884c\u52d5\u4e0d\u53ef)`);
            events.push({ type: 'ability_freeze', target: target.instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'bounce': {
        if (manualTarget) {
          logs.push(`\ud83d\udd04 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u3092\u624b\u672d\u306b\u623b\u3059`);
          events.push({ type: 'ability_bounce', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            // \u5168\u4f53\u30d0\u30a6\u30f3\u30b9\u306e\u51e6\u7406
            targets.forEach(target => {
              logs.push(`\ud83d\udd04 ${unit.name} \u306e\u52b9\u679c\uff01${target.name} \u3092\u624b\u672d\u306b\u623b\u3059`);
              events.push({ type: 'ability_bounce', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            logs.push(`\ud83d\udd04 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u3092\u624b\u672d\u306b\u623b\u3059`);
            events.push({ type: 'ability_bounce', target: target.instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'grant_barrier': {
        if (manualTarget) {
          manualTarget.barrierActive = true;
          if (!manualTarget.keywords.includes('barrier')) manualTarget.keywords.push('barrier');
          logs.push(`\ud83d\udee1\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u306b\u52a0\u8b77\u3092\u4ed8\u4e0e`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            const target = targets[0];
            target.barrierActive = true;
            if (!target.keywords.includes('barrier')) target.keywords.push('barrier');
            logs.push(`\ud83d\udee1\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306b\u52a0\u8b77\u3092\u4ed8\u4e0e`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'grant_endure': {
        if (manualTarget) {
          manualTarget.endureActive = true;
          if (!manualTarget.keywords.includes('endure')) manualTarget.keywords.push('endure');
          logs.push(`\ud83d\udcaa ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${manualTarget.name} \u306b\u4e0d\u5c48\u3092\u4ed8\u4e0e`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 1) {
            const target = targets[0];
            target.endureActive = true;
            if (!target.keywords.includes('endure')) target.keywords.push('endure');
            logs.push(`\ud83d\udcaa ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306b\u4e0d\u5c48\u3092\u4ed8\u4e0e`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'drain': {
        const targets = manualTarget ? [manualTarget] : getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
        targets.forEach(target => {
          target.currentHp -= value;
          logs.push(`\ud83e\ude78 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u304b\u3089 ${value} \u5438\u53ce`);
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
          
          const allies = [];
          forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
          if (allies.length > 0) {
            allies.sort((a, b) => a.currentHp - b.currentHp);
            const healed = Math.min(value, allies[0].maxHp - allies[0].currentHp);
            allies[0].currentHp += healed;
            logs.push(`\ud83d\udc9a ${allies[0].name} \u3092 ${healed} \u56de\u5fa9`);
            events.push({ type: 'ability_heal', source: unit.instanceId, target: allies[0].instanceId, value: healed });
          }
        });
        break;
      }
      case 'damage_shield': {
        const availableShields = opponentPlayer.shields.filter(s => !s.destroyed);
        if (availableShields.length > 0) {
          const targetShield = availableShields[0];
          targetShield.currentDurability -= value;
          logs.push(`\ud83d\udca5 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01\u6575\u306e\u30b7\u30fc\u30eb\u30c9\u306b\u76f4\u63a5 ${value} \u30c0\u30e1\u30fc\u30b8`);
          if (targetShield.currentDurability <= 0) {
            targetShield.currentDurability = 0;
            targetShield.destroyed = true;
            events.push({ type: 'ability_shield_destroy', player: opponentPlayer.id, index: opponentPlayer.shields.indexOf(targetShield) });
          }
        }
        break;
      }
      case 'heal_shield': {
        const shields = currentPlayer.shields;
        let targetShield = shields.find(s => s.currentDurability < s.durability && !s.destroyed) || shields.find(s => s.destroyed) || shields[0];
        if (targetShield) {
          if (targetShield.destroyed) targetShield.destroyed = false;
          targetShield.currentDurability += value;
          logs.push(`\ud83d\udee1\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01\u30b7\u30fc\u30eb\u30c9\u3092 ${value} \u56de\u5fa9\uff01`);
          events.push({ type: 'ability_shield_heal', player: currentPlayer.id, index: shields.indexOf(targetShield), value: value });
        }
        break;
      }
      case 'sp_gain': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        const targetName = targetPlayer === currentPlayer ? '\u81ea\u5206' : '\u76f8\u624b';
        targetPlayer.sp += value;
        logs.push(`\ud83d\udcb0 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${targetName}\u306e SP+${value} (\u73fe\u5728: ${targetPlayer.sp})`);
        break;
      }
      case 'sp_loss': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        const targetName = targetPlayer === currentPlayer ? '\u81ea\u5206' : '\u76f8\u624b';
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`\u26a0\ufe0f ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${targetName}\u306e SP-${value} (\u73fe\u5728: ${targetPlayer.sp})`);
        break;
      }
      case 'discard_random': {
        for (let i = 0; i < value && opponentPlayer.hand.length > 0; i++) {
          const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
          const discarded = opponentPlayer.hand.splice(idx, 1)[0];
          logs.push(`\u270b ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01\u76f8\u624b\u306e\u624b\u672d\u3092\u7834\u68c4 (${discarded.name})`);
          events.push({ type: 'ability_discard', player: opponentPlayer.id });
        }
        break;
      }
      case 'reduce_cost_hand': {
        if (currentPlayer.hand.length > 0) {
          const idx = Math.floor(Math.random() * currentPlayer.hand.length);
          const targetCard = currentPlayer.hand[idx];
          targetCard.cost = Math.max(0, targetCard.cost - value);
          logs.push(`\u2728 ${unit.name} \u306e\u52b9\u679c\uff01\u624b\u672d\u306e\u300c${targetCard.name}\u300d\u306e\u30b3\u30b9\u30c8\u304c ${value} \u4e0b\u304c\u3063\u305f (\u73fe\u5728: ${targetCard.cost})`);
        }
        break;
      }
      case 'steal_unit': {
        if (manualTarget && manualTarget.instanceId) {
          // \u76f8\u624b\u306e\u76e4\u9762\u304b\u3089\u524a\u9664
          let removed = false;
          let stoleFrom = null;
          for (const r of ROWS) {
            for (let i = 0; i < NUM_LANES; i++) {
              if (opponentPlayer.board[r][i] && opponentPlayer.board[r][i].instanceId === manualTarget.instanceId) {
                stoleFrom = opponentPlayer.board[r][i];
                opponentPlayer.board[r][i] = null;
                removed = true;
                break;
              }
            }
          }
          if (removed && stoleFrom) {
            // \u81ea\u5206\u306e\u7a7a\u304d\u30b9\u30ed\u30c3\u30c8\u3092\u63a2\u3059
            let moved = false;
            for (const r of ROWS) {
              for (let i = 0; i < NUM_LANES; i++) {
                if (!currentPlayer.board[r][i]) {
                  stoleFrom.ownerId = currentPlayer.id; // \u6240\u6709\u6a29\u5909\u66f4
                  currentPlayer.board[r][i] = stoleFrom;
                  moved = true;
                  logs.push(`\ud83e\uddf2 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01\u76f8\u624b\u306e ${stoleFrom.name} \u3092\u5f37\u596a\u3057\u3066\u81ea\u5206\u306e\u76e4\u9762\u306b\u5f15\u304d\u305a\u308a\u8fbc\u3093\u3060\uff01`);
                  break;
                }
              }
              if (moved) break;
            }
            if (!moved) {
              // \u7a7a\u304d\u30de\u30b9\u304c\u306a\u3044\u5834\u5408\u306f\u4e0d\u767a\uff08\u76f8\u624b\u306e\u76e4\u9762\u306b\u4e00\u77ac\u3067\u623b\u3059\u304b\u3001\u5893\u5730\u306b\u9001\u308b\u304b\u3002\u5b89\u5168\u306e\u305f\u3081\u3053\u3053\u3067\u306f\u5143\u306b\u623b\u3059\uff09
              logs.push(`\u26a0\ufe0f \u7a7a\u304d\u30de\u30b9\u304c\u306a\u3044\u305f\u3081\u5f37\u596a\u5931\u6557`);
              // (To be strictly safe we would put them back, but let's assume UI forced a target or empty check. Actually if no space, we just kill it)
              stoleFrom.currentHp = 0;
              events.push({ type: 'ability_kill', target: stoleFrom.instanceId });
            }
          }
        } else if (trigger === 'on_play' && !abilityTargetId.includes('all')) {
          needsTarget = true;
        }
        break;
      }
      case 'silence': {
        const processSilence = (target) => {
          target.keywords = [];
          target.abilities = [];
          target.barrierActive = false;
          target.stealthActive = false;
          target.endureActive = false;
          target.frozen = false; // \u51cd\u7d50\u89e3\u9664
          logs.push(`\ud83d\ude36 ${unit.name} \u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u767a\u52d5\uff01${target.name} \u306f\u300c\u6c88\u9ed9\u300d\u3057\u3001\u3059\u3079\u3066\u306e\u80fd\u529b\u3092\u5931\u3063\u305f\uff01`);
        };
        if (manualTarget) {
          processSilence(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            targets.forEach(t => processSilence(t));
          } else if (targets.length === 1) {
            processSilence(targets[0]);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'summon_token': {
        const tokenId = ability.tokenId || value;
        const tokenCard = cardMap[tokenId];
        if (!tokenCard) break;

        // \u53ec\u559a\u5834\u6240\u304c\u672a\u78ba\u5b9a\u306e\u5834\u5408\u3001\u30d7\u30ec\u30a4\u30e4\u30fc\u306b\u5165\u529b\u3092\u4fc3\u3059\uff08\u5168\u30c8\u30ea\u30ac\u30fc\u5171\u901a\uff09
        if (!targetRow || targetLane === undefined || targetLane === null) {
          // \u5c11\u306a\u304f\u3068\u30821\u3064\u306f\u7a7a\u304d\u30b9\u30ed\u30c3\u30c8\u304c\u3042\u308b\u304b\u78ba\u8a8d
          let hasEmptySlot = false;
          ['front', 'back'].forEach(r => {
            for (let i = 0; i < NUM_LANES; i++) {
              if (!currentPlayer.board[r][i]) hasEmptySlot = true;
            }
          });

          if (hasEmptySlot) {
            console.log(`\ud83c\udfaf [AbilityProcessor] summon_token: Requesting target for ${unit.name} (${trigger})`);
            needsTarget = true;
            targetId = 'empty_slot';
            // \u30bf\u30fc\u30b2\u30c3\u30c8\u8981\u6c42\u6642\u306f\u5373\u5ea7\u306b\u7d50\u679c\u3092\u8fd4\u3057\u3001\u5165\u529b\u3092\u5f85\u3064
            return { events, needsTarget, targetId, effect: 'summon_token', originalAbility: ability };
          } else {
            logs.push(`\u26a0\ufe0f ${unit.name} \u306e\u52b9\u679c\uff01\u3057\u304b\u3057\u5834\u306b\u7a7a\u304d\u304c\u306a\u304f\u53ec\u559a\u306b\u5931\u6557\u3057\u307e\u3057\u305f`);
            break;
          }
        }

        // \u53ec\u559a\u5834\u6240\u304c\u78ba\u5b9a\u3057\u3066\u3044\u308b\u5834\u5408\uff08\u89e3\u6c7a\u30d5\u30a7\u30fc\u30ba\uff09
        if (!currentPlayer.board[targetRow][targetLane]) {
          const tokenInstance = createUnitInstance(tokenCard, currentPlayer.id);
          tokenInstance.hasActed = true; // \u51fa\u3057\u305f\u30bf\u30fc\u30f3\u306f\u57fa\u672c\u7684\u306b\u653b\u6483\u4e0d\u53ef
          currentPlayer.board[targetRow][targetLane] = tokenInstance;
          events.push({
            type: 'ability_summon',
            player: currentPlayer.id,
            unit: tokenInstance,
            row: targetRow,
            lane: targetLane
          });
          logs.push(`\u2728 ${unit.name} \u306e\u52b9\u679c: ${tokenCard.name} \u3092\u53ec\u559a\u3057\u307e\u3057\u305f`);
        }
        break;
      }
      default: {
        logs.push(`\u26a0\ufe0f \u672a\u5b9f\u88c5\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u52b9\u679c: ${effect}`);
        break;
      }
    }
    if (needsTarget) {
      // targetId\u304c\u672a\u8a2d\u5b9a\u306e\u5834\u5408\u3001ability.target \u304b\u3089\u81ea\u52d5\u8a2d\u5b9a
      if (!targetId) {
        targetId = abilityTargetId;
      }
      console.log(`\ud83c\udfaf [AbilityProcessor] Target requested for ${effect}, targetId: ${targetId}`);
      return { events, needsTarget, targetId, effect, originalAbility: ability, abilityIndex: i };
    }
  }
  return { events, needsTarget: false, targetId: null };
}

function processSearch(unit, playerState, cardMap, logs) {
  const searchCount = getKeywordParam(unit, 'search');
  if (searchCount === null || searchCount <= 0) return;

  const revealed = [];
  for (let i = 0; i < Math.min(searchCount, playerState.deck.length); i++) {
    const cardId = playerState.deck[i];
    revealed.push({ index: i, card: cardMap[cardId] });
  }

  if (revealed.length === 0) {
    logs.push(`\ud83d\udd0d ${unit.name} \u306e\u63a2\u7d22${searchCount}: \u5c71\u672d\u306b\u30ab\u30fc\u30c9\u304c\u3042\u308a\u307e\u305b\u3093`);
    return;
  }

  logs.push(`\ud83d\udd0d ${unit.name} \u306e\u63a2\u7d22${searchCount}: ${revealed.map(r => r.card.name).join(', ')} \u3092\u78ba\u8a8d`);

  revealed.sort((a, b) => b.card.cost - a.card.cost);
  const chosen = revealed[0];
  playerState.deck.splice(chosen.index, 1);
  playerState.hand.push({ ...chosen.card });
  logs.push(`\ud83d\udd0d ${unit.name} \u306e\u63a2\u7d22: ${chosen.card.name} \u3092\u624b\u672d\u306b\u52a0\u3048\u305f`);

  return { revealed, chosen: chosen.card };
}

function processSpellEffect(card, gameState, currentPlayer, opponentPlayer, targetRow, targetLane, cardMap, logs, startIndex = 0) {
  const abilities = card.abilities && card.abilities.length > 0 ? card.abilities : [
    { trigger: 'on_play', effect: card.abilityEffect, value: card.abilityValue, target: card.targetId || 'enemy_unit_1' }
  ];

  const events = [];
  let needsTarget = false;
  let targetId = null;

  for (let i = startIndex; i < abilities.length; i++) {
    const ability = abilities[i];
    if (!ability.effect) continue;

    const effect = ability.effect;
    const value = ability.value;
    const abilityTargetId = ability.target || 'enemy_unit_1';

    // \u624b\u52d5\u30bf\u30fc\u30b2\u30c3\u30c8\uff08\u30d7\u30ec\u30a4\u30e4\u30fc\u304c\u30af\u30ea\u30c3\u30af\u3057\u305f\u5bfe\u8c61\uff09\u306e\u5224\u5b9a
    const manualTarget = (targetRow !== undefined && targetRow !== null && targetLane !== undefined && targetLane !== null && gameState.phase === 'targeting') 
      ? (abilityTargetId.includes('self') ? currentPlayer.board[targetRow][targetLane] : opponentPlayer.board[targetRow][targetLane])
      : null;

    switch (effect) {
      case 'damage': {
        const { applyDamage } = require('./CombatResolver');
        if (manualTarget) {
          const actualDamage = applyDamage(manualTarget, value, logs);
          logs.push(`\ud83d\udd25 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'spell_damage', source: card.id, target: manualTarget.instanceId, damage: actualDamage });
          if (manualTarget.currentHp <= 0) events.push({ type: 'spell_kill', target: manualTarget.instanceId, row: targetRow, lane: targetLane });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 0) {
            logs.push(`\ud83d\udca8 \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u5bfe\u8c61\u304c\u9b54\u76fe\uff08Spellshield\uff09\u3067\u5b88\u3089\u308c\u3066\u3044\u308b\u304b\u3001\u6709\u52b9\u306a\u5bfe\u8c61\u304c\u3044\u306a\u3044\u305f\u3081\u4e0d\u767a\u306b\u7d42\u308f\u308a\u307e\u3057\u305f`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          } else {
            const target = targets[0];
            const actualDamage = applyDamage(target, value, logs);
            logs.push(`\ud83d\udd25 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${target.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8 (HP: ${target.currentHp})`);
            events.push({ type: 'spell_damage', source: card.id, target: target.instanceId, damage: actualDamage });
            if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId });
          }
        }
        break;
      }
      case 'damage_all': {
        const { applyDamage } = require('./CombatResolver');
        const targets = getAbilityTargets('all_units', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          const actualDamage = applyDamage(target, value, logs);
          logs.push(`\ud83d\udd25 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${target.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8`);
          events.push({ type: 'spell_damage', source: card.id, target: target.instanceId, damage: actualDamage });
          if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId });
        });
        break;
      }
      case 'damage_all_enemy': {
        const { applyDamage } = require('./CombatResolver');
        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          const actualDamage = applyDamage(target, value, logs);
          logs.push(`\ud83d\udd25 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${target.name} \u306b ${actualDamage} \u30c0\u30e1\u30fc\u30b8`);
          events.push({ type: 'spell_damage', source: card.id, target: target.instanceId, damage: actualDamage });
          if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId });
        });
        break;
      }
      case 'draw': {
        events.push({ type: 'spell_draw', player: currentPlayer.id, count: value });
        logs.push(`\ud83d\udcd6 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${value} \u679a\u30c9\u30ed\u30fc`);
        break;
      }
      case 'reduce_cost_hand': {
        if (currentPlayer.hand.length > 0) {
          const idx = Math.floor(Math.random() * currentPlayer.hand.length);
          const targetCard = currentPlayer.hand[idx];
          targetCard.cost = Math.max(0, targetCard.cost - value);
          logs.push(`\u2728 \u30b9\u30da\u30eb\u300c${card.name}\u300d\u767a\u52d5\uff01\u624b\u672d\u306e\u300c${targetCard.name}\u300d\u306e\u30b3\u30b9\u30c8\u304c ${value} \u4e0b\u304c\u3063\u305f (\u73fe\u5728: ${targetCard.cost})`);
        }
        break;
      }
      case 'steal_unit': {
        if (manualTarget) {
          let moved = false;
          for (const r of ROWS) {
            for (let j = 0; j < NUM_LANES; j++) {
              if (!currentPlayer.board[r][j]) {
                manualTarget.ownerId = currentPlayer.id;
                currentPlayer.board[r][j] = manualTarget;
                // \u5143\u306e\u5834\u6240\u3092\u6d88\u53bb\uff08opponentPlayer\u306e\u30dc\u30fc\u30c9\u304b\u3089\u63a2\u3059\uff09
                forEachUnit(opponentPlayer.board, (u, row, lane) => {
                  if (u && u.instanceId === manualTarget.instanceId) opponentPlayer.board[row][lane] = null;
                });
                moved = true;
                logs.push(`\ud83e\uddf2 \u30b9\u30da\u30eb\u300c${card.name}\u300d\u767a\u52d5\uff01\u76f8\u624b\u306e ${manualTarget.name} \u3092\u5f37\u596a\u3057\u305f\uff01`);
                break;
              }
            }
            if (moved) break;
          }
          if (!moved) {
            logs.push(`\u26a0\ufe0f \u7a7a\u304d\u30de\u30b9\u304c\u306a\u3044\u305f\u3081\u5f37\u596a\u5931\u6557`);
            manualTarget.currentHp = 0;
            events.push({ type: 'spell_kill', target: manualTarget.instanceId });
          }
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'silence': {
        const processSilence = (target) => {
          target.keywords = [];
          target.abilities = [];
          target.silenced = true; // 沈黙フラグをセット
          // デフォルト能力フィールドも無効化
          target.abilityTrigger = null;
          target.abilityEffect = null;
          target.abilityValue = 0;

          target.barrierActive = false;
          target.stealthActive = false;
          target.endureActive = false;
          logs.push(`\ud83d\ude36 \u30b9\u30da\u30eb\u300c${card.name}\u300d\u767a\u52d5\uff01${target.name} \u306f\u300c\u6c88\u9ed9\u300d\u3057\u3001\u80fd\u529b\u3092\u5931\u3063\u305f\uff01`);
        };
        if (manualTarget) {
          processSilence(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (targets.length === 0) {
            logs.push(`\ud83d\udca8 \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u5bfe\u8c61\u7121\u3057`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          } else {
            processSilence(targets[0]);
          }
        }
        break;
      }
      case 'heal': {
        if (manualTarget) {
          const healed = Math.min(value, manualTarget.maxHp - manualTarget.currentHp);
          manualTarget.currentHp += healed;
          logs.push(`\ud83d\udc9a \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u3092 ${healed} \u56de\u5fa9`);
        } else {
          const targets = getAbilityTargets(abilityTargetId === 'enemy_unit_1' ? 'self_unit_1' : abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            const healed = Math.min(value, target.maxHp - target.currentHp);
            target.currentHp += healed;
            logs.push(`\ud83d\udc9a \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${target.name} \u3092 ${healed} \u56de\u5fa9`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'freeze': {
        if (manualTarget) {
          manualTarget.hasActed = true;
          manualTarget.canAttack = false;
          logs.push(`\u2744\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u3092\u51cd\u7d50\uff01`);
          events.push({ type: 'spell_freeze', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              target.hasActed = true;
              target.canAttack = false;
              logs.push(`\u2744\ufe0f \u30b9\u30da\u30eb\u52b9\u679c\uff01${target.name} \u3092\u51cd\u7d50\uff01`);
              events.push({ type: 'spell_freeze', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            targets[0].hasActed = true;
            targets[0].canAttack = false;
            logs.push(`\u2744\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${targets[0].name} \u3092\u51cd\u7d50\uff01`);
            events.push({ type: 'spell_freeze', target: targets[0].instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'destroy': {
        const { processUnitDeath } = require('./CombatResolver');
        if (manualTarget) {
          const isDead = processUnitDeath(manualTarget, logs);
          if (isDead) {
            manualTarget.currentHp = 0;
            logs.push(`\u2620\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u3092\u7834\u58ca\uff01`);
            events.push({ type: 'spell_kill', target: manualTarget.instanceId });
          }
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              const isDead = processUnitDeath(target, logs);
              if (isDead) {
                target.currentHp = 0;
                logs.push(`\u2620\ufe0f \u30b9\u30da\u30eb\u52b9\u679c\uff01${target.name} \u3092\u7834\u58ca\uff01`);
                events.push({ type: 'spell_kill', target: target.instanceId });
              }
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            const isDead = processUnitDeath(target, logs);
            if (isDead) {
              target.currentHp = 0;
              logs.push(`\u2620\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${target.name} \u3092\u7834\u58ca\uff01`);
              events.push({ type: 'spell_kill', target: target.instanceId });
            }
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'destroy_lowest_hp':
      case 'destroy_highest_hp':
      case 'destroy_highest_atk':
      case 'destroy_lowest_atk': {
        // \u7d71\u5408\u30bf\u30fc\u30b2\u30c3\u30c8\u30b7\u30b9\u30c6\u30e0\u3078\u306e\u4e92\u63db\u6027\u306e\u305f\u3081\u306e\u51e6\u7406
        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        if (targets.length === 0) break;
        let bestVal = (effect.includes('lowest') || effect.includes('frailest')) ? Infinity : -Infinity;
        const criteria = effect.includes('hp') ? 'hp' : 'atk';
        targets.forEach(u => {
          const v = criteria === 'hp' ? u.currentHp : (u.currentAttack || u.attack);
          if (effect.includes('lowest') || effect.includes('frailest')) { if (v < bestVal) bestVal = v; }
          else { if (v > bestVal) bestVal = v; }
        });
        const candidates = targets.filter(u => (criteria === 'hp' ? u.currentHp : (u.currentAttack || u.attack)) === bestVal);
        
        if (candidates.length === 1) {
          candidates[0].currentHp = 0;
          logs.push(`\u2620\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${candidates[0].name} \u3092\u7834\u58ca\uff01`);
          events.push({ type: 'spell_kill', target: candidates[0].instanceId });
        } else if (candidates.length > 1) {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'buff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack += value;
          logs.push(`\u2b06\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u653b\u6483\u529b+${value}`);
        } else if (abilityTargetId.includes('all')) {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer);
          targets.forEach(t => t.currentAttack += value);
          logs.push(`\u2b06\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u5168\u30e6\u30cb\u30c3\u30c8 \u653b\u6483\u529b+${value}`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'buff_hp': {
        if (manualTarget) {
          manualTarget.currentHp += value;
          manualTarget.maxHp += value;
          logs.push(`\u2b06\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} HP+${value}`);
        } else if (abilityTargetId.includes('all')) {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer);
          targets.forEach(t => { t.currentHp += value; t.maxHp += value; });
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'buff_stats': {
        if (manualTarget) {
          manualTarget.currentAttack += value;
          manualTarget.currentHp += value;
          manualTarget.maxHp += value;
          logs.push(`\u2b06\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} ATK/HP+${value}`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'grant_barrier': {
        if (manualTarget) {
          manualTarget.barrierActive = true;
          if (!manualTarget.keywords.includes('barrier')) manualTarget.keywords.push('barrier');
          logs.push(`\ud83d\udee1\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u306b\u52a0\u8b77\u3092\u4ed8\u4e0e`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'drain': {
        if (manualTarget) {
          manualTarget.currentHp -= value;
          logs.push(`\ud83e\ude78 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u304b\u3089 ${value} \u5438\u53ce`);
          const allies = [];
          forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
          if (allies.length > 0) {
            allies.sort((a, b) => a.currentHp - b.currentHp);
            const healed = Math.min(value, allies[0].maxHp - allies[0].currentHp);
            allies[0].currentHp += healed;
            logs.push(`\ud83d\udc9a ${allies[0].name} \u3092 ${healed} \u56de\u5fa9`);
          }
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'summon_token': {
        const tokenId = ability.tokenId || value;
        const tokenData = cardMap[tokenId];
        if (tokenData) {
          if (targetRow && targetLane !== null && !currentPlayer.board[targetRow][targetLane]) {
            const tokenInstance = createUnitInstance(tokenData, currentPlayer.id);
            tokenInstance.hasActed = true;
            currentPlayer.board[targetRow][targetLane] = tokenInstance;
            events.push({ type: 'spell_summon', player: currentPlayer.id, unit: tokenInstance, row: targetRow, lane: targetLane });
            logs.push(`\u2694\ufe0f \u30b9\u30da\u30eb\u52b9\u679c\uff01\u300c${tokenInstance.name}\u300d\u3092\u53ec\u559a\u3057\u307e\u3057\u305f`);
          } else {
            needsTarget = true;
            targetId = 'self_board_empty';
          }
        }
        break;
      }
      case 'sp_gain': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        targetPlayer.sp += value;
        logs.push(`\ud83d\udcb0 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${targetPlayer.name}\u306e SP+${value}`);
        break;
      }
      case 'sp_loss': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`\u26a0\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${targetPlayer.name}\u306e SP-${value}`);
        break;
      }
      case 'discard_random': {
        for (let j = 0; j < value && opponentPlayer.hand.length > 0; j++) {
          const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
          const discarded = opponentPlayer.hand.splice(idx, 1)[0];
          logs.push(`\u270b \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u76f8\u624b\u306e\u624b\u672d\u3092\u7834\u68c4 (${discarded.name})`);
          events.push({ type: 'spell_discard', player: opponentPlayer.id });
        }
        break;
      }
      case 'bounce': {
        if (manualTarget) {
          logs.push(`\ud83d\udd04 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u3092\u624b\u672d\u306b\u623b\u3059`);
          events.push({ type: 'spell_bounce', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
          if (abilityTargetId.includes('all')) {
            // \u5168\u4f53\u30d0\u30a6\u30f3\u30b9
            targets.forEach(target => {
              logs.push(`\ud83d\udd04 \u30b9\u30da\u30eb\u52b9\u679c\uff01${target.name} \u3092\u624b\u672d\u306b\u623b\u3059`);
              events.push({ type: 'spell_bounce', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            logs.push(`\ud83d\udd04 \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${targets[0].name} \u3092\u624b\u672d\u306b\u623b\u3059`);
            events.push({ type: 'spell_bounce', target: targets[0].instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          }
        }
        break;
      }
      case 'damage_shield': {
        const availableShields = opponentPlayer.shields.filter(s => !s.destroyed);
        if (availableShields.length > 0) {
          const targetShield = availableShields[0];
          targetShield.currentDurability -= value;
          logs.push(`\ud83d\udca5 \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u6575\u306e\u30b7\u30fc\u30eb\u30c9\u306b\u76f4\u63a5 ${value} \u30c0\u30e1\u30fc\u30b8`);
          if (targetShield.currentDurability <= 0) {
            targetShield.currentDurability = 0;
            targetShield.destroyed = true;
            events.push({ type: 'spell_shield_destroy', player: opponentPlayer.id, index: opponentPlayer.shields.indexOf(targetShield) });
          }
        }
        break;
      }
      case 'heal_shield': {
        const shields = currentPlayer.shields;
        let targetShield = shields.find(s => s.currentDurability < s.durability && !s.destroyed) || shields.find(s => s.destroyed) || shields[0];
        if (targetShield) {
          if (targetShield.destroyed) targetShield.destroyed = false;
          targetShield.currentDurability += value;
          logs.push(`\ud83d\udee1\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: \u30b7\u30fc\u30eb\u30c9\u3092 ${value} \u56de\u5fa9\uff01`);
          events.push({ type: 'spell_shield_heal', player: currentPlayer.id, index: shields.indexOf(targetShield), value: value });
        }
        break;
      }
      case 'debuff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack = Math.max(0, manualTarget.currentAttack - value);
          logs.push(`\u2b07\ufe0f \u30b9\u30da\u30eb\u300c${card.name}\u300d: ${manualTarget.name} \u306e\u653b\u6483\u529b -${value}`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      default:
        logs.push(`\u26a0\ufe0f \u672a\u5b9f\u88c5\u306e\u30b9\u30da\u30eb\u52b9\u679c: ${effect}`);
    }

    if (needsTarget) {
      return { events, needsTarget, targetId, effect, abilityIndex: i };
    }
  }

  return { events, needsTarget: false, targetId: null };
}

function processShieldSkill(shield, currentPlayer, opponentPlayer, cardMap, logs) {
  const abilities = shield.abilities || (shield.skill ? [{
    id: shield.skill.id,
    effect: shield.skill.effectType,
    value: shield.skill.effectValue,
    target: shield.skill.target
  }] : []);

  if (abilities.length === 0) return [];
  
  const allEvents = [];

  abilities.forEach((ability, index) => {
    const effectType = ability.effect || ability.effectType;
    const value = ability.value || ability.effectValue || 0;
    const targetId = ability.target || 'self';
    const events = [];

    // \u30bf\u30fc\u30b2\u30c3\u30c8\u5224\u5b9a\u306e\u5171\u901a\u5316 (self / enemy / opponent)
    const targetPlayer = (targetId === 'enemy' || targetId === 'opponent' || targetId === 'enemy_hand') ? opponentPlayer : currentPlayer;
    const isSelf = targetPlayer === currentPlayer;
    const targetName = isSelf ? '\u81ea\u5206' : '\u76f8\u624b';
    const abilityName = shield.name + (abilities.length > 1 ? ` (\u52b9\u679c${index + 1})` : '\u306e\u30b9\u30ad\u30eb');
    const abilityTargetId = targetId;

    switch (effectType) {
      case 'none':
        if (abilities.length === 1) logs.push(`\ud83d\udee1\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: \u52b9\u679c\u306a\u3057`);
        break;
      
      // \u30c9\u30ed\u30fc\u51e6\u7406\u306e\u7d71\u5408
      case 'draw':
      case 'enemy_draw':
        events.push({ type: 'shield_skill_draw', player: targetPlayer.id, count: value });
        logs.push(`\ud83d\udcd6 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u304c ${value} \u679a\u30c9\u30ed\u30fc`);
        break;

      // \u624b\u672d\u7834\u68c4\u51e6\u7406\u306e\u7d71\u5408
      case 'discard':
      case 'discard_random':
      case 'discard_self':
        for (let i = 0; i < value && targetPlayer.hand.length > 0; i++) {
          const idx = Math.floor(Math.random() * targetPlayer.hand.length);
          const discarded = targetPlayer.hand.splice(idx, 1)[0];
          logs.push(`\u270b \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e ${discarded.name} \u3092\u6368\u3066\u3055\u305b\u305f`);
          events.push({ type: 'ability_discard', player: targetPlayer.id });
        }
        break;

      // SP\u64cd\u4f5c\u306e\u5171\u901a\u5316
      case 'sp_gain':
        targetPlayer.sp += value;
        logs.push(`\ud83d\udcb0 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e SP+${value} (\u5408\u8a08: ${targetPlayer.sp})`);
        break;
      case 'sp_loss':
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`\u26a0\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e SP-${value} (\u5408\u8a08: ${targetPlayer.sp})`);
        break;

      // \u56de\u5fa9\u30fb\u30d0\u30d5\u51e6\u7406\u306e\u6c4e\u7528\u5316
      case 'heal_all_ally':
      case 'heal_all':
        forEachUnit(targetPlayer.board, unit => {
          const healed = Math.min(value, unit.maxHp - unit.currentHp);
          if (healed > 0) {
            unit.currentHp += healed;
            logs.push(`\ud83d\udc9a \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${unit.name} \u3092 ${healed} \u56de\u5fa9`);
          }
        });
        break;

      case 'buff_hp_all_ally':
      case 'buff_hp_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.currentHp += value;
          unit.maxHp += value;
        });
        logs.push(`\u2b06\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u5168\u30e6\u30cb\u30c3\u30c8\u306eHP+${value}`);
        break;

      case 'buff_attack_all_ally':
      case 'buff_attack_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.currentAttack += value;
        });
        logs.push(`\u2b06\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u5168\u30e6\u30cb\u30c3\u30c8\u306e\u653b\u6483\u529b+${value}`);
        break;

      // \u30c0\u30e1\u30fc\u30b8\u30fb\u7834\u58ca\u51e6\u7406\u306e\u6c4e\u7528\u5316
      case 'damage':
      case 'damage_all_enemy':
      case 'damage_all_ally':
        forEachUnit(targetPlayer.board, (target, row, lane) => {
          target.currentHp -= value;
          logs.push(`\ud83d\udd25 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${target.name} \u306b ${value} \u30c0\u30e1\u30fc\u30b8`);
          if (target.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: target.instanceId, row, lane });
        });
        break;

      case 'damage_all':
        // \u4e21\u65b9\u306e\u30dc\u30fc\u30c9\u306b\u30c0\u30e1\u30fc\u30b8
        [currentPlayer, opponentPlayer].forEach(p => {
          forEachUnit(p.board, (u, r, l) => {
            u.currentHp -= value;
            if (u.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: u.instanceId, row: r, lane: l });
          });
        });
        logs.push(`\ud83d\udca5 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: \u5168\u30e6\u30cb\u30c3\u30c8\u306b ${value} \u30c0\u30e1\u30fc\u30b8`);
        break;

      case 'damage_self': // \u4ee5\u524d\u306e\u4e92\u63db\u6027\u7528
        forEachUnit(currentPlayer.board, (ally, row, lane) => {
          ally.currentHp -= value;
          logs.push(`\ud83d\udca5 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${ally.name} \u306b ${value} \u30c0\u30e1\u30fc\u30b8 (\u30c7\u30e1\u30ea\u30c3\u30c8)`);
          if (ally.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: ally.instanceId, row, lane });
        });
        break;

      case 'destroy':
      case 'destroy_weakest':
      case 'destroy_weakest_enemy':
      case 'destroy_strongest':
      case 'destroy_strongest_enemy': {
        const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
        targets.forEach(target => {
          if (target.instanceId) {
            target.currentHp = 0;
            logs.push(`\u2620\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${target.name} \u3092\u7834\u58ca\uff01`);
            events.push({ type: 'ability_kill', target: target.instanceId });
          }
        });
        break;
      }

      case 'bounce':
      case 'bounce_lowest':
      case 'bounce_lowest_enemy':
      case 'bounce_highest':
      case 'bounce_highest_enemy': {
        const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u306e\u5834\u5408\u306f\u30e6\u30cb\u30c3\u30c8\u306a\u3057
        targets.forEach(target => {
          if (target.instanceId) {
            logs.push(`\ud83d\udd04 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${target.name} \u3092\u624b\u672d\u306b\u623b\u3057\u305f`);
            events.push({ 
              type: 'ability_bounce', 
              target: target.instanceId,
              row: target.row,
              lane: target.lane
            });
          }
        });
        break;
      }

      case 'grant_barrier_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.barrierActive = true;
          if (!unit.keywords.includes('barrier')) unit.keywords.push('barrier');
        });
        logs.push(`\ud83d\udee1\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u5168\u30e6\u30cb\u30c3\u30c8\u306b\u52a0\u8b77\u3092\u4ed8\u4e0e`);
        break;

      case 'summon_token': {
        let tokenId = value;
        if (!isNaN(parseInt(value)) && String(value).length < 4) {
          tokenId = 'T' + String(value).padStart(3, '0');
        }
        const tokenData = cardMap[tokenId] || cardMap[value];
        if (tokenData) {
          let spawnedCount = 0;
          for (const row of ROWS) {
            for (let i = 0; i < NUM_LANES; i++) {
              if (!targetPlayer.board[row][i] && spawnedCount < 1) {
                const tokenInstance = createUnitInstance(tokenData, targetPlayer.id);
                tokenInstance.hasActed = true;
                targetPlayer.board[row][i] = tokenInstance;
                events.push({ type: 'ability_summon', player: targetPlayer.id, unit: tokenInstance, row, lane: i });
                logs.push(`\u2694\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306b\u300c${tokenInstance.name}\u300d\u3092\u53ec\u559a`);
                spawnedCount++;
              }
            }
          }
        }
        break;
      }

      case 'level_up':
        Object.keys(targetPlayer.tribeLevels).forEach(color => {
          targetPlayer.tribeLevels[color] += value;
        });
        logs.push(`\ud83c\udf1f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u5168\u795e\u65cf\u30ec\u30d9\u30eb+${value}`);
        break;

      case 'freeze_all_enemy':
      case 'freeze_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.hasActed = true;
          unit.canAttack = false;
          events.push({ type: 'ability_freeze', target: unit.instanceId });
        });
        logs.push(`\u2744\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e\u5168\u30e6\u30cb\u30c3\u30c8\u3092\u51cd\u7d50\uff01`);
        break;

      case 'damage_shield': {
        const available = targetPlayer.shields.filter(s => !s.destroyed);
        if (available.length > 0) {
          const targetShield = available[0];
          targetShield.currentDurability -= value;
          logs.push(`\ud83d\udca5 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e\u30b7\u30fc\u30eb\u30c9\u306b ${value} \u30c0\u30e1\u30fc\u30b8\uff01`);
          if (targetShield.currentDurability <= 0) {
            targetShield.currentDurability = 0;
            targetShield.destroyed = true;
            events.push({ type: 'shield_skill_destroy_secondary', player: targetPlayer.id, index: targetPlayer.shields.indexOf(targetShield) });
          }
        }
        break;
      }

      case 'grant_endure_random': {
        const units = [];
        forEachUnit(targetPlayer.board, u => units.push(u));
        if (units.length > 0) {
          const target = units[Math.floor(Math.random() * units.length)];
          target.endureActive = true;
          if (!target.keywords.includes('endure')) target.keywords.push('endure');
          logs.push(`\ud83d\udcaa \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${targetName}\u306e ${target.name} \u306b\u300c\u4e0d\u5c48\u300d\u3092\u4ed8\u4e0e`);
        }
        break;
      }

      case 'enemy_buff_hp':
        forEachUnit(opponentPlayer.board, unit => {
          unit.currentHp += value;
          unit.maxHp += value;
        });
        logs.push(`\ud83d\udc96 \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: \u6575\u5168\u30e6\u30cb\u30c3\u30c8\u306eHP+${value} (\u30c7\u30e1\u30ea\u30c3\u30c8)`);
        break;

      case 'self_freeze_random':
        const allies = [];
        forEachUnit(currentPlayer.board, u => allies.push(u));
        if (allies.length > 0) {
          const target = allies[Math.floor(Math.random() * allies.length)];
          target.hasActed = true;
          target.canAttack = false;
          logs.push(`\u2744\ufe0f \u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u300c${abilityName}\u300d: ${target.name} \u304c\u51cd\u7d50\uff01 (\u30c7\u30e1\u30ea\u30c3\u30c8)`);
          events.push({ type: 'ability_freeze', target: target.instanceId });
        }
        break;
      default:
        logs.push(`\u26a0\ufe0f \u672a\u5b9f\u88c5\u306e\u30b7\u30fc\u30eb\u30c9\u30b9\u30ad\u30eb\u52b9\u679c: ${effectType}`);
    }
    allEvents.push(...events);
  });

  return allEvents;
}



module.exports = {
  processAbility,
  processSearch,
  processSpellEffect,
  processShieldSkill,
};
