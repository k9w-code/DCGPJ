'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Google Spreadsheet CSV Export URLs
const CARDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=0';
const SHIELDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=108587861';
const KEYWORDS_URL = 'https://docs.google.com/spreadsheets/d/1R6-XpyHV_WiFIWKx6kSRNf-A7LjRrRhrrhK1FKMaTTw/export?format=csv&gid=1171970069';

function fetchRawData(url) {
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
        response.on('end', () => resolve(data));
      }
    }).on('error', reject);
  });
}

async function fetchCSV(url) {
  const data = await fetchRawData(url);
  return parse(data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });
}

function saveLocalCSV(filename, content) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[DataLoader] Successfully saved to local file: ${filename}`);
    return true;
  } catch (e) {
    console.error(`[DataLoader] Failed to save local file: ${filename}`, e.message);
    return false;
  }
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

async function loadAllData(options = {}) {
  const forceSync = options.sync || false;
  console.log(`Loading master data... (forceSync: ${forceSync})`);
  
  let cardsRaw, shieldsRaw, keywordsRaw;

  if (forceSync) {
    console.log('[DataLoader] Force fetching from spreadsheets and updating local files...');
    // 同期モード: URLから取得し、成功したものをローカルに保存
    const [cData, sData, kData] = await Promise.all([
      fetchRawData(CARDS_URL),
      fetchRawData(SHIELDS_URL),
      fetchRawData(KEYWORDS_URL),
    ]);
    
    // 保存
    saveLocalCSV('cards.csv', cData);
    saveLocalCSV('shields.csv', sData);
    saveLocalCSV('keywords.csv', kData);
    
    // パース
    cardsRaw = parse(cData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
    shieldsRaw = parse(sData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
    keywordsRaw = parse(kData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
  } else {
    // 通常モード: ローカル優先、なければURL
    cardsRaw = loadLocalCSV('cards.csv') || await fetchCSV(CARDS_URL);
    shieldsRaw = loadLocalCSV('shields.csv') || await fetchCSV(SHIELDS_URL);
    keywordsRaw = loadLocalCSV('keyword_master.csv') || loadLocalCSV('keywords.csv') || await fetchCSV(KEYWORDS_URL);
  }

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
        description: row.description || '',
        condition: row.condition ? row.condition.trim() : ''
      });
    }

    const trigger2 = row.trigger2;
    const effect2 = row.effect2;
    const valueStr2 = row.value2;
    if (trigger2 && trigger2.trim() !== '' && trigger2.trim() !== 'none') {
      abilities.push({
        id: `${row.id}_ability2`,
        trigger: trigger2.trim(),
        effect: effect2 ? effect2.trim() : '',
        value: isNaN(parseInt(valueStr2)) ? (valueStr2 ? valueStr2.trim() : '') : parseInt(valueStr2),
        target: row.target2 ? row.target2.trim() : '',
        text: '',
        description: '',
        condition: ''
      });
    }

    const firstAbility = abilities.length > 0 ? abilities[0] : {};
    
    // 数値データの安全なパース
    const cost = parseInt(row.cost || row.コスト || 0);
    const attack = parseInt(row.atk || row.attack || row.攻撃力 || 0);
    const hp = parseInt(row.life || row.hp || row.体力 || 0);
    const rarity = parseInt(row.rarity || row.レアリティ || 1);
    const deckLimit = parseInt(row.deck_limit || row.max_copies || row.枚数制限 || 3);
    
    return {
      id: row.id,
      artId: row.art_id || row.id,
      name: row.name,
      colors: row.color ? row.color.split(',').map(c => c.trim()).filter(c => c) : ['neutral'],
      color: row.color ? row.color.split(',')[0].trim() : 'neutral',
      rarity: isNaN(rarity) ? 1 : rarity,
      type: row.type || 'unit',
      isToken: isNaN(deckLimit) || deckLimit === 0, // 制限0ならトークン
      cost: isNaN(cost) ? 0 : cost,
      attack: isNaN(attack) ? 0 : attack,
      hp: isNaN(hp) ? 0 : hp,
      keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
      
      // 旧実装との互換性
      abilityTrigger: firstAbility.trigger || 'none',
      abilityEffect: firstAbility.effect || '',
      abilityValue: isNaN(parseInt(firstAbility.value)) ? (firstAbility.value || '') : parseInt(firstAbility.value),
      
      // 新アビリティリスト
      abilities: abilities,
      
      flavorText: row.description || row.flavor_text || '',
      text: row.text || '',
      maxCopies: isNaN(deckLimit) ? 3 : deckLimit,
    };
  });

  // シールドデータの構築（ターゲット指定と表示テキスト追加）
  const shields = shieldsRaw.filter(row => row.id).map(row => {
    const rarity = parseInt(row.rarity || row.レアリティ || 1);
    const life = parseInt(row.durability || row.life || row.hp || 1);
    
    return {
      id: row.id,
      type: 'shield',
      name: row.name,
      rarity: isNaN(rarity) ? 1 : rarity,
      durability: isNaN(life) ? 1 : life,
      skill: {
        id: `${row.id}_skill`,
        name: row.name + 'のスキル',
        effectType: row.effect || 'none',
        effectValue: isNaN(parseInt(row.value)) ? (row.value ? row.value.trim() : '') : parseInt(row.value),
        target: row.target || '',
        text: row.text || '',
        description: row.description || ''
      }
    };
  });

  const cardMap = {};
  for (const card of cards) {
    cardMap[card.id] = card;
  }

  return { cards, cardMap, shields, keywordMap };
}

module.exports = { loadAllData };
