import { socketClient } from './SocketClient';
import { ControllerInput } from '../types';
import { encodeBinaryInput, decodeBinaryInput, inputSanitizer } from './InputSanitizer';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private isHost: boolean = false;
  private onInputCallback?: (playerId: string, input: ControllerInput) => void;

  // 60Hz dirty check throttle state for direct transport
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

  constructor(isHost: boolean = false, onInput?: (playerId: string, input: ControllerInput) => void) {
    this.isHost = isHost;
    this.onInputCallback = onInput;
    this.initSignalingListeners();
  }

  private initSignalingListeners() {
    // 1. Host receives offer from client
    socketClient.on('webrtc-offer', async (data: { fromSocketId: string; playerId: string; offer: RTCSessionDescriptionInit }) => {
      if (!this.isHost) return;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peerConnections.set(data.fromSocketId, pc);

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.binaryType = 'arraybuffer';
        this.dataChannels.set(data.fromSocketId, dc);

        dc.onmessage = (msg) => {
          try {
            let input: ControllerInput | null = null;
            if (msg.data instanceof ArrayBuffer || ArrayBuffer.isView(msg.data)) {
              input = decodeBinaryInput(msg.data);
            } else if (typeof msg.data === 'string') {
              input = JSON.parse(msg.data);
            }
            if (input && this.onInputCallback) {
              const sanitized = inputSanitizer.sanitize(data.playerId, input);
              if (sanitized) {
                this.onInputCallback(data.playerId, sanitized);
              }
            }
          } catch {}
        };
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.getSocket()?.emit('webrtc-ice-candidate', {
            targetSocketId: data.fromSocketId,
            candidate: event.candidate,
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketClient.getSocket()?.emit('webrtc-answer', {
        targetSocketId: data.fromSocketId,
        answer,
      });
    });

    // 2. Client receives answer from host
    socketClient.on('webrtc-answer', async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
      if (this.isHost) return;
      const pc = this.peerConnections.get('host');
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    // 3. ICE candidate exchange
    socketClient.on('webrtc-ice-candidate', async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = this.isHost ? this.peerConnections.get(data.fromSocketId) : this.peerConnections.get('host');
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      }
    });
  }

  // Client creates WebRTC DataChannel connection to Host
  public async connectAsClient(): Promise<boolean> {
    if (this.isHost) return false;

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peerConnections.set('host', pc);

      // Create low-latency unordered unreliable data channel for gaming inputs
      const dc = pc.createDataChannel('hypercade-input', {
        ordered: false,
        maxRetransmits: 0,
      });
      dc.binaryType = 'arraybuffer';
      this.dataChannels.set('host', dc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketClient.getSocket()?.emit('webrtc-ice-candidate', {
            candidate: event.candidate,
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketClient.getSocket()?.emit('webrtc-offer', { offer });
      return true;
    } catch {
      return false;
    }
  }

  // Send input directly over DataChannel (with zero-latency device-to-device transport & 60Hz throttle)
  public sendInputDirect(input: ControllerInput): boolean {
    const dc = this.dataChannels.get('host');
    if (!dc || dc.readyState !== 'open') return false;

    const now = performance.now();
    const btnChanged =
      input.action1 !== this.lastSentInput.action1 ||
      input.action2 !== this.lastSentInput.action2 ||
      Boolean(input.action3) !== this.lastSentInput.action3;

    const dx = Math.abs(input.x - this.lastSentInput.x);
    const dy = Math.abs(input.y - this.lastSentInput.y);
    const stickMoved = dx > 0.005 || dy > 0.005;

    // 1. Immediate button send
    if (btnChanged) {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
      this.pendingInput = null;
      this.dispatchBinary(dc, input, now);
      return true;
    }

    // 2. Drop duplicate stick frames
    if (!stickMoved && now - this.lastSentInput.time < 500) {
      return true;
    }

    // 3. 60Hz stick rate limit
    const elapsed = now - this.lastSentInput.time;
    if (elapsed >= 16.0) {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
      this.pendingInput = null;
      this.dispatchBinary(dc, input, now);
    } else {
      this.pendingInput = input;
      if (!this.throttleTimer) {
        const waitMs = Math.max(1, Math.round(16.0 - elapsed));
        this.throttleTimer = setTimeout(() => {
          this.throttleTimer = null;
          if (this.pendingInput && dc.readyState === 'open') {
            const next = this.pendingInput;
            this.pendingInput = null;
            this.dispatchBinary(dc, next, performance.now());
          }
        }, waitMs);
      }
    }
    return true;
  }

  private dispatchBinary(dc: RTCDataChannel, input: ControllerInput, now: number) {
    this.lastSentInput = {
      x: input.x,
      y: input.y,
      action1: input.action1,
      action2: input.action2,
      action3: Boolean(input.action3),
      time: now,
    };
    try {
      const buffer = encodeBinaryInput(input);
      dc.send(buffer);
    } catch {
      try {
        dc.send(JSON.stringify(input));
      } catch {}
    }
  }

  public closeAll() {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.dataChannels.forEach((dc) => dc.close());
    this.peerConnections.forEach((pc) => pc.close());
    this.dataChannels.clear();
    this.peerConnections.clear();
  }
}
