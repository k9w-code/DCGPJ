// KeywordEffects.js - キーワード定義と効果処理（3レーン×前後列対応）
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');

const KEYWORDS = {
  taunt: { id: 'taunt', name: '挑発', description: '挑発を持つユニットが前列にいる場合、相手は挑発ユニット以外を攻撃対象にできない', type: 'passive' },
  rush: { id: 'rush', name: '速攻', description: '場に出たターンから攻撃できる', type: 'passive' },
  stealth: { id: 'stealth', name: '潜伏', description: '攻撃するまで相手の攻撃対象、及び手動スペル・効果の対象にならない', type: 'passive' },
  double_strike: { id: 'double_strike', name: '連撃', description: '攻撃時に2回連続でダメージを与える', type: 'on_attack' },
  barrier: { id: 'barrier', name: '加護', description: '1度だけ受けるダメージを無効化する', type: 'on_damage' },
  endure: { id: 'endure', name: '不屈', description: '撃破時に1度だけHP1で復活する', type: 'on_death' },
  siege: { id: 'siege', name: '攻城', description: 'シールドに与えるダメージが2になる', type: 'passive' },
  comeback: { id: 'comeback', name: '逆転', description: 'シールド残り1枚以下の時に追加効果', type: 'conditional' },
  lethal: { id: 'lethal', name: '必殺', description: '与えたダメージが1以上なら対象を即死させる', type: 'passive' },
  crisis: { id: 'crisis', name: '背水', description: '自分のアバターライフが3以下の時に追加効果', type: 'conditional' },
  snipe: { id: 'snipe', name: '狙撃', description: '前後列のルールを無視して任意の敵ユニットを攻撃できる', type: 'passive' },
  resonance: { id: 'resonance', name: '共鳴', description: '自分がスペルカードをプレイするたびに追加効果', type: 'on_spell_play' },
  silence: { id: 'silence', name: '沈黙', description: '対象ユニットの全キーワードとアビリティを無効化する', type: 'targeted' },
  link: { id: 'link', name: '連携', description: 'このターン中に自分が他のカードをプレイしている場合、追加効果', type: 'conditional' },
  vanguard: { id: 'vanguard', name: '先陣', description: '自分の前列がこのユニット1体のみの場合、追加効果', type: 'conditional' },
  rearguard: { id: 'rearguard', name: '後衛', description: '自分の後列がこのユニット1体のみの場合、追加効果', type: 'conditional' },
  spellshield: { id: 'spellshield', name: '魔盾', description: '相手の手動スペルや効果の対象にならない', type: 'passive' },
  sacrifice: { id: 'sacrifice', name: '代償', description: '自身の他の味方ユニット1体を破壊しなければプレイできない', type: 'cost' },
  echo: { id: 'echo', name: '残響', description: '場に出た時、SPが足りていれば自動でコストを支払い同名ユニットを出す', type: 'on_play' },
  overload: { id: 'overload', name: '暴走', description: '強力なスタッツを持つが、次のターンの獲得SPが1減少する', type: 'on_turn_end' },
  loner: { id: 'loner', name: '孤高', description: '自分の場に他の味方ユニットが存在しない場合、追加効果', type: 'conditional' },
  avenger: { id: 'avenger', name: '復讐', description: 'このターン中に他の味方ユニットが破壊されている場合、追加効果', type: 'conditional' },
  decay: { id: 'decay', name: '腐敗', description: '毎ターンの終了時、自身のHPが1減る', type: 'on_turn_end' },
  legacy: { id: 'legacy', name: '遺言', description: '破壊された時に発動する', type: 'on_death' },
};

function parseKeywords(keywordStr) {
  if (!keywordStr || keywordStr.trim() === '') return [];
  return keywordStr.split(';').map(k => k.trim()).filter(k => k !== '');
}

function getKeywordId(keyword) {
  const parts = keyword.split(':');
  if (parts[0] === 'awaken') {
    return { id: 'awaken', color: parts[1] || 'self', param: parseInt(parts[2]) || 7 };
  }
  return { id: parts[0], param: null };
}

function hasKeyword(unit, keywordId) {
  if (!unit || !unit.keywords) return false;
  // 'rush' と 'speed' は同義として扱う
  const searchIds = (keywordId === 'rush') ? ['rush', 'speed'] : [keywordId];
  return unit.keywords.some(k => searchIds.includes(getKeywordId(k).id));
}

function getKeywordParam(unit, keywordId) {
  if (!unit || !unit.keywords) return null;
  for (const k of unit.keywords) {
    const parsed = getKeywordId(k);
    if (parsed.id === keywordId) return parsed.param;
  }
  return null;
}

/**
 * 挑発を持つ前列ユニットを取得
 * ※ 挑発は前列にいる場合のみ有効
 */
function getTauntTargets(opponentBoard) {
  const tauntUnits = [];
  for (let lane = 0; lane < NUM_LANES; lane++) {
    const unit = opponentBoard.front[lane];
    if (unit && hasKeyword(unit, 'taunt') && !hasKeyword(unit, 'stealth')) {
      tauntUnits.push({ row: 'front', lane, unit });
    }
  }
  return tauntUnits;
}

/**
 * 攻撃可能な対象を取得（前後列ルール対応）
 * 
 * ルール:
 * - 前列ユニットから攻撃: 正面の前列 > 同レーン後列 > 他レーン前列 > シールド/ダイレクト
 * - 後列ユニットから攻撃: 同レーン前列(敵) > 他の前列(敵)  > シールド/ダイレクト (※後列は基本前列越しに攻撃不可)
 * - 相手の前列全てが空の場合、後列を直接攻撃可能
 * - 挑発持ちが前列にいる場合、挑発持ちのみ攻撃可能
 */
function getValidAttackTargets(attackerRow, attackerLane, attackerUnit, opponentBoard, opponentShields) {
  const targets = [];

  // SNIPE (狙撃) チェック: 狙撃を持つ場合、挑発や前後列のルールを無視して相手の全ユニット（潜伏以外）を対象にできる
  if (hasKeyword(attackerUnit, 'snipe')) {
    let hasValidUnitToSnipe = false;
    for (const r of ['front', 'back']) {
      for (const l of [0, 1, 2]) {
        const u = opponentBoard[r][l];
        if (u && !hasKeyword(u, 'stealth')) {
          targets.push({ type: 'unit', row: r, lane: l, unit: u });
          hasValidUnitToSnipe = true;
        }
      }
    }
    // ユニットが存在しない場合はシールドかダイレクトアタックへ回すため下の処理に合流させるが、
    // ユニットがいるなら「どこでも攻撃できる」としてreturnする。
    if (hasValidUnitToSnipe) {
      // 狙撃であっても、相手の盤面にユニットがいなければシールド/ダイレクトになるだけなので、そこだけ共通処理とする。
      // もし相手がシールドを張っていたらシールドも狙えるようにするか？ 基本的にはユニットのみ狙い撃つか、ユニットがいないならシールド。
      // とりあえずユニット全てを返す（シールドを無視して裏を叩けるわけではなく、あくまで「ユニットならどこでも攻撃可能」とする）
      return targets;
    }
  }

  // 1. 挑発チェック (挑発はグローバルに優先)
  const tauntTargets = getTauntTargets(opponentBoard);
  if (tauntTargets.length > 0) {
    for (const t of tauntTargets) {
      targets.push({ type: 'unit', row: t.row, lane: t.lane, unit: t.unit });
    }
    return targets;
  }

  // 2. 正面の判定
  // 同レーンの前列を確認
  const frontUnit = opponentBoard.front[attackerLane];
  if (frontUnit && !hasKeyword(frontUnit, 'stealth')) {
    targets.push({ type: 'unit', row: 'front', lane: attackerLane, unit: frontUnit });
    return targets;
  }

  // 同レーンの後列を確認
  const backUnit = opponentBoard.back[attackerLane];
  if (backUnit && !hasKeyword(backUnit, 'stealth')) {
    targets.push({ type: 'unit', row: 'back', lane: attackerLane, unit: backUnit });
    return targets;
  }

  // 3. 正面が空なら、シールドまたはダイレクトアタック可能
  const activeShields = (opponentShields || []).filter(s => s && !s.destroyed && s.currentDurability > 0);
  if (activeShields.length > 0) {
    // 破壊されていないシールドをすべて候補として返す
    for (const s of activeShields) {
      targets.push({ type: 'shield', id: s.id, name: s.name });
    }
  } else {
    targets.push({ type: 'direct' });
  }

  // (オプション) 他のレーンの前列ユニットも攻撃対象に含める場合はここに追加しますが、
  // 現状の「正面優先・空ならシールド」というルールに合わせてこれ以上追加しません。

  return targets;
}

module.exports = {
  KEYWORDS,
  parseKeywords,
  getKeywordId,
  hasKeyword,
  getKeywordParam,
  getTauntTargets,
  getValidAttackTargets,
};
