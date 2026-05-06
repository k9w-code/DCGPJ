// GameState.js - \u30b2\u30fc\u30e0\u72b6\u614b\u7ba1\u7406\uff083\u30ec\u30fc\u30f3\u00d7\u524d\u5f8c\u5217\uff09
'use strict';

const NUM_LANES = 3;
const ROWS = ['front', 'back']; // \u524d\u5217\u30fb\u5f8c\u5217
const INITIAL_HAND_SIZE = 4;
const MAX_HAND_SIZE = 7;
const SP_PER_TURN = 3;
const FIRST_TURN_SP = 4;
const DECK_SIZE = 40;
const MAX_TRIBE_LEVEL = 9;
const NUM_SHIELDS = 3;

function createBoard() {
  // { front: [null, null, null], back: [null, null, null] }
  return {
    front: new Array(NUM_LANES).fill(null),
    back: new Array(NUM_LANES).fill(null),
  };
}

function createPlayerState(playerId, playerName, isAI = false, avatar = '\ud83e\udd16') {
  return {
    id: playerId,
    name: playerName,
    isAI: isAI,
    avatar: avatar,
    deck: [],
    hand: [],
    board: createBoard(),    // \u524d\u52173 + \u5f8c\u52173 = 6\u30b9\u30ed\u30c3\u30c8
    shields: [],
    sp: 0,
    tribeLevels: {
      red: 0, blue: 0, green: 0, white: 0, black: 0,
    },
    graveyard: [],
    totalShieldDurability: 0,
    shieldsDestroyed: 0,
    cardsPlayedThisTurn: 0,
    friendlyDeathsThisTurn: 0,
    spModifiers: 0,
  };
}

function createUnitInstance(cardData, ownerId) {
  return {
    instanceId: `${cardData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    cardId: cardData.id,
    artId: cardData.artId || cardData.id,
    name: cardData.name,
    type: 'unit', // \u8a73\u7d30\u8868\u793a\u7528\u306b\u30bf\u30a4\u30d7\u3092\u660e\u793a
    color: cardData.color,
    cost: cardData.cost,
    baseAttack: cardData.attack,
    baseHp: cardData.hp,
    currentAttack: cardData.attack,
    currentHp: cardData.hp,
    maxHp: cardData.hp,
    keywords: [...cardData.keywords],
    abilityTrigger: cardData.abilityTrigger,
    abilityEffect: cardData.abilityEffect,
    abilityValue: cardData.abilityValue,
    // \u65b0\u30a2\u30d3\u30ea\u30c6\u30a3\u30ea\u30b9\u30c8\uff08\u914d\u5217\u5185\u306e\u5404\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3082\u8907\u88fd\uff09
    abilities: cardData.abilities ? cardData.abilities.map(a => ({...a})) : [],
    rarity: cardData.rarity || 1,
    flavorText: cardData.flavorText || '',
    text: cardData.text || '',
    ownerId,
    canAttack: false,
    hasActed: false,
    barrierActive: false,
    endureActive: false,
    stealthActive: false,
    summonedThisTurn: true,
    modifiers: [],
    silenced: false,
  };
}

function createShieldInstance(shieldData) {
  return {
    id: shieldData.id,
    artId: shieldData.artId || shieldData.id,
    type: 'shield',
    name: shieldData.name,
    skillId: shieldData.skillId,
    skill: shieldData.skill,
    rarity: shieldData.rarity || 1,
    maxDurability: shieldData.durability,
    currentDurability: shieldData.durability,
    destroyed: false,
  };
}

function createGameState(player1, player2) {
  return {
    gameId: `game_${Date.now()}`,
    players: {
      [player1.id]: player1,
      [player2.id]: player2,
    },
    playerOrder: [player1.id, player2.id],
    currentPlayerIndex: 0,
    turnNumber: 1,
    phase: 'not_started',
    winner: null,
    logs: [],
    isFirstTurn: { [player1.id]: true, [player2.id]: true },
  };
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function drawCards(playerState, cardMap, count) {
  const drawn = [];
  console.log(`[GameState] ${playerState.name}: Drawing ${count} cards. Current hand: ${playerState.hand.length}`);
  let drawnCount = 0;
  while (drawnCount < count && playerState.deck.length > 0) {
    const cardId = playerState.deck.shift();
    const cardData = cardMap[cardId];
    if (cardData) {
      playerState.hand.push({ ...cardData });
      drawn.push(cardData);
      console.log(`[GameState] ${playerState.name}: Drew ${cardData.name} (Hand: ${playerState.hand.length})`);
      drawnCount++;
    } else {
      console.warn(`[GameState] ${playerState.name}: Invalid card ID in deck: ${cardId}`);
    }
  }
  if (drawnCount < count && playerState.deck.length === 0) {
    console.log(`[GameState] ${playerState.name}: DECK OUT!`);
    return { drawn, deckOut: true };
  }
  return { drawn, deckOut: false };
}

function getCurrentPlayer(gameState) {
  const id = gameState.playerOrder[gameState.currentPlayerIndex];
  return gameState.players[id];
}

function getOpponentPlayer(gameState) {
  const idx = gameState.currentPlayerIndex === 0 ? 1 : 0;
  const id = gameState.playerOrder[idx];
  return gameState.players[id];
}

// \u30d8\u30eb\u30d1\u30fc: \u76e4\u9762\u306e\u5168\u30e6\u30cb\u30c3\u30c8\u3092\u8d70\u67fb
function forEachUnit(board, callback) {
  for (const row of ROWS) {
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const unit = board[row][lane];
      if (unit) callback(unit, row, lane);
    }
  }
}

// \u30d8\u30eb\u30d1\u30fc: \u76e4\u9762\u306b\u30e6\u30cb\u30c3\u30c8\u304c\u3044\u308b\u304b
function getBoardUnit(board, row, lane) {
  return board[row] && board[row][lane] ? board[row][lane] : null;
}

// \u30d8\u30eb\u30d1\u30fc: \u30e9\u30a4\u30d5\u8a08\u7b97 (\u30b7\u30fc\u30eb\u30c9\u8010\u4e45\u5024\u306e\u5408\u8a08 + 1)
function calculateLife(playerState) {
  let shieldSum = 0;
  for (const shield of playerState.shields) {
    if (!shield.destroyed) {
      shieldSum += shield.currentDurability;
    }
  }
  return shieldSum + 1;
}

module.exports = {
  NUM_LANES,
  ROWS,
  INITIAL_HAND_SIZE,
  MAX_HAND_SIZE,
  SP_PER_TURN,
  FIRST_TURN_SP,
  DECK_SIZE,
  MAX_TRIBE_LEVEL,
  NUM_SHIELDS,
  createBoard,
  createPlayerState,
  createUnitInstance,
  createShieldInstance,
  createGameState,
  shuffleDeck,
  drawCards,
  getCurrentPlayer,
  getOpponentPlayer,
  forEachUnit,
  getBoardUnit,
  calculateLife,
};
