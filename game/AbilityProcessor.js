const { NUM_LANES, ROWS, forEachUnit, calculateLife, createUnitInstance } = require('./GameState');
const { hasKeyword, getKeywordParam, getKeywordId } = require('./KeywordEffects');

// ヘルパー: ユニット群から特定の条件で「候補」をリストアップする
function selectByCriteria(units, criteria, mode) {
  if (units.length === 0) return [];
  
  // まず指定基準（HP, ATK, Cost）の最適値を見つける
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

  // 最適値と一致するユニットをすべて返す（タイを維持）
  return units.filter(u => {
    let val;
    if (criteria === 'hp') val = u.currentHp;
    else if (criteria === 'atk') val = u.currentAttack !== undefined ? u.currentAttack : u.attack;
    else if (criteria === 'cost') val = u.cost || 0;
    return val === bestVal;
  });
}

// ヘルパー: 対象指定識別子に基づいてターゲットを取得
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
    
    // HP基準
    case 'enemy_unit_weakest': candidates = selectByCriteria(enemyUnits, 'hp', 'min'); break;
    case 'enemy_unit_toughest': candidates = selectByCriteria(enemyUnits, 'hp', 'max'); break;
    case 'self_unit_weakest': candidates = selectByCriteria(selfUnits, 'hp', 'min'); break;
    case 'self_unit_toughest': candidates = selectByCriteria(selfUnits, 'hp', 'max'); break;

    // 攻撃力基準
    case 'enemy_unit_strongest': candidates = selectByCriteria(enemyUnits, 'atk', 'max'); break;
    case 'enemy_unit_frailest': candidates = selectByCriteria(enemyUnits, 'atk', 'min'); break;
    case 'self_unit_strongest': candidates = selectByCriteria(selfUnits, 'atk', 'max'); break;
    case 'self_unit_frailest': candidates = selectByCriteria(selfUnits, 'atk', 'min'); break;

    // コスト基準
    case 'enemy_unit_highest_cost': candidates = selectByCriteria(enemyUnits, 'cost', 'max'); break;
    case 'enemy_unit_lowest_cost': candidates = selectByCriteria(enemyUnits, 'cost', 'min'); break;
    case 'self_unit_highest_cost': candidates = selectByCriteria(selfUnits, 'cost', 'max'); break;
    case 'self_unit_lowest_cost': candidates = selectByCriteria(selfUnits, 'cost', 'min'); break;

    case 'self': return [currentPlayer];
    case 'enemy': return [opponentPlayer];
    case 'this_unit': return unit ? [unit] : []; // 自身を対象にする
    case 'enemy_shield': return opponentPlayer.shields.filter(s => !s.destroyed).slice(0, 1);
    default: return [];
  }

  // 相手ユニットを対象とする場合、魔盾 (spellshield) を持つユニットを候補からから除外
  // 全体効果（ターゲットIDに 'all' が含まれる場合）は、魔盾（Spellshield）や潜伏（Stealth）を無視する
  const isAreaEffect = targetId.includes('all');

  if (isEnemyTarget && !isAreaEffect) {
    candidates = candidates.filter(u => !hasKeyword(u, 'spellshield'));
  }

  // 1体指定系（_1, weakest等）で候補が複数の場合、ここでは全員返して呼び出し側(processAbility)で判断させる
  // ただし、単体のランダム1体 (enemy_unit_1等) の場合は、歴史的な互換性としてここで1つ選ぶ場合もあるが、
  // 最新の「タイなら選択」ルールを優先し、一旦候補リストの状態を維持して返す
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

    // 条件のチェック（既存の keywords 列から取得）
    let conditionMet = true;
    
    // on_play の場合、keywords に awaken があればそれをレベル条件として扱う
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
          logs.push(`⚠️ ${unit.name} は神族レベル条件（${awakenKw}）を満たしていないため、効果は発動しませんでした`);
        }
      }
    }
    
    // 代償 (Sacrifice) のチェック
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

    // 残響 (Echo) のチェック
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

    // その他のキーワード条件（link, crisis等）
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
        logs.push(`⚠️ ${unit.name} の「${cond}」条件を満たしていないため発動しません`);
      }
    }

    if (!conditionMet) continue;

    const effect = ability.effect;
    const value = ability.value;
    const abilityTargetId = ability.target || 'enemy_unit_1';

    // 配置 (on_play) 直後は targetRow/Lane は配置場所を指すため、フェーズが targeting かつ手動トリガーでない限り、これらをアビリティの対象とはみなさない
    const manualTarget = (targetRow !== undefined && targetRow !== null && targetLane !== undefined && targetLane !== null && gameState.phase === 'targeting') 
      ? (abilityTargetId.includes('self') ? currentPlayer.board[targetRow][targetLane] : opponentPlayer.board[targetRow][targetLane])
      : null;

    switch (effect) {
      case 'damage': {
        const { applyDamage } = require('./CombatResolver');
        if (manualTarget) {
          const actualDamage = applyDamage(manualTarget, value, logs);
          logs.push(`🔥 ${unit.name} のアビリティ発動！${manualTarget.name} に ${actualDamage} ダメージ (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'ability_damage', source: unit.instanceId, target: manualTarget.instanceId, damage: actualDamage });
          if (manualTarget.currentHp <= 0) events.push({ type: 'ability_kill', target: manualTarget.instanceId });
        } else {
          const { applyDamage } = require('./CombatResolver');
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 1) {
            const target = targets[0];
            const actualDamage = applyDamage(target, value, logs);
            logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${actualDamage} ダメージ (HP: ${target.currentHp})`);
            events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: actualDamage });
            if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          } else if (abilityTargetId !== 'all_units' && !abilityTargetId.includes('all')) {
            logs.push(`⚠️ ${unit.name} のアビリティ：有効な対象（魔盾なし）がいないため不発に終わりました`);
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
          logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${actualDamage} ダメージ (HP: ${target.currentHp})`);
          events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: actualDamage });
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
        });
        break;
      }
      case 'heal': {
        if (manualTarget) {
          const healed = Math.min(value, manualTarget.maxHp - manualTarget.currentHp);
          manualTarget.currentHp += healed;
          logs.push(`💚 ${unit.name} のアビリティ発動！${manualTarget.name} を ${healed} 回復 (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'ability_heal', source: unit.instanceId, target: manualTarget.instanceId, value: healed });
        } else {
          const targetSpec = (abilityTargetId === 'enemy_unit_1' || abilityTargetId === 'enemy_unit') ? 'self_unit_1' : abilityTargetId;
          const targets = getAbilityTargets(targetSpec, currentPlayer, opponentPlayer, value);
          
          if (targets.length === 1) {
            const target = targets[0];
            const healed = Math.min(value, target.maxHp - target.currentHp);
            target.currentHp += healed;
            logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
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
            logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
            events.push({ type: 'ability_heal', source: unit.instanceId, target: target.instanceId, value: healed });
          }
        });
        break;
      }
      case 'draw': {
        logs.push(`📖 ${unit.name} のアビリティ発動！${value} 枚ドロー`);
        events.push({ type: 'ability_draw', player: currentPlayer.id, count: value });
        break;
      }
      case 'buff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack += value;
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: value });
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${manualTarget.name} 攻撃力+${value} (ATK: ${manualTarget.currentAttack})`);
        } else {
          const targets = abilityTargetId === 'this_unit' ? [unit] : getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            target.currentAttack += value;
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: value });
            logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} 攻撃力+${value} (ATK: ${target.currentAttack})`);
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
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} 攻撃力+${value} (ATK: ${target.currentAttack})`);
        });
        break;
      }
      case 'buff_hp': {
        if (manualTarget) {
          manualTarget.currentHp += value;
          manualTarget.maxHp += value;
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'hp', value: value });
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${manualTarget.name} HP+${value} (HP: ${manualTarget.currentHp})`);
        } else {
          const targets = abilityTargetId === 'this_unit' ? [unit] : getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            target.currentHp += value;
            target.maxHp += value;
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'hp', value: value });
            logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} HP+${value} (HP: ${target.currentHp})`);
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
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${manualTarget.name} ATK/HP+${value} (ATK: ${manualTarget.currentAttack}, HP: ${manualTarget.currentHp})`);
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
            logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} ATK/HP+${value} (ATK: ${target.currentAttack}, HP: ${target.currentHp})`);
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
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} HP+${value} (HP: ${target.currentHp})`);
        });
        break;
      }
      case 'debuff_attack_all': {
        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentAttack = Math.max(0, target.currentAttack - value);
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} の攻撃力を ${value} 減少 (ATK: ${target.currentAttack})`);
        });
        break;
      }
      case 'debuff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack = Math.max(0, manualTarget.currentAttack - value);
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${manualTarget.name} の攻撃力を ${value} 減少 (ATK: ${manualTarget.currentAttack})`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 1) {
            const target = targets[0];
            target.currentAttack = Math.max(0, target.currentAttack - value);
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
            logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} の攻撃力を ${value} 減少 (ATK: ${target.currentAttack})`);
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
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} のHPを ${value} 減少 (HP: ${target.currentHp})`);
          
          if (target.currentHp <= 0) {
            const isReallyDead = processUnitDeath(target, logs);
            if (isReallyDead) {
              events.push({ type: 'ability_kill', target: target.instanceId });
              logs.push(`💀 ${target.name} は生命力を失い撃破された！`);
            }
          }
        };

        if (manualTarget) {
          processDebuffHp(manualTarget);
        } else if (trigger === 'on_play' && !abilityTargetId.includes('all')) {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
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
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} の攻撃力/HPを ${value} 減少 (ATK: ${target.currentAttack}, HP: ${target.currentHp})`);
          
          if (target.currentHp <= 0) {
            const isReallyDead = processUnitDeath(target, logs);
            if (isReallyDead) {
              events.push({ type: 'ability_kill', target: target.instanceId });
              logs.push(`💀 ${target.name} は生命力を失い撃破された！`);
            }
          }
        };

        if (manualTarget) {
          processDebuffStats(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
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
            logs.push(`☠️ ${unit.name} のアビリティ発動！${manualTarget.name} を破壊！`);
            events.push({ type: 'ability_kill', target: manualTarget.instanceId });
          }
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 1) {
            const target = targets[0];
            const isDead = processUnitDeath(target, logs);
            if (isDead) {
              target.currentHp = 0;
              logs.push(`☠️ ${unit.name} のアビリティ発動！${target.name} を破壊！`);
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
               logs.push(`⚠️ 選択されたターゲットは条件を満たしていません。効果は不発となりました。`);
               break;
             }
          } else if (trigger === 'on_play' || trigger === 'activate') {
             needsTarget = true;
             targetId = 'enemy_unit_1'; // クライアント側に敵を選択可能と伝える
             break;
          } else {
             // ターン終了時等のタイブレークは左上から優先（安定ソートの第1候補）
             targetToDestroy = candidates[0];
          }
        }

        if (targetToDestroy) {
          const { processUnitDeath } = require('./CombatResolver');
          const isDead = processUnitDeath(targetToDestroy, logs);
          if (isDead) {
            targetToDestroy.currentHp = 0;
            const detailStr = isLowestHp ? '最もHPが低い' : isHighestHp ? '最もHPが高い' : isHighestAtk ? '最も攻撃力が高い' : '最も攻撃力が低い';
            logs.push(`☠️ ${unit.name} の効果！${detailStr} ${targetToDestroy.name} を破壊！`);
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
          logs.push(`❄️ ${unit.name} のアビリティ発動！${manualTarget.name} を凍結！ (次ターン行動不可)`);
          events.push({ type: 'ability_freeze', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              target.hasActed = true;
              target.canAttack = false;
              target.frozen = true;
              logs.push(`❄️ ${unit.name} のアビリティ発動！${target.name} を凍結！`);
              events.push({ type: 'ability_freeze', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            target.hasActed = true;
            target.canAttack = false;
            target.frozen = true;
            logs.push(`❄️ ${unit.name} のアビリティ発動！${target.name} を凍結！ (次ターン行動不可)`);
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
          logs.push(`🔄 ${unit.name} のアビリティ発動！${manualTarget.name} を手札に戻す`);
          events.push({ type: 'ability_bounce', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (abilityTargetId.includes('all')) {
            // 全体バウンスの処理
            targets.forEach(target => {
              logs.push(`🔄 ${unit.name} の効果！${target.name} を手札に戻す`);
              events.push({ type: 'ability_bounce', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            logs.push(`🔄 ${unit.name} のアビリティ発動！${target.name} を手札に戻す`);
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
          logs.push(`🛡️ ${unit.name} のアビリティ発動！${manualTarget.name} に加護を付与`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 1) {
            const target = targets[0];
            target.barrierActive = true;
            if (!target.keywords.includes('barrier')) target.keywords.push('barrier');
            logs.push(`🛡️ ${unit.name} のアビリティ発動！${target.name} に加護を付与`);
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
          logs.push(`💪 ${unit.name} のアビリティ発動！${manualTarget.name} に不屈を付与`);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 1) {
            const target = targets[0];
            target.endureActive = true;
            if (!target.keywords.includes('endure')) target.keywords.push('endure');
            logs.push(`💪 ${unit.name} のアビリティ発動！${target.name} に不屈を付与`);
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
          logs.push(`🩸 ${unit.name} のアビリティ発動！${target.name} から ${value} 吸収`);
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
          
          const allies = [];
          forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
          if (allies.length > 0) {
            allies.sort((a, b) => a.currentHp - b.currentHp);
            const healed = Math.min(value, allies[0].maxHp - allies[0].currentHp);
            allies[0].currentHp += healed;
            logs.push(`💚 ${allies[0].name} を ${healed} 回復`);
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
          logs.push(`💥 ${unit.name} のアビリティ発動！敵のシールドに直接 ${value} ダメージ`);
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
          logs.push(`🛡️ ${unit.name} のアビリティ発動！シールドを ${value} 回復！`);
          events.push({ type: 'ability_shield_heal', player: currentPlayer.id, index: shields.indexOf(targetShield), value: value });
        }
        break;
      }
      case 'sp_gain': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        const targetName = targetPlayer === currentPlayer ? '自分' : '相手';
        targetPlayer.sp += value;
        logs.push(`💰 ${unit.name} のアビリティ発動！${targetName}の SP+${value} (現在: ${targetPlayer.sp})`);
        break;
      }
      case 'sp_loss': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        const targetName = targetPlayer === currentPlayer ? '自分' : '相手';
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`⚠️ ${unit.name} のアビリティ発動！${targetName}の SP-${value} (現在: ${targetPlayer.sp})`);
        break;
      }
      case 'discard_random': {
        for (let i = 0; i < value && opponentPlayer.hand.length > 0; i++) {
          const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
          const discarded = opponentPlayer.hand.splice(idx, 1)[0];
          logs.push(`✋ ${unit.name} のアビリティ発動！相手の手札を破棄 (${discarded.name})`);
          events.push({ type: 'ability_discard', player: opponentPlayer.id });
        }
        break;
      }
      case 'reduce_cost_hand': {
        if (currentPlayer.hand.length > 0) {
          const idx = Math.floor(Math.random() * currentPlayer.hand.length);
          const targetCard = currentPlayer.hand[idx];
          targetCard.cost = Math.max(0, targetCard.cost - value);
          logs.push(`✨ ${unit.name} の効果！手札の「${targetCard.name}」のコストが ${value} 下がった (現在: ${targetCard.cost})`);
        }
        break;
      }
      case 'steal_unit': {
        if (manualTarget && manualTarget.instanceId) {
          // 相手の盤面から削除
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
            // 自分の空きスロットを探す
            let moved = false;
            for (const r of ROWS) {
              for (let i = 0; i < NUM_LANES; i++) {
                if (!currentPlayer.board[r][i]) {
                  stoleFrom.ownerId = currentPlayer.id; // 所有権変更
                  currentPlayer.board[r][i] = stoleFrom;
                  moved = true;
                  logs.push(`🧲 ${unit.name} のアビリティ発動！相手の ${stoleFrom.name} を強奪して自分の盤面に引きずり込んだ！`);
                  break;
                }
              }
              if (moved) break;
            }
            if (!moved) {
              // 空きマスがない場合は不発（相手の盤面に一瞬で戻すか、墓地に送るか。安全のためここでは元に戻す）
              logs.push(`⚠️ 空きマスがないため強奪失敗`);
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
          target.frozen = false; // 凍結解除
          logs.push(`😶 ${unit.name} のアビリティ発動！${target.name} は「沈黙」し、すべての能力を失った！`);
        };
        if (manualTarget) {
          processSilence(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
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

        // 召喚場所が未確定の場合、プレイヤーに入力を促す（全トリガー共通）
        if (!targetRow || targetLane === undefined || targetLane === null) {
          // 少なくとも1つは空きスロットがあるか確認
          let hasEmptySlot = false;
          ['front', 'back'].forEach(r => {
            for (let i = 0; i < NUM_LANES; i++) {
              if (!currentPlayer.board[r][i]) hasEmptySlot = true;
            }
          });

          if (hasEmptySlot) {
            console.log(`🎯 [AbilityProcessor] summon_token: Requesting target for ${unit.name} (${trigger})`);
            needsTarget = true;
            targetId = 'empty_slot';
            // ターゲット要求時は即座に結果を返し、入力を待つ
            return { events, needsTarget, targetId, effect: 'summon_token', originalAbility: ability };
          } else {
            logs.push(`⚠️ ${unit.name} の効果！しかし場に空きがなく召喚に失敗しました`);
            break;
          }
        }

        // 召喚場所が確定している場合（解決フェーズ）
        if (!currentPlayer.board[targetRow][targetLane]) {
          const tokenInstance = createUnitInstance(tokenCard, currentPlayer.id);
          tokenInstance.hasActed = true; // 出したターンは基本的に攻撃不可
          currentPlayer.board[targetRow][targetLane] = tokenInstance;
          events.push({
            type: 'ability_summon',
            player: currentPlayer.id,
            unit: tokenInstance,
            row: targetRow,
            lane: targetLane
          });
          logs.push(`✨ ${unit.name} の効果: ${tokenCard.name} を召喚しました`);
        }
        break;
      }
      default: {
        logs.push(`⚠️ 未実装のアビリティ効果: ${effect}`);
        break;
      }
    }
    if (needsTarget) {
      // targetIdが未設定の場合、ability.target から自動設定
      if (!targetId) {
        targetId = abilityTargetId;
      }
      console.log(`🎯 [AbilityProcessor] Target requested for ${effect}, targetId: ${targetId}`);
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
    logs.push(`🔍 ${unit.name} の探索${searchCount}: 山札にカードがありません`);
    return;
  }

  logs.push(`🔍 ${unit.name} の探索${searchCount}: ${revealed.map(r => r.card.name).join(', ')} を確認`);

  revealed.sort((a, b) => b.card.cost - a.card.cost);
  const chosen = revealed[0];
  playerState.deck.splice(chosen.index, 1);
  playerState.hand.push({ ...chosen.card });
  logs.push(`🔍 ${unit.name} の探索: ${chosen.card.name} を手札に加えた`);

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

    // 手動ターゲット（プレイヤーがクリックした対象）の判定
    const manualTarget = (targetRow !== undefined && targetRow !== null && targetLane !== undefined && targetLane !== null && gameState.phase === 'targeting') 
      ? (abilityTargetId.includes('self') ? currentPlayer.board[targetRow][targetLane] : opponentPlayer.board[targetRow][targetLane])
      : null;

    switch (effect) {
      case 'damage': {
        const { applyDamage } = require('./CombatResolver');
        if (manualTarget) {
          const actualDamage = applyDamage(manualTarget, value, logs);
          logs.push(`🔥 スペル「${card.name}」: ${manualTarget.name} に ${actualDamage} ダメージ (HP: ${manualTarget.currentHp})`);
          events.push({ type: 'spell_damage', source: card.id, target: manualTarget.instanceId, damage: actualDamage });
          if (manualTarget.currentHp <= 0) events.push({ type: 'spell_kill', target: manualTarget.instanceId, row: targetRow, lane: targetLane });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 0) {
            logs.push(`💨 スペル「${card.name}」: 有効な対象がいないため不発`);
          } else if (targets.length > 1) {
            needsTarget = true;
            targetId = abilityTargetId;
          } else {
            const target = targets[0];
            const actualDamage = applyDamage(target, value, logs);
            logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${actualDamage} ダメージ (HP: ${target.currentHp})`);
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
          logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${actualDamage} ダメージ`);
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
          logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${actualDamage} ダメージ`);
          events.push({ type: 'spell_damage', source: card.id, target: target.instanceId, damage: actualDamage });
          if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId });
        });
        break;
      }
      case 'draw': {
        events.push({ type: 'spell_draw', player: currentPlayer.id, count: value });
        logs.push(`📖 スペル「${card.name}」: ${value} 枚ドロー`);
        break;
      }
      case 'reduce_cost_hand': {
        if (currentPlayer.hand.length > 0) {
          const idx = Math.floor(Math.random() * currentPlayer.hand.length);
          const targetCard = currentPlayer.hand[idx];
          targetCard.cost = Math.max(0, targetCard.cost - value);
          logs.push(`✨ スペル「${card.name}」発動！手札の「${targetCard.name}」のコストが ${value} 下がった (現在: ${targetCard.cost})`);
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
                // 元の場所を消去（opponentPlayerのボードから探す）
                forEachUnit(opponentPlayer.board, (u, row, lane) => {
                  if (u && u.instanceId === manualTarget.instanceId) opponentPlayer.board[row][lane] = null;
                });
                moved = true;
                logs.push(`🧲 スペル「${card.name}」発動！相手の ${manualTarget.name} を強奪した！`);
                break;
              }
            }
            if (moved) break;
          }
          if (!moved) {
            logs.push(`⚠️ 空きマスがないため強奪失敗`);
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
          target.barrierActive = false;
          target.stealthActive = false;
          target.endureActive = false;
          logs.push(`😶 スペル「${card.name}」発動！${target.name} は「沈黙」し、能力を失った！`);
        };
        if (manualTarget) {
          processSilence(manualTarget);
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (targets.length === 0) {
            logs.push(`💨 スペル「${card.name}」: 対象無し`);
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
          logs.push(`💚 スペル「${card.name}」: ${manualTarget.name} を ${healed} 回復`);
        } else {
          const targets = getAbilityTargets(abilityTargetId === 'enemy_unit_1' ? 'self_unit_1' : abilityTargetId, currentPlayer, opponentPlayer, value);
          if (targets.length === 1) {
            const target = targets[0];
            const healed = Math.min(value, target.maxHp - target.currentHp);
            target.currentHp += healed;
            logs.push(`💚 スペル「${card.name}」: ${target.name} を ${healed} 回復`);
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
          logs.push(`❄️ スペル「${card.name}」: ${manualTarget.name} を凍結！`);
          events.push({ type: 'spell_freeze', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              target.hasActed = true;
              target.canAttack = false;
              logs.push(`❄️ スペル効果！${target.name} を凍結！`);
              events.push({ type: 'spell_freeze', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            targets[0].hasActed = true;
            targets[0].canAttack = false;
            logs.push(`❄️ スペル「${card.name}」: ${targets[0].name} を凍結！`);
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
            logs.push(`☠️ スペル「${card.name}」: ${manualTarget.name} を破壊！`);
            events.push({ type: 'spell_kill', target: manualTarget.instanceId });
          }
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (abilityTargetId.includes('all')) {
            targets.forEach(target => {
              const isDead = processUnitDeath(target, logs);
              if (isDead) {
                target.currentHp = 0;
                logs.push(`☠️ スペル効果！${target.name} を破壊！`);
                events.push({ type: 'spell_kill', target: target.instanceId });
              }
            });
          } else if (targets.length === 1) {
            const target = targets[0];
            const isDead = processUnitDeath(target, logs);
            if (isDead) {
              target.currentHp = 0;
              logs.push(`☠️ スペル「${card.name}」: ${target.name} を破壊！`);
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
        // 統合ターゲットシステムへの互換性のための処理
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
          logs.push(`☠️ スペル「${card.name}」: ${candidates[0].name} を破壊！`);
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
          logs.push(`⬆️ スペル「${card.name}」: ${manualTarget.name} 攻撃力+${value}`);
        } else if (abilityTargetId.includes('all')) {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer);
          targets.forEach(t => t.currentAttack += value);
          logs.push(`⬆️ スペル「${card.name}」: 全ユニット 攻撃力+${value}`);
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
          logs.push(`⬆️ スペル「${card.name}」: ${manualTarget.name} HP+${value}`);
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
          logs.push(`⬆️ スペル「${card.name}」: ${manualTarget.name} ATK/HP+${value}`);
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
          logs.push(`🛡️ スペル「${card.name}」: ${manualTarget.name} に加護を付与`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      case 'drain': {
        if (manualTarget) {
          manualTarget.currentHp -= value;
          logs.push(`🩸 スペル「${card.name}」: ${manualTarget.name} から ${value} 吸収`);
          const allies = [];
          forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
          if (allies.length > 0) {
            allies.sort((a, b) => a.currentHp - b.currentHp);
            const healed = Math.min(value, allies[0].maxHp - allies[0].currentHp);
            allies[0].currentHp += healed;
            logs.push(`💚 ${allies[0].name} を ${healed} 回復`);
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
            logs.push(`⚔️ スペル効果！「${tokenInstance.name}」を召喚しました`);
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
        logs.push(`💰 スペル「${card.name}」: ${targetPlayer.name}の SP+${value}`);
        break;
      }
      case 'sp_loss': {
        const targetPlayer = (abilityTargetId === 'enemy' || abilityTargetId === 'opponent') ? opponentPlayer : currentPlayer;
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`⚠️ スペル「${card.name}」: ${targetPlayer.name}の SP-${value}`);
        break;
      }
      case 'discard_random': {
        for (let j = 0; j < value && opponentPlayer.hand.length > 0; j++) {
          const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
          const discarded = opponentPlayer.hand.splice(idx, 1)[0];
          logs.push(`✋ スペル「${card.name}」: 相手の手札を破棄 (${discarded.name})`);
          events.push({ type: 'spell_discard', player: opponentPlayer.id });
        }
        break;
      }
      case 'bounce': {
        if (manualTarget) {
          logs.push(`🔄 スペル「${card.name}」: ${manualTarget.name} を手札に戻す`);
          events.push({ type: 'spell_bounce', target: manualTarget.instanceId });
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
          if (abilityTargetId.includes('all')) {
            // 全体バウンス
            targets.forEach(target => {
              logs.push(`🔄 スペル効果！${target.name} を手札に戻す`);
              events.push({ type: 'spell_bounce', target: target.instanceId });
            });
          } else if (targets.length === 1) {
            logs.push(`🔄 スペル「${card.name}」: ${targets[0].name} を手札に戻す`);
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
          logs.push(`💥 スペル「${card.name}」: 敵のシールドに直接 ${value} ダメージ`);
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
          logs.push(`🛡️ スペル「${card.name}」: シールドを ${value} 回復！`);
          events.push({ type: 'spell_shield_heal', player: currentPlayer.id, index: shields.indexOf(targetShield), value: value });
        }
        break;
      }
      case 'debuff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack = Math.max(0, manualTarget.currentAttack - value);
          logs.push(`⬇️ スペル「${card.name}」: ${manualTarget.name} の攻撃力 -${value}`);
        } else {
          needsTarget = true;
          targetId = abilityTargetId;
        }
        break;
      }
      default:
        logs.push(`⚠️ 未実装のスペル効果: ${effect}`);
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

    // ターゲット判定の共通化 (self / enemy / opponent)
    const targetPlayer = (targetId === 'enemy' || targetId === 'opponent' || targetId === 'enemy_hand') ? opponentPlayer : currentPlayer;
    const isSelf = targetPlayer === currentPlayer;
    const targetName = isSelf ? '自分' : '相手';
    const abilityName = shield.name + (abilities.length > 1 ? ` (効果${index + 1})` : 'のスキル');
    const abilityTargetId = targetId;

    switch (effectType) {
      case 'none':
        if (abilities.length === 1) logs.push(`🛡️ シールドスキル「${abilityName}」: 効果なし`);
        break;
      
      // ドロー処理の統合
      case 'draw':
      case 'enemy_draw':
        events.push({ type: 'shield_skill_draw', player: targetPlayer.id, count: value });
        logs.push(`📖 シールドスキル「${abilityName}」: ${targetName}が ${value} 枚ドロー`);
        break;

      // 手札破棄処理の統合
      case 'discard':
      case 'discard_random':
      case 'discard_self':
        for (let i = 0; i < value && targetPlayer.hand.length > 0; i++) {
          const idx = Math.floor(Math.random() * targetPlayer.hand.length);
          const discarded = targetPlayer.hand.splice(idx, 1)[0];
          logs.push(`✋ シールドスキル「${abilityName}」: ${targetName}の ${discarded.name} を捨てさせた`);
          events.push({ type: 'ability_discard', player: targetPlayer.id });
        }
        break;

      // SP操作の共通化
      case 'sp_gain':
        targetPlayer.sp += value;
        logs.push(`💰 シールドスキル「${abilityName}」: ${targetName}の SP+${value} (合計: ${targetPlayer.sp})`);
        break;
      case 'sp_loss':
        targetPlayer.sp = Math.max(0, targetPlayer.sp - value);
        logs.push(`⚠️ シールドスキル「${abilityName}」: ${targetName}の SP-${value} (合計: ${targetPlayer.sp})`);
        break;

      // 回復・バフ処理の汎用化
      case 'heal_all_ally':
      case 'heal_all':
        forEachUnit(targetPlayer.board, unit => {
          const healed = Math.min(value, unit.maxHp - unit.currentHp);
          if (healed > 0) {
            unit.currentHp += healed;
            logs.push(`💚 シールドスキル「${abilityName}」: ${unit.name} を ${healed} 回復`);
          }
        });
        break;

      case 'buff_hp_all_ally':
      case 'buff_hp_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.currentHp += value;
          unit.maxHp += value;
        });
        logs.push(`⬆️ シールドスキル「${abilityName}」: ${targetName}全ユニットのHP+${value}`);
        break;

      case 'buff_attack_all_ally':
      case 'buff_attack_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.currentAttack += value;
        });
        logs.push(`⬆️ シールドスキル「${abilityName}」: ${targetName}全ユニットの攻撃力+${value}`);
        break;

      // ダメージ・破壊処理の汎用化
      case 'damage':
      case 'damage_all_enemy':
      case 'damage_all_ally':
        forEachUnit(targetPlayer.board, (target, row, lane) => {
          target.currentHp -= value;
          logs.push(`🔥 シールドスキル「${abilityName}」: ${target.name} に ${value} ダメージ`);
          if (target.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: target.instanceId, row, lane });
        });
        break;

      case 'damage_all':
        // 両方のボードにダメージ
        [currentPlayer, opponentPlayer].forEach(p => {
          forEachUnit(p.board, (u, r, l) => {
            u.currentHp -= value;
            if (u.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: u.instanceId, row: r, lane: l });
          });
        });
        logs.push(`💥 シールドスキル「${abilityName}」: 全ユニットに ${value} ダメージ`);
        break;

      case 'damage_self': // 以前の互換性用
        forEachUnit(currentPlayer.board, (ally, row, lane) => {
          ally.currentHp -= value;
          logs.push(`💥 シールドスキル「${abilityName}」: ${ally.name} に ${value} ダメージ (デメリット)`);
          if (ally.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: ally.instanceId, row, lane });
        });
        break;

      case 'destroy':
      case 'destroy_weakest':
      case 'destroy_weakest_enemy':
      case 'destroy_strongest':
      case 'destroy_strongest_enemy': {
        const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
        targets.forEach(target => {
          if (target.instanceId) {
            target.currentHp = 0;
            logs.push(`☠️ シールドスキル「${abilityName}」: ${target.name} を破壊！`);
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
        const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value, null); // シールドスキルの場合はユニットなし
        targets.forEach(target => {
          if (target.instanceId) {
            logs.push(`🔄 シールドスキル「${abilityName}」: ${target.name} を手札に戻した`);
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
        logs.push(`🛡️ シールドスキル「${abilityName}」: ${targetName}全ユニットに加護を付与`);
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
                logs.push(`⚔️ シールドスキル「${abilityName}」: ${targetName}に「${tokenInstance.name}」を召喚`);
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
        logs.push(`🌟 シールドスキル「${abilityName}」: ${targetName}全神族レベル+${value}`);
        break;

      case 'freeze_all_enemy':
      case 'freeze_all':
        forEachUnit(targetPlayer.board, unit => {
          unit.hasActed = true;
          unit.canAttack = false;
          events.push({ type: 'ability_freeze', target: unit.instanceId });
        });
        logs.push(`❄️ シールドスキル「${abilityName}」: ${targetName}の全ユニットを凍結！`);
        break;

      case 'damage_shield': {
        const available = targetPlayer.shields.filter(s => !s.destroyed);
        if (available.length > 0) {
          const targetShield = available[0];
          targetShield.currentDurability -= value;
          logs.push(`💥 シールドスキル「${abilityName}」: ${targetName}のシールドに ${value} ダメージ！`);
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
          logs.push(`💪 シールドスキル「${abilityName}」: ${targetName}の ${target.name} に「不屈」を付与`);
        }
        break;
      }

      case 'enemy_buff_hp':
        forEachUnit(opponentPlayer.board, unit => {
          unit.currentHp += value;
          unit.maxHp += value;
        });
        logs.push(`💖 シールドスキル「${abilityName}」: 敵全ユニットのHP+${value} (デメリット)`);
        break;

      case 'self_freeze_random':
        const allies = [];
        forEachUnit(currentPlayer.board, u => allies.push(u));
        if (allies.length > 0) {
          const target = allies[Math.floor(Math.random() * allies.length)];
          target.hasActed = true;
          target.canAttack = false;
          logs.push(`❄️ シールドスキル「${abilityName}」: ${target.name} が凍結！ (デメリット)`);
          events.push({ type: 'ability_freeze', target: target.instanceId });
        }
        break;
      default:
        logs.push(`⚠️ 未実装のシールドスキル効果: ${effectType}`);
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
