// GameState.js - ゲーム状態管理（3レーン×前後列）
'use strict';

const NUM_LANES = 3;
const ROWS = ['front', 'back']; // 前列・後列
const INITIAL_HAND_SIZE = 4;
const MAX_HAND_SIZE = 7;
const SP_PER_TURN = 3;
const FIRST_TURN_SECOND_PLAYER_SP = 4;
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

function createPlayerState(playerId, playerName) {
  return {
    id: playerId,
    name: playerName,
    deck: [],
    hand: [],
    board: createBoard(),    // 前列3 + 後列3 = 6スロット
    shields: [],
    sp: 0,
    tribeLevels: {
      red: 0, blue: 0, green: 0, white: 0, black: 0,
    },
    graveyard: [],
    totalShieldDurability: 0,
    shieldsDestroyed: 0,
  };
}

function createUnitInstance(cardData, ownerId) {
  return {
    instanceId: `${cardData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    cardId: cardData.id,
    artId: cardData.artId || cardData.id,
    name: cardData.name,
    type: 'unit', // 詳細表示用にタイプを明示
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
    ownerId,
    canAttack: false,
    hasActed: false,
    barrierActive: false,
    endureActive: false,
    stealthActive: false,
    summonedThisTurn: true,
  };
}

function createShieldInstance(shieldData) {
  return {
    id: shieldData.id,
    type: 'shield',
    name: shieldData.name,
    skillId: shieldData.skillId,
    skill: shieldData.skill,
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
  for (let i = 0; i < count; i++) {
    if (playerState.deck.length === 0) {
      return { drawn, deckOut: true };
    }
    if (playerState.hand.length >= MAX_HAND_SIZE) break;
    const cardId = playerState.deck.shift();
    const cardData = cardMap[cardId];
    if (cardData) {
      playerState.hand.push({ ...cardData });
      drawn.push(cardData);
    }
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

// ヘルパー: 盤面の全ユニットを走査
function forEachUnit(board, callback) {
  for (const row of ROWS) {
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const unit = board[row][lane];
      if (unit) callback(unit, row, lane);
    }
  }
}

// ヘルパー: 盤面にユニットがいるか
function getBoardUnit(board, row, lane) {
  return board[row] && board[row][lane] ? board[row][lane] : null;
}

// ヘルパー: ライフ計算 (シールド耐久値の合計 + 1)
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
  FIRST_TURN_SECOND_PLAYER_SP,
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
