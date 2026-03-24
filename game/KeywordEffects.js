// KeywordEffects.js - キーワード定義と効果処理（3レーン×前後列対応）
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');

const KEYWORDS = {
  taunt: { id: 'taunt', name: '挑発', description: '挑発を持つユニットが前列にいる場合、相手は挑発ユニット以外を攻撃対象にできない', type: 'passive' },
  rush: { id: 'rush', name: '速攻', description: '場に出たターンから攻撃できる', type: 'passive' },
  stealth: { id: 'stealth', name: '潜伏', description: '攻撃するまで相手の攻撃対象にならない', type: 'passive' },
  double_strike: { id: 'double_strike', name: '連撃', description: '攻撃時に2回連続でダメージを与える', type: 'on_attack' },
  barrier: { id: 'barrier', name: '加護', description: '1度だけ受けるダメージを無効化する', type: 'on_damage' },
  endure: { id: 'endure', name: '不屈', description: '撃破時に1度だけHP1で復活する', type: 'on_death' },
  siege: { id: 'siege', name: '攻城', description: 'シールドに与えるダメージが2になる', type: 'passive' },
  comeback: { id: 'comeback', name: '逆転', description: 'シールド残り1枚以下の時に追加効果', type: 'conditional' },
};

function parseKeywords(keywordStr) {
  if (!keywordStr || keywordStr.trim() === '') return [];
  return keywordStr.split(';').map(k => k.trim()).filter(k => k !== '');
}

function getKeywordId(keyword) {
  const match = keyword.match(/^(\w+?)_(\d+)$/);
  if (match && match[1] === 'search') {
    return { id: 'search', param: parseInt(match[2]) };
  }
  return { id: keyword, param: null };
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

  // 挑発チェック（前列のみ）
  const tauntTargets = getTauntTargets(opponentBoard);
  if (tauntTargets.length > 0) {
    for (const t of tauntTargets) {
      targets.push({ type: 'unit', row: t.row, lane: t.lane, unit: t.unit });
    }
    return targets;
  }

  // 相手の前列にユニットがいるか
  const frontHasUnits = opponentBoard.front.some(u => u && !hasKeyword(u, 'stealth'));
  
  if (frontHasUnits) {
    // 前列のユニットを攻撃可能
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const unit = opponentBoard.front[lane];
      if (unit && !hasKeyword(unit, 'stealth')) {
        targets.push({ type: 'unit', row: 'front', lane, unit });
      }
    }
  } else {
    // 前列が空なら後列を攻撃可能
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const unit = opponentBoard.back[lane];
      if (unit && !hasKeyword(unit, 'stealth')) {
        targets.push({ type: 'unit', row: 'back', lane, unit });
      }
    }
    
    // 後列にもユニットがいなければシールド/ダイレクトアタック
    if (targets.length === 0) {
      const hasShields = opponentShields.some(s => s && !s.destroyed && s.currentDurability > 0);
      if (hasShields) {
        targets.push({ type: 'shield' });
      } else {
        targets.push({ type: 'direct' });
      }
    }
  }

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
