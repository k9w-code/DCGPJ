// KeywordEffects.js - \u30ad\u30fc\u30ef\u30fc\u30c9\u5b9a\u7fa9\u3068\u52b9\u679c\u51e6\u7406\uff083\u30ec\u30fc\u30f3\u00d7\u524d\u5f8c\u5217\u5bfe\u5fdc\uff09
'use strict';

const { NUM_LANES, ROWS } = require('./GameState');

const KEYWORDS = {
  taunt: { id: 'taunt', name: '\u6311\u767a', description: '\u6311\u767a\u3092\u6301\u3064\u30e6\u30cb\u30c3\u30c8\u304c\u524d\u5217\u306b\u3044\u308b\u5834\u5408\u3001\u76f8\u624b\u306f\u6311\u767a\u30e6\u30cb\u30c3\u30c8\u4ee5\u5916\u3092\u653b\u6483\u5bfe\u8c61\u306b\u3067\u304d\u306a\u3044', type: 'passive' },
  rush: { id: 'rush', name: '\u901f\u653b', description: '\u5834\u306b\u51fa\u305f\u30bf\u30fc\u30f3\u304b\u3089\u653b\u6483\u3067\u304d\u308b', type: 'passive' },
  stealth: { id: 'stealth', name: '\u6f5c\u4f0f', description: '\u653b\u6483\u3059\u308b\u307e\u3067\u76f8\u624b\u306e\u653b\u6483\u5bfe\u8c61\u3001\u53ca\u3073\u624b\u52d5\u30b9\u30da\u30eb\u30fb\u52b9\u679c\u306e\u5bfe\u8c61\u306b\u306a\u3089\u306a\u3044', type: 'passive' },
  double_strike: { id: 'double_strike', name: '\u9023\u6483', description: '\u653b\u6483\u6642\u306b2\u56de\u9023\u7d9a\u3067\u30c0\u30e1\u30fc\u30b8\u3092\u4e0e\u3048\u308b', type: 'on_attack' },
  barrier: { id: 'barrier', name: '\u52a0\u8b77', description: '1\u5ea6\u3060\u3051\u53d7\u3051\u308b\u30c0\u30e1\u30fc\u30b8\u3092\u7121\u52b9\u5316\u3059\u308b', type: 'on_damage' },
  endure: { id: 'endure', name: '\u4e0d\u5c48', description: '\u6483\u7834\u6642\u306b1\u5ea6\u3060\u3051HP1\u3067\u5fa9\u6d3b\u3059\u308b', type: 'on_death' },
  siege: { id: 'siege', name: '\u653b\u57ce', description: '\u30b7\u30fc\u30eb\u30c9\u306b\u4e0e\u3048\u308b\u30c0\u30e1\u30fc\u30b8\u304c2\u306b\u306a\u308b', type: 'passive' },
  comeback: { id: 'comeback', name: '\u9006\u8ee2', description: '\u30b7\u30fc\u30eb\u30c9\u6b8b\u308a1\u679a\u4ee5\u4e0b\u306e\u6642\u306b\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  lethal: { id: 'lethal', name: '\u5fc5\u6bba', description: '\u4e0e\u3048\u305f\u30c0\u30e1\u30fc\u30b8\u304c1\u4ee5\u4e0a\u306a\u3089\u5bfe\u8c61\u3092\u5373\u6b7b\u3055\u305b\u308b', type: 'passive' },
  crisis: { id: 'crisis', name: '\u80cc\u6c34', description: '\u81ea\u5206\u306e\u30a2\u30d0\u30bf\u30fc\u30e9\u30a4\u30d5\u304c3\u4ee5\u4e0b\u306e\u6642\u306b\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  snipe: { id: 'snipe', name: '\u72d9\u6483', description: '\u524d\u5f8c\u5217\u306e\u30eb\u30fc\u30eb\u3092\u7121\u8996\u3057\u3066\u4efb\u610f\u306e\u6575\u30e6\u30cb\u30c3\u30c8\u3092\u653b\u6483\u3067\u304d\u308b', type: 'passive' },
  resonance: { id: 'resonance', name: '\u5171\u9cf4', description: '\u81ea\u5206\u304c\u30b9\u30da\u30eb\u30ab\u30fc\u30c9\u3092\u30d7\u30ec\u30a4\u3059\u308b\u305f\u3073\u306b\u8ffd\u52a0\u52b9\u679c', type: 'on_spell_play' },
  silence: { id: 'silence', name: '\u6c88\u9ed9', description: '\u5bfe\u8c61\u30e6\u30cb\u30c3\u30c8\u306e\u5168\u30ad\u30fc\u30ef\u30fc\u30c9\u3068\u30a2\u30d3\u30ea\u30c6\u30a3\u3092\u7121\u52b9\u5316\u3059\u308b', type: 'targeted' },
  link: { id: 'link', name: '\u9023\u643a', description: '\u3053\u306e\u30bf\u30fc\u30f3\u4e2d\u306b\u81ea\u5206\u304c\u4ed6\u306e\u30ab\u30fc\u30c9\u3092\u30d7\u30ec\u30a4\u3057\u3066\u3044\u308b\u5834\u5408\u3001\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  vanguard: { id: 'vanguard', name: '\u5148\u9663', description: '\u81ea\u5206\u306e\u524d\u5217\u304c\u3053\u306e\u30e6\u30cb\u30c3\u30c81\u4f53\u306e\u307f\u306e\u5834\u5408\u3001\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  rearguard: { id: 'rearguard', name: '\u5f8c\u885b', description: '\u81ea\u5206\u306e\u5f8c\u5217\u304c\u3053\u306e\u30e6\u30cb\u30c3\u30c81\u4f53\u306e\u307f\u306e\u5834\u5408\u3001\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  spellshield: { id: 'spellshield', name: '\u9b54\u76fe', description: '\u76f8\u624b\u306e\u624b\u52d5\u30b9\u30da\u30eb\u3084\u52b9\u679c\u306e\u5bfe\u8c61\u306b\u306a\u3089\u306a\u3044', type: 'passive' },
  sacrifice: { id: 'sacrifice', name: '\u4ee3\u511f', description: '\u81ea\u8eab\u306e\u4ed6\u306e\u5473\u65b9\u30e6\u30cb\u30c3\u30c81\u4f53\u3092\u7834\u58ca\u3057\u306a\u3051\u308c\u3070\u30d7\u30ec\u30a4\u3067\u304d\u306a\u3044', type: 'cost' },
  echo: { id: 'echo', name: '\u6b8b\u97ff', description: '\u5834\u306b\u51fa\u305f\u6642\u3001SP\u304c\u8db3\u308a\u3066\u3044\u308c\u3070\u81ea\u52d5\u3067\u30b3\u30b9\u30c8\u3092\u652f\u6255\u3044\u540c\u540d\u30e6\u30cb\u30c3\u30c8\u3092\u51fa\u3059', type: 'on_play' },
  overload: { id: 'overload', name: '\u66b4\u8d70', description: '\u5f37\u529b\u306a\u30b9\u30bf\u30c3\u30c4\u3092\u6301\u3064\u304c\u3001\u6b21\u306e\u30bf\u30fc\u30f3\u306e\u7372\u5f97SP\u304c1\u6e1b\u5c11\u3059\u308b', type: 'on_turn_end' },
  loner: { id: 'loner', name: '\u5b64\u9ad8', description: '\u81ea\u5206\u306e\u5834\u306b\u4ed6\u306e\u5473\u65b9\u30e6\u30cb\u30c3\u30c8\u304c\u5b58\u5728\u3057\u306a\u3044\u5834\u5408\u3001\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  avenger: { id: 'avenger', name: '\u5fa9\u8b90', description: '\u3053\u306e\u30bf\u30fc\u30f3\u4e2d\u306b\u4ed6\u306e\u5473\u65b9\u30e6\u30cb\u30c3\u30c8\u304c\u7834\u58ca\u3055\u308c\u3066\u3044\u308b\u5834\u5408\u3001\u8ffd\u52a0\u52b9\u679c', type: 'conditional' },
  decay: { id: 'decay', name: '\u8150\u6557', description: '\u6bce\u30bf\u30fc\u30f3\u306e\u7d42\u4e86\u6642\u3001\u81ea\u8eab\u306eHP\u304c1\u6e1b\u308b', type: 'on_turn_end' },
  legacy: { id: 'legacy', name: '\u907a\u8a00', description: '\u7834\u58ca\u3055\u308c\u305f\u6642\u306b\u767a\u52d5\u3059\u308b', type: 'on_death' },
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
  // 'rush' \u3068 'speed' \u306f\u540c\u7fa9\u3068\u3057\u3066\u6271\u3046
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
 * \u6311\u767a\u3092\u6301\u3064\u524d\u5217\u30e6\u30cb\u30c3\u30c8\u3092\u53d6\u5f97
 * \u203b \u6311\u767a\u306f\u524d\u5217\u306b\u3044\u308b\u5834\u5408\u306e\u307f\u6709\u52b9
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
 * \u653b\u6483\u53ef\u80fd\u306a\u5bfe\u8c61\u3092\u53d6\u5f97\uff08\u524d\u5f8c\u5217\u30eb\u30fc\u30eb\u5bfe\u5fdc\uff09
 * 
 * \u30eb\u30fc\u30eb:
 * - \u524d\u5217\u30e6\u30cb\u30c3\u30c8\u304b\u3089\u653b\u6483: \u6b63\u9762\u306e\u524d\u5217 > \u540c\u30ec\u30fc\u30f3\u5f8c\u5217 > \u4ed6\u30ec\u30fc\u30f3\u524d\u5217 > \u30b7\u30fc\u30eb\u30c9/\u30c0\u30a4\u30ec\u30af\u30c8
 * - \u5f8c\u5217\u30e6\u30cb\u30c3\u30c8\u304b\u3089\u653b\u6483: \u540c\u30ec\u30fc\u30f3\u524d\u5217(\u6575) > \u4ed6\u306e\u524d\u5217(\u6575)  > \u30b7\u30fc\u30eb\u30c9/\u30c0\u30a4\u30ec\u30af\u30c8 (\u203b\u5f8c\u5217\u306f\u57fa\u672c\u524d\u5217\u8d8a\u3057\u306b\u653b\u6483\u4e0d\u53ef)
 * - \u76f8\u624b\u306e\u524d\u5217\u5168\u3066\u304c\u7a7a\u306e\u5834\u5408\u3001\u5f8c\u5217\u3092\u76f4\u63a5\u653b\u6483\u53ef\u80fd
 * - \u6311\u767a\u6301\u3061\u304c\u524d\u5217\u306b\u3044\u308b\u5834\u5408\u3001\u6311\u767a\u6301\u3061\u306e\u307f\u653b\u6483\u53ef\u80fd
 */
function getValidAttackTargets(attackerRow, attackerLane, attackerUnit, opponentBoard, opponentShields) {
  const targets = [];

  // SNIPE (\u72d9\u6483) \u30c1\u30a7\u30c3\u30af: \u72d9\u6483\u3092\u6301\u3064\u5834\u5408\u3001\u6311\u767a\u3084\u524d\u5f8c\u5217\u306e\u30eb\u30fc\u30eb\u3092\u7121\u8996\u3057\u3066\u76f8\u624b\u306e\u5168\u30e6\u30cb\u30c3\u30c8\uff08\u6f5c\u4f0f\u4ee5\u5916\uff09\u3092\u5bfe\u8c61\u306b\u3067\u304d\u308b
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
    // \u30e6\u30cb\u30c3\u30c8\u304c\u5b58\u5728\u3057\u306a\u3044\u5834\u5408\u306f\u30b7\u30fc\u30eb\u30c9\u304b\u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af\u3078\u56de\u3059\u305f\u3081\u4e0b\u306e\u51e6\u7406\u306b\u5408\u6d41\u3055\u305b\u308b\u304c\u3001
    // \u30e6\u30cb\u30c3\u30c8\u304c\u3044\u308b\u306a\u3089\u300c\u3069\u3053\u3067\u3082\u653b\u6483\u3067\u304d\u308b\u300d\u3068\u3057\u3066return\u3059\u308b\u3002
    if (hasValidUnitToSnipe) {
      // \u72d9\u6483\u3067\u3042\u3063\u3066\u3082\u3001\u76f8\u624b\u306e\u76e4\u9762\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u306a\u3051\u308c\u3070\u30b7\u30fc\u30eb\u30c9/\u30c0\u30a4\u30ec\u30af\u30c8\u306b\u306a\u308b\u3060\u3051\u306a\u306e\u3067\u3001\u305d\u3053\u3060\u3051\u5171\u901a\u51e6\u7406\u3068\u3059\u308b\u3002
      // \u3082\u3057\u76f8\u624b\u304c\u30b7\u30fc\u30eb\u30c9\u3092\u5f35\u3063\u3066\u3044\u305f\u3089\u30b7\u30fc\u30eb\u30c9\u3082\u72d9\u3048\u308b\u3088\u3046\u306b\u3059\u308b\u304b\uff1f \u57fa\u672c\u7684\u306b\u306f\u30e6\u30cb\u30c3\u30c8\u306e\u307f\u72d9\u3044\u6483\u3064\u304b\u3001\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u306a\u3044\u306a\u3089\u30b7\u30fc\u30eb\u30c9\u3002
      // \u3068\u308a\u3042\u3048\u305a\u30e6\u30cb\u30c3\u30c8\u5168\u3066\u3092\u8fd4\u3059\uff08\u30b7\u30fc\u30eb\u30c9\u3092\u7121\u8996\u3057\u3066\u88cf\u3092\u53e9\u3051\u308b\u308f\u3051\u3067\u306f\u306a\u304f\u3001\u3042\u304f\u307e\u3067\u300c\u30e6\u30cb\u30c3\u30c8\u306a\u3089\u3069\u3053\u3067\u3082\u653b\u6483\u53ef\u80fd\u300d\u3068\u3059\u308b\uff09
      return targets;
    }
  }

  // 1. \u6311\u767a\u30c1\u30a7\u30c3\u30af (\u6311\u767a\u306f\u30b0\u30ed\u30fc\u30d0\u30eb\u306b\u512a\u5148)
  const tauntTargets = getTauntTargets(opponentBoard);
  if (tauntTargets.length > 0) {
    for (const t of tauntTargets) {
      targets.push({ type: 'unit', row: t.row, lane: t.lane, unit: t.unit });
    }
    return targets;
  }

  // 2. \u6b63\u9762\u306e\u5224\u5b9a
  // \u540c\u30ec\u30fc\u30f3\u306e\u524d\u5217\u3092\u78ba\u8a8d
  const frontUnit = opponentBoard.front[attackerLane];
  if (frontUnit && !hasKeyword(frontUnit, 'stealth')) {
    targets.push({ type: 'unit', row: 'front', lane: attackerLane, unit: frontUnit });
    return targets;
  }

  // \u540c\u30ec\u30fc\u30f3\u306e\u5f8c\u5217\u3092\u78ba\u8a8d
  const backUnit = opponentBoard.back[attackerLane];
  if (backUnit && !hasKeyword(backUnit, 'stealth')) {
    targets.push({ type: 'unit', row: 'back', lane: attackerLane, unit: backUnit });
    return targets;
  }

  // 3. \u6b63\u9762\u304c\u7a7a\u306a\u3089\u3001\u30b7\u30fc\u30eb\u30c9\u307e\u305f\u306f\u30c0\u30a4\u30ec\u30af\u30c8\u30a2\u30bf\u30c3\u30af\u53ef\u80fd
  const activeShields = (opponentShields || []).filter(s => s && !s.destroyed && s.currentDurability > 0);
  if (activeShields.length > 0) {
    // \u7834\u58ca\u3055\u308c\u3066\u3044\u306a\u3044\u30b7\u30fc\u30eb\u30c9\u3092\u3059\u3079\u3066\u5019\u88dc\u3068\u3057\u3066\u8fd4\u3059
    for (const s of activeShields) {
      targets.push({ type: 'shield', id: s.id, name: s.name });
    }
  } else {
    targets.push({ type: 'direct' });
  }

  // (\u30aa\u30d7\u30b7\u30e7\u30f3) \u4ed6\u306e\u30ec\u30fc\u30f3\u306e\u524d\u5217\u30e6\u30cb\u30c3\u30c8\u3082\u653b\u6483\u5bfe\u8c61\u306b\u542b\u3081\u308b\u5834\u5408\u306f\u3053\u3053\u306b\u8ffd\u52a0\u3057\u307e\u3059\u304c\u3001
  // \u73fe\u72b6\u306e\u300c\u6b63\u9762\u512a\u5148\u30fb\u7a7a\u306a\u3089\u30b7\u30fc\u30eb\u30c9\u300d\u3068\u3044\u3046\u30eb\u30fc\u30eb\u306b\u5408\u308f\u305b\u3066\u3053\u308c\u4ee5\u4e0a\u8ffd\u52a0\u3057\u307e\u305b\u3093\u3002

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
