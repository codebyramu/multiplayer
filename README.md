# 🕹️ HYPERCADE — Living Room Multiplayer Platform

> Next-Generation WebRTC P2P Party Game Platform for 1–8 Players. One big screen (TV/laptop host), phone controllers via QR scan or party code, 60 FPS authoritative canvas physics, and intelligent Bot AI.

---

## 🎮 6 Dynamic Multiplayer Arcade Games

1. 🐍 **Serpent Arena**: Cyber snake battle royale with boost mass-burning, singularity gravitational storms, dynamic group centroid camera zoom, and predatory coiling bots.
2. 🏎️ **Neon Relay**: High-speed cyberpunk hovercraft racing with drifting, 3D barrier-clearing jumps (`jumpZ > 12`), drafting slipstreams, and sequential lap timers.
3. ⚡ **Void Tag**: Hunter vs. Survivors infection tag with light sanctuary energy shielding, phase dash evasions, and EMP stun pulses.
4. 💎 **Relic Rush**: Fast-paced gem collection chaos featuring high-speed kinetic tackles, gem scatter physics, kinetic shield deflections, and cosmic core bounty rushes.
5. 🛑 **Last Platform**: Hexagonal platform survival arena with collapsing tile decay matrices, 3D jump & air-hops, 7-second electric freeze projectiles, and offensive dash shoves.
6. 🔦 **Shadow Outrun (Chore Police / Flashlight Heist)**: Flashlight raycasting with 35% speed slow on illuminated fugitives, coin scavenging, dynamic deputy conversions, and 3 voting maps (*Backrooms Labyrinth, Dungeon Catacombs, Cyber Vault*).

---

## 🤖 Multi-Tier Bot AI Heuristics

Every game features fully autonomous Bot AI with three distinct difficulty tiers:
* 🟢 **Easy**: Relaxed reaction windows (~0.25-0.3s), casual wandering, 20% ability usage probability.
* 🟡 **Medium**: Balanced tactical decisions (~0.08-0.12s), objective pathing, resource prioritization, and defensive counter-abilities.
* 🔴 **Hard**: Razor-sharp frame-perfect reactions (~0.01-0.03s), raycast lead trajectory prediction, draft slingshots, coordinate deputy flanking, and offensive shoving.

*Note: In the Themed Waiting Arena, the host can dynamically toggle each individual bot's difficulty (`EASY`, `MEDIUM`, `HARD`) with live sound and badge feedback.*

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start frontend + multiplayer signaling backend
npm run dev

# 3. Open on your TV / Main Screen
http://localhost:5173

# 4. Join on Smartphone Gamepad (same WiFi or local network)
http://<your-local-ip>:5173
```

---

## 📱 Mobile Gamepad Controller Features

* **360° Virtual Analog Joystick**: Precision pointer-captured joystick with spring physics and zero-latency WebRTC DataChannel transport.
* **Instant In-App QR Scanner**: Built-in camera scanner with automatic party code detection.
* **Dedicated Round Lost Screen**: Shows animated round lost banner, live reaction emote cheer bar (`🔥`, `⚡`, `💀`, `👑`, `👏`, `🎉`), and live spectator POV camera switcher.
* **Pre-Match Map Voting**: Direct mobile voting for *Shadow Outrun* maps with real-time leading indicator synchronization.

---

## 🛠️ Architecture & Tech Stack

* **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Canvas 2D Engine.
* **Audio Engine**: Procedural Web Audio API synthesizer with Master Dynamics Compressor and natural Web Speech AI voiceover narration.
* **Networking**: WebRTC Direct DataChannels (`maxRetransmits: 0`) with resilient Socket.IO fallback.
* **Performance**: 60 FPS authoritative game loop with delta-time clamping, throttled 10 Hz UI synchronization, and zero memory leaks.

---

## 📄 License
MIT © Hypercade Team
