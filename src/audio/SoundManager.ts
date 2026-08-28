import { SOUND_REGISTRY, MUSIC_REGISTRY, SoundEffectKey, MusicTrackKey, SoundEffectDefinition, MusicTrackDefinition } from './AudioConfig';

// HYPERCADE Dynamic Procedural & Custom Web Audio Engine
// Generates authentic 80s/90s arcade sound effects, chiptune beats, and supports custom MP3/WAV/OGG audio files.
// Optimized for zero buffer underruns, sound clipping prevention, max 12 concurrent voices, and leak-free node disposal.

export type MusicTrack = 'none' | 'lobby' | 'ingame' | 'final-duel';

const MAX_SFX_VOICES = 12;

interface ActiveVoice {
  id: number;
  nodes: AudioNode[];
  cleanupTimer?: number;
  stop: () => void;
}

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private masterCompressor: DynamicsCompressorNode | null = null;
  private noiseBufferCache: Map<number, AudioBuffer> = new Map();
  private customAudioCache: Map<string, HTMLAudioElement> = new Map();
  private customMusicElement: HTMLAudioElement | null = null;

  private isMuted: boolean = false;
  private masterVolume: number = 0.6;
  private musicVolume: number = 0.45;
  private sfxVolume: number = 0.7;
  private initialized: boolean = false;

  // Music Engine State
  private currentTrack: MusicTrack = 'none';
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private nextNoteTime: number = 0;
  private currentTrackGainNode: GainNode | null = null;

  // Final duel acceleration state
  private duelIntensity: number = 1.0;

  // Voice Management & Concurrency Limiting (Clamped to 12 Max)
  private activeVoices: Set<ActiveVoice> = new Set();
  private voiceCounter: number = 0;

  // SFX Throttling to prevent audio node flood
  private lastTriggerTimes: Map<string, number> = new Map();

  // Window resume handlers tracking
  private resumeHandlersAttached: boolean = false;

  constructor() {
    try {
      const savedMute = localStorage.getItem('hypercade_mute');
      if (savedMute !== null) this.isMuted = savedMute === 'true';

      const savedMasterVol = localStorage.getItem('hypercade_master_volume') || localStorage.getItem('hypercade_volume');
      if (savedMasterVol !== null) this.masterVolume = Math.max(0, Math.min(1, parseFloat(savedMasterVol)));

      const savedMusicVol = localStorage.getItem('hypercade_music_volume');
      if (savedMusicVol !== null) this.musicVolume = Math.max(0, Math.min(1, parseFloat(savedMusicVol)));

      const savedSfxVol = localStorage.getItem('hypercade_sfx_volume');
      if (savedSfxVol !== null) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(savedSfxVol)));
    } catch {
      // Ignore SSR / blocked storage
    }

    this.attachResumeListeners();
  }

  private attachResumeListeners() {
    if (typeof window === 'undefined' || this.resumeHandlersAttached) return;
    window.addEventListener('click', this.handleUserInteraction, { passive: true });
    window.addEventListener('keydown', this.handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', this.handleUserInteraction, { passive: true });
    this.resumeHandlersAttached = true;
  }

  private detachResumeListeners() {
    if (typeof window === 'undefined' || !this.resumeHandlersAttached) return;
    window.removeEventListener('click', this.handleUserInteraction);
    window.removeEventListener('keydown', this.handleUserInteraction);
    window.removeEventListener('touchstart', this.handleUserInteraction);
    this.resumeHandlersAttached = false;
  }

  private handleUserInteraction = () => {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            this.detachResumeListeners();
          }
        }).catch(() => {});
      } else if (this.ctx.state === 'running') {
        this.detachResumeListeners();
      }
    }
  };

  // --- AUDIO CUSTOMIZATION & REGISTRY APIS --- //

  public setCustomSound(key: SoundEffectKey, filePath: string, volume?: number) {
    if (SOUND_REGISTRY[key]) {
      SOUND_REGISTRY[key].file = filePath;
      if (volume !== undefined) SOUND_REGISTRY[key].volume = volume;
    }
  }

  public setCustomMusic(key: MusicTrackKey, filePath: string, volume?: number) {
    if (MUSIC_REGISTRY[key]) {
      MUSIC_REGISTRY[key].file = filePath;
      if (volume !== undefined) MUSIC_REGISTRY[key].volume = volume;
    }
  }

  public getSoundRegistry(): Record<SoundEffectKey, SoundEffectDefinition> {
    return SOUND_REGISTRY;
  }

  public getMusicRegistry(): Record<MusicTrackKey, MusicTrackDefinition> {
    return MUSIC_REGISTRY;
  }

  private playCustomAudio(filePath: string, volume = 1.0): boolean {
    if (typeof window === 'undefined' || this.isMuted) return false;
    try {
      let audio = this.customAudioCache.get(filePath);
      if (!audio) {
        audio = new Audio(filePath);
        this.customAudioCache.set(filePath, audio);
      }
      audio.volume = Math.max(0, Math.min(1, volume * this.masterVolume * this.sfxVolume));
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  public init() {
    if (typeof window === 'undefined') return;
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();

        // 1. Master Output Limiter / Dynamics Compressor (prevents clipping/distortion during multi-sound spikes)
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
        this.masterCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
        this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);
        this.masterCompressor.connect(this.ctx.destination);

        // 2. Master Gain connected through Compressor
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.masterCompressor);

        // 3. Music Sub-mix Gain
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);

        // 4. SFX Sub-mix Gain
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.initialized = true;
      }
    } catch (e) {
      console.warn('[SoundManager] Web Audio API initialization blocked or unsupported:', e);
    }
  }

  private getNoiseBuffer(durationSeconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const roundedDuration = Math.round(durationSeconds * 100) / 100;
    if (this.noiseBufferCache.has(roundedDuration)) {
      return this.noiseBufferCache.get(roundedDuration)!;
    }
    const bufferSize = Math.floor(this.ctx.sampleRate * roundedDuration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBufferCache.set(roundedDuration, buffer);
    return buffer;
  }

  private resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- CONCURRENT VOICE LIMITING & NODE DISPOSAL --- //

  /**
   * Registers an active sound effect voice and ensures total active voices
   * never exceed MAX_SFX_VOICES (12). Disposes all intermediate audio nodes on finish.
   */
  private registerVoice(
    nodes: AudioNode[],
    durationMs: number,
    onStopExtra?: () => void
  ): ActiveVoice {
    // If voice limit reached, preempt and disconnect the oldest voice
    if (this.activeVoices.size >= MAX_SFX_VOICES) {
      const oldest = this.activeVoices.values().next().value;
      if (oldest) {
        oldest.stop();
      }
    }

    const voiceId = ++this.voiceCounter;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;

      if (voice.cleanupTimer) {
        clearTimeout(voice.cleanupTimer);
        voice.cleanupTimer = undefined;
      }
      this.activeVoices.delete(voice);

      if (onStopExtra) {
        try {
          onStopExtra();
        } catch {}
      }

      // Disconnect and release all nodes in this voice
      for (const node of nodes) {
        try {
          if ('stop' in node && typeof (node as any).stop === 'function') {
            try {
              (node as any).stop();
            } catch {}
          }
          node.disconnect();
        } catch {}
      }
    };

    const voice: ActiveVoice = {
      id: voiceId,
      nodes,
      stop: cleanup,
    };

    // Auto-cleanup after the duration + safety buffer
    voice.cleanupTimer = window.setTimeout(cleanup, Math.max(25, durationMs + 35));
    this.activeVoices.add(voice);

    return voice;
  }

  /**
   * SFX Rate Limiter / Throttling:
   * Prevents audio node flood when e.g. 8 snakes collect pellets simultaneously in Serpent Arena.
   */
  private shouldThrottle(key: string, minIntervalMs: number = 30): boolean {
    const now = performance.now();
    const last = this.lastTriggerTimes.get(key) || 0;
    if (now - last < minIntervalMs) {
      return true;
    }
    this.lastTriggerTimes.set(key, now);
    return false;
  }

  // --- VOLUME CONTROLS & PERSISTENCE --- //

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('hypercade_mute', String(muted));
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.setMasterVolume(vol);
  }

  public getVolume(): number {
    return this.getMasterVolume();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('hypercade_master_volume', String(this.masterVolume));
      localStorage.setItem('hypercade_volume', String(this.masterVolume));
    } catch {}
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('hypercade_music_volume', String(this.musicVolume));
    } catch {}
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('hypercade_sfx_volume', String(this.sfxVolume));
    } catch {}
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public getCurrentTrack(): MusicTrack {
    return this.currentTrack;
  }

  // --- MATCH TRANSITION & LEAK CLEANUP API --- //

  /**
   * Completely stops and disposes all active SFX voices, disconnects gains,
   * purges scheduled timers, and resets audio state on match/round transitions.
   */
  public stopAllSounds(): void {
    // 1. Evict and clean up all active SFX voices
    for (const voice of Array.from(this.activeVoices)) {
      voice.stop();
    }
    this.activeVoices.clear();

    // 2. Clear throttle timestamps
    this.lastTriggerTimes.clear();

    // 3. Stop any procedural music interval
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    // 4. Disconnect and release track gain
    if (this.currentTrackGainNode) {
      try {
        this.currentTrackGainNode.gain.cancelScheduledValues(0);
        this.currentTrackGainNode.disconnect();
      } catch {}
      this.currentTrackGainNode = null;
    }

    // 5. Pause and reset custom music audio element
    if (this.customMusicElement) {
      try {
        this.customMusicElement.pause();
        this.customMusicElement.currentTime = 0;
      } catch {}
      this.customMusicElement = null;
    }

    // 6. Pause any cached custom sound elements
    for (const audio of this.customAudioCache.values()) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
  }

  public reset(): void {
    this.stopAllSounds();
  }

  // --- DYNAMIC PROCEDURAL SYNTH MUSIC ENGINE --- //

  public playMusic(track: MusicTrack, fadeDuration: number = 0.8) {
    if (this.currentTrack === track) return;
    this.init();
    this.resume();

    if (this.currentTrackGainNode && this.ctx) {
      const oldGain = this.currentTrackGainNode;
      const now = this.ctx.currentTime;
      try {
        oldGain.gain.cancelScheduledValues(now);
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
        oldGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(() => {
          try {
            oldGain.disconnect();
          } catch {}
        }, fadeDuration * 1000 + 50);
      } catch {}
    }

    if (this.customMusicElement) {
      this.customMusicElement.pause();
      this.customMusicElement.currentTime = 0;
      this.customMusicElement = null;
    }

    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    this.currentTrack = track;
    if (track === 'none') {
      this.currentTrackGainNode = null;
      return;
    }

    // Check if custom music file is registered in MUSIC_REGISTRY
    if (MUSIC_REGISTRY[track]?.file) {
      try {
        const audio = new Audio(MUSIC_REGISTRY[track]!.file);
        audio.loop = true;
        audio.volume = Math.max(0, Math.min(1, (MUSIC_REGISTRY[track]!.volume ?? 0.5) * (this.isMuted ? 0 : this.masterVolume * this.musicVolume)));
        audio.play().catch(() => {});
        this.customMusicElement = audio;
        return;
      } catch {}
    }

    if (!this.ctx || !this.musicGain) {
      this.currentTrackGainNode = null;
      return;
    }

    const trackGain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    trackGain.gain.setValueAtTime(0.0001, now);
    trackGain.gain.exponentialRampToValueAtTime(1.0, now + fadeDuration);
    trackGain.connect(this.musicGain);
    this.currentTrackGainNode = trackGain;

    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;

    if (track === 'lobby') {
      this.startLobbyScheduler(trackGain);
    } else if (track === 'ingame') {
      this.startInGameScheduler(trackGain);
    } else if (track === 'final-duel') {
      this.duelIntensity = 1.0;
      this.startFinalDuelScheduler(trackGain);
    }
  }

  public stopMusic(fadeDuration: number = 0.5) {
    this.playMusic('none', fadeDuration);
  }

  private startLobbyScheduler(trackGain: GainNode) {
    const tempo = 116;
    const stepDuration = 60 / tempo / 4;
    const lookahead = 0.12;

    const chordProgressions = [
      { root: 220.0, notes: [220.0, 261.63, 329.63, 440.0], bass: 110.0 },
      { root: 174.61, notes: [174.61, 220.0, 261.63, 349.23], bass: 87.31 },
      { root: 261.63, notes: [261.63, 329.63, 392.0, 523.25], bass: 130.81 },
      { root: 196.0, notes: [196.0, 246.94, 293.66, 392.0], bass: 98.0 },
    ];

    const scheduler = () => {
      if (!this.ctx || this.currentTrack !== 'lobby') return;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        const chordIndex = Math.floor((this.musicStep / 16) % chordProgressions.length);
        const chord = chordProgressions[chordIndex];
        const stepInBar = this.musicStep % 16;
        const time = this.nextNoteTime;
        const arpNoteIndex = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1, 3, 2, 1, 0][stepInBar];
        const noteFreq = chord.notes[arpNoteIndex] * 1.5;
        this.synthPluck(time, noteFreq, 'triangle', 0.08, 0.12, trackGain, 1800);
        if (stepInBar === 0 || stepInBar === 4 || stepInBar === 7 || stepInBar === 10 || stepInBar === 14) {
          const bassFreq = (stepInBar === 7 || stepInBar === 14) ? chord.bass * 1.5 : chord.bass;
          this.synthBass(time, bassFreq, stepDuration * 1.8, trackGain, 400);
        }
        if (stepInBar % 2 === 0) {
          this.synthHat(time, stepInBar % 4 === 2 ? 0.03 : 0.015, trackGain, 7000);
        }
        if (stepInBar === 0) {
          this.synthPad(time, chord.notes, stepDuration * 15, trackGain);
        }
        this.musicStep++;
        this.nextNoteTime += stepDuration;
      }
    };
    this.musicInterval = window.setInterval(scheduler, 25);
  }

  private startInGameScheduler(trackGain: GainNode) {
    const tempo = 132;
    const stepDuration = 60 / tempo / 4;
    const lookahead = 0.12;

    const progressions = [
      { root: 146.83, bassRoot: 73.42, arp: [293.66, 349.23, 440.0, 587.33] },
      { root: 174.61, bassRoot: 87.31, arp: [349.23, 440.0, 523.25, 698.46] },
      { root: 130.81, bassRoot: 65.41, arp: [261.63, 329.63, 392.0, 523.25] },
      { root: 116.54, bassRoot: 58.27, arp: [233.08, 293.66, 349.23, 466.16] },
    ];

    const scheduler = () => {
      if (!this.ctx || this.currentTrack !== 'ingame') return;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        const barIndex = Math.floor((this.musicStep / 16) % progressions.length);
        const section = progressions[barIndex];
        const stepInBar = this.musicStep % 16;
        const time = this.nextNoteTime;
        const bassFreq = (stepInBar % 2 === 1) ? section.bassRoot * 2 : section.bassRoot;
        this.synthRollingBass(time, bassFreq, stepDuration * 0.95, trackGain);
        if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) this.synthKick(time, trackGain);
        if (stepInBar === 4 || stepInBar === 12) this.synthSnare(time, trackGain);
        if (stepInBar % 2 === 1) this.synthHat(time, 0.04, trackGain, 9000);
        const arpIndex = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 3, 1, 2, 3, 1, 2][stepInBar];
        this.synthLeadArp(time, section.arp[arpIndex], trackGain);
        this.musicStep++;
        this.nextNoteTime += stepDuration;
      }
    };
    this.musicInterval = window.setInterval(scheduler, 25);
  }

  private startFinalDuelScheduler(trackGain: GainNode) {
    const tempo = 138;
    const stepDuration = 60 / tempo / 4;
    const lookahead = 0.12;

    const scheduler = () => {
      if (!this.ctx || this.currentTrack !== 'final-duel') return;
      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        const stepInBar = this.musicStep % 16;
        const time = this.nextNoteTime;
        if (stepInBar === 0) this.synthHeartbeat(time, 0.35, trackGain, true);
        else if (stepInBar === 2) this.synthHeartbeat(time, 0.25, trackGain, false);
        else if (stepInBar === 8) this.synthHeartbeat(time, 0.38, trackGain, true);
        else if (stepInBar === 10) this.synthHeartbeat(time, 0.28, trackGain, false);
        if (stepInBar === 0) this.synthDarkDrone(time, stepDuration * 16, trackGain);
        if (stepInBar % 2 === 0) {
          const tenseNotes = [311.13, 329.63, 369.99, 329.63, 311.13, 329.63, 440.0, 369.99];
          this.synthTensionPulse(time, tenseNotes[Math.floor(stepInBar / 2) % tenseNotes.length], trackGain);
        }
        if (stepInBar % 2 === 1) this.synthHat(time, 0.02, trackGain, 11000);
        this.musicStep++;
        this.nextNoteTime += stepDuration;
      }
    };
    this.musicInterval = window.setInterval(scheduler, 25);
  }

  private synthPluck(time: number, freq: number, type: OscillatorType, duration: number, gainLevel: number, dest: AudioNode, filterCutoff = 2000) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + duration);
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + duration);
  }

  private synthBass(time: number, freq: number, duration: number, dest: AudioNode, cutoff = 500) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + duration);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + duration);
  }

  private synthRollingBass(time: number, freq: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq / 2, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(250, time + duration);
    filter.Q.setValueAtTime(3.5, time);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        subOsc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    subOsc.start(time);
    osc.stop(time + duration);
    subOsc.stop(time + duration);
  }

  private synthPad(time: number, freqs: number[], duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    freqs.forEach((f) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, time);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, time);
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.035, time + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };
      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private synthLeadArp(time: number, freq: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.Q.setValueAtTime(2.0, time);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private synthKick(time: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.08);
    gain.gain.setValueAtTime(0.65, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private synthSnare(time: number, dest: AudioNode) {
    if (!this.ctx) return;
    const buffer = this.getNoiseBuffer(0.15);
    if (!buffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1400, time);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    const osc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
    toneGain.gain.setValueAtTime(0.3, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(toneGain);
    toneGain.connect(dest);
    noise.onended = () => {
      try {
        noise.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
      } catch {}
    };
    osc.onended = () => {
      try {
        osc.disconnect();
        toneGain.disconnect();
      } catch {}
    };
    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.15);
    osc.stop(time + 0.08);
  }

  private synthHat(time: number, gainLevel: number, dest: AudioNode, cutoff = 8000) {
    if (!this.ctx) return;
    const buffer = this.getNoiseBuffer(0.04);
    if (!buffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(cutoff, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    noise.start(time);
    noise.stop(time + 0.04);
  }

  private synthHeartbeat(time: number, gainLevel: number, dest: AudioNode, isPrimary: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = isPrimary ? 85 : 70;
    const endFreq = isPrimary ? 30 : 25;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.14);
    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + 0.18);
  }

  private synthDarkDrone(time: number, duration: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, time);
    filter.frequency.linearRampToValueAtTime(220, time + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(140, time + duration);
    filter.Q.setValueAtTime(4.0, time);
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + duration);
  }

  private synthTensionPulse(time: number, freq: number, dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, time);
    filter.Q.setValueAtTime(3.0, time);
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };
    osc.start(time);
    osc.stop(time + 0.08);
  }

  // --- PROCEDURAL SFX GENERATORS & STINGERS --- //

  public playClick(pitch = 800) {
    if (this.isMuted) return;
    if (this.shouldThrottle('click', 25)) return;
    const cfg = SOUND_REGISTRY['click'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.25 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 55);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playCountdownPitch(step: 3 | 2 | 1 | 'go' | number | string) {
    if (this.isMuted) return;
    if (this.shouldThrottle(`countdown_${step}`, 40)) return;
    const cfgBeep = SOUND_REGISTRY['countdownBeep'];
    const cfgGo = SOUND_REGISTRY['countdownGo'];
    if (step === 'go' && cfgGo?.file && this.playCustomAudio(cfgGo.file, cfgGo.volume)) return;
    if (typeof step === 'number' && cfgBeep?.file && this.playCustomAudio(cfgBeep.file, cfgBeep.volume)) return;

    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    if (step === 3 || step === '3') {
      this.synthCountdownTone(now, 523.25, 0.22, 'square');
    } else if (step === 2 || step === '2') {
      this.synthCountdownTone(now, 659.25, 0.22, 'square');
    } else if (step === 1 || step === '1') {
      this.synthCountdownTone(now, 783.99, 0.24, 'square');
      this.synthCountdownTone(now + 0.08, 783.99, 0.16, 'sawtooth');
    } else {
      const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      chord.forEach((freq, i) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.45);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 + i * 0.03);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        this.registerVoice([osc, gain], (0.55 + i * 0.03) * 1000);
        osc.start(now);
        osc.stop(now + 0.55 + i * 0.03);
      });
      this.synthLaserSweep(now);
    }
  }

  private synthCountdownTone(time: number, freq: number, duration: number, type: OscillatorType) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, time + duration);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    this.registerVoice([osc, gain], duration * 1000);
    osc.start(time);
    osc.stop(time + duration);
  }

  private synthLaserSweep(time: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.35);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    this.registerVoice([osc, gain], 420);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  public playCountdownBeep(isGo: boolean = false) {
    this.playCountdownPitch(isGo ? 'go' : 2);
  }

  /**
   * High-Performance Throttled Pellet / Item Pickup
   * Clamped to prevent audio node buffer exhaustion when 8 snakes consume pellets at once.
   */
  public playPickup(freq = 600) {
    if (this.isMuted) return;
    if (this.shouldThrottle('pickup', 30)) return;
    const cfg = SOUND_REGISTRY['pickup'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.8, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.28 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 110);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playPowerup(pitch = 520) {
    if (this.isMuted) return;
    if (this.shouldThrottle('powerup', 60)) return;
    const cfg = SOUND_REGISTRY['powerup'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const notes = [pitch, pitch * 1.25, pitch * 1.5, pitch * 2];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.3 * (cfg?.volume ?? 1.0), now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      this.registerVoice([osc, gain], (idx * 0.05 + 0.16) * 1000);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    });
  }

  public playBoost() {
    if (this.isMuted) return;
    if (this.shouldThrottle('boost', 50)) return;
    const cfg = SOUND_REGISTRY['boost'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.32 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 220);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playJump() {
    if (this.isMuted) return;
    if (this.shouldThrottle('jump', 40)) return;
    const cfg = SOUND_REGISTRY['jump'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.28 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 150);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  public playNitro() {
    if (this.isMuted) return;
    if (this.shouldThrottle('nitro', 60)) return;
    const cfg = SOUND_REGISTRY['nitro'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.35 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 230);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  public playZap() {
    if (this.isMuted) return;
    if (this.shouldThrottle('zap', 40)) return;
    const cfg = SOUND_REGISTRY['zap'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.35 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 160);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playHit() {
    if (this.isMuted) return;
    if (this.shouldThrottle('hit', 40)) return;
    const cfg = SOUND_REGISTRY['hit'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.45 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 170);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  public playTackle() {
    if (this.isMuted) return;
    if (this.shouldThrottle('tackle', 50)) return;
    const cfg = SOUND_REGISTRY['tackle'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.45 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 210);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playFreeze() {
    if (this.isMuted) return;
    if (this.shouldThrottle('freeze', 60)) return;
    const cfg = SOUND_REGISTRY['freeze'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(240, this.ctx.currentTime + 0.22);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.35 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, filter, gain], 250);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.24);
  }

  public playShockwave() {
    if (this.isMuted) return;
    if (this.shouldThrottle('shockwave', 60)) return;
    const cfg = SOUND_REGISTRY['shockwave'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.48 * (cfg?.volume ?? 1.0), this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 330);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.32);
  }

  public playElimination() {
    if (this.isMuted) return;
    if (this.shouldThrottle('elimination', 80)) return;
    const cfg = SOUND_REGISTRY['elimination'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const buffer = this.getNoiseBuffer(0.45);
    if (!buffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.4);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65 * (cfg?.volume ?? 1.0), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.35);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    this.registerVoice([noise, filter, gain, subOsc, subGain], 480);
    noise.start(now);
    subOsc.start(now);
    noise.stop(now + 0.45);
    subOsc.stop(now + 0.4);
  }

  public playEliminationStinger() {
    this.playElimination();
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const stingerOsc = this.ctx.createOscillator();
    const stingerGain = this.ctx.createGain();
    stingerOsc.type = 'sawtooth';
    stingerOsc.frequency.setValueAtTime(320, now);
    stingerOsc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    stingerGain.gain.setValueAtTime(0.35, now);
    stingerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    stingerOsc.connect(stingerGain);
    stingerGain.connect(this.sfxGain);
    this.registerVoice([stingerOsc, stingerGain], 370);
    stingerOsc.start(now);
    stingerOsc.stop(now + 0.35);
  }

  public playVictoryFanfare() {
    if (this.isMuted) return;
    const cfg = SOUND_REGISTRY['victory'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const melody = [
      { freq: 261.63, time: 0.00, dur: 0.12 },
      { freq: 329.63, time: 0.10, dur: 0.12 },
      { freq: 392.00, time: 0.20, dur: 0.12 },
      { freq: 523.25, time: 0.32, dur: 0.22 },
      { freq: 392.00, time: 0.52, dur: 0.12 },
      { freq: 523.25, time: 0.64, dur: 0.14 },
      { freq: 659.25, time: 0.78, dur: 0.16 },
      { freq: 783.99, time: 0.94, dur: 0.18 },
      { freq: 1046.50, time: 1.12, dur: 0.95 },
    ];
    melody.forEach((note) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(note.freq * 1.004, now + note.time);
      gain.gain.setValueAtTime(0.001, now + note.time);
      gain.gain.linearRampToValueAtTime(0.28 * (cfg?.volume ?? 1.0), now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);
      this.registerVoice([osc, osc2, gain], (note.time + note.dur) * 1000);
      osc.start(now + note.time);
      osc2.start(now + note.time);
      osc.stop(now + note.time + note.dur);
      osc2.stop(now + note.time + note.dur);
    });
  }

  public playDefeatStinger() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [392.0, 311.13, 261.63, 196.0, 130.81];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + idx * 0.12 + 0.3);
      gain.gain.setValueAtTime(0.3, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      this.registerVoice([osc, gain], (idx * 0.12 + 0.38) * 1000);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.35);
    });
  }

  public playHunterStinger() {
    if (this.isMuted) return;
    const cfg = SOUND_REGISTRY['stinger'];
    if (cfg?.file && this.playCustomAudio(cfg.file, cfg.volume)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 470);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  public playWheelTick(pitch = 1200) {
    if (this.isMuted) return;
    if (this.shouldThrottle('wheelTick', 20)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, this.ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 45);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  public playWheelWinner() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      this.registerVoice([osc, gain], (idx * 0.06 + 0.38) * 1000);
      osc.start(this.ctx.currentTime + idx * 0.06);
      osc.stop(this.ctx.currentTime + idx * 0.06 + 0.35);
    });
  }

  public playPointTally(pitch = 880) {
    if (this.isMuted) return;
    if (this.shouldThrottle('pointTally', 30)) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    this.registerVoice([osc, gain], 160);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playGrandCrownFanfare() {
    if (this.isMuted) return;
    this.init();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const chord1 = [392.00, 523.25, 659.25];
    const chord2 = [440.00, 554.37, 659.25];
    const chord3 = [523.25, 659.25, 783.99, 1046.50];

    const scheduleChord = (chord: number[], startTime: number, duration: number) => {
      chord.forEach((freq) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.22, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        this.registerVoice([osc, gain], (startTime + duration) * 1000);
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
      });
    };

    scheduleChord(chord1, 0.0, 0.22);
    scheduleChord(chord1, 0.25, 0.22);
    scheduleChord(chord2, 0.5, 0.28);
    scheduleChord(chord3, 0.82, 1.4);
  }
}

export const soundManager = new SoundManager();
