# 🕹️ HYPERCADE — Multiplayer Party Game Platform

> A local-network party gaming platform for 2–8 players. One screen (TV/laptop), any number of phones as instant controllers via QR code or room code.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (frontend + backend together)
npm run dev

# 3. Open the host screen on your TV/laptop browser
http://localhost:5173

# 4. Players join on their phone (same WiFi)
http://<your-local-ip>:5173/controller
```

> **Finding your local IP**: Run `ip addr | grep 192.168` or `hostname -I` in terminal.

---

## 📁 Project Structure

```
mulltiplayer/
├── src/
│   ├── audio/                   # 🔊 Sound system
│   │   ├── AudioConfig.ts       # Sound registry & custom file paths
│   │   └── SoundManager.ts      # Web Audio API + custom file player
│   │
│   ├── components/ui/           # 🧩 Reusable UI components
│   │   ├── ArcadeButton.tsx     # Glowing arcade-style button
│   │   ├── AvatarSelector.tsx   # Player avatar/color picker
│   │   ├── GlassPanel.tsx       # Glassmorphism card panel
│   │   ├── QRCodeDisplay.tsx    # Room QR code generator
│   │   └── QRScannerModal.tsx   # In-app camera QR code scanner
│   │
│   ├── data/
│   │   └── games.ts             # Game catalog with titles, descriptions, cover art
│   │
│   ├── games/                   # 🎮 Individual game engines
│   │   ├── serpent-arena/       # Snake battle royale
│   │   │   ├── SerpentArenaEngine.ts
│   │   │   ├── SerpentAIBrain.ts
│   │   │   ├── SerpentSkinRenderer.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── neon-relay/          # Hovercraft circuit racing
│   │   │   ├── NeonRelayEngine.ts
│   │   │   ├── botAI.ts
│   │   │   └── particles.ts
│   │   │
│   │   ├── void-tag/            # Hunter vs Survivors
│   │   │   ├── VoidTagEngine.ts
│   │   │   └── VoidTagBotAI.ts
│   │   │
│   │   ├── relic-rush/          # Gem collection chaos
│   │   │   └── RelicRushEngine.ts
│   │   │
│   │   └── last-platform/       # Hex tile battle royale
│   │       ├── LastPlatformEngine.ts
│   │       ├── HexGrid.ts
│   │       ├── BotAI.ts
│   │       ├── LastPlatformRenderer.ts
│   │       └── ParticleSystem.ts
│   │
│   ├── multiplayer/
│   │   └── SocketClient.ts
│   │
│   ├── server/
│   │   └── gameServer.ts
│   │
│   ├── types/
│   │   └── index.ts             # Shared TypeScript types
│   │
│   └── views/                   # 🖥️ Main screens
│       ├── HomeView.tsx
│       ├── HostLobbyView.tsx
│       ├── GameView.tsx
│       └── ControllerView.tsx   # Mobile controller UI
│
├── public/
│   ├── audio/                   # 🎵 Drop your sound files here!
│   │   ├── README.md            # Audio customization guide
│   │   ├── sfx/                 # Sound effects
│   │   │   ├── boost.mp3
│   │   │   ├── zap.mp3
│   │   │   ├── click.mp3
│   │   │   ├── eat.mp3
│   │   │   └── death.mp3
│   │   ├── music/               # Background music
│   │   └── ambient/             # Ambient sounds
│   │
│   └── images/
│       └── games/               # Game cover art
│
├── package.json
├── vite.config.ts
├── tailwind.config.js           # Tailwind theme (arcade colors)
└── tsconfig.json
```

---

## 🎮 Games

### 🐍 Serpent Arena
Classic snake multiplayer battle royale.
- **Powerups**: ⚡ Hyper Boost (5s super-speed) · 👻 Ghost Hunt (10s phase through bodies)
- **Bot Personalities**: Collector, Aggressive, Ambusher
- **Controls**: Joystick → steer · Action1 → boost

### 🏎️ Neon Relay
Hovercraft circuit racing on a neon track.
- **Controls**: Joystick → steer · Action1 → jump · Action2 → nitro boost

### 👻 Void Tag
Hunter tags Survivors in a nebula arena.
- **Controls**: Joystick → move · Action1 → Phase Dash · Action2 → EMP Stun

### 💎 Relic Rush
Collect gems and steal from others.
- **Controls**: Joystick → move · Action1 → tackle · Action2 → shield

### 🏔️ Last Platform (Last Stand)
Hex tile battle royale — last one standing wins!
- **Mechanics**: Step on tiles → they crack (1.5s) → crumble (1s) → collapse! Storm shrinks the arena.
- **Abilities**: ⚡ Electric Freeze Shot (7s cooldown) freezes opponents for 2s
- **Controls**: Joystick → move · Action1 → jump/air-hop · Action2 → freeze shot

---

## 📱 Mobile Controller

Players open the controller URL on their phones (same WiFi as host).

### Joining
- **Scan QR Code**: Tap 📷 SCAN QR CODE → point at TV screen
- **Manual Code**: Type the 5-character party code from TV
- Pick pilot name, avatar, color → JOIN

### In-Game Layout (Landscape Mode)
```
+----------------------------------+
| [STATUS BAR - name, score, rank] |
+-------------------+--------------+
|                   | [ABILITY BTN]|
|  [360° JOYSTICK]  | [ACTION BTN] |
|                   | [🔥 ⚡ 👑 🎉] |
+-------------------+--------------+
```
> Rotate your phone sideways for the full landscape layout.

### Spectator Mode (After Elimination)
- **🌐 Arena Overview**: Watch full battle on TV
- **👤 Pilot Spectate**: Cycle through remaining players (< PREV / NEXT >)
- **Cheer Emotes**: 🔥 ⚡ 💀 👑 👏 🎉 sent live to the TV screen

---

## 🤖 Bot System

### Setting Difficulty
In the Waiting Arena, each bot has its own difficulty button:
`[🤖 EASY]` → `[🤖 MEDIUM]` → `[🤖 HARD]` (tap to cycle)

### Bot Personalities
| Personality | Behavior |
|-------------|----------|
| `aggressive` | Hunts nearest opponent |
| `defensive` | Stays safe, retreats when threatened |
| `collector` | Focuses on food/relics |
| `ambusher` | Waits at chokepoints, strikes fast |
| `chaotic` | Unpredictable mixed strategy |

---

## 🔊 Custom Audio

Replace sound files in `public/audio/sfx/` with your own MP3s:

| File | Used For |
|------|----------|
| `sfx/boost.mp3` | Boost / speed powerup |
| `sfx/zap.mp3` | Electric shoot / hit |
| `sfx/eat.mp3` | Food collection |
| `sfx/death.mp3` | Player elimination |
| `sfx/click.mp3` | UI button clicks |
| `music/menu_theme.mp3` | Lobby background music |
| `music/<gameId>.mp3` | In-game music per game |

See `public/audio/README.md` for the full sound registry API.

---

## 🛠️ Development

```bash
npm run dev              # Start dev server (hot reload)
npx tsc --noEmit        # Type check
npm run build           # Production build
npx tsx src/games/test_ai_simulation.ts  # Run bot AI tests (51 tests)
```

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (custom arcade theme) |
| Animations | Framer Motion |
| Realtime | Socket.IO |
| Server | Node.js + Express |
| Rendering | HTML5 Canvas 2D |
| Audio | Web Audio API + HTMLAudioElement |

---

## 🌐 Network Setup

All devices must be on the **same WiFi** network.

```
Host TV   → http://localhost:5173
Players   → http://192.168.x.x:5173/controller
```

> **Camera on mobile**: Browsers require HTTPS or localhost for camera access.
> If on local HTTP WiFi, players can still join by typing the party code manually.

---

## 🏗️ Adding a New Game

1. Create `src/games/<game-id>/` folder
2. Implement `<GameId>Engine.ts` with `update()`, `getPlayerHUDState()`, `getMatchResults()`
3. Add bot AI in `<GameId>BotAI.ts`
4. Register in `src/data/games.ts`
5. Add types in `src/types/index.ts`

---

MIT License · Built with ❤️ for party game chaos
