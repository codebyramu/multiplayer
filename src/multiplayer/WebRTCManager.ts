import { socketClient } from './SocketClient';
import { ControllerInput } from '../types';

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
        this.dataChannels.set(data.fromSocketId, dc);

        dc.onmessage = (msg) => {
          try {
            const input: ControllerInput = JSON.parse(msg.data);
            if (this.onInputCallback) {
              this.onInputCallback(data.playerId, input);
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

  // Send input directly over DataChannel (with zero-latency device-to-device transport)
  public sendInputDirect(input: ControllerInput): boolean {
    const dc = this.dataChannels.get('host');
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(input));
      return true;
    }
    return false;
  }

  public closeAll() {
    this.dataChannels.forEach((dc) => dc.close());
    this.peerConnections.forEach((pc) => pc.close());
    this.dataChannels.clear();
    this.peerConnections.clear();
  }
}
