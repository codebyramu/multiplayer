import { ControllerInput } from '../types';

export interface PlayerInputTelemetry {
  playerId: string;
  packetsReceived: number;
  packetsDroppedRateLimit: number;
  packetsDroppedMalformed: number;
  lastPacketTimestamp: number;
  currentRateHz: number;
}

export function encodeBinaryInput(input: ControllerInput): ArrayBuffer {
  const buffer = new ArrayBuffer(16);
  const f32 = new Float32Array(buffer);
  f32[0] = input.x;
  f32[1] = input.y;
  let btnMask = 0;
  if (input.action1) btnMask |= 1;
  if (input.action2) btnMask |= 2;
  if (input.action3) btnMask |= 4;
  f32[2] = btnMask;
  f32[3] = (input.timestamp || Date.now()) % 100000000;
  return buffer;
}

export function decodeBinaryInput(raw: any): ControllerInput | null {
  if (!raw) return null;
  if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
    const byteOffset = 'byteOffset' in raw ? (raw as ArrayBufferView).byteOffset : 0;
    const byteLength = 'byteLength' in raw ? (raw as ArrayBufferView).byteLength : (raw as ArrayBuffer).byteLength;
    const buffer = 'buffer' in raw ? (raw as ArrayBufferView).buffer : (raw as ArrayBuffer);
    if (byteLength >= 12) {
      const f32 = new Float32Array(buffer, byteOffset, Math.min(4, Math.floor(byteLength / 4)));
      const x = Math.max(-1.0, Math.min(1.0, Number(f32[0]) || 0));
      const y = Math.max(-1.0, Math.min(1.0, Number(f32[1]) || 0));
      const btnMask = Math.round(Number(f32[2]) || 0);
      const action1 = (btnMask & 1) !== 0;
      const action2 = (btnMask & 2) !== 0;
      const action3 = (btnMask & 4) !== 0;
      const mag = Math.min(1.0, Math.hypot(x, y));
      const angle = ((Math.atan2(y, x) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return {
        x,
        y,
        magnitude: mag,
        angle,
        action1,
        action2,
        action3,
        timestamp: Date.now(),
      };
    }
  } else if (Array.isArray(raw) && raw.length >= 3) {
    const x = Math.max(-1.0, Math.min(1.0, Number(raw[0]) || 0));
    const y = Math.max(-1.0, Math.min(1.0, Number(raw[1]) || 0));
    const btnMask = Number(raw[2]) || 0;
    const action1 = (btnMask & 1) !== 0;
    const action2 = (btnMask & 2) !== 0;
    const action3 = (btnMask & 4) !== 0;
    const mag = Math.min(1.0, Math.hypot(x, y));
    const angle = ((Math.atan2(y, x) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return {
      x,
      y,
      magnitude: mag,
      angle,
      action1,
      action2,
      action3,
      timestamp: Number(raw[3]) || Date.now(),
    };
  }
  return null;
}

export class InputSanitizer {
  // 200Hz max rate corresponds to minimum inter-packet interval of 5.0ms (allowing small jitter down to 4.5ms)
  private static readonly MAX_FREQUENCY_HZ = 200;
  private static readonly MIN_PACKET_INTERVAL_MS = 4.5;
  private static readonly RATE_WINDOW_MS = 1000;

  private playerTimestamps: Map<string, number> = new Map();
  private playerPacketWindows: Map<string, number[]> = new Map();
  private telemetry: Map<string, PlayerInputTelemetry> = new Map();

  /**
   * Sanitizes and rate-limits incoming controller input packets.
   * Drops packets exceeding 200Hz or containing severely malformed payloads.
   * Returns valid ControllerInput, or null if packet was dropped.
   */
  public sanitize(playerId: string, rawInput: any): ControllerInput | null {
    const now = performance.now();
    const stats = this.getOrCreateTelemetry(playerId);
    stats.packetsReceived++;

    // Check if input is in binary or compact array format
    if (rawInput instanceof ArrayBuffer || ArrayBuffer.isView(rawInput) || Array.isArray(rawInput)) {
      const decoded = decodeBinaryInput(rawInput);
      if (!decoded) {
        stats.packetsDroppedMalformed++;
        return null;
      }
      rawInput = decoded;
    }

    // 1. RATE LIMITER: 200Hz maximum check
    const lastTime = this.playerTimestamps.get(playerId) || 0;
    const interval = now - lastTime;

    // Rolling packet rate calculation
    let windowTimes = this.playerPacketWindows.get(playerId);
    if (!windowTimes) {
      windowTimes = [];
      this.playerPacketWindows.set(playerId, windowTimes);
    }
    windowTimes.push(now);
    // Evict timestamps older than 1 second
    while (windowTimes.length > 0 && windowTimes[0] < now - InputSanitizer.RATE_WINDOW_MS) {
      windowTimes.shift();
    }
    stats.currentRateHz = windowTimes.length;

    // Drop packet if faster than 200Hz (>200 packets in last second or delta < 4.5ms)
    if (interval < InputSanitizer.MIN_PACKET_INTERVAL_MS || windowTimes.length > InputSanitizer.MAX_FREQUENCY_HZ) {
      stats.packetsDroppedRateLimit++;
      return null;
    }

    this.playerTimestamps.set(playerId, now);
    stats.lastPacketTimestamp = Date.now();

    // 2. PAYLOAD STRUCTURE & MALFORMED DATA CHECK
    if (!rawInput || typeof rawInput !== 'object') {
      stats.packetsDroppedMalformed++;
      return null;
    }

    // 3. VECTOR SANITIZATION & BOUNDS CLAMPING
    const rawX = Number(rawInput.x);
    const rawY = Number(rawInput.y);
    const rawMag = Number(rawInput.magnitude);
    const rawAngle = Number(rawInput.angle);

    // If completely non-numeric or extreme out-of-bounds (e.g. glitch injection), reject or clamp
    if (isNaN(rawX) || isNaN(rawY) || !isFinite(rawX) || !isFinite(rawY)) {
      stats.packetsDroppedMalformed++;
      return null;
    }

    // Strict clamping to unit circle vector space
    const x = Math.max(-1.0, Math.min(1.0, rawX));
    const y = Math.max(-1.0, Math.min(1.0, rawY));

    // Magnitude clamping
    let magnitude = isFinite(rawMag) ? Math.max(0.0, Math.min(1.0, rawMag)) : Math.hypot(x, y);
    if (magnitude > 1.0) magnitude = 1.0;

    // Angle calculation & sanitization
    let angle = isFinite(rawAngle) ? rawAngle : Math.atan2(y, x);
    if (isNaN(angle)) angle = 0;
    // Normalize angle to [0, 2*PI)
    angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Action button coercions
    const action1 = Boolean(rawInput.action1);
    const action2 = Boolean(rawInput.action2);
    const action3 = Boolean(rawInput.action3);

    // Timestamp verification
    const timestamp = typeof rawInput.timestamp === 'number' && rawInput.timestamp > 0
      ? rawInput.timestamp
      : Date.now();

    return {
      x,
      y,
      magnitude,
      angle,
      action1,
      action2,
      action3,
      timestamp,
    };
  }

  public getTelemetry(playerId?: string): PlayerInputTelemetry | Record<string, PlayerInputTelemetry> {
    if (playerId) {
      return this.getOrCreateTelemetry(playerId);
    }
    const result: Record<string, PlayerInputTelemetry> = {};
    for (const [id, data] of this.telemetry.entries()) {
      result[id] = { ...data };
    }
    return result;
  }

  public resetPlayer(playerId: string): void {
    this.playerTimestamps.delete(playerId);
    this.playerPacketWindows.delete(playerId);
    this.telemetry.delete(playerId);
  }

  public resetAll(): void {
    this.playerTimestamps.clear();
    this.playerPacketWindows.clear();
    this.telemetry.clear();
  }

  private getOrCreateTelemetry(playerId: string): PlayerInputTelemetry {
    let entry = this.telemetry.get(playerId);
    if (!entry) {
      entry = {
        playerId,
        packetsReceived: 0,
        packetsDroppedRateLimit: 0,
        packetsDroppedMalformed: 0,
        lastPacketTimestamp: Date.now(),
        currentRateHz: 0,
      };
      this.telemetry.set(playerId, entry);
    }
    return entry;
  }
}

export const inputSanitizer = new InputSanitizer();
