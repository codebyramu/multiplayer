import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { RoomState, GameId, TournamentMode } from '../types';
import { GAMES_DATA } from '../data/games';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { MysteryWheelModal } from '../components/ui/MysteryWheelModal';
import { TournamentEngine } from '../multiplayer/TournamentEngine';
import {
  Tv, QrCode, Play, Users, Bot, Settings,
  Sparkles, Check, ChevronLeft, ChevronRight, X, Trophy, Shuffle, Flame, ChevronDown, ChevronUp,
  ArrowRight, ArrowLeft, ShieldAlert, Cpu
} from 'lucide-react';
import { soundManager } from '../audio/SoundManager';
import { socketClient } from '../multiplayer/SocketClient';
import { CuteCharacter } from '../components/ui/CuteCharacter';

interface HostLobbyViewProps {
  room: RoomState;
  tournamentMode?: TournamentMode;
  playlistSequence?: GameId[];
  onSelectTournamentMode?: (mode: TournamentMode, customSequence?: GameId[]) => void;
  onSelectGame: (gameId: GameId) => void;
  onUpdateBots: (count: number) => void;
  onUpdateDifficulty?: (difficulty: 'easy' | 'normal' | 'hard' | 'extreme') => void;
  onStartMatch: () => void;
  onKickPlayer: (playerId: string) => void;
  onLeaveLobby: () => void;
}

const PLAYER_EMOJIS = ['🐲', '🦊', '🐺', '🦁', '🐯', '🦅', '🤖', '👾', '🎭', '🔮'];

export const HostLobbyView: React.FC<HostLobbyViewProps> = ({
  room,
  tournamentMode = 'single',
  playlistSequence,
  onSelectTournamentMode,
  onSelectGame,
  onUpdateBots,
  onUpdateDifficulty,
  onStartMatch,
  onKickPlayer,
  onLeaveLobby,
}) => {
  // Screen mode: 'lobby' (Setup / Settings) vs 'arena' (Dedicated Themed Waiting Arena)
  const [viewMode, setViewMode] = useState<'lobby' | 'arena'>('lobby');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showMysteryWheel, setShowMysteryWheel] = useState(false);
  const [showTournamentOptions, setShowTournamentOptions] = useState(false);
  const [readyCountdown, setReadyCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownStartedRef = useRef(false);

  const selectedGameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];
  const playersList = Object.values(room.players || {});
  const realPlayers = playersList.filter((p) => !p.isBot);
  const totalContenders = playersList.length;
  const readyCount = playersList.filter((p) => p.isReady).length;

  // Bot difficulty state
  const currentDifficulty = room.config?.difficulty || 'normal';

  const handleDifficultyChange = (diff: 'easy' | 'normal' | 'hard') => {
    const pitchMap = { easy: 800, normal: 950, hard: 1150 };
    soundManager.playClick(pitchMap[diff]);
    if (onUpdateDifficulty) {
      onUpdateDifficulty(diff);
    }
  };

  const handleToggleBotDifficulty = (botId: string) => {
    const current = room.players[botId]?.difficulty || 'medium';
    const next: 'easy' | 'medium' | 'hard' = current === 'easy' ? 'medium' : current === 'medium' ? 'hard' : 'easy';
    if (room.players[botId]) {
      room.players[botId].difficulty = next;
      // Trigger update event if available
      if (onUpdateBots) {
        const botCount = Object.values(room.players).filter((p) => p.isBot).length;
        onUpdateBots(botCount);
      }
    }
    const pitchMap = { easy: 800, medium: 950, hard: 1150 };
    soundManager.playClick(pitchMap[next]);
  };

  // Determine if auto-start countdown should fire (in arena mode or when ready condition is met)
  useEffect(() => {
    const threshold = totalContenders < 4 ? totalContenders : Math.ceil(totalContenders * 0.9);
    const shouldStart = totalContenders > 0 && readyCount >= threshold;

    if (shouldStart && !countdownStartedRef.current) {
      countdownStartedRef.current = true;
      setReadyCountdown(5);
      soundManager.playCountdownPitch(5);

      countdownRef.current = setInterval(() => {
        setReadyCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            countdownStartedRef.current = false;
            soundManager.playCountdownPitch('go');
            onStartMatch();
            return null;
          }
          const nextVal = prev - 1;
          soundManager.playCountdownPitch(nextVal);
          return nextVal;
        });
      }, 1000);
    } else if (!shouldStart && countdownStartedRef.current) {
      // Cancel countdown if players un-ready
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      countdownStartedRef.current = false;
      setReadyCountdown(null);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [readyCount, totalContenders, onStartMatch]);

  const currentSequence = playlistSequence && playlistSequence.length > 0
    ? playlistSequence
    : [room.selectedGame];

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${room.localIp || window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/?join=${room.code}`
    : `http://localhost:5173/?join=${room.code}`;

  const SHADOW_MAP_LIST: Array<{
    id: 'backrooms' | 'dungeon' | 'cyber-vault';
    name: string;
    badge: string;
    icon: string;
    description: string;
  }> = [
    {
      id: 'backrooms',
      name: 'Backrooms Labyrinth',
      badge: '🟡 LEVEL 0',
      icon: '🟡',
      description: 'Eerie yellow wallpaper corridors, humming fluorescents & tight maze corners.',
    },
    {
      id: 'dungeon',
      name: 'Dungeon Catacombs',
      badge: '🏰 GOTHIC RUINS',
      icon: '🏰',
      description: 'Ancient stone catacombs, iron portcullises & rich relic vaults.',
    },
    {
      id: 'cyber-vault',
      name: 'Cyber Vault',
      badge: '💠 HIGH-TECH',
      icon: '💠',
      description: 'Laser barrier grid, glowing server racks & high-speed corridors.',
    },
  ];

  const allGameKeys: GameId[] = ['serpent-arena', 'neon-relay', 'void-tag', 'relic-rush', 'last-platform', 'shadow-outrun'];

  const cycleGame = (direction: 1 | -1) => {
    const currentIndex = allGameKeys.indexOf(room.selectedGame);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = allGameKeys.length - 1;
    if (nextIndex >= allGameKeys.length) nextIndex = 0;
    soundManager.playClick(950);
    onSelectGame(allGameKeys[nextIndex]);
  };

  const handleSetTournamentMode = (mode: TournamentMode) => {
    soundManager.playClick(1000);
    const seq = TournamentEngine.generateSequence(mode, undefined, room.selectedGame);
    if (onSelectTournamentMode) onSelectTournamentMode(mode, seq);
    if (seq.length > 0 && seq[0] !== room.selectedGame) onSelectGame(seq[0]);
  };

  const handleShufflePlaylist = () => {
    soundManager.playClick(1100);
    const seq = TournamentEngine.generateSequence(tournamentMode || 'best_of_3');
    if (onSelectTournamentMode) onSelectTournamentMode(tournamentMode || 'best_of_3', seq);
    if (seq.length > 0) onSelectGame(seq[0]);
  };

  const isPlaylistActive = tournamentMode !== 'single' && currentSequence.length > 1;

  // Arena Stage Theme Configs
  const themeConfig: Record<GameId, {
    name: string;
    subtitle: string;
    icon: string;
    bgGradient: string;
    accentColor: string;
    glowHex: string;
    floorPattern: string;
  }> = {
    'serpent-arena': {
      name: 'SYNTHWAVE NEON PIT',
      subtitle: 'CYBERPUNK GLOW • ENERGY SURGE ARENA',
      icon: '🐍',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(45,0,80,0.95) 0%, rgba(15,0,30,1) 70%, rgba(5,0,10,1) 100%)',
      accentColor: '#00F5A0',
      glowHex: 'rgba(0,245,160,0.25)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(0,245,160,0.2) 0%, transparent 65%)',
    },
    'neon-relay': {
      name: 'TURBO CIRCUIT GANTRY',
      subtitle: 'HIGH-VELOCITY GRID • LASER SPEEDWAY',
      icon: '🏎️',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(0,35,80,0.95) 0%, rgba(0,15,40,1) 70%, rgba(2,5,18,1) 100%)',
      accentColor: '#00E5FF',
      glowHex: 'rgba(0,229,255,0.25)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(0,229,255,0.2) 0%, transparent 65%)',
    },
    'void-tag': {
      name: 'COSMIC VOID SANCTUARY',
      subtitle: 'DEEP SPACE NEBULA • STEALTH BATTLEGROUND',
      icon: '⚡',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(50,0,85,0.95) 0%, rgba(20,0,40,1) 70%, rgba(6,0,16,1) 100%)',
      accentColor: '#9D4EDD',
      glowHex: 'rgba(157,78,221,0.28)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(157,78,221,0.22) 0%, transparent 65%)',
    },
    'relic-rush': {
      name: 'ANCIENT CYBER TEMPLE',
      subtitle: 'CYBER-GOLD RUINS • RUNIC POWER MATRIX',
      icon: '💎',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(60,30,0,0.95) 0%, rgba(25,10,0,1) 70%, rgba(10,4,0,1) 100%)',
      accentColor: '#FFB224',
      glowHex: 'rgba(255,178,36,0.25)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(255,178,36,0.22) 0%, transparent 65%)',
    },
    'last-platform': {
      name: 'QUANTUM HEX PLATFORM',
      subtitle: 'SUB-ZERO COLLAPSING ABYSS • SURVIVAL MATRIX',
      icon: '🧊',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(0,50,65,0.95) 0%, rgba(0,20,30,1) 70%, rgba(1,10,15,1) 100%)',
      accentColor: '#00E5FF',
      glowHex: 'rgba(0,229,255,0.25)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(0,229,255,0.2) 0%, transparent 65%)',
    },
    'shadow-outrun': {
      name: 'SHADOW OUTRUN HEIST',
      subtitle: 'BACKROOMS & DUNGEON FLASHLIGHT PURSUIT',
      icon: '🔦',
      bgGradient: 'radial-gradient(ellipse at 50% 30%, rgba(40,25,0,0.95) 0%, rgba(20,10,0,1) 70%, rgba(8,4,0,1) 100%)',
      accentColor: '#FFB224',
      glowHex: 'rgba(255,178,36,0.28)',
      floorPattern: 'radial-gradient(circle at 50% 90%, rgba(255,178,36,0.25) 0%, transparent 65%)',
    },
  };

  const activeTheme = themeConfig[room.selectedGame] || themeConfig['serpent-arena'];

  // ══════════════════════════════════════════════════════════════════
  // VIEW MODE A: DEDICATED THEMED WAITING ARENA SCREEN
  // ══════════════════════════════════════════════════════════════════
  if (viewMode === 'arena') {
    return (
      <div
        className="min-h-[calc(100vh-4rem)] p-3 sm:p-6 lg:p-8 flex flex-col justify-between relative overflow-y-auto overflow-x-hidden transition-all duration-700"
        style={{
          background: activeTheme.bgGradient,
        }}
      >
        {/* Dynamic Floor Ambient Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: activeTheme.floorPattern }}
        />

        {/* ─── 1. TOP ARENA NAVIGATION & LIVE STATUS BAR ─── */}
        <div className="relative z-20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/60 backdrop-blur-xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/15 shadow-2xl shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => {
                soundManager.playClick(850);
                setViewMode('lobby');
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-arcade-cream font-arcade text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4 text-arcade-amber shrink-0" />
              <span className="hidden xs:inline">← BACK TO LOBBY</span>
              <span className="xs:hidden">← BACK</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/50 border border-arcade-amber/40">
              <span className="text-[10px] font-mono text-arcade-cream-muted uppercase">CODE:</span>
              <span className="font-arcade text-base sm:text-lg text-arcade-amber font-black tracking-widest">{room.code}</span>
            </div>
          </div>

          {/* Arena Stage Title */}
          <div className="text-center hidden sm:block">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{activeTheme.icon}</span>
              <h2 className="font-arcade text-base sm:text-xl text-arcade-cream tracking-wider" style={{ color: activeTheme.accentColor }}>
                {activeTheme.name}
              </h2>
            </div>
            <p className="text-[10px] font-mono text-white/50 tracking-widest uppercase">
              {activeTheme.subtitle}
            </p>
          </div>

          {/* Contender Ready Count Badge */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="px-3 py-1.5 rounded-2xl bg-arcade-mint/20 border border-arcade-mint/40 text-arcade-mint font-mono text-xs font-bold flex items-center gap-1.5 shadow-glow-mint">
              <span className="w-2 h-2 rounded-full bg-arcade-mint animate-ping shrink-0" />
              <span>{readyCount}/{totalContenders} READY</span>
            </div>

            <button
              onClick={() => {
                soundManager.playCountdownPitch('go');
                onStartMatch();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-arcade-amber to-amber-500 hover:brightness-110 text-black font-arcade text-xs font-black shadow-glow-amber transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span>LAUNCH NOW</span>
            </button>
          </div>
        </div>

        {/* ─── 2. COUNTDOWN ALERT BANNER (IF ACTIVE) ─── */}
        <AnimatePresence>
          {readyCountdown !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="relative z-30 my-4"
            >
              <div className="max-w-xl mx-auto flex items-center justify-center gap-6 py-4 px-8 rounded-3xl bg-green-950/80 border-2 border-green-400 shadow-[0_0_50px_rgba(34,197,94,0.6)] backdrop-blur-2xl">
                <div className="text-center sm:text-left">
                  <div className="font-arcade text-sm sm:text-base text-green-300 uppercase tracking-widest">
                    🚀 ALL CONTENDERS READY!
                  </div>
                  <div className="font-mono text-xs text-white/70">
                    MATCH COMMENCING ON HOST SCREEN
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={readyCountdown}
                    initial={{ scale: 1.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-arcade text-6xl sm:text-7xl text-green-400 font-black drop-shadow-[0_0_30px_rgba(34,197,94,1)]"
                  >
                    {readyCountdown}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── 3. CENTER ARENA STAGE — ANIMATED CONTENDERS HOLDING SIGNBOARDS ─── */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center py-4 sm:py-8 min-h-0">
          {playersList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <span className="text-6xl opacity-30 animate-pulse">👥</span>
              <p className="font-arcade text-base text-arcade-cream-muted">WAITING FOR PILOTS TO JOIN...</p>
              <p className="font-mono text-xs text-white/40">Scan QR Code or Enter Party Code on mobile controller</p>
            </div>
          ) : (
            <div className="w-full max-w-6xl mx-auto overflow-x-auto overflow-y-visible">
              <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-12 pt-10 sm:pt-16 pb-4 min-w-0">
                <AnimatePresence>
                  {playersList.map((p, idx) => {
                    const isReady = p.isReady === true;
                    const emoji = p.isBot ? '🤖' : (PLAYER_EMOJIS[idx % PLAYER_EMOJIS.length]);
                    const isLeader = p.isOwner || (p.isHost && realPlayers.length === 0);

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ scale: 0, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ delay: idx * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
                        className="flex flex-col items-center relative group"
                        style={{ width: 'clamp(80px, 18vw, 110px)' }}
                      >
                      {/* ═══ 1. SIGNBOARD IN HAND ═══ */}
                      {/* When Ready: Thrust high above head with green neon glow & sparkles. When Waiting: Held low at waist */}
                      <motion.div
                        animate={
                          isReady
                            ? {
                                y: -34,
                                scale: [1, 1.1, 1],
                                rotate: [-3, 3, -3],
                              }
                            : {
                                y: 6,
                                scale: 0.95,
                                rotate: [0, 0, 0],
                              }
                        }
                        transition={{
                          y: { type: 'spring', stiffness: 450, damping: 20 },
                          scale: { repeat: isReady ? Infinity : 0, duration: 1.5 },
                          rotate: { repeat: isReady ? Infinity : 0, duration: 2.2 },
                        }}
                        className="relative z-30 flex flex-col items-center pointer-events-none"
                      >
                        {/* Signboard Panel */}
                        <div
                          className={`px-3.5 py-1.5 rounded-2xl border-2 font-arcade text-xs font-black tracking-wider transition-all flex items-center gap-1.5 shadow-2xl ${
                            isReady
                              ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black border-white shadow-[0_0_30px_rgba(34,197,94,1)]'
                              : 'bg-black/90 text-white/50 border-white/25 shadow-lg'
                          }`}
                        >
                          {isReady ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 fill-black" />
                              <span>READY! ✓</span>
                            </>
                          ) : (
                            <span>⏳ WAITING</span>
                          )}
                        </div>

                        {/* Signboard Wooden/Metal Pole */}
                        <div className="w-2 h-7 bg-gradient-to-b from-amber-600 via-amber-800 to-amber-950 border-x border-black/60 shadow-sm" />
                      </motion.div>

                      {/* ═══ 2. CHARACTER AVATAR BODY & SUIT ═══ */}
                      <div className="relative flex flex-col items-center -mt-2">
                        {/* 2D Cute Character Vector Avatar */}
                        <div
                          className="relative flex items-center justify-center p-2 rounded-3xl shadow-2xl transition-all"
                          style={{
                            backgroundColor: `${p.color || '#00F5A0'}22`,
                            border: `2px solid ${p.color || '#00F5A0'}`,
                            boxShadow: isReady ? `0 0 25px ${p.color || '#00F5A0'}88` : 'none',
                          }}
                        >
                          <CuteCharacter
                            avatar={p.isBot ? 'robot' : (p.avatar || 'cat')}
                            color={p.color || '#00F5A0'}
                            mood={isReady ? 'ready' : 'idle'}
                            size={72}
                            showCrown={isLeader}
                          />
                        </div>

                        {/* Stage Ground Shadow */}
                        <div className="w-16 h-3 rounded-full bg-black/70 blur-[3px] mt-1.5" />
                      </div>

                      {/* ═══ 3. FLOATING PILOT NAME TAG ═══ */}
                      <div className="mt-2 flex flex-col items-center w-full">
                        <span
                          className={`font-display font-bold text-xs truncate max-w-full text-center px-2.5 py-1 rounded-lg bg-black/70 border ${
                            isReady
                              ? 'text-green-400 border-green-400/60 shadow-glow-mint'
                              : 'text-arcade-cream border-white/15'
                          }`}
                        >
                          {p.name}
                        </span>
                        {p.isBot ? (
                          <button
                            onClick={() => handleToggleBotDifficulty(p.id)}
                            className={`mt-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border transition-all ${
                              p.difficulty === 'hard'
                                ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                                : p.difficulty === 'easy'
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                            }`}
                            title="Click to cycle bot difficulty"
                          >
                            🤖 {p.difficulty?.toUpperCase() || 'NORMAL'} 🔄
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-white/50 uppercase mt-0.5 font-semibold">
                            {p.isHost ? 'HOST' : isLeader ? 'LEADER' : 'CONTROLLER'}
                          </span>
                        )}
                      </div>

                      {/* Kick Button for Host (Hover) */}
                      {!p.isHost && !p.isBot && (
                        <button
                          onClick={() => {
                            soundManager.playClick(600);
                            onKickPlayer(p.id);
                          }}
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-arcade-crimson text-white transition-opacity w-6 h-6 flex items-center justify-center shadow-lg hover:scale-110"
                          title="Kick player"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* ─── 4. BOTTOM ARENA CONTROLS ─── */}
        <div className="relative z-20 flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/50 backdrop-blur-xl p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/10 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-white/70 text-center sm:text-left">
            <Sparkles className="w-4 h-4 text-arcade-amber shrink-0" />
            <span className="text-[10px] sm:text-xs">ALL CONTENDERS MUST RAISE SIGNBOARDS TO LAUNCH</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <ArcadeButton
              variant="neutral"
              size="md"
              onClick={() => {
                soundManager.playClick(850);
                setViewMode('lobby');
              }}
            >
              ← SETTINGS
            </ArcadeButton>

            <ArcadeButton
              variant="amber"
              size="lg"
              icon={<Play className="w-5 h-5 fill-current" />}
              onClick={() => {
                soundManager.playCountdownPitch('go');
                onStartMatch();
              }}
            >
              START MATCH 🚀
            </ArcadeButton>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW MODE B: MAIN HOST LOBBY CONFIGURATION VIEW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-[calc(100vh-4rem)] p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col space-y-4 sm:space-y-6 overflow-y-auto">

      {/* ═══════════════════════════════════════════════════
           1. HIGH-CONTRAST PARTY CODE + CRISP QR BANNER
         ═══════════════════════════════════════════════════ */}
      <GlassPanel
        variant="glow-amber"
        className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 border-2 border-arcade-amber/60 bg-gradient-to-br from-arcade-amber/15 via-arcade-card to-arcade-bg/90 shadow-[0_0_50px_rgba(255,178,36,0.3)]"
      >
        <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-arcade-amber/25 border border-arcade-amber/50 text-arcade-amber text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase max-w-full overflow-hidden">
            <Tv className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">TV HOST ARENA &bull; ZERO DOWNLOAD MULTIPLAYER</span>
          </div>

          <div className="text-xs font-mono text-white/70 truncate">
            STEP 1: Scan QR or visit{' '}
            <span className="text-arcade-cream font-bold bg-white/10 px-2 py-0.5 rounded-lg border border-white/15 text-[11px]">
              {room.localIp || (typeof window !== 'undefined' ? window.location.hostname : 'localhost')}{typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : ''}
            </span>
          </div>

          <div className="pt-1">
            <div className="text-[10px] font-mono text-arcade-amber uppercase tracking-widest font-bold">
              STEP 2: ENTER PARTY CODE
            </div>
            <div className="flex items-center justify-center sm:justify-start pt-1.5">
              <span className="font-arcade text-4xl sm:text-6xl lg:text-8xl font-black text-arcade-amber tracking-widest drop-shadow-[0_0_35px_rgba(255,178,36,0.9)] select-all bg-black/50 px-4 py-2 rounded-2xl sm:rounded-3xl border-2 border-arcade-amber/50 shadow-2xl">
                {room.code}
              </span>
            </div>
          </div>
        </div>

        {/* High-contrast Scannable QR Code */}
        <div
          onClick={() => {
            soundManager.playClick(900);
            setShowQRModal(true);
          }}
          className="cursor-pointer group flex flex-col items-center p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white/10 border-2 border-arcade-amber/50 hover:border-arcade-mint hover:scale-105 transition-all shadow-2xl flex-shrink-0"
        >
          <div className="p-3 bg-white rounded-xl sm:rounded-2xl shadow-2xl">
            <QRCodeSVG value={joinUrl} size={100} level="H" includeMargin={false} />
          </div>
          <span className="mt-2 text-[10px] sm:text-xs font-mono font-bold text-arcade-cream group-hover:text-arcade-mint flex items-center gap-1 tracking-wider uppercase">
            <QrCode className="w-3.5 h-3.5 text-arcade-amber group-hover:text-arcade-mint shrink-0" /> ENLARGE
          </span>
        </div>
      </GlassPanel>

      {/* ═══════════════════════════════════════════════════
           2. MAIN LOBBY GRID (SETTINGS + CONNECTED CONTENDERS)
         ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ─── LEFT COLUMN: GAME SELECTION + BOT CONTROLS (8 cols) ─── */}
        <div className="lg:col-span-8 space-y-6">

          {/* Game Selection Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-arcade text-sm text-arcade-cream">SELECT GAME ARENA</span>
                <span className="px-2 py-0.5 rounded-full bg-arcade-amber/20 border border-arcade-amber/40 text-[10px] font-mono text-arcade-amber">
                  {allGameKeys.indexOf(room.selectedGame) + 1} OF {allGameKeys.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => cycleGame(-1)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => cycleGame(1)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {allGameKeys.map((gId) => {
                const g = GAMES_DATA[gId];
                const isSelected = room.selectedGame === gId;
                return (
                  <motion.button
                    key={gId}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      soundManager.playClick(1000);
                      onSelectGame(gId);
                    }}
                    className={`relative h-32 rounded-2xl overflow-hidden border-2 transition-all flex flex-col justify-end text-left p-2.5 ${
                      isSelected
                        ? 'border-arcade-amber shadow-[0_0_25px_rgba(255,178,36,0.6)] ring-2 ring-arcade-amber/50'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    {/* Cover art image */}
                    {g.coverImage ? (
                      <img
                        src={g.coverImage}
                        alt={g.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-arcade-amber/20 to-black" />
                    )}

                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent ${isSelected ? '' : 'bg-black/30'}`} />

                    {/* Selected Badge */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="w-5 h-5 rounded-full bg-arcade-amber flex items-center justify-center shadow-glow-amber">
                          <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                        </div>
                      </div>
                    )}

                    {/* Category */}
                    <div className="relative z-10">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-mono text-arcade-amber uppercase backdrop-blur-sm border border-white/10">
                        {g.category.split('/')[0]}
                      </span>
                      <h4 className={`font-arcade text-xs mt-1 truncate ${isSelected ? 'text-arcade-amber font-bold' : 'text-arcade-cream'}`}>
                        {g.title}
                      </h4>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Interactive Map Voting Section for Shadow Outrun */}
          {room.selectedGame === 'shadow-outrun' && (
            <GlassPanel variant="glow-amber" className="p-4 sm:p-5 border-2 border-arcade-amber/50 bg-black/75 space-y-4 shadow-[0_0_35px_rgba(255,178,36,0.25)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-arcade-amber/20 border border-arcade-amber/50 text-arcade-amber flex items-center justify-center font-arcade text-lg shadow-glow-amber">
                    🗳️
                  </div>
                  <div>
                    <h3 className="font-arcade text-sm sm:text-base text-arcade-cream flex items-center gap-2">
                      <span>LIVE MAP VOTE</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-arcade-amber/25 text-arcade-amber border border-arcade-amber/40 uppercase font-bold">
                        3 ARENA MAPS
                      </span>
                    </h3>
                    <p className="text-[11px] font-mono text-white/60">
                      Players on mobile & host vote in real-time. Winning map launches when match starts!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center px-3 py-1.5 rounded-2xl bg-black/60 border border-arcade-amber/40">
                  <span className="text-[10px] font-mono text-arcade-cream-muted uppercase font-bold">LEADING MAP:</span>
                  <span className="font-arcade text-xs text-arcade-amber font-black tracking-wide">
                    {(SHADOW_MAP_LIST.find((m) => m.id === (room.selectedMap || room.config?.selectedMap || 'backrooms')) || SHADOW_MAP_LIST[0]).name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SHADOW_MAP_LIST.map((m) => {
                  const voteCount = room.mapVoting?.[m.id] || 0;
                  const currentSelected = room.selectedMap || room.config?.selectedMap || 'backrooms';
                  const isWinning = currentSelected === m.id;
                  const isHostVoted = room.playerMapVotes?.['host'] === m.id;

                  return (
                    <motion.div
                      key={m.id}
                      whileHover={{ scale: 1.02 }}
                      className={`relative rounded-2xl p-4 border-2 transition-all flex flex-col justify-between space-y-3 ${
                        isWinning
                          ? 'border-arcade-amber bg-gradient-to-b from-arcade-amber/25 via-black/80 to-black shadow-[0_0_30px_rgba(255,178,36,0.45)] ring-1 ring-arcade-amber/40'
                          : 'border-white/15 bg-black/60 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl">{m.icon}</span>
                          <div>
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-arcade-amber border border-white/10 block w-fit">
                              {m.badge}
                            </span>
                            <h4 className="font-arcade text-xs sm:text-sm text-arcade-cream font-bold mt-1">{m.name}</h4>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className={`px-2.5 py-1 rounded-xl font-arcade text-xs font-black flex items-center gap-1.5 ${
                            voteCount > 0
                              ? 'bg-arcade-mint text-black shadow-glow-mint'
                              : 'bg-white/10 text-white/50 border border-white/10'
                          }`}>
                            <span>{voteCount}</span>
                            <span className="text-[9px]">{voteCount === 1 ? 'VOTE' : 'VOTES'}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] font-mono text-white/70 leading-relaxed min-h-[36px]">
                        {m.description}
                      </p>

                      <button
                        onClick={() => {
                          soundManager.playClick(1100);
                          socketClient.voteMap(m.id, 'host');
                        }}
                        className={`w-full py-2.5 px-3 rounded-xl font-arcade text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md ${
                          isHostVoted
                            ? 'bg-gradient-to-r from-arcade-amber to-amber-500 text-black shadow-glow-amber border border-white/40'
                            : 'bg-white/10 hover:bg-white/20 text-arcade-cream border border-white/20'
                        }`}
                      >
                        <span>{isHostVoted ? '✓ CAST AS HOST' : 'VOTE THIS MAP'}</span>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </GlassPanel>
          )}

          {/* Bot Count + Bot Difficulty Controls */}
          <GlassPanel className="p-5 space-y-4 border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Bot Count Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-arcade-cyan" />
                    <span className="text-xs font-mono text-arcade-cream font-bold">AI BOT COUNT</span>
                  </div>
                  <span className="text-xs font-mono text-arcade-cyan font-bold">
                    {room.botCount} BOTS
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 1, 3, 5, 7].map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        soundManager.playClick(900);
                        onUpdateBots(b);
                      }}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                        room.botCount === b
                          ? 'bg-arcade-cyan text-black shadow-glow-cyan font-black'
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot Difficulty Toggle (EASY, MEDIUM, HARD) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-arcade-amber" />
                    <span className="text-xs font-mono text-arcade-cream font-bold">BOT DIFFICULTY</span>
                  </div>
                  <span className="text-xs font-mono uppercase font-bold text-arcade-amber">
                    {currentDifficulty === 'normal' ? 'MEDIUM' : currentDifficulty.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'easy', label: 'EASY', colorClass: 'bg-arcade-mint text-black shadow-glow-mint' },
                    { id: 'normal', label: 'MEDIUM', colorClass: 'bg-arcade-amber text-black shadow-glow-amber' },
                    { id: 'hard', label: 'HARD', colorClass: 'bg-arcade-crimson text-white shadow-glow-crimson' },
                  ].map((diff) => {
                    const isActive = currentDifficulty === diff.id;
                    return (
                      <button
                        key={diff.id}
                        onClick={() => handleDifficultyChange(diff.id as any)}
                        className={`py-2 rounded-xl text-xs font-arcade font-black transition-all ${
                          isActive
                            ? diff.colorClass
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {diff.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </GlassPanel>

          {/* Tournament & Playlist Options Collapsible */}
          <div className="space-y-2">
            <button
              onClick={() => {
                soundManager.playClick(800);
                setShowTournamentOptions((v) => !v)}
              }
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors w-full"
            >
              <Settings className="w-4 h-4 text-arcade-amber" />
              <span className="font-mono text-xs text-arcade-cream uppercase tracking-wider font-bold">
                ⚙️ TOURNAMENT & GRAND PRIX OPTIONS
              </span>
              <span className="ml-auto text-xs font-mono text-arcade-amber font-bold">
                {tournamentMode?.replace('_', ' ').toUpperCase()}
              </span>
              {showTournamentOptions ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>

            <AnimatePresence>
              {showTournamentOptions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <GlassPanel className="p-4 space-y-4 border-arcade-amber/20">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {[
                        { id: 'single', label: 'SINGLE', desc: '1 Arena', icon: '⚡' },
                        { id: 'best_of_3', label: 'BEST OF 3', desc: '3 Rounds', icon: '🥉' },
                        { id: 'best_of_5', label: 'BEST OF 5', desc: '5 Arenas', icon: '🥇' },
                        { id: 'all_5', label: 'ALL 5', desc: 'Full Grand Prix', icon: '🏆' },
                        { id: 'mystery', label: 'MYSTERY', desc: 'Spin Wheel', icon: '🎲' },
                      ].map((modeItem) => {
                        const isActive = modeItem.id !== 'mystery' && tournamentMode === modeItem.id;
                        return (
                          <button
                            key={modeItem.id}
                            onClick={() => {
                              if (modeItem.id === 'mystery') {
                                soundManager.playClick(1000);
                                setShowMysteryWheel(true);
                              } else {
                                handleSetTournamentMode(modeItem.id as TournamentMode);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${
                              isActive
                                ? 'border-arcade-amber bg-arcade-amber/20 shadow-glow-amber'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            <span className="text-base">{modeItem.icon}</span>
                            <span className="font-arcade text-[10px] text-arcade-cream mt-1 block">{modeItem.label}</span>
                            <span className="text-[9px] font-mono text-arcade-cream-muted block">{modeItem.desc}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isPlaylistActive && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-arcade-amber font-bold flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5" /> QUEUED SEQUENCE ({currentSequence.length} ROUNDS)
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {currentSequence.map((gid, idx) => (
                              <span
                                key={idx}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-mono"
                              >
                                <span className="text-arcade-amber font-bold">#{idx + 1}</span>
                                <span className="text-arcade-cream">{GAMES_DATA[gid]?.title || gid}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={handleShufflePlaylist}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-arcade-cyan transition-colors self-start sm:self-center"
                        >
                          <Shuffle className="w-3.5 h-3.5" /> SHUFFLE
                        </button>
                      </div>
                    )}
                  </GlassPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* ─── RIGHT COLUMN: CONNECTED CONTENDERS SIDEBAR (4 cols) ─── */}
        <div className="lg:col-span-4 space-y-4">
          <GlassPanel className="p-5 space-y-4 border-arcade-mint/30 shadow-glow-mint">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-arcade-mint" />
                <h3 className="font-arcade text-sm text-arcade-cream">CONNECTED PILOTS</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-arcade-mint/20 border border-arcade-mint/40 text-[10px] font-mono text-arcade-mint font-bold">
                {readyCount}/{totalContenders} READY
              </span>
            </div>

            {/* Contenders List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {playersList.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-arcade-cream-muted">
                  No contenders connected yet.
                </div>
              ) : (
                playersList.map((p, idx) => {
                  const isLeader = p.isOwner || (p.isHost && realPlayers.length === 0);
                  const isReady = p.isReady === true;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-black shadow-md shrink-0 border border-white/40"
                          style={{ backgroundColor: p.color || '#00F5A0' }}
                        >
                          {p.isBot ? '🤖' : (PLAYER_EMOJIS[idx % PLAYER_EMOJIS.length])}
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-xs font-bold text-arcade-cream truncate block max-w-[120px]">
                              {p.name}
                            </span>
                            {isLeader && (
                              <span className="text-xs" title="Party Leader">👑</span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-white/40 uppercase">
                            {p.isHost ? 'HOST' : p.isBot ? `AI: ${p.botArchetype || 'BOT'}` : 'CONTROLLER'}
                          </span>
                        </div>
                      </div>

                      {/* Ready Badge / Bot Difficulty & Kick Control */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.isBot ? (
                          <button
                            onClick={() => handleToggleBotDifficulty(p.id)}
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg border transition-all ${
                              p.difficulty === 'hard'
                                ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                                : p.difficulty === 'easy'
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                            }`}
                            title="Click to cycle bot difficulty"
                          >
                            🤖 {p.difficulty?.toUpperCase() || 'NORMAL'}
                          </button>
                        ) : (
                          <span
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                              isReady
                                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                : 'bg-white/5 text-arcade-cream-muted border-white/15'
                            }`}
                          >
                            {isReady ? 'READY ✓' : 'WAIT ⏳'}
                          </span>
                        )}

                        {!p.isHost && !p.isBot && (
                          <button
                            onClick={() => {
                              soundManager.playClick(600);
                              onKickPlayer(p.id);
                            }}
                            className="p-1 rounded-lg bg-arcade-crimson/20 hover:bg-arcade-crimson/40 text-arcade-crimson transition-colors"
                            title="Kick from party"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Prominent Button: ENTER WAITING ARENA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                soundManager.playPowerup(550);
                setViewMode('arena');
              }}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-arcade-cyan via-arcade-mint to-arcade-cyan text-black font-arcade text-sm font-black flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(0,229,255,0.4)] hover:brightness-110 transition-all uppercase tracking-wider"
            >
              <span>ENTER WAITING ARENA</span>
              <ArrowRight className="w-5 h-5 stroke-[3]" />
            </motion.button>
          </GlassPanel>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════
           3. BOTTOM ACTION BAR
         ═══════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/10">
        <ArcadeButton variant="neutral" size="lg" onClick={onLeaveLobby}>
          ← BACK TO HUB
        </ArcadeButton>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ArcadeButton
            variant="cyan"
            size="xl"
            icon={<ArrowRight className="w-5 h-5" />}
            onClick={() => {
              soundManager.playPowerup(550);
              setViewMode('arena');
            }}
            className="flex-1 sm:flex-none"
          >
            ENTER ARENA →
          </ArcadeButton>

          <ArcadeButton
            variant="amber"
            size="xl"
            icon={<Play className="w-6 h-6 fill-current" />}
            onClick={() => {
              soundManager.playCountdownPitch('go');
              onStartMatch();
            }}
            className="flex-1 sm:flex-none px-8"
          >
            {isPlaylistActive
              ? `START PLAYLIST (${currentSequence.length} ROUNDS)`
              : `LAUNCH MATCH (${totalContenders} PILOTS)`}
          </ArcadeButton>
        </div>
      </div>

      {/* ─── Mystery Wheel Modal ─── */}
      <MysteryWheelModal
        isOpen={showMysteryWheel}
        onClose={() => setShowMysteryWheel(false)}
        onSelectGame={(gId) => {
          onSelectGame(gId);
          if (onSelectTournamentMode) onSelectTournamentMode('single', [gId]);
        }}
      />

      {/* ─── Fullscreen QR Modal ─── */}
      {showQRModal && (
        <div
          onClick={() => setShowQRModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 rounded-3xl bg-arcade-surface border border-arcade-amber/40 shadow-glow-amber text-center max-w-sm w-full space-y-4"
          >
            <h3 className="font-arcade text-lg text-arcade-amber">SCAN TO JOIN</h3>
            <p className="text-xs font-mono text-arcade-cream-muted">
              Party code: <strong className="text-arcade-cream">{room.code}</strong>
            </p>
            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mx-auto">
              <QRCodeSVG value={joinUrl} size={220} level="H" />
            </div>
            <p className="text-xs font-mono text-arcade-cream-muted break-all">{joinUrl}</p>
            <ArcadeButton variant="neutral" size="md" onClick={() => setShowQRModal(false)} fullWidth>
              CLOSE
            </ArcadeButton>
          </motion.div>
        </div>
      )}
    </div>
  );
};
