// ============================================================================
// HYPERCADE AUDIO REGISTRY & CUSTOMIZATION SYSTEM
// ============================================================================
// You can customize any sound effect or music track in this file.
//
// 1. To use a custom audio file (.mp3, .wav, .ogg):
//    - Place your audio file in the 'public/audio/sfx/' or 'public/audio/music/' folder.
//    - Set the 'file' property to its URL path, e.g. '/audio/sfx/my_boost.mp3'.
//
// 2. To adjust procedural sound parameters (pitch, volume, duration):
//    - Modify 'defaultFrequency', 'volume', or 'pitchMultiplier' below.
//
// 3. If 'file' is undefined or fails to load, Hypercade will automatically
//    fall back to its high-speed Web Audio procedural synthesizer with 0 latency!
// ============================================================================

export type SoundEffectKey =
  | 'click'
  | 'boost'
  | 'jump'
  | 'nitro'
  | 'elimination'
  | 'pickup'
  | 'zap'
  | 'hit'
  | 'tackle'
  | 'freeze'
  | 'shockwave'
  | 'stinger'
  | 'victory'
  | 'countdownBeep'
  | 'countdownGo'
  | 'powerup';

export type MusicTrackKey = 'lobby' | 'ingame' | 'final-duel';

export interface SoundEffectDefinition {
  name: string;
  category: 'ui' | 'combat' | 'movement' | 'ambient' | 'stinger';
  file?: string;              // Custom audio file path (e.g. '/audio/sfx/boost.mp3')
  volume: number;             // Volume multiplier (0.0 to 1.0)
  defaultFrequency?: number;  // Base frequency in Hz for procedural synth
  pitchMultiplier?: number;   // Pitch shift multiplier (1.0 = normal)
  durationMs?: number;        // Approximate duration
}

export interface MusicTrackDefinition {
  name: string;
  file?: string;              // Custom music file path (e.g. '/audio/music/lobby.mp3')
  volume: number;             // Volume multiplier (0.0 to 1.0)
  bpm: number;                // Tempo for procedural synth
  key: string;                // Musical root key (e.g. 'Am', 'Dm')
}

// ----------------------------------------------------------------------------
// SOUND EFFECT REGISTRY
// ----------------------------------------------------------------------------
export const SOUND_REGISTRY: Record<SoundEffectKey, SoundEffectDefinition> = {
  click: {
    name: 'UI Button Click',
    category: 'ui',
    file: undefined, // E.g. '/audio/sfx/click.mp3'
    volume: 0.65,
    defaultFrequency: 850,
  },
  boost: {
    name: 'Thruster / Speed Boost',
    category: 'movement',
    file: undefined, // E.g. '/audio/sfx/boost.mp3'
    volume: 0.75,
    defaultFrequency: 220,
  },
  jump: {
    name: '3D Platform / Laser Jump',
    category: 'movement',
    file: undefined, // E.g. '/audio/sfx/jump.mp3'
    volume: 0.70,
    defaultFrequency: 340,
  },
  nitro: {
    name: 'Neon Relay Nitro Surge',
    category: 'movement',
    file: undefined, // E.g. '/audio/sfx/nitro.mp3'
    volume: 0.80,
    defaultFrequency: 300,
  },
  elimination: {
    name: 'Player Elimination / Explosion',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/elimination.mp3'
    volume: 0.85,
    defaultFrequency: 110,
  },
  pickup: {
    name: 'Gem / Food / Relic Pickup',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/pickup.mp3'
    volume: 0.60,
    defaultFrequency: 650,
  },
  zap: {
    name: 'Laser Zap / Electric Hazard',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/zap.mp3'
    volume: 0.75,
    defaultFrequency: 750,
  },
  hit: {
    name: 'Physical Collision / Bump',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/hit.mp3'
    volume: 0.70,
    defaultFrequency: 180,
  },
  tackle: {
    name: 'Relic Rush Slam Tackle',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/tackle.mp3'
    volume: 0.80,
    defaultFrequency: 160,
  },
  freeze: {
    name: 'Sub-Zero Freeze Blast',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/freeze.mp3'
    volume: 0.75,
    defaultFrequency: 520,
  },
  shockwave: {
    name: 'EMP Stun Shockwave',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/shockwave.mp3'
    volume: 0.80,
    defaultFrequency: 140,
  },
  stinger: {
    name: 'Void Hunter Awakening Stinger',
    category: 'stinger',
    file: undefined, // E.g. '/audio/sfx/stinger.mp3'
    volume: 0.85,
    defaultFrequency: 120,
  },
  victory: {
    name: 'Victory Fanfare / Match End',
    category: 'stinger',
    file: undefined, // E.g. '/audio/sfx/victory.mp3'
    volume: 0.80,
    defaultFrequency: 440,
  },
  countdownBeep: {
    name: 'Countdown Tick (3, 2, 1)',
    category: 'ui',
    file: undefined, // E.g. '/audio/sfx/countdown_beep.mp3'
    volume: 0.65,
    defaultFrequency: 440,
  },
  countdownGo: {
    name: 'Countdown GO! Horn',
    category: 'ui',
    file: undefined, // E.g. '/audio/sfx/countdown_go.mp3'
    volume: 0.80,
    defaultFrequency: 880,
  },
  powerup: {
    name: 'Powerup Collection / Special',
    category: 'combat',
    file: undefined, // E.g. '/audio/sfx/powerup.mp3'
    volume: 0.70,
    defaultFrequency: 580,
  },
};

// ----------------------------------------------------------------------------
// MUSIC TRACK REGISTRY
// ----------------------------------------------------------------------------
export const MUSIC_REGISTRY: Record<MusicTrackKey, MusicTrackDefinition> = {
  lobby: {
    name: 'Chill Cyberpunk Street',
    file: '/audio/music/lobby_cyberpunk.mp3',
    volume: 0.40,
    bpm: 110,
    key: 'Am',
  },
  ingame: {
    name: 'Electronic Future Beats',
    file: '/audio/music/ingame_aggressive.mp3',
    volume: 0.38,
    bpm: 130,
    key: 'Dm',
  },
  'final-duel': {
    name: 'Calm Ambient Resonance',
    file: '/audio/music/calm_ambient.mp3',
    volume: 0.45,
    bpm: 148,
    key: 'Em',
  },
};
