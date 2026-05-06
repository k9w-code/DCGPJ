const fs = require('fs');

// 1. server.js 修正: セッション再開機能の追加
let s = fs.readFileSync('server.js', 'utf8');
const reconnectCode = `
  // セッションの復旧（ページ遷移時のソケット更新）
  socket.on('reconnect_session', (data) => {
    if (!data.sessionId) return;
    const session = sessions.get(data.sessionId);
    if (session) {
      const room = rooms.get(session.roomId);
      if (room) {
        sessionId = data.sessionId;
        currentRoom = session.roomId;
        socket.join(currentRoom);
        
        // プレイヤーのソケットを最新のものに更新
        const player = room.players[session.playerIndex];
        if (player) {
          player.socket = socket;
          console.log(\`🔄 セッション復旧: \${player.name} (Room: \${currentRoom})\`);
        }
        
        socket.emit('session_reconnected', { roomId: currentRoom, playerIndex: session.playerIndex });
      }
    }
  });
`;
if (!s.includes('reconnect_session')) {
    s = s.replace("socket.on('create_room', (data) => {", reconnectCode + "\n  socket.on('create_room', (data) => {");
    fs.writeFileSync('server.js', s, 'utf8');
}

// 2. deck-builder.js 修正: セッション再開の発行
let db = fs.readFileSync('public/js/deck-builder.js', 'utf8');
const dbReconnect = `
// セッション復旧の試行
const sessionId = localStorage.getItem('dcg_session_id');
if (sessionId) {
  socket.emit('reconnect_session', { sessionId });
}

socket.on('session_reconnected', (data) => {
  console.log('✅ セッションが復旧しました:', data);
});
`;
if (!db.includes('reconnect_session')) {
    db = db.replace('const socket = io();', 'const socket = io();\n' + dbReconnect);
    fs.writeFileSync('public/js/deck-builder.js', db, 'utf8');
}

// 3. lobby.js でのセッション保存
let lb = fs.readFileSync('public/js/lobby.js', 'utf8');
if (!lb.includes('dcg_session_id')) {
    // room_created や room_joined のタイミングで保存
    lb = lb.replace("localStorage.setItem('dcg_player_name', name);", 
                    "localStorage.setItem('dcg_player_name', name);");
    
    // sessionId を保存する箇所を探す
    lb = lb.replace("localStorage.setItem('dcg_session_id', data.sessionId);", ""); // 重複防止
    lb = lb.replace("socket.on('room_created', (data) => {", "socket.on('room_created', (data) => {\n    localStorage.setItem('dcg_session_id', data.sessionId);");
    lb = lb.replace("socket.on('room_joined', (data) => {", "socket.on('room_joined', (data) => {\n    localStorage.setItem('dcg_session_id', data.sessionId);");
    
    fs.writeFileSync('public/js/lobby.js', lb, 'utf8');
}

console.log('Session persistence logic added with correct paths.');
