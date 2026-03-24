// lobby.js - ロビー画面のクライアントロジック
'use strict';

const socket = io();

if (window.audioManager) {
  window.audioManager.playBGM('lobby');
}

let selectedMode = 'pve';

// モード選択
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedMode = card.dataset.mode;
    document.getElementById('pvp-rooms').style.display = selectedMode === 'pvp' ? 'block' : 'none';
    if (selectedMode === 'pvp') socket.emit('get_rooms');
  });
});

// ルーム作成
document.getElementById('btn-create').addEventListener('click', () => {
  const playerName = document.getElementById('player-name').value || 'プレイヤー';
  const roomName = document.getElementById('room-name').value || '';
  
  socket.emit('create_room', {
    playerName,
    roomName: roomName || `${playerName}の部屋`,
    mode: selectedMode,
  });

  document.getElementById('create-section').style.display = 'none';
  document.getElementById('status-section').style.display = 'block';
  document.getElementById('status-text').textContent = 'ルーム作成中...';
});

// ルーム一覧
document.getElementById('btn-refresh')?.addEventListener('click', () => socket.emit('get_rooms'));

socket.on('room_list', (roomItems) => {
  const list = document.getElementById('room-list');
  list.innerHTML = '';
  if (roomItems.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:13px;">参加可能なルームがありません</div>';
    return;
  }
  roomItems.forEach(room => {
    const item = document.createElement('div');
    item.className = 'room-item';
    item.innerHTML = `
      <div>
        <div style="font-weight:600;">${room.name}</div>
        <div style="font-size:11px;color:var(--text-dim);">ホスト: ${room.hostName}</div>
      </div>
      <button class="btn btn-sm btn-primary">参加</button>
    `;
    item.querySelector('button').addEventListener('click', () => {
      const playerName = document.getElementById('player-name').value || 'プレイヤー2';
      socket.emit('join_room', { roomId: room.roomId, playerName });
      document.getElementById('status-section').style.display = 'block';
      document.getElementById('status-text').textContent = 'ルームに参加中...';
    });
    list.appendChild(item);
  });
});

// ルーム作成完了
socket.on('room_created', (data) => {
  sessionStorage.setItem('sessionId', data.sessionId);
  sessionStorage.setItem('playerId', data.playerId);
  sessionStorage.setItem('roomId', data.roomId);
  document.getElementById('status-text').textContent = 
    selectedMode === 'pvp' ? '対戦相手を待っています...' : 'ゲーム準備中...';
});

// ルーム参加完了
socket.on('room_joined', (data) => {
  sessionStorage.setItem('sessionId', data.sessionId);
  sessionStorage.setItem('playerId', data.playerId);
  sessionStorage.setItem('roomId', data.roomId);
});

// ルーム準備完了 → デッキ構築画面へ
socket.on('room_ready', (data) => {
  sessionStorage.setItem('gameMode', data.mode);
  window.location.href = '/deck-builder.html';
});

socket.on('error_msg', (data) => alert(data.message));
