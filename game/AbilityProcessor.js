const { NUM_LANES, ROWS, forEachUnit, calculateLife, createUnitInstance } = require('./GameState');
const { hasKeyword, getKeywordParam, getKeywordId } = require('./KeywordEffects');

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

function processAbility(trigger, unit, gameState, currentPlayer, opponentPlayer, cardMap, logs, targetRow, targetLane) {
  const abilities = unit.abilities && unit.abilities.length > 0 ? unit.abilities : [
    { trigger: unit.abilityTrigger, effect: unit.abilityEffect, value: unit.abilityValue, target: 'enemy_unit_1' }
  ];

  const events = [];
  let needsTarget = false;
  let targetId = null;
  
  if (trigger === 'on_play' && hasKeyword(unit, 'awaken')) {
    const rawAwaken = unit.keywords.find(k => k.startsWith('awaken'));
    if (rawAwaken) {
      const parsed = getKeywordId(rawAwaken);
      const reqLevel = parsed.param || 7;
      let reqColor = parsed.color;
      if (reqColor === 'self' || !reqColor) reqColor = unit.colors ? unit.colors[0] : unit.color;
      
      const currentLvl = currentPlayer.tribeLevels[reqColor] || 0;
      if (currentLvl < reqLevel) {
        logs.push(`💤 ${unit.name} は神族レベル不足（${reqColor} Lv.${currentLvl}/${reqLevel}）により覚醒せず、効果は発動しませんでした`);
        return { events, needsTarget: false };
      }
      logs.push(`🌟 ${unit.name} が覚醒！`);
    }
  }

  for (const ability of abilities) {
    if (ability.trigger !== trigger || !ability.effect) continue;

    const effect = ability.effect;
    const value = ability.value;
    const abilityTargetId = ability.target || 'enemy_unit_1';

    // 配置 (on_play) 直後は targetRow/Lane は配置場所を指すため、フェーズが targeting かつ手動トリガーでない限り、これらをアビリティの対象とはみなさない
    const manualTarget = (targetRow !== undefined && targetRow !== null && targetLane !== undefined && targetLane !== null && gameState.phase === 'targeting') 
      ? (abilityTargetId.includes('self') ? currentPlayer.board[targetRow][targetLane] : opponentPlayer.board[targetRow][targetLane])
      : null;

    switch (effect) {
      case 'damage': {
        if (manualTarget) {
          const targets = [manualTarget];
          targets.forEach(target => {
            if (target.instanceId) {
              target.currentHp -= value;
              logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
              events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: value });
              if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
            }
          });
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(abilityTargetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            if (target.instanceId) {
              target.currentHp -= value;
              logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
              events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: value });
              if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
            }
          });
        }
        break;
      }
      case 'damage_all':
      case 'damage_all_enemy': {
        const tType = effect === 'damage_all' ? 'all_units' : 'enemy_unit_all';
        const targets = getAbilityTargets(tType, currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentHp -= value;
          logs.push(`🔥 ${unit.name} のアビリティ発動！${target.name} に ${value} ダメージ (HP: ${target.currentHp})`);
          events.push({ type: 'ability_damage', source: unit.instanceId, target: target.instanceId, damage: value });
          if (target.currentHp <= 0) events.push({ type: 'ability_kill', target: target.instanceId });
        });
        break;
      }
      case 'heal': {
        if (manualTarget) {
          const targets = [manualTarget];
          targets.forEach(target => {
            if (target.instanceId) {
              const healed = Math.min(value, target.maxHp - target.currentHp);
              target.currentHp += healed;
              logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
              events.push({ type: 'ability_heal', source: unit.instanceId, target: target.instanceId, value: healed });
            }
          });
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(abilityTargetId === 'enemy_unit_1' ? 'self_unit_1' : abilityTargetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            if (target.instanceId) {
              const healed = Math.min(value, target.maxHp - target.currentHp);
              target.currentHp += healed;
              logs.push(`💚 ${unit.name} のアビリティ発動！${target.name} を ${healed} 回復 (HP: ${target.currentHp})`);
              events.push({ type: 'ability_heal', source: unit.instanceId, target: target.instanceId, value: healed });
            }
          });
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
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${manualTarget.name} 攻撃力+${value} (ATK: ${manualTarget.currentAttack})`);
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          const target = targets.length > 0 ? targets[0] : unit;
          target.currentAttack += value;
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: value });
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} 攻撃力+${value} (ATK: ${target.currentAttack})`);
        }
        break;
      }
      case 'buff_attack_all': {
        const targets = getAbilityTargets('self_unit_all', currentPlayer, opponentPlayer);
        targets.forEach(target => {
          target.currentAttack += value;
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'atk', value: value });
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} 攻撃力+${value}`);
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
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          const target = targets.length > 0 ? targets[0] : unit;
          target.currentHp += value;
          target.maxHp += value;
          if (!target.modifiers) target.modifiers = [];
          target.modifiers.push({ source: unit.name, type: 'hp', value: value });
          logs.push(`⬆️ ${unit.name} のアビリティ発動！${target.name} HP+${value} (HP: ${target.currentHp})`);
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
      case 'debuff_attack': {
        if (manualTarget) {
          manualTarget.currentAttack = Math.max(0, manualTarget.currentAttack - value);
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'atk', value: -value });
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${manualTarget.name} の攻撃力を ${value} 減少 (ATK: ${manualTarget.currentAttack})`);
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            target.currentAttack = Math.max(0, target.currentAttack - value);
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'atk', value: -value });
            logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} の攻撃力を ${value} 減少 (ATK: ${target.currentAttack})`);
          });
        }
        break;
      }
      case 'debuff_hp': {
        if (manualTarget) {
          manualTarget.currentHp = Math.max(1, manualTarget.currentHp - value);
          if (!manualTarget.modifiers) manualTarget.modifiers = [];
          manualTarget.modifiers.push({ source: unit.name, type: 'hp', value: -value });
          logs.push(`⬇️ ${unit.name} のアビリティ発動！${manualTarget.name} のHPを ${value} 減少 (HP: ${manualTarget.currentHp})`);
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            target.currentHp = Math.max(1, target.currentHp - value);
            if (!target.modifiers) target.modifiers = [];
            target.modifiers.push({ source: unit.name, type: 'hp', value: -value });
            logs.push(`⬇️ ${unit.name} のアビリティ発動！${target.name} のHPを ${value} 減少 (HP: ${target.currentHp})`);
          });
        }
        break;
      }
      case 'destroy': {
        if (manualTarget) {
          manualTarget.currentHp = 0;
          logs.push(`☠️ ${unit.name} のアビリティ発動！${manualTarget.name} を破壊！`);
          events.push({ type: 'ability_kill', target: manualTarget.instanceId });
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            target.currentHp = 0;
            logs.push(`☠️ ${unit.name} のアビリティ発動！${target.name} を破壊！`);
            events.push({ type: 'ability_kill', target: target.instanceId });
          });
        }
        break;
      }
      case 'destroy_weakest': {
        const targets = getAbilityTargets('enemy_unit_all', currentPlayer, opponentPlayer);
        if (targets.length > 0) {
          targets.sort((a, b) => a.currentHp - b.currentHp);
          const weakest = targets[0];
          weakest.currentHp = 0;
          logs.push(`☠️ ${unit.name} のアビリティ発動！最も弱き ${weakest.name} を破壊！`);
          events.push({ type: 'ability_kill', target: weakest.instanceId });
        }
        break;
      }
      case 'freeze': {
        if (manualTarget) {
          manualTarget.hasActed = true;
          manualTarget.canAttack = false;
          logs.push(`❄️ ${unit.name} のアビリティ発動！${manualTarget.name} を凍結！ (次ターン行動不可)`);
          events.push({ type: 'ability_freeze', target: manualTarget.instanceId });
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            target.hasActed = true;
            target.canAttack = false;
            logs.push(`❄️ ${unit.name} のアビリティ発動！${target.name} を凍結！ (次ターン行動不可)`);
            events.push({ type: 'ability_freeze', target: target.instanceId });
          });
        }
        break;
      }
      case 'bounce': {
        if (manualTarget) {
          logs.push(`🔄 ${unit.name} のアビリティ発動！${manualTarget.name} を手札に戻す`);
          events.push({ type: 'ability_bounce', target: manualTarget.instanceId });
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            logs.push(`🔄 ${unit.name} のアビリティ発動！${target.name} を手札に戻す`);
            events.push({ type: 'ability_bounce', target: target.instanceId });
          });
        }
        break;
      }
      case 'grant_barrier': {
        if (manualTarget) {
          manualTarget.barrierActive = true;
          if (!manualTarget.keywords.includes('barrier')) manualTarget.keywords.push('barrier');
          logs.push(`🛡️ ${unit.name} のアビリティ発動！${manualTarget.name} にバリアを付与`);
        } else if (trigger === 'on_play') {
          needsTarget = true;
        } else {
          const targets = getAbilityTargets(targetId, currentPlayer, opponentPlayer, value);
          targets.forEach(target => {
            target.barrierActive = true;
            if (!target.keywords.includes('barrier')) target.keywords.push('barrier');
            logs.push(`🛡️ ${unit.name} のアビリティ発動！${target.name} にバリアを付与`);
          });
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
      case 'sp_gain': {
        currentPlayer.sp += value;
        logs.push(`💰 ${unit.name} のアビリティ発動！SP+${value} (SP: ${currentPlayer.sp})`);
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
      return { events, needsTarget, targetId, effect, originalAbility: ability };
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

function processSpellEffect(card, gameState, currentPlayer, opponentPlayer, targetRow, targetLane, cardMap, logs) {
  const effect = card.abilityEffect;
  const value = card.abilityValue;
  const events = [];
  let needsTarget = false;
  let targetId = card.targetId || 'self_board_empty';

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
        } else {
          logs.push(`💨 スペル「${card.name}」: 対象がいないため不発`);
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
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
        target.hasActed = true;
        target.canAttack = false;
        logs.push(`❄️ スペル「${card.name}」: ${target.name} を凍結！（次ターン行動不可）`);
        events.push({ type: 'freeze', target: target.instanceId });
      }
      break;
    }
    case 'destroy': {
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
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
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
        target.currentAttack += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} の攻撃力+${value}`);
      }
      break;
    }
    case 'buff_hp': {
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
        target.currentHp += value;
        target.maxHp += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} のHP+${value}`);
      }
      break;
    }
    case 'grant_barrier': {
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
        target.barrierActive = true;
        if (!target.keywords.includes('barrier')) target.keywords.push('barrier');
        logs.push(`🛡️ スペル「${card.name}」: ${target.name} にバリアを付与`);
      }
      break;
    }
    case 'drain': {
      const targetPlayer = targetId.includes('enemy') ? opponentPlayer : currentPlayer;
      if (targetRow && targetPlayer.board[targetRow] && targetLane !== null && targetPlayer.board[targetRow][targetLane]) {
        const target = targetPlayer.board[targetRow][targetLane];
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
      } else {
        logs.push(`💨 スペル「${card.name}」: 対象がいないため不発`);
      }
      break;
    }
    case 'summon_token': {
      const tokenData = cardMap[value];
      if (tokenData) {
        const isRowValid = targetRow === 'front' || targetRow === 'back';
        const isLaneValid = targetLane !== undefined && targetLane !== null && targetLane >= 0 && targetLane < NUM_LANES;

        // 手動ターゲット（召喚座標）が指定されており、かつそこが自分の空きスロットである場合
        if (isRowValid && isLaneValid && !currentPlayer.board[targetRow][targetLane]) {
          const tokenInstance = createUnitInstance(tokenData, currentPlayer.id);
          tokenInstance.hasActed = true; // スペル召喚は即座に行動完了（バランス調整）
          currentPlayer.board[targetRow][targetLane] = tokenInstance;
          events.push({ type: 'spell_summon', player: currentPlayer.id, unit: tokenInstance, row: targetRow, lane: targetLane });
          logs.push(`⚔️ スペル/スキル効果！「${tokenInstance.name}」を召喚しました`);
        } else {
          // 座標が未指定ならターゲット選択フェーズを要求
          needsTarget = true;
          targetId = 'self_board_empty';
        }
      }
      break;
    }
    case 'sp_gain': {
      currentPlayer.sp += value;
      logs.push(`💰 スペル「${card.name}」: SP+${value} (SP: ${currentPlayer.sp})`);
      break;
    }
    case 'damage_all_enemy': {
      forEachUnit(opponentPlayer.board, (target, row, lane) => {
        target.currentHp -= value;
        logs.push(`🔥 スペル「${card.name}」: ${target.name} に ${value} ダメージ`);
        if (target.currentHp <= 0) events.push({ type: 'spell_kill', target: target.instanceId, row, lane });
      });
      break;
    }
    case 'buff_attack_all': {
      forEachUnit(currentPlayer.board, (target) => {
        target.currentAttack += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} の攻撃力+${value}`);
      });
      break;
    }
    case 'buff_hp_all': {
      forEachUnit(currentPlayer.board, (target) => {
        target.currentHp += value;
        target.maxHp += value;
        logs.push(`⬆️ スペル「${card.name}」: ${target.name} のHP+${value}`);
      });
      break;
    }
    case 'discard_random': {
      for (let i = 0; i < value && opponentPlayer.hand.length > 0; i++) {
        const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
        const discarded = opponentPlayer.hand.splice(idx, 1)[0];
        logs.push(`✋ スペル「${card.name}」: 相手の手札を破棄 (${discarded.name})`);
        events.push({ type: 'spell_discard', player: opponentPlayer.id });
      }
      break;
    }
    case 'bounce': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        logs.push(`🔄 スペル「${card.name}」: ${target.name} を手札に戻す`);
        events.push({ type: 'spell_bounce', target: target.instanceId, row: targetRow, lane: targetLane });
      } else {
        const targets = [];
        forEachUnit(opponentPlayer.board, (u, r, l) => targets.push({u, r, l}));
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          logs.push(`🔄 スペル「${card.name}」: ${t.u.name} を手札に戻す`);
          events.push({ type: 'spell_bounce', target: t.u.instanceId, row: t.r, lane: t.l });
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
    case 'debuff_attack': {
      if (targetRow && opponentPlayer.board[targetRow] && targetLane !== null && opponentPlayer.board[targetRow][targetLane]) {
        const target = opponentPlayer.board[targetRow][targetLane];
        target.currentAttack = Math.max(0, target.currentAttack - value);
        logs.push(`⬇️ スペル「${card.name}」: ${target.name} の攻撃力 -${value} (ATK: ${target.currentAttack})`);
      }
      break;
    }
    default:
      logs.push(`⚠️ 未実装のスペル効果: ${effect}`);
  }
  return { events, needsTarget, targetId, effect };
}

function processShieldSkill(shield, currentPlayer, opponentPlayer, cardMap, logs) {
  if (!shield.skill) return [];
  const skill = shield.skill;
  const events = [];
  const value = skill.effectValue || 0;

  switch (skill.effectType) {
    case 'none':
      logs.push(`🛡️ シールドスキル「${skill.name}」: 効果なし`);
      break;
    case 'damage_all_enemy':
      forEachUnit(opponentPlayer.board, (target, row, lane) => {
        target.currentHp -= value;
        logs.push(`🔥 シールドスキル「${skill.name}」: ${target.name} に ${value} ダメージ`);
        if (target.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: target.instanceId, row, lane });
      });
      break;
    case 'draw':
      events.push({ type: 'shield_skill_draw', player: currentPlayer.id, count: value });
      logs.push(`📖 シールドスキル「${skill.name}」: ${value} 枚ドロー`);
      break;
    case 'heal_all_ally':
      forEachUnit(currentPlayer.board, ally => {
        const healed = Math.min(value, ally.maxHp - ally.currentHp);
        if (healed > 0) {
          ally.currentHp += healed;
          logs.push(`💚 シールドスキル「${skill.name}」: ${ally.name} を ${healed} 回復`);
        }
      });
      break;
    case 'discard_random':
      for (let i = 0; i < value && opponentPlayer.hand.length > 0; i++) {
        const idx = Math.floor(Math.random() * opponentPlayer.hand.length);
        const discarded = opponentPlayer.hand.splice(idx, 1)[0];
        logs.push(`✋ シールドスキル「${skill.name}」: 相手の ${discarded.name} を捨てさせた`);
        events.push({ type: 'ability_discard', player: opponentPlayer.id });
      }
      break;
    case 'sp_gain':
      currentPlayer.sp += value;
      logs.push(`💰 シールドスキル「${skill.name}」: SP+${value} (SP: ${currentPlayer.sp})`);
      break;
    case 'sp_loss':
      currentPlayer.sp = Math.max(0, currentPlayer.sp - value);
      logs.push(`⚠️ シールドスキル「${skill.name}」: SP-${value} (デメリット)`);
      break;
    case 'damage_self':
      forEachUnit(currentPlayer.board, (ally, row, lane) => {
        ally.currentHp -= value;
        logs.push(`💥 シールドスキル「${skill.name}」: ${ally.name} に ${value} ダメージ (デメリット)`);
        if (ally.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: ally.instanceId, row, lane });
      });
      break;
    case 'damage_all':
      forEachUnit(currentPlayer.board, (u, r, l) => {
        u.currentHp -= value;
        if (u.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: u.instanceId, row: r, lane: l });
      });
      forEachUnit(opponentPlayer.board, (u, r, l) => {
        u.currentHp -= value;
        if (u.currentHp <= 0) events.push({ type: 'shield_skill_kill', target: u.instanceId, row: r, lane: l });
      });
      logs.push(`💥 シールドスキル「${skill.name}」: 全ユニットに ${value} ダメージ (デメリット)`);
      break;
    case 'summon_token': {
      let tokenId = value;
      // 数値（例: "4"）で来た場合、TXXX 形式へ正規化 (もしマスタがそのように定義されている場合)
      if (!isNaN(parseInt(value)) && String(value).length < 4) {
        tokenId = 'T' + String(value).padStart(3, '0');
      }
      
      const tokenData = cardMap[tokenId] || cardMap[value];
      if (tokenData) {
        let spawnedCount = 0;
        for (const row of ROWS) {
          for (let i = 0; i < NUM_LANES; i++) {
            if (!currentPlayer.board[row][i] && spawnedCount < 1) {
              const tokenInstance = createUnitInstance(tokenData, currentPlayer.id);
              tokenInstance.hasActed = true;
              currentPlayer.board[row][i] = tokenInstance;
              events.push({ type: 'ability_summon', player: currentPlayer.id, unit: tokenInstance, row, lane: i });
              logs.push(`⚔️ シールドスキル「${skill.name}」: 「${tokenInstance.name}」を召喚`);
              spawnedCount++;
            }
          }
        }
      } else {
        logs.push(`⚠️ シールドスキルのトークンID「${value}」がマスタに見つかりません`);
      }
      break;
    }
    case 'level_up':
      // tribeLevels を使用 (他の箇所と同期)
      Object.keys(currentPlayer.tribeLevels).forEach(color => {
        currentPlayer.tribeLevels[color] += value;
      });
      logs.push(`🌟 シールドスキル「${skill.name}」: 全神族レベル+${value}`);
      break;
    case 'freeze_all_enemy':
      forEachUnit(opponentPlayer.board, unit => {
        unit.hasActed = true;
        unit.canAttack = false;
        events.push({ type: 'ability_freeze', target: unit.instanceId });
      });
      logs.push(`❄️ シールドスキル「${skill.name}」: 敵の全ユニットを凍結！`);
      break;
    case 'bounce_lowest_enemy': {
      const targets = [];
      forEachUnit(opponentPlayer.board, (u, r, l) => targets.push({u, r, l}));
      if (targets.length > 0) {
        targets.sort((a,b) => (a.u.cost || 0) - (b.u.cost || 0));
        const t = targets[0];
        logs.push(`🔄 シールドスキル「${skill.name}」: ${t.u.name} を手札に戻す`);
        events.push({ type: 'ability_bounce', target: t.u.instanceId, row: t.r, lane: t.l });
      }
      break;
    }
    case 'grant_barrier_all':
      forEachUnit(currentPlayer.board, unit => {
        unit.barrierActive = true;
        if (!unit.keywords.includes('barrier')) unit.keywords.push('barrier');
      });
      logs.push(`🛡️ シールドスキル「${skill.name}」: 味方全ユニットに加護を付与`);
      break;
    case 'discard_self':
      if (currentPlayer.hand.length > 0) {
        const idx = Math.floor(Math.random() * currentPlayer.hand.length);
        const discarded = currentPlayer.hand.splice(idx, 1)[0];
        logs.push(`✋ シールドスキル「${skill.name}」: 自分の手札を破棄 (${discarded.name}) (デメリット)`);
        events.push({ type: 'ability_discard', player: currentPlayer.id });
      }
      break;
    case 'enemy_draw':
      logs.push(`📖 シールドスキル「${skill.name}」: 相手が ${value} 枚ドロー (デメリット)`);
      events.push({ type: 'ability_draw', player: opponentPlayer.id, count: value });
      break;
    case 'buff_attack_all_ally':
      forEachUnit(currentPlayer.board, unit => {
        unit.currentAttack += value;
      });
      logs.push(`⬆️ シールドスキル「${skill.name}」: 味方全ユニットの攻撃力+${value}`);
      break;
    case 'buff_hp_all_ally':
      forEachUnit(currentPlayer.board, unit => {
        unit.currentHp += value;
        unit.maxHp += value;
      });
      logs.push(`⬆️ シールドスキル「${skill.name}」: 味方全ユニットのHP+${value}`);
      break;
    case 'destroy_weakest_enemy': {
      const targets = [];
      forEachUnit(opponentPlayer.board, u => targets.push(u));
      if (targets.length > 0) {
        targets.sort((a,b) => a.currentHp - b.currentHp);
        const weakest = targets[0];
        weakest.currentHp = 0;
        logs.push(`☠️ シールドスキル「${skill.name}」: 最も弱き ${weakest.name} を破壊！`);
        events.push({ type: 'ability_kill', target: weakest.instanceId });
      }
      break;
    }
    case 'destroy_strongest_enemy': {
      const targets = [];
      forEachUnit(opponentPlayer.board, u => targets.push(u));
      if (targets.length > 0) {
        targets.sort((a,b) => b.currentAttack - a.currentAttack);
        const strongest = targets[0];
        strongest.currentHp = 0;
        logs.push(`☠️ シールドスキル「${skill.name}」: 強者 ${strongest.name} を破壊！`);
        events.push({ type: 'ability_kill', target: strongest.instanceId });
      }
      break;
    }
    case 'debuff_attack_all_enemy':
      forEachUnit(opponentPlayer.board, unit => {
        unit.currentAttack = Math.max(0, unit.currentAttack - value);
      });
      logs.push(`⬇️ シールドスキル「${skill.name}」: 敵全ユニットの攻撃力-${value}`);
      break;
    case 'bounce_highest_enemy': {
      const targets = [];
      forEachUnit(opponentPlayer.board, (u, r, l) => targets.push({u, r, l}));
      if (targets.length > 0) {
        targets.sort((a,b) => (b.u.cost || 0) - (a.u.cost || 0));
        const t = targets[0];
        logs.push(`🔄 シールドスキル「${skill.name}」: 高コストの ${t.u.name} を手札に戻す`);
        events.push({ type: 'ability_bounce', target: t.u.instanceId, row: t.r, lane: t.l });
      }
      break;
    }
    case 'damage_shield': {
      const available = opponentPlayer.shields.filter(s => !s.destroyed);
      if (available.length > 0) {
        const targetShield = available[0];
        targetShield.currentDurability -= value;
        logs.push(`💥 シールドスキル「${skill.name}」: 敵のシールドに ${value} ダメージ！`);
        if (targetShield.currentDurability <= 0) {
          targetShield.currentDurability = 0;
          targetShield.destroyed = true;
          events.push({ type: 'shield_skill_destroy_secondary', player: opponentPlayer.id, index: opponentPlayer.shields.indexOf(targetShield) });
        }
      }
      break;
    }
    case 'grant_endure_random': {
      const allies = [];
      forEachUnit(currentPlayer.board, u => allies.push(u));
      if (allies.length > 0) {
        const target = allies[Math.floor(Math.random() * allies.length)];
        target.endureActive = true;
        if (!target.keywords.includes('endure')) target.keywords.push('endure');
        logs.push(`💪 シールドスキル「${skill.name}」: ${target.name} に「不屈」を付与`);
      }
      break;
    }
    case 'enemy_buff_hp':
      forEachUnit(opponentPlayer.board, unit => {
        unit.currentHp += value;
        unit.maxHp += value;
      });
      logs.push(`💖 シールドスキル「${skill.name}」: 敵全ユニットのHP+${value} (デメリット)`);
      break;
    case 'self_freeze_random': {
      const allies = [];
      forEachUnit(currentPlayer.board, u => allies.push(u));
      if (allies.length > 0) {
        const target = allies[Math.floor(Math.random() * allies.length)];
        target.hasActed = true;
        target.canAttack = false;
        logs.push(`❄️ シールドスキル「${skill.name}」: ${target.name} が凍結！ (デメリット)`);
        events.push({ type: 'ability_freeze', target: target.instanceId });
      }
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
