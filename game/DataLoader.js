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
    const buffer = fs.readFileSync(filePath);
    
    let data;
    try {
      // \u307e\u305a\u306f UTF-8 \u3067\u30c7\u30b3\u30fc\u30c9\u3092\u8a66\u307f\u308b\uff08fatal: true \u3067\u4e0d\u6b63\u306a\u30d0\u30a4\u30c8\u3092\u691c\u77e5\uff09
      data = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      // UTF-8 \u3067\u5931\u6557\u3057\u305f\u5834\u5408\u306f Shift-JIS \u3092\u8a66\u884c
      console.warn(`[DataLoader] UTF-8 decoding failed for ${filename}, falling back to Shift-JIS...`);
      data = new TextDecoder('shift-jis').decode(buffer);
    }

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
    // \u540c\u671f\u30e2\u30fc\u30c9: URL\u304b\u3089\u53d6\u5f97\u3057\u3001\u6210\u529f\u3057\u305f\u3082\u306e\u3092\u30ed\u30fc\u30ab\u30eb\u306b\u4fdd\u5b58
    const [cData, sData, kData] = await Promise.all([
      fetchRawData(CARDS_URL),
      fetchRawData(SHIELDS_URL),
      fetchRawData(KEYWORDS_URL),
    ]);
    
    // \u4fdd\u5b58
    saveLocalCSV('cards.csv', cData);
    saveLocalCSV('shields.csv', sData);
    saveLocalCSV('keywords.csv', kData);
    
    // \u30d1\u30fc\u30b9
    cardsRaw = parse(cData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
    shieldsRaw = parse(sData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
    keywordsRaw = parse(kData, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true });
  } else {
    // \u901a\u5e38\u30e2\u30fc\u30c9: \u30ed\u30fc\u30ab\u30eb\u512a\u5148\u3001\u306a\u3051\u308c\u3070URL
    cardsRaw = loadLocalCSV('cards.csv') || await fetchCSV(CARDS_URL);
    shieldsRaw = loadLocalCSV('shields.csv') || await fetchCSV(SHIELDS_URL);
    keywordsRaw = loadLocalCSV('keyword_master.csv') || loadLocalCSV('keywords.csv') || await fetchCSV(KEYWORDS_URL);
  }

  // \u30ad\u30fc\u30ef\u30fc\u30c9\u30de\u30b9\u30bf
  const keywordMap = {};
  for (const row of keywordsRaw) {
    if (!row.id) continue;
    keywordMap[row.id] = {
      id: row.id,
      name: row.name || row.id,
      description: row.description || ''
    };
  }

  // \u30ab\u30fc\u30c9\u30c7\u30fc\u30bf\u306e\u69cb\u7bc9
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
    const target2 = row.target2;

    // trigger2 \u304c 'none' \u307e\u305f\u306f\u7a7a\u6b04\u3067\u3082\u3001effect2 \u304c\u3042\u308c\u3070 trigger1 \u3092\u7d99\u627f\u3059\u308b
    if ((trigger2 && trigger2.trim() !== '' && trigger2.trim() !== 'none') || (effect2 && effect2.trim() !== '')) {
      const finalTrigger2 = (trigger2 && trigger2.trim() !== 'none' && trigger2.trim() !== '') ? trigger2.trim() : trigger.trim();
      abilities.push({
        id: `${row.id}_ability2`,
        trigger: finalTrigger2,
        effect: effect2 ? effect2.trim() : '',
        value: isNaN(parseInt(valueStr2)) ? (valueStr2 ? valueStr2.trim() : '') : parseInt(valueStr2),
        target: target2 ? target2.trim() : '',
        text: row.text2 ? row.text2.trim() : (row.text ? row.text.trim() : ''),
        description: row.description2 || '',
        condition: row.condition2 || ''
      });
    }

    const firstAbility = abilities.length > 0 ? abilities[0] : {};
    
    // \u6570\u5024\u30c7\u30fc\u30bf\u306e\u5b89\u5168\u306a\u30d1\u30fc\u30b9
    const cost = parseInt(row.cost || row.\u30b3\u30b9\u30c8 || 0);
    const attack = parseInt(row.atk || row.attack || row.\u653b\u6483\u529b || 0);
    const hp = parseInt(row.life || row.hp || row.\u4f53\u529b || 0);
    const rarity = parseInt(row.rarity || row.\u30ec\u30a2\u30ea\u30c6\u30a3 || 1);
    const deckLimit = parseInt(row.limit || row.deck_limit || row.max_copies || row.\u679a\u6570\u5236\u9650 || 3);
    
    return {
      id: row.id,
      artId: row.art_id || row.id,
      name: row.name,
      colors: row.color ? row.color.split(',').map(c => c.trim()).filter(c => c) : ['neutral'],
      color: row.color ? row.color.split(',')[0].trim() : 'neutral',
      rarity: isNaN(rarity) ? 1 : rarity,
      type: row.type || 'unit',
      isToken: isNaN(deckLimit) || deckLimit === 0, // \u5236\u96500\u306a\u3089\u30c8\u30fc\u30af\u30f3
      cost: isNaN(cost) ? 0 : cost,
      attack: isNaN(attack) ? 0 : attack,
      hp: isNaN(hp) ? 0 : hp,
      keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()).filter(k => k) : [],
      
      // \u65e7\u5b9f\u88c5\u3068\u306e\u4e92\u63db\u6027
      abilityTrigger: firstAbility.trigger || 'none',
      abilityEffect: firstAbility.effect || '',
      abilityValue: isNaN(parseInt(firstAbility.value)) ? (firstAbility.value || '') : parseInt(firstAbility.value),
      
      // \u65b0\u30a2\u30d3\u30ea\u30c6\u30a3\u30ea\u30b9\u30c8
      abilities: abilities,
      
      flavorText: row.description || row.flavor_text || row.flavor || row.desc || row.\u30d5\u30ec\u30fc\u30d0\u30fc\u30c6\u30ad\u30b9\u30c8 || row.\u8aac\u660e || '',
      text: row.text || row.\u30c6\u30ad\u30b9\u30c8 || row.ability_text || row.manual_text || '',
      maxCopies: isNaN(deckLimit) ? 3 : deckLimit,
      expansion: row.expansion || 'basic',
    };
  });

  // \u30b7\u30fc\u30eb\u30c9\u30c7\u30fc\u30bf\u306e\u69cb\u7bc9\uff08\u30bf\u30fc\u30b2\u30c3\u30c8\u6307\u5b9a\u3068\u8868\u793a\u30c6\u30ad\u30b9\u30c8\u8ffd\u52a0\uff09
  const shields = shieldsRaw.filter(row => row.id).map(row => {
    const rarity = parseInt(row.rarity || row.\u30ec\u30a2\u30ea\u30c6\u30a3 || 1);
    const life = parseInt(row.durability || row.life || row.hp || 1);
    
    const abilities = [];
    const effect1 = row.effect || 'none';
    if (effect1 !== 'none') {
      abilities.push({
        id: `${row.id}_ability1`,
        trigger: 'on_break',
        effect: effect1,
        value: isNaN(parseInt(row.value)) ? (row.value ? row.value.trim() : '') : parseInt(row.value),
        target: row.target || 'self',
        text: row.text || ''
      });
    }

    const effect2 = row.effect2 || 'none';
    if (effect2 !== 'none' && effect2 !== '') {
      abilities.push({
        id: `${row.id}_ability2`,
        trigger: 'on_break',
        effect: effect2,
        value: isNaN(parseInt(row.value2)) ? (row.value2 ? row.value2.trim() : '') : parseInt(row.value2),
        target: row.target2 || 'self',
        text: row.text2 || ''
      });
    }

    return {
      id: row.id,
      artId: row.art_id || row.id,
      type: 'shield',
      name: row.name,
      rarity: isNaN(rarity) ? 1 : rarity,
      durability: isNaN(life) ? 1 : life,
      abilities: abilities,
      text: row.text || '', // \u30c8\u30c3\u30d7\u30ec\u30d9\u30eb\u306b\u3082\u8ffd\u52a0
      // \u904e\u53bb\u306e\u30b3\u30fc\u30c9\u3068\u306e\u4e92\u63db\u6027\u306e\u305f\u3081\u306b skill \u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3082\u30e1\u30a4\u30f3\u306e\u30a2\u30d3\u30ea\u30c6\u30a3\u3067\u69cb\u7bc9
      skill: abilities.length > 0 ? {
        id: abilities[0].id,
        name: row.name + '\u306e\u30b9\u30ad\u30eb',
        effectType: abilities[0].effect,
        effectValue: abilities[0].value,
        target: abilities[0].target,
        text: row.text || '',
        description: row.description || ''
      } : null
    };
  });

  const cardMap = {};
  for (const card of cards) {
    cardMap[card.id] = card;
  }

  return { cards, cardMap, shields, keywordMap };
}

module.exports = { loadAllData };
