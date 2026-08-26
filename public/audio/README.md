# 🎵 Hypercade Audio & Sound Customization Guide

This folder (`public/audio/`) is where you can place custom sound effects, music tracks, and ambient audio for Hypercade.

---

## 📁 Folder Structure

```
public/
├── audio/
│   ├── sfx/            # Sound Effects (.mp3, .wav, .ogg)
│   │   ├── click.mp3
│   │   ├── boost.mp3
│   │   ├── jump.mp3
│   │   ├── nitro.mp3
│   │   ├── elimination.mp3
│   │   ├── pickup.mp3
│   │   ├── zap.mp3
│   │   ├── hit.mp3
│   │   ├── tackle.mp3
│   │   ├── freeze.mp3
│   │   ├── shockwave.mp3
│   │   ├── stinger.mp3
│   │   ├── victory.mp3
│   │   └── countdown.mp3
│   ├── music/          # Background Music Tracks (.mp3, .ogg)
│   │   ├── lobby.mp3
│   │   ├── ingame.mp3
│   │   └── final_duel.mp3
│   └── ambient/        # Ambient Arena Loops (.mp3, .ogg)
│       ├── synthwave.mp3
│       └── cyber.mp3
└── images/             # Game Cover Images (.jpg, .png, .webp)
    ├── serpent-arena.jpg
    ├── neon-relay.jpg
    ├── void-tag.jpg
    ├── relic-rush.jpg
    └── last-platform.jpg
```

---

## 🎛️ How to Change Any Sound Effect

All sound effects and music tracks are configured in `src/audio/AudioConfig.ts`.

### Step 1: Drop your audio file
Put your `.mp3`, `.wav`, or `.ogg` file into `public/audio/sfx/` (e.g. `public/audio/sfx/my_boost.mp3`).

### Step 2: Update `src/audio/AudioConfig.ts`
Open `src/audio/AudioConfig.ts` and set the `file` path for that sound:

```typescript
export const SOUND_REGISTRY: Record<SoundEffectKey, SoundEffectDefinition> = {
  boost: {
    name: 'Rocket / Speed Boost',
    file: '/audio/sfx/my_boost.mp3', // <-- Set your custom audio path here!
    volume: 0.8,
  },
  // ...
};
```

---

## ⚡ Procedural Fallback System
If no audio file is provided (or if a file fails to load), Hypercade automatically uses its built-in **Web Audio Procedural Synthesizer** to generate 80s/90s arcade sound effects in real-time with zero latency and 0 external dependencies!
