const fs = require('fs');
const { parse } = require('csv-parse/sync');

const cardsFile = fs.readFileSync('data/cards.csv', 'utf-8');
const cards = parse(cardsFile, { columns: true, skip_empty_lines: true, trim: true });

const shieldsFile = fs.readFileSync('data/shields.csv', 'utf-8');
const shields = parse(shieldsFile, { columns: true, skip_empty_lines: true, trim: true });

const shieldSkillsFile = fs.readFileSync('data/shield_skills.csv', 'utf-8');
const shieldSkills = parse(shieldSkillsFile, { columns: true, skip_empty_lines: true, trim: true });

const skillMap = {};
for (const skill of shieldSkills) {
  skillMap[skill.id] = skill;
}

// 1. キーワードマスタ (新規)
const keywordHeaders = ['id', 'name', 'description'];
const keywordData = [
  ['taunt', '挑発', '相手はこのユニット以外を攻撃対象に選べない。'],
  ['rush', '速攻', '配置したターンに攻撃ができる。'],
  ['stealth', '潜伏', '攻撃するまで、相手の攻撃対象やアビリティの対象に選ばれない。'],
  ['barrier', '加護', '一度だけダメージを無効化する。'],
  ['endure', '不屈', '破壊されるとき、一度だけHP1で耐える。'],
  ['double_strike', '連撃', '一度の攻撃で2回ダメージを与える。'],
  ['search_1', '探索1', '配置時、山札からコスト1のカードを1枚手札に加える。']
];
let keywordTsv = keywordHeaders.join('\t') + '\n';
for (const row of keywordData) {
  keywordTsv += row.join('\t') + '\n';
}
fs.writeFileSync('tmp/keywords_master.tsv', keywordTsv);

// 2. カードマスタ (カンマ区切りに変更)
const cardHeaders = ['id', 'art_id', 'name', 'color', 'rarity', 'type', 'token_flag', 'deck_limit', 'cost', 'atk', 'life', 'keywords', 'text', 'description', 'expansion'];
let cardTsv = cardHeaders.join('\t') + '\n';
for (const card of cards) {
  const row = [
    card.id,
    card.id,
    card.name,
    card.color,
    '1',
    card.type,
    'n',
    card.max_copies || '3',
    card.cost || '',
    card.attack || '',
    card.hp || '',
    (card.keywords || '').replace(/;/g, ','), // セミコロンをカンマに置換
    '', 
    card.flavor_text || '',
    '001'
  ];
  cardTsv += row.join('\t') + '\n';
}
fs.writeFileSync('tmp/cards_updated.tsv', cardTsv);

// 3. アビリティマスタ (ターゲット/テキスト対応 & 全カード行)
const abilityHeaders = ['ability_id', 'card_id', 'trigger', 'effect', 'value', 'target', 'text', 'condition'];
let abilityTsv = abilityHeaders.join('\t') + '\n';
for (const card of cards) {
  const hasAbility = card.ability_trigger && card.ability_trigger !== 'none' || card.ability_effect;
  const row = [
    `${card.id}_1`,
    card.id,
    hasAbility ? (card.ability_trigger || 'none') : '',
    hasAbility ? (card.ability_effect || '') : '',
    hasAbility ? (card.ability_value || '') : '',
    hasAbility ? 'enemy_unit_1' : '', // 適当なデフォルトターゲット
    hasAbility ? (card.flavor_text || '') : '', // テキスト列としてフレーバーを仮入れ
    ''
  ];
  abilityTsv += row.join('\t') + '\n';
}
fs.writeFileSync('tmp/abilities_updated.tsv', abilityTsv);

// 4. シールドマスタ (ターゲット/テキスト対応)
const shieldHeaders = ['id', 'name', 'rarity', 'life', 'effect', 'value', 'target', 'text', 'description', 'expansion'];
let shieldTsv = shieldHeaders.join('\t') + '\n';
for (const shield of shields) {
  const skill = skillMap[shield.skill_id] || {};
  const row = [
    shield.id,
    shield.name,
    '1',
    shield.durability || '1',
    skill.effect_type || 'none',
    skill.effect_value || '0',
    'enemy_unit_all', // 適当なデフォルトターゲット
    skill.description || '', // 表示用テキスト
    skill.description || '', // 説明文
    '001'
  ];
  shieldTsv += row.join('\t') + '\n';
}
fs.writeFileSync('tmp/shields_updated.tsv', shieldTsv);
