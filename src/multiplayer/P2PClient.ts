import { Peer, DataConnection } from 'peerjs';
import { RoomState, ControllerInput } from '../types';

type EventCallback = (...args: any[]) => void;

export class P2PClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public isConnected: boolean = false;
  public playerId: string = '';

  constructor() {}

  // Phone connects directly to the TV host peer
  public connectToHost(partyCode: string, playerData: { name: string; avatar: string; color: string; skin?: string }): Promise<{ success: boolean; room?: RoomState; playerId?: string; error?: string }> {
    return new Promise((resolve) => {
      const code = partyCode.trim().toUpperCase();
      const hostPeerId = `hypercade-room-${code}`;

      // Initialize client Peer
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      let resolved = false;

      this.peer.on('open', (clientPeerId) => {
        // Open connection directly to TV host
        this.connection = this.peer!.connect(hostPeerId, {
          reliable: true,
        });

        this.connection.on('open', () => {
          this.isConnected = true;
          this.emitLocal('connected', true);

          // Send join request to TV host
          this.connection!.send({
            type: 'join-room',
            data: playerData,
          });
        });

        this.connection.on('data', (raw: any) => {
          try {
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (msg.type === 'join-success') {
              this.playerId = msg.data.playerId;
              if (!resolved) {
                resolved = true;
                resolve({
                  success: true,
                  room: msg.data.room,
                  playerId: msg.data.playerId,
                });
              }
            } else {
              this.emitLocal(msg.type, msg.data);
            }
          } catch {}
        });

        this.connection.on('close', () => {
          this.isConnected = false;
          this.emitLocal('disconnected', false);
        });

        this.connection.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Could not connect to Host TV screen.' });
          }
        });
      });

      this.peer.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Party code not found or Host TV offline.' });
        }
      });

      // 6-second timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'Connection to Host TV timed out. Check party code.' });
        }
      }, 6000);
    });
  }

  public sendInput(input: ControllerInput) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send({
          type: 'player-input',
          senderId: this.playerId,
          data: input,
        });
      } catch {}
    }
  }

  public setReady(isReady: boolean) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send({
          type: 'player-ready',
          senderId: this.playerId,
          data: { isReady, playerId: this.playerId },
        });
      } catch {}
    }
  }

  public sendEmote(emote: string) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send({
          type: 'emote-reaction',
          senderId: this.playerId,
          data: { emote, playerId: this.playerId },
        });
      } catch {}
    }
  }

  public voteMap(mapId: string) {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send({
          type: 'player-vote-map',
          senderId: this.playerId,
          data: { mapId, playerId: this.playerId },
        });
      } catch {}
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

  public disconnect() {
    this.connection?.close();
    this.peer?.destroy();
    this.isConnected = false;
  }
}

export const p2pClient = new P2PClient();
