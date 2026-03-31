'use strict';

const https = require('https');
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

async function loadAllData() {
  console.log('Fetching master data from Google Spreadsheets...');
  const [cardsRaw, shieldsRaw, keywordsRaw] = await Promise.all([
    fetchCSV(CARDS_URL),
    fetchCSV(SHIELDS_URL),
    fetchCSV(KEYWORDS_URL)
  ]);

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
    if (row.trigger && row.trigger.trim() !== '' && row.trigger.trim() !== 'none') {
      abilities.push({
        id: `${row.id}_ability`,
        trigger: row.trigger.trim(),
        effect: row.effect ? row.effect.trim() : '',
        value: parseInt(row.value) || 0,
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
      isToken: row.token_flag === 'y' || row.token_flag === '1' || row.token_flag === 'true',
      cost: parseInt(row.cost) || 0,
      attack: parseInt(row.atk || row.attack) || 0,
      hp: parseInt(row.life || row.hp) || 0,
      keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
      
      // 旧実装との互換性
      abilityTrigger: firstAbility.trigger || 'none',
      abilityEffect: firstAbility.effect || '',
      abilityValue: firstAbility.value || 0,
      
      // 新アビリティリスト
      abilities: abilities,
      
      flavorText: row.description || row.flavor_text || '',
      text: row.text || '',
      maxCopies: parseInt(row.deck_limit || row.max_copies) || 3,
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
      effectValue: parseInt(row.value) || 0,
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
