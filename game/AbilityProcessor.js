const { NUM_LANES, ROWS, forEachUnit, calculateLife } = require('./GameState');
const { hasKeyword, getKeywordParam } = require('./KeywordEffects');

// ヘルパー: 対象指定識別子に基づいてターゲットを取得
function getAbilityTargets(targetId, currentPlayer, opponentPlayer, value) {
  switch (targetId) {
    case 'self_unit_1': {
      const units = [];
      forEachUnit(currentPlayer.board, u => units.push(u));
      return units.length > 0 ? [units[Math.floor(Math.random() * units.length)]] : [];
    }
    case 'self_unit_all': {
      const units = [];
      forEachUnit(currentPlayer.board, u => units.push(u));
      return units;
    }
    case 'enemy_unit_1': {
      const units = [];
      forEachUnit(opponentPlayer.board, u => units.push(u));
      return units.length > 0 ? [units[Math.floor(Math.random() * units.length)]] : [];
    }
    case 'enemy_unit_all': {
      const units = [];
      forEachUnit(opponentPlayer.board, u => units.push(u));
      return units;
    }
    case 'all_units': {
      const units = [];
      forEachUnit(currentPlayer.board, u => units.push(u));
      forEachUnit(opponentPlayer.board, u => units.push(u));
      return units;
    }
    case 'self': return [currentPlayer];
    case 'enemy': return [opponentPlayer];
    case 'enemy_shield': return opponentPlayer.shields.filter(s => !s.destroyed).slice(0, 1);
    default: return [];
  }
}

function processAbility(trigger, unit, gameState, currentPlayer, opponentPlayer, cardMap, logs) {
  // 複数アビリティ対応: unit.abilities があればそれを、なければ単一アビリティとして処理
  const abilities = unit.abilities && unit.abilities.length > 0 ? unit.abilities : [
    { trigger: unit.abilityTrigger, effect: unit.abilityEffect, value: unit.abilityValue, target: 'enemy_unit_1' }
  ];

  const events = [];
  for (const ability of abilities) {
    if (ability.trigger !== trigger || !ability.effect) continue;

    const effect = ability.effect;
    const value = ability.value;
    const targetId = ability.target || 'enemy_unit_1';

    switch (effect) {
      case 'damage': {
        const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
        targets.forEach(target => {
          if (target.instanceId) { // ユニットの場合
            target.currentHp -= value;
            logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
            events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: value });
            if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
          }
        });
        break;
      }
      case 'damage_all': {
        // 全体ダメージはターゲット指定を無視して相手全ユニット（または指定された範囲）に
        const targets = targetId.includes('enemy') || targetId === 'all_units' ? getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer) : [];
        targets.forEach(target => {
          target.currentHp -= value;
          logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
        });
        break;
      }
      case 'heal': {
        const targets = getAbilityTargets(targetId === 'enemy_unit_1' ? 'self_unit_1' : targetId, currentPlayer, opponentPlayer, value);
        targets.forEach(target => {
          if (target.instanceId) {
            const healed = Math.min(value, target.maxHp - target.currentHp);
            target.currentHp += healed;
            logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
          }
        });
        break;
      }
      case 'heal_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          const healed = Math.min(value, target.maxHp - target.currentHp);
          if (healed > 0) {
            target.currentHp += healed;
            logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
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
        const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
        const target = targets.length > 0 ? targets[0] : unit; // 指定がなければ自分
        target.currentAttack += value;
        logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} 攻撃力+${value} (ATK: ${target.currentAttack})`);
        break;
      }
      case 'buff_hp': {
        const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
        const target = targets.length > 0 ? targets[0] : unit;
        target.currentHp += value;
        target.maxHp += value;
        logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} HP+${value} (HP: ${target.currentHp})`);
        break;
      }
      case 'buff_hp_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentHp += value;
          target.maxHp += value;
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} HP+${value} (HP: ${target.currentHp})`);
        });
        break;
      }
      case 'sp_gain': {
        currentPlayer.sp += value;
        logs.push(`💰 ${unit.name} のアビリティ発動！SP+${value} (SP: ${currentPlayer.sp})`);
        break;
      }
      default:
        logs.push(`⚠️ 未実装のアビリティ効果: ${effect}`);
    }
  }
  return events;
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

function processSpellEffect(card, gameState, currentPlayer, opponentPlayer, targetRow, targetLane, cardMap, logs) {
  const effect = card.abilityEffect;
  const value = card.abilityValue;
  const events = [];

  switch (effect) {
    case 'damage': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== undefined && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        target.currentHp -= value;
        logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
        if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId, row: targetRow, lane: targetLane });
      } else {
        const targets = [];
        for (const row of ROWS) {
          for (let i = 0; i < NUM_LANES; i++) {
            if (opponentPlayer.board[row][i]) targets.push({ row, lane: i });
          }
        }
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          const target = opponentPlayer.board[t.row][t.lane];
          target.currentHp -= value;
          logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
          if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId, row: t.row, lane: t.lane });
        }
      }
      break;
    }
    case 'damage_all': {
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          const target = opponentPlayer.board[row][i];
          if (target) {
            target.currentHp -= value;
            logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
            if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId, row, lane: i });
          }
        }
      }
      break;
    }
    case 'draw': {
      events.push({ type: 'spell_draw', player: currentPlayer.id, count: value });
      logs.push(`📖 スペル「${card.name}」: ${value} 枚ドロー`);
      break;
    }
    case 'heal': {
      const allies = [];
      forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
      if (allies.length > 0) {
        allies.sort((a, b) => a.currentHp - b.currentHp);
        const target = allies[0];
        const healed = Math.min(value, target.maxHp - target.currentHp);
        target.currentHp += healed;
        logs.push(`💚 スペル「${card.name}」: ${target.name} を ${healed} 回復`);
      }
      break;
    }
    case 'freeze': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        target.hasActed = true;
        target.canAttack = false;
        logs.push(`❄️ スペル「${card.name}」: ${target.name} を凍結！（次ターン行動不可）`);
        events.push({ type: 'freeze', target: target.instanceId });
      }
      break;
    }
    case 'destroy': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        logs.push(`☠️ スペル「${card.name}」: ${target.name} を破壊！`);
        events.push({ type: 'spell_kill', target: target.instanceId, row: targetRow, lane: targetLane });
      }
      break;
    }
    case 'destroy_weakest': {
      let weakest = null;
      let weakestRow = null;
      let weakestLane = -1;
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          const u = opponentPlayer.board[row][i];
          if (u && (weakest === null || u.currentHp < weakest.currentHp)) {
            weakest = u; weakestRow = row; weakestLane = i;
          }
        }
      }
      if (weakest) {
        logs.push(`☠️ スペル「${card.name}」: ${weakest.name}(HP:${weakest.currentHp}) を浄化！`);
        events.push({ type: 'spell_kill', target: weakest.instanceId, row: weakestRow, lane: weakestLane });
      }
      break;
    }
    case 'buff_attack': {
      if (targetRow && currentPlayer.board[targetRow] && targetLane !== null && currentPlayer.board[targetRow][targetLane]) {
        const target = currentPlayer.board[targetRow][targetLane];
        target.currentAttack += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} の攻撃力+${value}`);
      }
      break;
    }
    case 'buff_hp': {
      if (targetRow && currentPlayer.board[targetRow] && targetLane !== null && currentPlayer.board[targetRow][targetLane]) {
        const target = currentPlayer.board[targetRow][targetLane];
        target.currentHp += value;
        target.maxHp += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} のHP+${value}`);
      }
      break;
    }
    case 'grant_barrier': {
      if (targetRow && currentPlayer.board[targetRow] && targetLane !== null && currentPlayer.board[targetRow][targetLane]) {
        const target = currentPlayer.board[targetRow][targetLane];
        target.barrierActive = true;
        if (!target.keywords.includes('barrier')) target.keywords.push('barrier');
        logs.push(`🛡️ スペル「${card.name}」: ${target.name} にバリアを付与`);
      }
      break;
    }
    case 'drain': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        target.currentHp -= value;
        logs.push(`🩸 スペル「${card.name}」: ${target.name} から ${value} 吸収`);
        if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId, row: targetRow, lane: targetLane });
        
        const allies = [];
        forEachUnit(currentPlayer.board, u => { if (u.currentHp < u.maxHp) allies.push(u); });
        if (allies.length > 0) {
          allies.sort((a, b) => a.currentHp - b.currentHp);
          const healed = Math.min(value, allies[0].maxHp - allies[0].currentHp);
          allies[0].currentHp += healed;
          logs.push(`💚 ${allies[0].name} を ${healed} 回復`);
        }
      }
      break;
    }
    default:
      logs.push(`⚠️ 未実装のスペル効果: ${effect}`);
  }
  return events;
}

function processShieldSkill(shield, gameState, shieldOwner, opponent, cardMap, logs) {
  if (!shield.skill) return [];
  const skill = shield.skill;
  const events = [];
  const value = skill.effectValue;

  switch (skill.effectType) {
    case 'none':
      logs.push(`🛡️ シールドスキル「${skill.name}」: 効果なし`);
      break;
    case 'damage_all_enemy':
      forEachUnit(opponent.board, (target, row, lane) => {
        target.currentHp -= value;
        logs.push(`🔥 シールドスキル「${skill.name}」: ${target.name} に ${value} ダメージ`);
        if (target.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: target.instanceId, row, lane });
      });
      break;
    case 'draw':
      events.push({ type: 'shield_skill_draw', player: shieldOwner.id, count: value });
      logs.push(`📖 シールドスキル「${skill.name}」: ${value} 枚ドロー`);
      break;
    case 'heal_all_ally':
      forEachUnit(shieldOwner.board, ally => {
        const healed = Math.min(value, ally.maxHp - ally.currentHp);
        if (healed > 0) {
          ally.currentHp += healed;
          logs.push(`💚 シールドスキル「${skill.name}」: ${ally.name} を ${healed} 回復`);
        }
      });
      break;
    case 'discard_random':
      for (let i = 0; i < value && opponent.hand.length > 0; i++) {
        const idx = Math.floor(Math.random() * opponent.hand.length);
        const discarded = opponent.hand.splice(idx, 1)[0];
        logs.push(`✋ シールドスキル「${skill.name}」: 相手の ${discarded.name} を捨てさせた`);
      }
      break;
    case 'sp_gain':
      shieldOwner.sp += value;
      logs.push(`💰 シールドスキル「${skill.name}」: SP+${value} (SP: ${shieldOwner.sp})`);
      break;
    case 'damage_self':
      forEachUnit(shieldOwner.board, (ally, row, lane) => {
        ally.currentHp -= value;
        logs.push(`💥 シールドスキル「${skill.name}」: ${ally.name} に ${value} ダメージ (デメリット)`);
        if (ally.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: ally.instanceId, row, lane });
      });
      break;
    case 'summon_token': {
      let spawned = false;
      for (const row of ROWS) {
        for (let i = 0; i < NUM_LANES; i++) {
          if (!shieldOwner.board[row][i]) {
            const token = {
              instanceId: `TOKEN_${Date.now()}_${row}_${i}`,
              cardId: 'TOKEN', name: 'トークン', color: 'neutral',
              cost: 0, baseAttack: value, baseHp: value,
              currentAttack: value, currentHp: value, maxHp: value,
              keywords: [], abilityTrigger: 'none', abilityEffect: '', abilityValue: 0,
              ownerId: shieldOwner.id, canAttack: false, hasActed: true,
              barrierActive: false, endureActive: false, stealthActive: false, summonedThisTurn: true,
            };
            shieldOwner.board[row][i] = token;
            logs.push(`🎭 シールドスキル「${skill.name}」: ${row === 'front' ? '前列' : '後列'}レーン${i + 1}にトークン(ATK${value}/HP${value})を召喚`);
            spawned = true;
            break;
          }
        }
        if (spawned) break;
      }
      break;
    }
    case 'level_up': {
      let maxColor = 'red';
      let maxLevel = 0;
      for (const [color, level] of Object.entries(shieldOwner.tribeLevels)) {
        if (level > maxLevel) { maxLevel = level; maxColor = color; }
      }
      if (shieldOwner.tribeLevels[maxColor] < 9) {
        shieldOwner.tribeLevels[maxColor]++;
        logs.push(`⬆️ シールドスキル「${skill.name}」: ${maxColor}の神族レベル+1 (Lv.${shieldOwner.tribeLevels[maxColor]})`);
      }
      break;
    }
    case 'damage_all': {
      [shieldOwner, opponent].forEach(player => {
        forEachUnit(player.board, (u, row, lane) => {
          u.currentHp -= value;
          logs.push(`💥 シールドスキル「${skill.name}」: ${u.name} に ${value} ダメージ`);
          if (u.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: u.instanceId, row, lane });
        });
      });
      break;
    }
    default:
      logs.push(`⚠️ 未実装のシールドスキル効果: ${skill.effectType}`);
  }
  return events;
}

module.exports = {
  processAbility,
  processSearch,
  processSpellEffect,
  processShieldSkill,
};
