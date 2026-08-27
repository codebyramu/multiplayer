import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 5000,
  pingTimeout: 10000,
});

// Helper: Get local network IP for easy QR code scanning on mobile devices
function getLocalNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Generate human-friendly 5-character party codes
const CODE_WORDS = [
  'HYPER', 'NEON', 'VOID', 'CYBER', 'VIPER', 'PULSE', 'RETRO', 
  'DRIFT', 'NOVA', 'RELIC', 'ARCADE', 'PIXEL', 'SONIC', 'TURBO',
  'TITAN', 'STORM', 'BLAZE', 'LASER', 'SPECT', 'ALPHA', 'OMEGA'
];

function generatePartyCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${word.slice(0, 3)}${num}`; // e.g. HYP42, NEO77, VOI19
}

export interface PlayerSession {
  id: string;
  socketId: string;
  name: string;
  avatar: string;
  color: string;
  skin?: string;
  isHost: boolean;
  isOwner?: boolean;
  isBot?: boolean;
  isReady: boolean;
  score: number;
  ping: number;
  connected: boolean;
  lastActive: number;
}

export interface RoomSession {
  code: string;
  hostSocketId: string;
  selectedGame: string;
  state: 'lobby' | 'countdown' | 'playing' | 'results';
  players: Record<string, PlayerSession>;
  botCount: number;
  config: {
    roundDuration: number;
    difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
    powerupsEnabled: boolean;
  };
  createdAt: number;
}

const rooms: Record<string, RoomSession> = {};
const socketToRoom: Record<string, string> = {};
const socketToPlayerId: Record<string, string> = {};

// HTTP API: Get Network IP & Health
app.get('/api/info', (_req, res) => {
  const localIp = getLocalNetworkIp();
  res.json({
    status: 'online',
    localIp,
    roomsCount: Object.keys(rooms).length,
    timestamp: Date.now(),
  });
});

app.get('/api/room/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms[code];
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    selectedGame: room.selectedGame,
    state: room.state,
    playerCount: Object.keys(room.players).length,
  });
});

io.on('connection', (socket: Socket) => {
  // 1. HOST: CREATE PARTY
  socket.on('create-room', (data: { selectedGame?: string }, callback) => {
    let code = generatePartyCode();
    while (rooms[code]) {
      code = generatePartyCode();
    }

    const hostId = `host_${socket.id.slice(0, 6)}`;
    const newRoom: RoomSession = {
      code,
      hostSocketId: socket.id,
      selectedGame: data?.selectedGame || 'serpent-arena',
      state: 'lobby',
      players: {},
      botCount: 3,
      config: {
        roundDuration: 90,
        difficulty: 'normal',
        powerupsEnabled: true,
      },
      createdAt: Date.now(),
    };

    rooms[code] = newRoom;
    socketToRoom[socket.id] = code;
    socketToPlayerId[socket.id] = hostId;
    socket.join(code);

    const localIp = getLocalNetworkIp();

    if (typeof callback === 'function') {
      callback({
        success: true,
        code,
        localIp,
        room: newRoom,
      });
    }

    socket.emit('room-created', { code, localIp, room: newRoom });
  });

  // 2. PLAYER: JOIN PARTY (OR RECONNECT)
  socket.on('join-room', (data: { code: string; name: string; avatar: string; color: string; skin?: string; existingPlayerId?: string }, callback) => {
    const code = (data.code || '').trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Party code not found. Please check and try again.' });
      }
      return;
    }

    // Reconnection detection: If playerId was previously in room
    const isReconnecting = Boolean(data.existingPlayerId && room.players[data.existingPlayerId]);
    const playerId = isReconnecting
      ? (data.existingPlayerId as string)
      : `p_${socket.id.slice(0, 6)}_${Math.floor(Math.random() * 1000)}`;

    const humanPlayers = Object.values(room.players).filter((p) => !p.isBot && p.id !== data.existingPlayerId);
    const isOwner = humanPlayers.length === 0;

    const playerSession: PlayerSession = {
      id: playerId,
      socketId: socket.id,
      name: data.name || (isReconnecting ? room.players[playerId]?.name : `Player ${Object.keys(room.players).length + 1}`),
      avatar: data.avatar || 'ship',
      color: data.color || '#00F5A0',
      skin: data.skin || 'synth',
      isHost: false,
      isOwner: isReconnecting ? room.players[playerId]?.isOwner : isOwner,
      isReady: true,
      score: isReconnecting ? room.players[playerId]?.score || 0 : 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    };

    room.players[playerId] = playerSession;
    socketToRoom[socket.id] = code;
    socketToPlayerId[socket.id] = playerId;
    socket.join(code);

    if (typeof callback === 'function') {
      callback({
        success: true,
        playerId,
        isReconnected: isReconnecting,
        isOwner: playerSession.isOwner,
        room: {
          code: room.code,
          selectedGame: room.selectedGame,
          state: room.state,
          players: room.players,
          botCount: room.botCount,
          config: room.config,
        },
      });
    }

    // Notify all participants in room (especially Host)
    io.to(code).emit('player-joined', { player: playerSession, room });
  });

  // 2b. PLAYER: TOGGLE READY STATUS
  socket.on('player-ready', (data: { isReady?: boolean }) => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];
    if (room && playerId && room.players[playerId]) {
      room.players[playerId].isReady = typeof data?.isReady === 'boolean' ? data.isReady : true;
      io.to(code).emit('player-ready-updated', {
        playerId,
        isReady: room.players[playerId].isReady,
        room,
      });
    }
  });

  // 3. WEBRTC SIGNALING RELAYS (Device-to-Device Direct Data Channel)
  socket.on('webrtc-offer', (payload: { targetSocketId?: string; offer: any }) => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];
    if (room) {
      const target = payload.targetSocketId || room.hostSocketId;
      io.to(target).emit('webrtc-offer', {
        fromSocketId: socket.id,
        playerId,
        offer: payload.offer,
      });
    }
  });

  socket.on('webrtc-answer', (payload: { targetSocketId: string; answer: any }) => {
    io.to(payload.targetSocketId).emit('webrtc-answer', {
      fromSocketId: socket.id,
      answer: payload.answer,
    });
  });

  socket.on('webrtc-ice-candidate', (payload: { targetSocketId?: string; candidate: any }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room) {
      const target = payload.targetSocketId || room.hostSocketId;
      io.to(target).emit('webrtc-ice-candidate', {
        fromSocketId: socket.id,
        candidate: payload.candidate,
      });
    }
  });

  // 4. HOST OR PARTY LEADER / OWNER: SELECT GAME
  socket.on('host-select-game', (data: { gameId: string }) => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];
    if (room && (room.hostSocketId === socket.id || (playerId && room.players[playerId]?.isOwner))) {
      room.selectedGame = data.gameId;
      io.to(code).emit('game-selected', { gameId: data.gameId });
    }
  });

  // 4b. PLAYER / HOST: VOTE MAP
  socket.on('player-vote-map', (data: { mapId: string; playerId?: string }) => {
    const code = socketToRoom[socket.id];
    const playerId = data.playerId || socketToPlayerId[socket.id] || 'host';
    const room = rooms[code];
    if (room && data.mapId) {
      io.to(code).emit('map-voted', { mapId: data.mapId, playerId });
    }
  });

  // 5. HOST: UPDATE BOTS & SETTINGS
  socket.on('host-update-settings', (data: { botCount?: number; config?: Partial<RoomSession['config']> }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      if (typeof data.botCount === 'number') room.botCount = Math.max(0, Math.min(7, data.botCount));
      if (data.config) room.config = { ...room.config, ...data.config };
      io.to(code).emit('settings-updated', { botCount: room.botCount, config: room.config });
    }
  });

  // 6. HOST: START MATCH (COUNTDOWN -> PLAYING)
  socket.on('host-start-countdown', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      room.state = 'countdown';
      io.to(code).emit('countdown-started', { countdownDuration: 3 });
    }
  });

  socket.on('host-start-game', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      room.state = 'playing';
      for (const pid in room.players) {
        room.players[pid].score = 0;
      }
      io.to(code).emit('game-started', {
        gameId: room.selectedGame,
        players: room.players,
        botCount: room.botCount,
        config: room.config,
      });
    }
  });

  // 7. REALTIME CONTROLLER INPUT (Phone -> Host over WebSocket fallback)
  socket.on('player-input', (inputData: {
    x?: number;
    y?: number;
    angle?: number;
    magnitude?: number;
    action1?: boolean;
    action2?: boolean;
    action3?: boolean;
    timestamp?: number;
  }) => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];
    if (room && playerId) {
      io.to(room.hostSocketId).volatile.emit('client-input', {
        playerId,
        input: inputData,
      });
    }
  });

  // 7b. SPECTATOR & PLAYER EMOTE REACTIONS (Forward to Room & TV Host)
  socket.on('player-emote', (data: { emoji: string; senderName?: string; senderColor?: string }) => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];
    if (room && data?.emoji) {
      const sender = playerId ? room.players[playerId] : null;
      const emotePayload = {
        id: `emote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        emoji: data.emoji,
        senderId: playerId || 'spectator',
        senderName: data.senderName || sender?.name || 'Spectator',
        senderColor: data.senderColor || sender?.color || '#FFB224',
        x: 0.12 + Math.random() * 0.76, // distribute horizontally
        timestamp: Date.now(),
      };
      io.to(code).emit('emote-reaction', emotePayload);
    }
  });

  // 8. HOST: BROADCAST AUTHORITATIVE GAME STATE (Host -> Players)
  socket.on('host-game-state', (gameState: any) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      socket.to(code).volatile.emit('sync-game-state', gameState);
    }
  });

  // 9. HOST: TRIGGER GAME EVENT (Haptics, Elimination, Score, SFX)
  socket.on('host-game-event', (eventData: {
    type: 'eliminate' | 'score' | 'powerup' | 'haptic' | 'hit' | 'announcement';
    targetPlayerId?: string;
    payload?: any;
  }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      if (eventData.targetPlayerId && room.players[eventData.targetPlayerId]) {
        io.to(room.players[eventData.targetPlayerId].socketId).emit('game-event', eventData);
      } else {
        io.to(code).emit('game-event', eventData);
      }
    }
  });

  // 10. HOST: END MATCH (SHOW PODIUM & RESULTS)
  socket.on('host-end-game', (resultsData: {
    winnerId: string;
    winnerName: string;
    rankings: Array<{ id: string; name: string; score: number; rank: number; avatar: string; color: string }>;
    mvpStat?: string;
  }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      room.state = 'results';
      io.to(code).emit('game-ended', resultsData);
    }
  });

  // 11. HOST: RETURN TO LOBBY
  socket.on('host-return-lobby', () => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id) {
      room.state = 'lobby';
      io.to(code).emit('returned-to-lobby');
    }
  });

  // 12. HOST: KICK PLAYER
  socket.on('host-kick-player', (data: { playerId: string }) => {
    const code = socketToRoom[socket.id];
    const room = rooms[code];
    if (room && room.hostSocketId === socket.id && data.playerId) {
      const targetPlayer = room.players[data.playerId];
      if (targetPlayer) {
        io.to(targetPlayer.socketId).emit('kicked-from-room');
        delete room.players[data.playerId];
        io.to(code).emit('player-left', { playerId: data.playerId, room });
      }
    }
  });

  // 13. PING / LATENCY MEASUREMENT
  socket.on('ping-sync', (clientTime: number, callback) => {
    if (typeof callback === 'function') {
      callback({
        clientTime,
        serverTime: Date.now(),
      });
    }
  });

  // 14. DISCONNECT / DROPPED PHONE HANDLING (TOLERANT RECONNECTION)
  socket.on('disconnect', () => {
    const code = socketToRoom[socket.id];
    const playerId = socketToPlayerId[socket.id];
    const room = rooms[code];

    if (room) {
      if (room.hostSocketId === socket.id) {
        io.to(code).emit('host-disconnected');
        delete rooms[code];
      } else if (playerId && room.players[playerId]) {
        // Mark player as temporarily disconnected instead of immediately destroying entity
        room.players[playerId].connected = false;
        room.players[playerId].lastActive = Date.now();
        io.to(code).emit('player-disconnected', { playerId, room });

        // Clean up after 35 seconds if not reconnected
        setTimeout(() => {
          if (rooms[code] && rooms[code].players[playerId] && !rooms[code].players[playerId].connected) {
            delete rooms[code].players[playerId];
            io.to(code).emit('player-left', { playerId, room: rooms[code] });
          }
        }, 35000);
      }
    }

    delete socketToRoom[socket.id];
    delete socketToPlayerId[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  const localIp = getLocalNetworkIp();
  console.log(`\n======================================================`);
  console.log(`🕹️  HYPERCADE Multiplayer Host Engine is Live!`);
  console.log(`🌐 Local Host:     http://localhost:${PORT}`);
  console.log(`📱 LAN Network IP: http://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});
