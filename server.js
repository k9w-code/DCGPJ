// server.js - Express + Socket.IO サーバー
'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const { loadAllData } = require('./game/DataLoader');
const GameEngine = require('./game/GameEngine');
const AIPlayer = require('./game/AIPlayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// マスターデータ読み込み
let gameData;

async function initServer() {
  try {
    gameData = await loadAllData();
    console.log(`✅ データ読み込み完了: カード${gameData.cards.length}枚, シールド${gameData.shields.length}種`);
    
    // サーバー起動
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🎮 DCG テストプレイサーバー起動: http://0.0.0.0:${PORT}\n`);
    });
  } catch (err) {
    console.error('❌ データ読み込みエラー:', err);
    process.exit(1);
  }
}
initServer();

// カードデータAPI
app.get('/api/cards', (req, res) => res.json(gameData.cards));
app.get('/api/shields', (req, res) => res.json(gameData.shields));
app.get('/api/keywords', (req, res) => res.json(gameData.keywordMap));

// マスターデータ再読み込みAPI
app.post('/api/reload', async (req, res) => {
  try {
    console.log('🔄 マスターデータのリロードを開始します...');
    const newData = await loadAllData();
    gameData = newData;
    console.log(`✅ リロード完了: カード${gameData.cards.length}枚, シールド${gameData.shields.length}種`);
    res.json({ success: true, message: 'Master data reloaded successfully', counts: { cards: gameData.cards.length, shields: gameData.shields.length } });
  } catch (err) {
    console.error('❌ リロードエラー:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ルーム管理
const rooms = new Map();
// sessionId → { roomId, playerIndex } のマッピング（ページ遷移を跨ぐ）
const sessions = new Map();

// デッキ自動構築（テスト用）
function buildRandomDeck(cardPool, color1, color2) {
  const validCards = cardPool.filter(c => c.color === color1 || c.color === color2);
  const deck = [];
  for (const card of validCards) {
    const copies = Math.min(card.maxCopies, 3);
    for (let i = 0; i < copies; i++) {
      deck.push(card.id);
    }
  }
  while (deck.length > 40) {
    deck.splice(Math.floor(Math.random() * deck.length), 1);
  }
  while (deck.length < 40) {
    const randomCard = validCards[Math.floor(Math.random() * validCards.length)];
    deck.push(randomCard.id);
  }
  return deck;
}

function getRandomShields(count) {
  const shuffled = [...gameData.shields].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(s => s.id);
}

function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

io.on('connection', (socket) => {
  console.log(`🔌 接続: ${socket.id}`);
  let sessionId = null;
  let currentRoom = null;

  // セッション復帰
  socket.on('restore_session', (data) => {
    sessionId = data.sessionId;
    const session = sessions.get(sessionId);
    if (session) {
      currentRoom = session.roomId;
      const room = rooms.get(currentRoom);
      if (room) {
        // プレイヤーのsocketを更新
        const player = room.players[session.playerIndex];
        if (player) {
          player.socket = socket;
          socket.join(currentRoom);
          console.log(`🔄 セッション復帰: ${player.name} (${sessionId.slice(0, 8)}...)`);

          // ゲームが開始済みなら状態を送信
          if (room.engine) {
            const playerId = player.id;
            const view = room.engine.getPlayerView(playerId);
            // 常に現在の盤面状態を先に送る (背景描画用)
            socket.emit('game_state', view);
            
            // マリガン未完了の場合のみ、追加でマリガン指示を送る
            if (room.engine.gameState.phase === 'mulligan' && !player.mulliganDone) {
              socket.emit('mulligan_phase', { hand: view.me.hand });
            }
          }
          socket.emit('session_restored', { sessionId, roomId: currentRoom, playerId: player.id });
        }
      }
    } else {
      socket.emit('session_invalid');
    }
  });

  // ルーム一覧取得
  socket.on('get_rooms', () => {
    const roomList = [];
    for (const [roomId, room] of rooms) {
      if (room.players.length < 2 && room.status === 'waiting') {
        roomList.push({
          roomId,
          name: room.name,
          hostName: room.players[0]?.name || '???',
          mode: room.mode,
        });
      }
    }
    socket.emit('room_list', roomList);
  });

  // ルーム作成
  socket.on('create_room', (data) => {
    const roomId = `room_${Date.now()}`;
    sessionId = generateSessionId();

    const playerId = `player_${sessionId.slice(0, 8)}`;
    const playerObj = {
      id: playerId,
      name: data.playerName || 'プレイヤー1',
      socket: socket,
      deck: null,
      shields: null,
      mulliganDone: false,
    };

    const room = {
      roomId,
      name: data.roomName || `${playerObj.name}の部屋`,
      mode: data.mode || 'pvp',
      players: [playerObj],
      status: 'waiting',
      engine: null,
    };
    rooms.set(roomId, room);

    sessions.set(sessionId, { roomId, playerIndex: 0 });
    currentRoom = roomId;
    socket.join(roomId);

    socket.emit('room_created', { roomId, playerId, sessionId });
    console.log(`🏠 ルーム作成: ${roomId} by ${playerObj.name}`);

    // PvE / 観戦モードならAIを追加
    if (data.mode === 'pve' || data.mode === 'spectate') {
      const aiId = `ai_${Date.now()}`;
      const aiPlayer = {
        id: aiId,
        name: 'NPC',
        socket: null,
        deck: null,
        shields: null,
        mulliganDone: false,
        isAI: true,
        ai: new AIPlayer(aiId),
      };
      room.players.push(aiPlayer);

      if (data.mode === 'spectate') {
        playerObj.isAI = true;
        playerObj.ai = new AIPlayer(playerId);
      }

      socket.emit('room_ready', { roomId, mode: data.mode });
    }
  });

  // ルーム参加
  socket.on('join_room', (data) => {
    const room = rooms.get(data.roomId);
    if (!room || room.players.length >= 2) {
      socket.emit('error_msg', { message: 'ルームに参加できません' });
      return;
    }

    sessionId = generateSessionId();
    const playerId = `player_${sessionId.slice(0, 8)}`;
    const playerObj = {
      id: playerId,
      name: data.playerName || 'プレイヤー2',
      socket: socket,
      deck: null,
      shields: null,
      mulliganDone: false,
    };

    room.players.push(playerObj);
    sessions.set(sessionId, { roomId: data.roomId, playerIndex: 1 });
    currentRoom = data.roomId;
    socket.join(data.roomId);

    socket.emit('room_joined', { roomId: data.roomId, playerId, sessionId });
    io.to(data.roomId).emit('room_ready', { roomId: data.roomId, mode: room.mode });
    console.log(`👤 ルーム参加: ${data.roomId} - ${playerObj.name}`);
  });

  // デッキ提出
  socket.on('submit_deck', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const session = sessions.get(sessionId);
    if (!session) return;
    const player = room.players[session.playerIndex];
    if (!player) return;

    player.deck = data.deckCardIds;
    player.shields = data.shieldIds;

    console.log(`📋 デッキ提出: ${player.name} (カード${player.deck.length}枚, シールド${player.shields.length}枚)`);

    // AI用デッキ自動構築
    for (const p of room.players) {
      if (p.isAI && !p.deck) {
        const colors = ['red', 'blue', 'green', 'white', 'black'];
        const c1 = colors[Math.floor(Math.random() * colors.length)];
        let c2 = colors[Math.floor(Math.random() * colors.length)];
        while (c2 === c1) c2 = colors[Math.floor(Math.random() * colors.length)];
        p.deck = buildRandomDeck(gameData.cards, c1, c2);
        p.shields = getRandomShields(3);
        p.mulliganDone = true;
        console.log(`🤖 AIデッキ構築: ${c1}/${c2}`);
      }
    }

    // 両者提出完了チェック
    if (room.players.every(p => p.deck && p.shields)) {
      startGame(room);
    } else {
      socket.emit('waiting_opponent_deck');
    }
  });

  // マリガン
  socket.on('mulligan_decision', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.engine) return;

    const session = sessions.get(sessionId);
    if (!session) return;
    const player = room.players[session.playerIndex];
    if (!player || player.mulliganDone) return;

    room.engine.processMulligan(player.id, data.doMulligan);
    player.mulliganDone = true;

    if (room.players.every(p => p.mulliganDone)) {
      room.engine.gameState.phase = 'main';
      room.engine.startTurn();
      sendGameStateToAll(room);

      // 先攻がAIならAIターン開始
      const currentId = room.engine.gameState.playerOrder[room.engine.gameState.currentPlayerIndex];
      const currentPlayerObj = room.players.find(p => p.id === currentId);
      if (currentPlayerObj && currentPlayerObj.isAI) {
        setTimeout(() => executeAITurn(room, currentPlayerObj), 1200);
      }
    } else {
      socket.emit('waiting_mulligan');
    }
  });

  // ゲームアクション
  socket.on('game_action', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.engine) return;

    const session = sessions.get(sessionId);
    if (!session) return;
    const player = room.players[session.playerIndex];
    if (!player) return;

    let result;
    switch (data.action) {
      case 'raise_tribe':
        result = room.engine.raiseTribeLevel(player.id, data.color);
        break;
      case 'play_card':
        result = room.engine.playCard(player.id, data.handIndex, data.targetRow, data.targetLane);
        break;
      case 'attack':
        result = room.engine.attackWithUnit(player.id, data.attackerRow, data.attackerLane, data.targetInfo);
        break;
      case 'activate_ability':
        result = room.engine.activateUnitAbility(player.id, data.unitRow, data.unitLane, data.abilityIndex);
        break;
      case 'end_turn':
        result = room.engine.endTurn(player.id);
        break;
      case 'surrender':
        result = room.engine.surrender(player.id);
        break;
      default:
        result = { error: '不明なアクション' };
    }

    if (result && result.error) {
      console.warn(`⚠️ アクションエラー [${player.name}]: ${result.error}`, { action: data.action, data });
      socket.emit('error_msg', { message: result.error });
      // エラー時も盤面情報を再送してクライアントと同期させる
      sendGameStateToAll(room);
    } else {
      sendGameStateToAll(room);

      // AIのターンチェック
      if (room.engine.gameState.phase === 'main') {
        const currentId = room.engine.gameState.playerOrder[room.engine.gameState.currentPlayerIndex];
        const currentPlayerObj = room.players.find(p => p.id === currentId);
        if (currentPlayerObj && currentPlayerObj.isAI) {
          setTimeout(() => executeAITurn(room, currentPlayerObj), 800);
        }
      }
    }
  });

  // 切断
  socket.on('disconnect', () => {
    console.log(`🔌 切断: ${socket.id}`);
    // ルームは残しておく（再接続を許可）
  });
});

// ゲーム開始処理
function startGame(room) {
  const engine = new GameEngine(gameData);
  room.engine = engine;
  room.status = 'playing';

  const p1 = room.players[0];
  const p2 = room.players[1];

  engine.initGame(
    { id: p1.id, name: p1.name, deckCardIds: p1.deck, shieldIds: p1.shields },
    { id: p2.id, name: p2.name, deckCardIds: p2.deck, shieldIds: p2.shields }
  );

  console.log(`🎮 ゲーム開始: ${p1.name} vs ${p2.name}`);

  // AIマリガン
  for (const p of room.players) {
    if (p.isAI) {
      const hand = engine.gameState.players[p.id].hand;
      const doMulligan = p.ai.decideMulligan(hand);
      engine.processMulligan(p.id, doMulligan);
      p.mulliganDone = true;
    }
  }

  // 通知: ゲーム開始 → ゲーム画面へ遷移を促す
  for (const p of room.players) {
    if (!p.isAI && p.socket) {
      p.socket.emit('game_started', { roomId: room.roomId });
    }
  }
}

// AIターン実行
function executeAITurn(room, aiPlayerObj) {
  if (!room.engine || room.engine.gameState.phase === 'game_over') return;

  const view = room.engine.getPlayerView(aiPlayerObj.id);
  const actions = aiPlayerObj.ai.decideTurnActions(view);

  let delay = 0;
  for (const action of actions) {
    setTimeout(() => {
      if (!room.engine || room.engine.gameState.phase === 'game_over') return;

      let result;
      switch (action.type) {
        case 'raise_tribe':
          result = room.engine.raiseTribeLevel(aiPlayerObj.id, action.color);
          break;
        case 'play_card':
          result = room.engine.playCard(aiPlayerObj.id, action.handIndex, action.targetRow, action.targetLane);
          break;
        case 'attack':
          result = room.engine.attackWithUnit(aiPlayerObj.id, action.attackerRow, action.attackerLane, action.targetInfo);
          break;
        case 'end_turn':
          result = room.engine.endTurn(aiPlayerObj.id);
          break;
      }

      sendGameStateToAll(room);

      if (action.type === 'end_turn' && room.engine.gameState.phase === 'main') {
        const nextId = room.engine.gameState.playerOrder[room.engine.gameState.currentPlayerIndex];
        const nextPlayer = room.players.find(p => p.id === nextId);
        if (nextPlayer && nextPlayer.isAI) {
          setTimeout(() => executeAITurn(room, nextPlayer), 1000);
        }
      }
    }, delay);
    delay += 600;
  }
}

// ゲーム状態送信
function sendGameStateToAll(room) {
  if (!room.engine) return;
  for (const p of room.players) {
    if (p.socket && p.socket.connected) {
      const view = room.engine.getPlayerView(p.id);
      p.socket.emit('game_state', view);
    }
  }
}

// -----
// サーバー起動は initServer() 内で行うためここから削除しました
// -----
