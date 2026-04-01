// server.js (Node.js 서버용 최종 복구본)
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname)); // index.html이 있는 폴더 제공

let rooms = {};

io.on('connection', (socket) => {
    // index.html에서 접속할 때 몰래 쥐어보낸 닉네임을 꺼냅니다.
    const clientNick = socket.handshake.query.nickname || '익명';
    console.log(`사용자 접속: ${socket.id} (닉네임: ${clientNick})`);

    // [복구됨] 방 생성: 사용자님의 원본처럼 문자열(roomCode)만 깔끔하게 받습니다.
    socket.on('setPeerId', (data) => {
        if (rooms[data.roomCode]) {
            rooms[data.roomCode].hostPeerId = data.peerId;
            io.to(data.roomCode).emit('lobbyUpdate', rooms[data.roomCode]);
            console.log(`✨ 방장 웜홀 개방: ${data.roomCode} (PeerID: ${data.peerId})`);
        }
    });

    socket.on('createRoom', (data) => {
        const roomCode = typeof data === 'string' ? data : data.roomCode;
        const requestedMax = data.maxPlayers || 5;
        rooms[roomCode] = { 
            host: socket.id, 
            players: [{ id: socket.id, name: clientNick, isHost: true }], 
            max: Math.min(5, requestedMax) // 문지기가 최대 5명의 규칙을 엄격히 지킵니다.
        };
        socket.join(roomCode);
        io.to(roomCode).emit('lobbyUpdate', rooms[roomCode]);
        console.log(`방 생성됨: ${roomCode} (방장: ${clientNick})`);
    });

    // [복구됨] 방 참가: 역시 원본의 규칙을 그대로 따릅니다.
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].players.length < rooms[roomCode].max) {
            socket.join(roomCode);
            rooms[roomCode].players.push({ id: socket.id, name: clientNick, isHost: false });
            io.to(roomCode).emit('lobbyUpdate', rooms[roomCode]);
            console.log(`방 참가함: ${roomCode} (참여자: ${clientNick})`);
        } else {
            socket.emit('errorMsg', '방이 가득 찼거나 존재하지 않습니다.');
        }
    });

    // [추가됨] 채팅 중계: 방 안의 모든 사람에게 닉네임과 메시지를 안전하게 배달합니다.
    socket.on('chat', (data) => {
        const roomCode = Array.from(socket.rooms)[1]; // 현재 속한 방 찾기
        if (roomCode) {
            io.to(roomCode).emit('chat', data);
        }
    });

    // [복구됨] AI 로봇 채우기: 방 이름이 정상적으로 인식되어 이제 버튼이 작동합니다.
    socket.on('fillWithAI', (roomCode) => {
        if (rooms[roomCode] && rooms[roomCode].host === socket.id) {
            let currentLen = rooms[roomCode].players.length;
            for(let i = currentLen; i < rooms[roomCode].max; i++) {
                rooms[roomCode].players.push({ id: `AI_${i}`, name: `AI (Bot)`, isHost: false, isBot: true });
            }
            io.to(roomCode).emit('lobbyUpdate', rooms[roomCode]);
        }
    });

    // [복구됨] 게임 시작 및 통신 릴레이
    socket.on('startGame', (roomCode) => {
        io.to(roomCode).emit('gameStarted', rooms[roomCode]);
    });

    // 방장의 물리 연산 결과를 참여자들에게 동기화 (이름: syncState)
    socket.on('hostStateUpdate', (data) => {
        socket.to(data.roomCode).emit('syncState', data.state);
    });

    // 참여자의 행동을 방장에게 전달
    socket.on('clientInput', (data) => {
        socket.to(data.roomCode).emit('playerInput', data);
    });

    // 연결 종료 처리
    socket.on('disconnecting', () => {
        for (const roomCode of socket.rooms) {
            if (rooms[roomCode]) {
                rooms[roomCode].players = rooms[roomCode].players.filter(p => p.id !== socket.id);
                io.to(roomCode).emit('lobbyUpdate', rooms[roomCode]);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('사용자 접속 종료:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});