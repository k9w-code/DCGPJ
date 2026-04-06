'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Google Spreadsheet CSV Export URLs
const CARDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=0';
const SHIELDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=108587861';
const KEYWORDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=1171970069';

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // 302 redirect handling for Google Sheets
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return https.get(res.headers.location, handleResponse).on('error', reject);
      }
      handleResponse(res);
      
      function handleResponse(response) {
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to fetch ${url}: ${response.statusCode}`));
        }
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            const parsed = parse(data, {
              columns: true,
              skip_empty_lines: true,
              trim: true,
              relax_column_count: true,
              bom: true
            });
            resolve(parsed);
          } catch(e) {
            reject(e);
          }
        });
      }
    }).on('error', reject);
  });
}

function loadLocalCSV(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (fs.existsSync(filePath)) {
    console.log(`[DataLoader] Local file found: ${filename}`);
    const data = fs.readFileSync(filePath, 'utf8');
    return parse(data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true
    });
  }
  return null;
}

async function loadAllData() {
  console.log('Loading master data...');
  
  const cardsRaw = loadLocalCSV('cards.csv') || await fetchCSV(CARDS_URL);
  const shieldsRaw = loadLocalCSV('shields.csv') || await fetchCSV(SHIELDS_URL);
  const keywordsRaw = loadLocalCSV('keyword_master.csv') || loadLocalCSV('keywords.csv') || await fetchCSV(KEYWORDS_URL);

  // キーワードマスタ
  const keywordMap = {};
  for (const row of keywordsRaw) {
    if (!row.id) continue;
    keywordMap[row.id] = {
      id: row.id,
      name: row.name || row.id,
      description: row.description || ''
    };
  }

  // カードデータの構築
  const cards = cardsRaw.filter(row => row.id).map(row => {
    const abilities = [];
    const trigger = row.ability_trigger || row.trigger;
    const effect = row.ability_effect || row.effect;
    const valueStr = row.ability_value || row.value;
    
    if (trigger && trigger.trim() !== '' && trigger.trim() !== 'none') {
      abilities.push({
        id: `${row.id}_ability`,
        trigger: trigger.trim(),
        effect: effect ? effect.trim() : '',
        value: isNaN(parseInt(valueStr)) ? (valueStr ? valueStr.trim() : '') : parseInt(valueStr),
        target: row.target ? row.target.trim() : '',
        text: row.text ? row.text.trim() : '',
        condition: row.condition ? row.condition.trim() : ''
      });
    }
    const firstAbility = abilities.length > 0 ? abilities[0] : {};
    
    return {
      id: row.id,
      artId: row.art_id || row.id,
      name: row.name,
      colors: row.color ? row.color.split(',').map(c => c.trim()).filter(c => c) : ['neutral'],
      color: row.color ? row.color.split(',')[0].trim() : 'neutral',
      rarity: parseInt(row.rarity || 1),
      type: row.type || 'unit',
      isToken: (parseInt(row.deck_limit || row.max_copies) || 0) === 0, // 制限0ならトークン
      cost: parseInt(row.cost) || 0,
      attack: parseInt(row.atk || row.attack) || 0,
      hp: parseInt(row.life || row.hp) || 0,
      keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
      
      // 旧実装との互換性
      abilityTrigger: firstAbility.trigger || 'none',
      abilityEffect: firstAbility.effect || '',
      abilityValue: isNaN(parseInt(firstAbility.value)) ? (firstAbility.value || '') : parseInt(firstAbility.value),
      
      // 新アビリティリスト
      abilities: abilities,
      
      flavorText: row.description || row.flavor_text || '',
      text: row.text || '',
      maxCopies: parseInt(row.deck_limit || row.max_copies) || 0,
    };
  });

  // シールドデータの構築（ターゲット指定と表示テキスト追加）
  const shields = shieldsRaw.filter(row => row.id).map(row => ({
    id: row.id,
    type: 'shield',
    name: row.name,
    durability: parseInt(row.life) || 1,
    skill: {
      id: `${row.id}_skill`,
      name: row.name + 'のスキル',
      effectType: row.effect || 'none',
      effectValue: isNaN(parseInt(row.value)) ? (row.value ? row.value.trim() : '') : parseInt(row.value),
      target: row.target || '',
      text: row.text || '',
      description: row.description || ''
    }
  }));

  const cardMap = {};
  for (const card of cards) {
    cardMap[card.id] = card;
  }

  return { cards, cardMap, shields, keywordMap };
}

module.exports = { loadAllData };
