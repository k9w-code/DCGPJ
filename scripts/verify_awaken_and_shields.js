// scripts/verify_awaken_and_shields.js
// 覚醒(awaken)能力とシールドスキルの発動状況をトレース検証
'use strict';

const { loadAllData } = require('../game/DataLoader');
const GameEngine = require('../game/GameEngine');
const AIPlayer   = require('../game/AIPlayer');

async function verifyAwakenAndShields() {
  const gameData = await loadAllData({ sync: false });
  
  console.log('=== 覚醒キーワードを持つカード一覧 ===');
  const awakenCards = gameData.cards.filter(c => (c.keywords || []).some(k => k.startsWith('awaken')));
  awakenCards.forEach(c => {
    console.log(`[${c.color}] ${c.id} ${c.name} (cost ${c.cost}) - kw: ${c.keywords.join(',')} - text: ${c.text}`);
  });

  console.log('\n=== シールドスキル一覧 (basic) ===');
  const basicShields = gameData.shields.filter(s => (s.expansion || 'basic') === 'basic');
  basicShields.forEach(s => {
    console.log(`${s.id} ${s.name} (耐久:${s.durability}) - skill: ${s.skill ? s.skill.text : 'なし'}`);
  });
}

verifyAwakenAndShields().catch(console.error);
