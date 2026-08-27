import { io, Socket } from 'socket.io-client';
import { RoomState, Player, ControllerInput, GameEventPayload, MatchResults } from '../types';

type EventCallback = (...args: any[]) => void;

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public isConnected: boolean = false;
  public ping: number = 0;
  private pingInterval: any = null;

  public connect(customServerUrl?: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        resolve(true);
        return;
      }

      // 1. Try window.location.origin (via Vite proxy) or fallback directly to port 3001
      const defaultUrl = typeof window !== 'undefined'
        ? (window.location.port === '5173' ? `http://${window.location.hostname}:3001` : window.location.origin)
        : 'http://localhost:3001';

      const url = customServerUrl || defaultUrl;

      if (this.socket) {
        this.socket.disconnect();
      }
      
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 6000,
      });

      let resolved = false;

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.startPingLoop();
        this.emitLocal('connected', true);
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emitLocal('disconnected', false);
      });

      this.socket.on('connect_error', (_err) => {
        if (!resolved) {
          // If port 3001 direct failed and we haven't tried origin, or vice versa
          resolved = true;
          resolve(false);
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(this.isConnected);
        }
      }, 4000);

      // Bind all server event relays
      const standardEvents = [
        'room-created', 'player-joined', 'player-left', 'player-disconnected', 'player-ready-updated', 'game-selected',
        'settings-updated', 'countdown-started', 'game-started', 'client-input',
        'sync-game-state', 'game-event', 'emote-reaction', 'game-ended', 'returned-to-lobby',
        'kicked-from-room', 'host-disconnected', 'map-voted', 'map-voting-updated',
        'webrtc-offer', 'webrtc-answer', 'webrtc-ice-candidate'
      ];

      standardEvents.forEach(evt => {
        this.socket?.on(evt, (data: any) => {
          this.emitLocal(evt, data);
        });
      });
    });
  }

  public getSocket(): Socket | null {
    return this.socket;
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

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const start = performance.now();
        this.socket.emit('ping-sync', start, () => {
          this.ping = Math.round(performance.now() - start);
        });
      }
    }, 4000);
  }

  private emitLocal(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }

  // --- HOST ACTIONS --- //

  public async createRoom(selectedGame: string = 'serpent-arena'): Promise<{ success: boolean; code?: string; localIp?: string; room?: RoomState }> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false });
        return;
      }
      const timer = setTimeout(() => {
        resolve({ success: false });
      }, 5000);

      this.socket.emit('create-room', { selectedGame }, (res: any) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  }

  public selectGame(gameId: string) {
    this.socket?.emit('host-select-game', { gameId });
  }

  public updateSettings(botCount: number, config?: any) {
    this.socket?.emit('host-update-settings', { botCount, config });
  }

  public startCountdown() {
    this.socket?.emit('host-start-countdown');
  }

  public startGame() {
    this.socket?.emit('host-start-game');
  }

  public broadcastGameState(state: any) {
    this.socket?.emit('host-game-state', state);
  }

  public sendGameEvent(event: GameEventPayload) {
    this.socket?.emit('host-game-event', event);
  }

  public endGame(results: MatchResults) {
    this.socket?.emit('host-end-game', results);
  }

  public returnToLobby() {
    this.socket?.emit('host-return-lobby');
  }

  public kickPlayer(playerId: string) {
    this.socket?.emit('host-kick-player', { playerId });
  }

  // --- CONTROLLER / PLAYER ACTIONS --- //

  public async joinRoom(data: { code: string; name: string; avatar: string; color: string; skin?: string }): Promise<{ success: boolean; playerId?: string; room?: RoomState; error?: string }> {
    if (!this.socket || !this.socket.connected) {
      await this.connect();
    }
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, error: 'Socket not connected. Check network.' });
        return;
      }
      const timer = setTimeout(() => {
        resolve({ success: false, error: 'Connection timed out. Verify Party Code on TV.' });
      }, 6000);

      this.socket.emit('join-room', data, (res: any) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  }

  public setReady(isReady: boolean = true) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('player-ready', { isReady });
    }
  }

  public sendInput(input: ControllerInput) {
    if (this.socket && this.socket.connected) {
      this.socket.volatile.emit('player-input', input);
    }
  }

  public voteMap(mapId: string, playerId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('player-vote-map', { mapId, playerId });
    } else {
      this.emitLocal('map-voted', { mapId, playerId: playerId || 'host' });
    }
  }

  public sendEmote(emoji: string, senderName?: string, senderColor?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('player-emote', { emoji, senderName, senderColor });
    } else {
      // Local fallback emote relay
      this.emitLocal('emote-reaction', {
        id: `emote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        emoji,
        senderId: 'local_client',
        senderName: senderName || 'Spectator',
        senderColor: senderColor || '#FFB224',
        x: 0.15 + Math.random() * 0.7,
        timestamp: Date.now(),
      });
    }
  }

  public disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }
}

export const socketClient = new SocketClient();
