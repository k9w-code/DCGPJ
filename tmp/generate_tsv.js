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

// 1. カードマスタ出力
const cardHeaders = ['id', 'art_id', 'name', 'color', 'rarity', 'type', 'token_flag', 'deck_limit', 'cost', 'atk', 'life', 'keywords', 'text', 'description', 'expansion'];
let cardTsv = cardHeaders.join('\t') + '\n';
for (const card of cards) {
  const row = [
    card.id,
    card.id, // art_id
    card.name,
    card.color,
    '1', // rarity
    card.type,
    'n', // token_flag
    card.max_copies || '3',
    card.cost || '',
    card.attack || '',
    card.hp || '',
    card.keywords || '',
    '', // text
    card.flavor_text || '',
    '001' // expansion
  ];
  cardTsv += row.join('\t') + '\n';
}

fs.writeFileSync('tmp/cards_export.tsv', cardTsv);

// 2. アビリティマスタ出力
const abilityHeaders = ['ability_id', 'card_id', 'trigger', 'effect', 'value', 'target', 'condition'];
let abilityTsv = abilityHeaders.join('\t') + '\n';
let abilityCount = 0;
for (const card of cards) {
  if (card.ability_trigger && card.ability_trigger !== 'none' || card.ability_effect) {
    abilityCount++;
    const row = [
      `${card.id}_1`,
      card.id,
      card.ability_trigger || 'none',
      card.ability_effect || '',
      card.ability_value || '',
      '', // target
      ''  // condition
    ];
    abilityTsv += row.join('\t') + '\n';
  }
}

fs.writeFileSync('tmp/abilities_export.tsv', abilityTsv);

// 3. シールドマスタ出力
const shieldHeaders = ['id', 'name', 'rarity', 'life', 'effect', 'value', 'target', 'description', 'expansion', 'text'];
let shieldTsv = shieldHeaders.join('\t') + '\n';
for (const shield of shields) {
  const skill = skillMap[shield.skill_id] || {};
  const row = [
    shield.id,
    shield.name,
    '1', // rarity
    shield.durability || '1',
    skill.effect_type || 'none',
    skill.effect_value || '0',
    '', // target
    skill.description || '',
    '001', // expansion
    '' // text
  ];
  shieldTsv += row.join('\t') + '\n';
}

fs.writeFileSync('tmp/shields_export.tsv', shieldTsv);
