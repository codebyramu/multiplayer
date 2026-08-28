import { Peer, DataConnection } from 'peerjs';
import { RoomState, Player, GameId, ControllerInput, MatchResults } from '../types';
import { LocalRoomEngine } from './LocalRoomEngine';
import { inputSanitizer, decodeBinaryInput } from './InputSanitizer';

type EventCallback = (...args: any[]) => void;

interface P2PMessage {
  type: string;
  senderId?: string;
  data?: any;
}

export class P2PHostServer {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  public playerInputs: Record<string, ControllerInput> = {};
  private roomState: RoomState | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public partyCode: string = '';
  public isReady: boolean = false;

  constructor() {}

  // 1. Host creates a P2P Server using a deterministic peer ID based on Party Code
  public startHost(partyCode: string, selectedGame: GameId = 'serpent-arena', initialBots: number = 3): Promise<RoomState> {
    return new Promise((resolve, reject) => {
      this.partyCode = partyCode.toUpperCase();
      const peerId = `hypercade-room-${this.partyCode}`;

      // Initialize PeerJS with public STUN/signaling
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.isReady = true;

        // Initialize authoritative host room state in the browser
        this.roomState = LocalRoomEngine.createLocalRoom(selectedGame, initialBots);
        this.roomState.code = this.partyCode;
        this.roomState.hostSocketId = id;
        this.roomState.players = LocalRoomEngine.generateBots(initialBots, this.roomState.players);

        this.emitLocal('room-created', { room: this.roomState });
        resolve(this.roomState);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        // If peer ID already taken (collision), generate a fallback
        if (err.type === 'unavailable-id') {
          const fallbackCode = `HYP${Math.floor(10 + Math.random() * 89)}`;
          this.partyCode = fallbackCode;
          this.peer?.destroy();
          this.startHost(fallbackCode, selectedGame, initialBots).then(resolve).catch(reject);
          return;
        }
        reject(err);
      });
    });
  }

  // 2. Handle phone connecting to the TV host
  private handleIncomingConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if ((conn as any)?.dataChannel) {
        try {
          (conn as any).dataChannel.binaryType = 'arraybuffer';
        } catch {}
      }
    });

    conn.on('data', (raw: any) => {
      // FAST PATH: Binary ArrayBuffer / compact TypedArray inputs
      if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) || Array.isArray(raw)) {
        const playerId = this.peerToPlayerId.get(conn.peer);
        if (playerId) {
          const sanitized = inputSanitizer.sanitize(playerId, raw);
          if (sanitized) {
            this.playerInputs[playerId] = sanitized;
            this.emitLocal('client-input', { playerId, input: sanitized });
          }
        }
        return;
      }

      try {
        const msg: P2PMessage = typeof raw === 'string' ? JSON.parse(raw) : raw;
        this.handleClientMessage(conn, msg);
      } catch {}
    });

    conn.on('close', () => {
      this.handleClientDisconnect(conn.peer);
    });

    conn.on('error', () => {
      this.handleClientDisconnect(conn.peer);
    });
  }

  // 3. Process player actions inside the host browser
  private handleClientMessage(conn: DataConnection, msg: P2PMessage) {
    if (!this.roomState) return;

    switch (msg.type) {
      case 'join-room': {
        const { name, avatar, color, skin } = msg.data || {};
        const playerId = `p_${conn.peer.slice(-6)}_${Date.now().toString().slice(-4)}`;
        this.peerToPlayerId.set(conn.peer, playerId);

        const newPlayer: Player = {
          id: playerId,
          socketId: conn.peer,
          name: (name || `Player ${Object.keys(this.roomState.players).length + 1}`).trim().slice(0, 16),
          avatar: avatar || '🐱',
          color: color || '#00E5FF',
          skin: skin || 'synth',
          isHost: false,
          isBot: false,
          isReady: false,
          score: 0,
          ping: 15,
          connected: true,
          lastActive: Date.now(),
        };

        this.roomState.players[playerId] = newPlayer;

        // Send confirmation back to phone
        conn.send({
          type: 'join-success',
          data: {
            room: this.roomState,
            playerId,
          },
        });

        // Broadcast to TV host & all phones
        this.broadcast('player-joined', { player: newPlayer, room: this.roomState });
        this.emitLocal('player-joined', { player: newPlayer, room: this.roomState });
        break;
      }

      case 'player-ready': {
        const { isReady, playerId } = msg.data || {};
        if (playerId && this.roomState.players[playerId]) {
          this.roomState.players[playerId].isReady = isReady;
          this.broadcast('player-ready-updated', {
            playerId,
            isReady,
            players: this.roomState.players,
            room: this.roomState,
          });
          this.emitLocal('player-ready-updated', {
            playerId,
            isReady,
            players: this.roomState.players,
            room: this.roomState,
          });
        }
        break;
      }

      case 'player-input': {
        const input: ControllerInput = msg.data;
        const playerId = msg.senderId || this.peerToPlayerId.get(conn.peer);
        if (playerId && input) {
          const sanitized = inputSanitizer.sanitize(playerId, input);
          if (sanitized) {
            this.playerInputs[playerId] = sanitized;
            this.emitLocal('client-input', { playerId, input: sanitized });
          }
        }
        break;
      }

      case 'emote-reaction': {
        const { emote, playerId } = msg.data || {};
        const player = playerId ? this.roomState.players[playerId] : undefined;
        this.broadcast('emote-reaction', {
          emote,
          playerId,
          playerName: player?.name || 'Player',
          playerColor: player?.color || '#00F5A0',
        });
        this.emitLocal('emote-reaction', {
          emote,
          playerId,
          playerName: player?.name || 'Player',
          playerColor: player?.color || '#00F5A0',
        });
        break;
      }

      case 'player-vote-map': {
        const { mapId, playerId } = msg.data || {};
        if (!this.roomState.mapVoting) this.roomState.mapVoting = {};
        this.roomState.mapVoting[mapId] = (this.roomState.mapVoting[mapId] || 0) + 1;
        this.broadcast('map-voting-updated', { mapVoting: this.roomState.mapVoting, playerId });
        this.emitLocal('map-voting-updated', { mapVoting: this.roomState.mapVoting, playerId });
        break;
      }
    }
  }

  private handleClientDisconnect(peerId: string) {
    this.connections.delete(peerId);
    const mappedPlayerId = this.peerToPlayerId.get(peerId);
    this.peerToPlayerId.delete(peerId);
    if (mappedPlayerId) {
      delete this.playerInputs[mappedPlayerId];
      inputSanitizer.resetPlayer(mappedPlayerId);
    }
    if (!this.roomState) return;

    let removedPlayerId: string | null = mappedPlayerId || null;
    for (const pid in this.roomState.players) {
      if (this.roomState.players[pid].socketId === peerId) {
        removedPlayerId = pid;
        delete this.roomState.players[pid];
        break;
      }
    }

    if (removedPlayerId) {
      this.broadcast('player-left', { playerId: removedPlayerId, room: this.roomState });
      this.emitLocal('player-left', { playerId: removedPlayerId, room: this.roomState });
    }
  }

  // 4. Host Broadcast methods
  public broadcast(type: string, data: any) {
    const payload = { type, data };
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch {}
      }
    });
  }

  public updateRoomState(updater: (prev: RoomState) => RoomState) {
    if (this.roomState) {
      this.roomState = updater(this.roomState);
      this.broadcast('sync-game-state', { room: this.roomState });
    }
  }

  public selectGame(gameId: GameId) {
    if (this.roomState) {
      this.roomState.selectedGame = gameId;
      this.broadcast('game-selected', { gameId, room: this.roomState });
      this.emitLocal('game-selected', { gameId, room: this.roomState });
    }
  }

  public startCountdown() {
    if (this.roomState) {
      this.roomState.state = 'countdown';
      this.broadcast('countdown-started', { count: 3 });
      this.emitLocal('countdown-started', { count: 3 });
    }
  }

  public startGame() {
    if (this.roomState) {
      this.roomState.state = 'playing';
      this.broadcast('game-started', { room: this.roomState });
      this.emitLocal('game-started', { room: this.roomState });
    }
  }

  public endGame(results: MatchResults) {
    if (this.roomState) {
      this.roomState.state = 'results';
      this.broadcast('game-ended', { results });
      this.emitLocal('game-ended', { results });
    }
  }

  public returnToLobby() {
    if (this.roomState) {
      this.roomState.state = 'lobby';
      for (const pid in this.roomState.players) {
        if (!this.roomState.players[pid].isHost) {
          this.roomState.players[pid].isReady = false;
        }
      }
      this.broadcast('returned-to-lobby', { room: this.roomState });
      this.emitLocal('returned-to-lobby', { room: this.roomState });
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  private emitLocal(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  public destroy() {
    this.connections.forEach((c) => c.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.isReady = false;
  }
}

export const p2pHostServer = new P2PHostServer();
