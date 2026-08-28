import { Peer, DataConnection } from 'peerjs';
import { RoomState, ControllerInput } from '../types';
import { encodeBinaryInput } from './InputSanitizer';

type EventCallback = (...args: any[]) => void;

export class P2PClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  public isConnected: boolean = false;
  public playerId: string = '';

  // 60Hz (16.6ms) Intelligent dirty-check throttle state
  private lastSentInput = {
    x: 0,
    y: 0,
    action1: false,
    action2: false,
    action3: false,
    time: 0,
  };
  private pendingInput: ControllerInput | null = null;
  private throttleTimer: any = null;

  constructor() {}

  // Phone connects directly to the TV host peer with UDP-like non-blocking transport
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

      this.peer.on('open', (_clientPeerId) => {
        // Open connection with reliable: false for non-blocking UDP speed
        this.connection = this.peer!.connect(hostPeerId, {
          reliable: false,
        });

        this.connection.on('open', () => {
          this.isConnected = true;
          if ((this.connection as any)?.dataChannel) {
            try {
              (this.connection as any).dataChannel.binaryType = 'arraybuffer';
            } catch {}
          }
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

        this.connection.on('error', (_err) => {
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Could not connect to Host TV screen.' });
          }
        });
      });

      this.peer.on('error', (_err) => {
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

  /**
   * Intelligently send input frame:
   * - Immediate send on button state change (zero latency).
   * - Drops duplicate stick positions (dirty check).
   * - Throttles high-frequency stick moves to 60Hz (16ms) window.
   * - Emits compact 16-byte binary ArrayBuffer payload.
   */
  public sendInput(input: ControllerInput) {
    if (!this.connection || !this.connection.open) return;

    const now = performance.now();
    const btnChanged =
      input.action1 !== this.lastSentInput.action1 ||
      input.action2 !== this.lastSentInput.action2 ||
      Boolean(input.action3) !== this.lastSentInput.action3;

    const dx = Math.abs(input.x - this.lastSentInput.x);
    const dy = Math.abs(input.y - this.lastSentInput.y);
    const stickMoved = dx > 0.005 || dy > 0.005;

    // 1. Button press/release is high priority: bypass rate limit and transmit instantly!
    if (btnChanged) {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
      this.pendingInput = null;
      this.dispatchBinaryInput(input, now);
      return;
    }

    // 2. Unchanged input stick frame: drop duplicate unless keepalive elapsed (> 500ms)
    if (!stickMoved && now - this.lastSentInput.time < 500) {
      return;
    }

    // 3. Stick moved: apply 60Hz (16.0ms) rate limiter
    const elapsed = now - this.lastSentInput.time;
    if (elapsed >= 16.0) {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
      this.pendingInput = null;
      this.dispatchBinaryInput(input, now);
    } else {
      this.pendingInput = input;
      if (!this.throttleTimer) {
        const waitMs = Math.max(1, Math.round(16.0 - elapsed));
        this.throttleTimer = setTimeout(() => {
          this.throttleTimer = null;
          if (this.pendingInput) {
            const nextInput = this.pendingInput;
            this.pendingInput = null;
            this.dispatchBinaryInput(nextInput, performance.now());
          }
        }, waitMs);
      }
    }
  }

  private dispatchBinaryInput(input: ControllerInput, now: number) {
    this.lastSentInput = {
      x: input.x,
      y: input.y,
      action1: input.action1,
      action2: input.action2,
      action3: Boolean(input.action3),
      time: now,
    };

    try {
      // 16-byte zero-allocation ArrayBuffer binary payload
      const binaryPayload = encodeBinaryInput(input);
      this.connection?.send(binaryPayload);
    } catch {
      // Fallback to lightweight JSON if ArrayBuffer fails
      try {
        this.connection?.send({
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
