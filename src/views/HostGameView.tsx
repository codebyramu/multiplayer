import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomState, ControllerInput, MatchResults, GameEventPayload, PlayerClientHUDState, EmoteReaction } from '../types';
import { GAMES_DATA } from '../data/games';
import { NeonRelayEngine } from '../games/neon-relay';
import { VoidTagEngine } from '../games/void-tag';
import { RelicRushEngine } from '../games/relic-rush';
import { LastPlatformEngine } from '../games/last-platform';
import { SerpentArenaEngine } from '../games/serpent-arena';
import { socketClient } from '../multiplayer/SocketClient';
import { soundManager } from '../audio/SoundManager';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { 
  Trophy, Clock, Volume2, VolumeX, Shield, Zap, Pause, Play, RotateCcw, Home, Sparkles, Skull, Crown, Flame 
} from 'lucide-react';

interface HostGameViewProps {
  room: RoomState;
  remoteInputs: Record<string, ControllerInput>;
  onBroadcastHUDState?: (hudState: PlayerClientHUDState) => void;
  onGameEvent?: (event: GameEventPayload) => void;
  onMatchEnd: (results: MatchResults) => void;
  onReturnToLobby: () => void;
}

interface BannerAnnouncement {
  id: string;
  type: 'elimination' | 'hunter' | 'leader' | 'finish' | 'general';
  text: string;
  subtext?: string;
  icon?: string;
  color?: string;
  timestamp: number;
}

export const HostGameView: React.FC<HostGameViewProps> = ({
  room,
  remoteInputs,
  onBroadcastHUDState,
  onGameEvent,
  onMatchEnd,
  onReturnToLobby,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const lastUIUpdateRef = useRef<number>(0);

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [matchTime, setMatchTime] = useState<number>(room.config.roundDuration || 90);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [topScores, setTopScores] = useState<Array<{ id: string; name: string; score: number; color: string }>>([]);
  
  // Dynamic On-Screen TV Announcement Banner
  const [activeAnnouncement, setActiveAnnouncement] = useState<BannerAnnouncement | null>(null);
  
  // Dramatic Full-Screen Victory Climax
  const [victoryAnnouncement, setVictoryAnnouncement] = useState<MatchResults | null>(null);

  // Floating Spectator Emote Reactions
  const [floatingEmotes, setFloatingEmotes] = useState<EmoteReaction[]>([]);

  // Powerup drop/collect announcement banners (top-right, stacked, max 3)
  const [powerupAnnouncements, setPowerupAnnouncements] = useState<
    Array<{ id: string; text: string; color: string }>
  >([]);

  // Local Host Keyboard state (WASD / Arrows + Space / Shift)
  const keyState = useRef<{ [key: string]: boolean }>({});

  const currentGameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];

  // Setup Keyboard Listeners for Host Player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyState.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keyState.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Listen for Spectator / Player Emote Reactions
  useEffect(() => {
    const unbindEmote = socketClient.on('emote-reaction', (emote: EmoteReaction) => {
      setFloatingEmotes((prev) => [...prev.slice(-15), emote]);
      soundManager.playClick(1200);

      // Auto-prune after 3.2s
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((e) => e.id !== emote.id));
      }, 3200);
    });

    return () => {
      unbindEmote();
    };
  }, []);

  // Compute local host controller input from keyboard
  const getLocalHostInput = useCallback((): ControllerInput => {
    let dx = 0;
    let dy = 0;
    const keys = keyState.current;

    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    const action1 = !!(keys['Space'] || keys['ShiftLeft'] || keys['KeyJ']);
    const action2 = !!(keys['KeyE'] || keys['KeyK'] || keys['ControlLeft']);

    const len = Math.sqrt(dx * dx + dy * dy);
    const normX = len > 0 ? dx / len : 0;
    const normY = len > 0 ? dy / len : 0;
    const angle = Math.atan2(normY, normX);

    return {
      x: normX,
      y: normY,
      angle,
      magnitude: len > 0 ? 1 : 0,
      action1,
      action2,
      timestamp: Date.now(),
    };
  }, []);

  // Trigger TV Banner Announcement
  const showBannerAnnouncement = useCallback((announcement: Omit<BannerAnnouncement, 'id' | 'timestamp'>) => {
    const newBanner: BannerAnnouncement = {
      ...announcement,
      id: `banner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setActiveAnnouncement(newBanner);
    setTimeout(() => {
      setActiveAnnouncement((curr) => (curr?.id === newBanner.id ? null : curr));
    }, 2800);
  }, []);

  // Show a small top-right powerup announcement banner (stacked, max 3)
  const showPowerupAnnouncement = useCallback((text: string, color: string, duration: number = 2500) => {
    const id = `pu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setPowerupAnnouncements((prev) => [...prev.slice(-2), { id, text, color }]);
    setTimeout(() => {
      setPowerupAnnouncements((prev) => prev.filter((a) => a.id !== id));
    }, duration);
  }, []);

  // Track eliminated players to trigger elimination banners
  const eliminatedPlayersRef = useRef<Set<string>>(new Set());

  // Initialize Game Engine on Mount
  useEffect(() => {
    eliminatedPlayersRef.current.clear();
    const playersMap = room.players;
    const selected = room.selectedGame;

    if (selected === 'neon-relay') {
      const engine = new NeonRelayEngine({ roundDuration: room.config.roundDuration || 90 });
      engine.init(playersMap);
      engineRef.current = engine;
    } else if (selected === 'void-tag') {
      const engine = new VoidTagEngine(
        playersMap, 
        undefined, 
        { roundDuration: room.config.roundDuration || 90 },
        (evt) => {
          if (evt.type === 'player_tagged') {
            const hunter = (evt.playerId && room.players[evt.playerId]?.name) || 'Hunter';
            const victim = (evt.targetId && room.players[evt.targetId]?.name) || 'Survivor';
            showBannerAnnouncement({
              type: 'hunter',
              text: `⚡ ${victim.toUpperCase()} WAS TAGGED BY ${hunter.toUpperCase()}!`,
              subtext: 'VOID CORRUPTION SPREADING',
              color: '#9D4EDD',
              icon: '⚡',
            });
            soundManager.playHunterStinger();
          } else if (evt.type === 'last_survivor') {
            showBannerAnnouncement({
              type: 'finish',
              text: evt.text || 'LAST SURVIVOR!',
              subtext: 'AVOID CORRUPTION TO WIN',
              color: '#FFB224',
              icon: '👑',
            });
            soundManager.playVictoryFanfare();
          } else if (evt.type === 'hunter_chosen') {
            showBannerAnnouncement({
              type: 'hunter',
              text: evt.text || 'VOID HUNTER AWAKENED',
              subtext: 'THE VOID HUNT HAS BEGUN',
              color: '#FF0055',
              icon: '👁️',
            });
          }
          if (onGameEvent) onGameEvent(evt as any);
        }
      );
      engineRef.current = engine;
    } else if (selected === 'relic-rush') {
      const engine = new RelicRushEngine(playersMap, { matchDuration: room.config.roundDuration || 90 });
      engine.onSound = (sound, pitch) => {
        if (sound === 'pickup') soundManager.playPickup(pitch || 600);
        else if (sound === 'boost') soundManager.playBoost();
        else if (sound === 'zap') soundManager.playZap();
        else if (sound === 'hit') soundManager.playHit();
        else if (sound === 'elimination') soundManager.playElimination();
        else if (sound === 'fanfare') soundManager.playVictoryFanfare();
        else if (sound === 'stinger') soundManager.playHunterStinger();
      };
      engine.onEvent = (evt) => {
        if (evt.type === 'eliminate') {
          const target = evt.targetPlayerId ? room.players[evt.targetPlayerId]?.name : 'Contender';
          showBannerAnnouncement({
            type: 'elimination',
            text: `💀 ${target?.toUpperCase()} DROPPED ALL RELICS!`,
            subtext: 'RELIC VAULT DISPERSED',
            color: '#FF3366',
            icon: '💀',
          });
          soundManager.playElimination();
        } else if (evt.type === 'announcement' && evt.payload) {
          showBannerAnnouncement({
            type: 'leader',
            text: evt.payload.title || 'VAULT SURGE!',
            subtext: evt.payload.description || '',
            color: '#FF007F',
            icon: '💎',
          });
        } else if (evt.type === 'hit' && evt.payload) {
          showBannerAnnouncement({
            type: 'elimination',
            text: evt.payload.text || 'RELIC SPILL!',
            subtext: 'GEMS SCATTERED ACROSS VAULT',
            color: '#FFB224',
            icon: '💥',
          });
        }
        if (onGameEvent) onGameEvent(evt);
      };
      engineRef.current = engine;
    } else if (selected === 'last-platform') {
      const engine = new LastPlatformEngine(
        room,
        (evt) => {
          if (evt.type === 'eliminate') {
            const pName = evt.targetPlayerId ? room.players[evt.targetPlayerId]?.name : 'Contender';
            showBannerAnnouncement({
              type: 'elimination',
              text: `💀 ${pName?.toUpperCase()} FELL INTO THE VOID!`,
              subtext: 'PLATFORM COLLAPSED',
              color: '#FF3366',
              icon: '💀',
            });
            soundManager.playElimination();
          } else if (evt.type === 'announcement' && evt.payload) {
            showBannerAnnouncement({
              type: 'finish',
              text: evt.payload.title || 'SUDDEN DEATH!',
              subtext: evt.payload.description || '',
              color: '#FF0055',
              icon: '⚡',
            });
          }
          if (onGameEvent) onGameEvent(evt);
        },
        { roundDuration: room.config.roundDuration || 75 }
      );
      engineRef.current = engine;
    } else {
      // Default: SERPENT ARENA
      const engine = new SerpentArenaEngine(playersMap, { roundDuration: room.config.roundDuration || 120 });
      engine.onEvent((evt) => {
        if (evt.type === 'eliminate') {
          const victim = evt.targetPlayerId ? room.players[evt.targetPlayerId]?.name : 'Serpent';
          showBannerAnnouncement({
            type: 'elimination',
            text: `💀 ${victim?.toUpperCase()} DESTROYED IN BATTLE!`,
            subtext: 'MASSIVE ENERGY BURST RELEASED',
            color: '#FF3366',
            icon: '💥',
          });
          soundManager.playElimination();
        } else if (evt.type === 'announcement' && evt.payload) {
          // Powerup-style announcements carry text + color → top-right pill overlay
          if (evt.payload.text && evt.payload.color) {
            showPowerupAnnouncement(
              evt.payload.text,
              evt.payload.color,
              evt.payload.duration ?? 2500,
            );
          } else {
            // Match-level announcements (e.g. match end) → center banner
            showBannerAnnouncement({
              type: 'leader',
              text: evt.payload.title || 'ARENA SURGE',
              subtext: evt.payload.description || '',
              color: '#FFB224',
              icon: '🌟',
            });
          }
        }
        if (onGameEvent) onGameEvent(evt);
      });
      engineRef.current = engine;
    }

    lastTimeRef.current = performance.now();
    soundManager.playCountdownBeep(true);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [room.selectedGame, showBannerAnnouncement, showPowerupAnnouncement, room.players, room.config.roundDuration]);

  const remoteInputsRef = useRef(remoteInputs);
  remoteInputsRef.current = remoteInputs;

  const roomRef = useRef(room);
  roomRef.current = room;

  const onBroadcastHUDStateRef = useRef(onBroadcastHUDState);
  onBroadcastHUDStateRef.current = onBroadcastHUDState;

  const onGameEventRef = useRef(onGameEvent);
  onGameEventRef.current = onGameEvent;

  const onMatchEndRef = useRef(onMatchEnd);
  onMatchEndRef.current = onMatchEnd;

  const matchEndedRef = useRef<boolean>(false);

  // Main 60 FPS Simulation & Render Loop
  useEffect(() => {
    matchEndedRef.current = false;

    const gameLoop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // Cap delta time to prevent physics tunneling
      lastTimeRef.current = time;

      const engine = engineRef.current;
      const canvas = canvasRef.current;
      const currentRoom = roomRef.current;
      const currentRemoteInputs = remoteInputsRef.current;

      if (engine && canvas && !isPaused) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Adjust canvas size to window size with DPR
          const width = window.innerWidth;
          const height = window.innerHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
          }

          ctx.save();
          ctx.scale(dpr, dpr);

          // Combine Local Keyboard Host input + Remote Mobile Controller inputs with strict sanitization
          const localInput = getLocalHostInput();
          const combinedInputs: Record<string, ControllerInput> = {};

          for (const pid in currentRemoteInputs) {
            const raw = currentRemoteInputs[pid];
            if (raw) {
              const cx = Math.max(-1, Math.min(1, Number(raw.x) || 0));
              const cy = Math.max(-1, Math.min(1, Number(raw.y) || 0));
              const cmag = Math.max(0, Math.min(1, Number(raw.magnitude) || 0));
              combinedInputs[pid] = {
                x: cx,
                y: cy,
                angle: Number(raw.angle) || Math.atan2(cy, cx),
                magnitude: cmag,
                action1: Boolean(raw.action1),
                action2: Boolean(raw.action2),
                timestamp: Number(raw.timestamp) || Date.now(),
              };
            }
          }
          
          // Assign local keyboard input to host player if present and not overridden
          for (const pid in currentRoom.players) {
            if (currentRoom.players[pid].isHost && !combinedInputs[pid]) {
              combinedInputs[pid] = localInput;
            }
          }

          // 1. Authoritative Engine Physics Tick
          engine.tick(dt, combinedInputs);

          // 1b. Drain Event Queue from Engines (e.g. NeonRelay)
          if (typeof engine.getEvents === 'function') {
            const events = engine.getEvents();
            for (const evt of events) {
              if (evt.type === 'announcement' && evt.payload) {
                showBannerAnnouncement({
                  type: 'leader',
                  text: evt.payload.title || 'CIRCUIT ALERT!',
                  subtext: evt.payload.description || '',
                  color: '#00E5FF',
                  icon: '⚡',
                });
              } else if (evt.type === 'hit') {
                soundManager.playHit();
              }
              if (onGameEventRef.current) onGameEventRef.current(evt);
            }
          }

          // 2. High-Performance Canvas Rendering
          engine.render(ctx, width, height);

          ctx.restore();

          // 3. Optimized Throttle for React State Updates & Network Broadcast (10 Hz)
          const rem = typeof engine.timeRemaining === 'number' 
            ? engine.timeRemaining 
            : typeof engine.matchTimeRemaining === 'number' 
            ? engine.matchTimeRemaining 
            : typeof engine.matchTime === 'number' && engine.config?.roundDuration 
            ? Math.max(0, engine.config.roundDuration - engine.matchTime) 
            : 0;

          const now = performance.now();
          const shouldUpdateUI = !lastUIUpdateRef.current || (now - lastUIUpdateRef.current >= 100);

          if (shouldUpdateUI) {
            lastUIUpdateRef.current = now;
            const ceilRem = Math.ceil(rem);
            setMatchTime((prev) => (prev !== ceilRem ? ceilRem : prev));

            // 4. Check for Player Eliminations & Broadcast HUD states
            for (const pid in currentRoom.players) {
              const hud = engine.getPlayerHUDState?.(pid);
              if (hud && onBroadcastHUDStateRef.current) {
                onBroadcastHUDStateRef.current(hud);
              }

              // Detection for Last Platform / Void Tag eliminations
              if (hud && hud.status === 'eliminated' && !eliminatedPlayersRef.current.has(pid)) {
                eliminatedPlayersRef.current.add(pid);
                const pName = currentRoom.players[pid]?.name || 'Contender';
                showBannerAnnouncement({
                  type: 'elimination',
                  text: `💀 ${pName.toUpperCase()} HAS BEEN ELIMINATED!`,
                  subtext: 'OUT OF THE ARENA',
                  color: '#FF3366',
                  icon: '💀',
                });
                soundManager.playElimination();
              }
            }

            // Update HUD leaderboard
            const results = engine.getResults?.();
            if (results && results.rankings) {
              setTopScores(
                results.rankings.slice(0, 5).map((r: any) => ({
                  id: r.id,
                  name: r.name,
                  score: r.score,
                  color: r.color,
                }))
              );
            }
          }

          // 5. Check for Match End / Victory Condition (Host Authoritative)
          const results = engine.getResults?.();
          const isFinished = results && (
            (results.timeRemaining !== undefined && results.timeRemaining <= 0) ||
            (rem <= 0 && results.durationSeconds > 0) ||
            engine.isGameOver ||
            engine.state === 'finished' ||
            engine.isMatchOver
          );

          if (isFinished && !matchEndedRef.current) {
            matchEndedRef.current = true;
            soundManager.playVictoryFanfare();
            const safeResults: MatchResults = {
              gameId: results?.gameId || currentRoom.selectedGame,
              winnerId: results?.winnerId || (results?.rankings && results.rankings[0]?.id) || Object.keys(currentRoom.players)[0] || '',
              winnerName: results?.winnerName || (results?.rankings && results.rankings[0]?.name) || Object.values(currentRoom.players)[0]?.name || 'Arena Champion',
              winnerAvatar: results?.winnerAvatar || (results?.rankings && results.rankings[0]?.avatar) || Object.values(currentRoom.players)[0]?.avatar || 'ship',
              winnerColor: results?.winnerColor || (results?.rankings && results.rankings[0]?.color) || Object.values(currentRoom.players)[0]?.color || '#00F5A0',
              rankings: (results?.rankings && results.rankings.length > 0)
                ? results.rankings
                : Object.values(currentRoom.players).map((p, idx) => ({
                    id: p.id,
                    name: p.name,
                    score: p.score || 0,
                    rank: idx + 1,
                    avatar: p.avatar,
                    color: p.color,
                    isBot: p.isBot,
                  })),
              durationSeconds: results?.durationSeconds || Math.round(currentRoom.config.roundDuration || 90),
              mvpStat: results?.mvpStat || 'Arena Champion',
            };
            setVictoryAnnouncement(safeResults);

            // Keep dramatic on-screen TV victory freeze & fanfare for 1.8s before opening podium
            setTimeout(() => {
              if (onMatchEndRef.current) onMatchEndRef.current(safeResults);
            }, 1800);
            return;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPaused, getLocalHostInput, showBannerAnnouncement]);

  const togglePause = () => {
    setIsPaused(!isPaused);
    soundManager.playClick(800);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    soundManager.setMuted(nextMuted);
    setIsMuted(nextMuted);
  };

  const minutes = Math.floor(matchTime / 60);
  const seconds = matchTime % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isTimeUrgent = matchTime <= 10 && matchTime > 0;

  return (
    <div className="fixed inset-0 bg-arcade-bg overflow-hidden select-none">
      {/* 1. Main Authoritative 60FPS Game Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* 2. Top Non-Overlapping TV HUD Overlay (Optimized for 3-5m Readability) */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none gap-4">
        {/* Top-Left: Game Title & Giant Party Code Badge */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <GlassPanel className="px-4 py-2.5 flex items-center gap-3 border-white/15 bg-black/70 backdrop-blur-md shadow-lg">
            <span className="w-3 h-3 rounded-full bg-arcade-mint animate-ping" />
            <div>
              <h1 className="font-arcade text-sm md:text-base text-arcade-cream tracking-wide">
                {currentGameMeta.title}
              </h1>
              <span className="text-[10px] font-mono text-arcade-cream-muted uppercase">
                {currentGameMeta.category}
              </span>
            </div>
            <div className="ml-2 px-2.5 py-1 rounded-lg bg-arcade-amber/20 border border-arcade-amber/40 text-arcade-amber font-arcade text-xs font-black tracking-widest shadow-glow-amber">
              {room.code}
            </div>
          </GlassPanel>
        </div>

        {/* Top-Center: Giant High-Contrast Match Clock & Timer Bar */}
        <div className="flex flex-col items-center pointer-events-auto">
          <div
            className={`px-6 py-2 rounded-2xl border-2 backdrop-blur-md transition-all shadow-2xl flex items-center gap-2.5 ${
              isTimeUrgent
                ? 'bg-arcade-crimson/30 border-arcade-crimson text-arcade-crimson shadow-[0_0_30px_rgba(255,51,102,0.8)] scale-110 animate-pulse'
                : 'bg-black/75 border-arcade-amber/40 text-arcade-amber shadow-glow-amber'
            }`}
          >
            <Clock className={`w-5 h-5 ${isTimeUrgent ? 'animate-bounce' : ''}`} />
            <span className="font-arcade text-2xl md:text-4xl font-black tracking-widest leading-none drop-shadow-[0_0_15px_currentColor]">
              {formattedTime}
            </span>
          </div>
          {isTimeUrgent && (
            <span className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-arcade-crimson animate-ping">
              FINAL SECONDS!
            </span>
          )}
        </div>

        {/* Top-Right: Live Leaderboard Pill & Utility Controls */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Live Leaderboard */}
          <GlassPanel className="hidden md:flex flex-col gap-1.5 p-3.5 border-white/15 bg-black/75 min-w-[210px] shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-arcade-cream-muted uppercase border-b border-white/10 pb-1">
              <span className="flex items-center gap-1.5 text-arcade-amber">
                <Trophy className="w-3.5 h-3.5" /> LIVE RANK
              </span>
              <span>SCORE</span>
            </div>
            <div className="space-y-1">
              {topScores.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 truncate max-w-[130px]">
                    <span className="text-white/40 font-bold text-[11px]">#{idx + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: p.color }} />
                    <span className="text-arcade-cream font-bold truncate">{p.name}</span>
                  </div>
                  <span className="text-arcade-amber font-black text-xs">{p.score}</span>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Audio & Pause Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-3 rounded-2xl bg-black/75 border border-white/15 text-arcade-cream hover:bg-white/10 backdrop-blur-md transition-all shadow-md active:scale-95"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-arcade-crimson" /> : <Volume2 className="w-5 h-5 text-arcade-mint" />}
            </button>

            <button
              onClick={togglePause}
              className="p-3 rounded-2xl bg-black/75 border border-white/15 text-arcade-cream hover:bg-white/10 backdrop-blur-md transition-all shadow-md active:scale-95"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-5 h-5 text-arcade-mint fill-current" /> : <Pause className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 3. DYNAMIC ON-SCREEN ELIMINATION & EVENT BANNER (Top Center) */}
      <AnimatePresence>
        {activeAnnouncement && (
          <motion.div
            key={activeAnnouncement.id}
            initial={{ y: -60, scale: 0.8, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -40, scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div
              className="px-8 py-3.5 rounded-2xl border-2 backdrop-blur-xl shadow-2xl flex items-center gap-3.5 text-center bg-black/85"
              style={{
                borderColor: activeAnnouncement.color || '#FF3366',
                boxShadow: `0 0 40px ${activeAnnouncement.color || '#FF3366'}60`,
              }}
            >
              <span className="text-2xl">{activeAnnouncement.icon || '⚡'}</span>
              <div>
                <h3
                  className="font-arcade text-base sm:text-lg md:text-xl font-black tracking-wider drop-shadow-md"
                  style={{ color: activeAnnouncement.color || '#FF3366' }}
                >
                  {activeAnnouncement.text}
                </h3>
                {activeAnnouncement.subtext && (
                  <p className="text-[11px] font-mono text-white/80 font-bold uppercase tracking-widest mt-0.5">
                    {activeAnnouncement.subtext}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3b. POWERUP DROP / COLLECT ANNOUNCEMENTS — Top-Right Stacked Pills */}
      <div className="absolute top-16 right-4 z-30 flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {powerupAnnouncements.map((ann) => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="px-3 py-1.5 rounded-xl font-arcade text-xs font-black border shadow-lg backdrop-blur-sm bg-black/80 max-w-xs"
              style={{
                color: ann.color,
                borderColor: ann.color,
                boxShadow: `0 0 16px ${ann.color}55`,
              }}
            >
              {ann.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 4. FLOATING SPECTATOR EMOTE PARTICLES (Rendered from Phone Controllers) */}
      <div className="absolute inset-0 pointer-events-none z-25 overflow-hidden">
        {floatingEmotes.map((emote) => (
          <div
            key={emote.id}
            className="absolute bottom-10 flex flex-col items-center animate-float-emote"
            style={{
              left: `${emote.x * 100}%`,
            }}
          >
            <span className="text-5xl md:text-6xl drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">
              {emote.emoji}
            </span>
            <span
              className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-black shadow-md uppercase truncate max-w-[100px]"
              style={{ backgroundColor: emote.senderColor || '#FFB224' }}
            >
              {emote.senderName}
            </span>
          </div>
        ))}
      </div>

      {/* 5. DRAMATIC FULL-SCREEN VICTORY ANNOUNCEMENT OVERLAY */}
      <AnimatePresence>
        {victoryAnnouncement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl pointer-events-none"
          >
            <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-arcade-surface via-arcade-card to-black border-4 border-arcade-amber shadow-[0_0_100px_rgba(255,178,36,0.8)] text-center max-w-xl w-full space-y-4">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-7xl sm:text-8xl mx-auto"
              >
                👑
              </motion.div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-arcade-amber/25 border border-arcade-amber text-arcade-amber font-mono text-sm font-black uppercase tracking-widest shadow-glow-amber">
                <Trophy className="w-4 h-4 text-arcade-amber" />
                <span>MATCH CONCLUDED</span>
              </div>
              <h2 className="font-arcade text-3xl sm:text-5xl text-white font-black drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]">
                {victoryAnnouncement.winnerName.toUpperCase()}
              </h2>
              <p className="font-arcade text-lg sm:text-2xl text-arcade-amber font-black tracking-wide">
                ARENA CHAMPION &bull; {victoryAnnouncement.rankings[0]?.score || 0} PTS
              </p>
              <div className="pt-2 text-xs font-mono text-white/60 uppercase tracking-widest animate-pulse">
                [ SYNCHRONIZING VICTORY PODIUM... ]
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Bottom Keyboard Controls Guide for Host Player */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none hidden sm:block">
        <GlassPanel className="px-3.5 py-2 text-[11px] font-mono font-bold text-white/80 flex items-center gap-3.5 border-white/15 bg-black/75 backdrop-blur-md shadow-md">
          <span>🎮 HOST: <strong className="text-arcade-amber">WASD / ARROWS</strong></span>
          <span>⚡ BOOST/ACTION 1: <strong className="text-arcade-cyan">SPACE</strong></span>
          <span>🛡️ ABILITY/ACTION 2: <strong className="text-arcade-mint">E / SHIFT</strong></span>
        </GlassPanel>
      </div>

      {/* 7. Pause Menu Modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <GlassPanel className="w-full max-w-sm p-6 text-center space-y-5 border-arcade-amber/50 shadow-glow-amber bg-black/90">
            <h3 className="font-arcade text-xl text-arcade-cream">MATCH PAUSED</h3>
            <p className="text-xs font-mono text-arcade-cream-muted">
              Simulation halted. All mobile controller inputs are buffered.
            </p>
            <div className="space-y-3">
              <ArcadeButton
                variant="amber"
                size="lg"
                icon={<Play className="w-4 h-4 fill-current" />}
                fullWidth
                onClick={togglePause}
              >
                RESUME MATCH
              </ArcadeButton>
              <ArcadeButton
                variant="neutral"
                size="md"
                icon={<Home className="w-4 h-4" />}
                fullWidth
                onClick={onReturnToLobby}
              >
                EXIT TO LOBBY
              </ArcadeButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

