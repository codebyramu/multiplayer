import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Tv,
  Camera,
  Check,
  Sparkles,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Flame,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { RoomState, ControllerInput, GameId, PlayerClientHUDState } from '../types';
import { GAMES_DATA, PLAYER_AVATARS } from '../data/games';
import { soundManager } from '../audio/SoundManager';
import { socketClient } from '../multiplayer/SocketClient';
import { QRScannerModal } from '../components/ui/QRScannerModal';
import { CuteCharacter } from '../components/ui/CuteCharacter';

interface ControllerViewProps {
  initialCode?: string;
  room: RoomState | null;
  playerId: string | null;
  inGame?: boolean;
  gameId: GameId;
  hudState: PlayerClientHUDState | null;
  allHudStates?: Record<string, PlayerClientHUDState>;
  onJoin?: (data: { code: string; name: string; avatar: string; color: string; skin: string }) => Promise<{ success: boolean; error?: string }>;
  onJoinParty?: (data: { code: string; name: string; avatar: string; color: string; skin: string }) => Promise<{ success: boolean; error?: string }>;
  onSendInput: (input: ControllerInput) => void;
  onLeave?: () => void;
  onLeaveRoom?: () => void;
  onReplayIntro?: () => void;
}

const COLOR_PALETTE = ['#00F5A0', '#00E5FF', '#FFB224', '#FF3366', '#9D4EDD', '#FF7700', '#3A86FF', '#E63946'];

export const ControllerView: React.FC<ControllerViewProps> = ({
  initialCode,
  room,
  playerId,
  gameId,
  hudState,
  allHudStates,
  onJoin,
  onJoinParty,
  onSendInput,
  onLeave,
  onLeaveRoom,
}) => {
  const joinHandler = onJoin || onJoinParty || (async () => ({ success: false }));
  const leaveHandler = onLeave || onLeaveRoom || (() => {});

  // If in a room, render waiting screen or arcade controller
  if (room) {
    const safePlayerId = playerId || Object.keys(room.players)[0] || '';
    if (room.state === 'lobby') {
      return (
        <LobbyScreen
          room={room}
          playerId={safePlayerId}
          color={room.players[safePlayerId]?.color || '#00F5A0'}
          onLeave={leaveHandler}
          onSendInput={onSendInput}
        />
      );
    }
    return (
      <ArcadeController
        room={room}
        playerId={safePlayerId}
        gameId={gameId}
        hudState={hudState}
        allHudStates={allHudStates}
        onSendInput={onSendInput}
        onLeave={leaveHandler}
      />
    );
  }

  return <MinimalJoinScreen initialCode={initialCode} onJoinParty={joinHandler} />;
};

/* ═══════════════════════════════════════════════════════════════
   1. ULTRA-MINIMAL APPLE-GRADE JOIN SCREEN (ZERO ESSAY, 3 ROWS)
   ═══════════════════════════════════════════════════════════════ */
const MinimalJoinScreen: React.FC<{
  initialCode?: string;
  onJoinParty: (data: { code: string; name: string; avatar: string; color: string; skin: string }) => Promise<{ success: boolean; error?: string }>;
}> = ({ initialCode, onJoinParty }) => {
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState('');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Auto-fill party code from URL query ?join=CODE
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const joinParam = urlParams.get('join');
      if (joinParam) {
        setCode(joinParam.toUpperCase().slice(0, 7));
      }
    } catch {}
  }, []);

  const currentAvatar = PLAYER_AVATARS[avatarIndex % PLAYER_AVATARS.length];
  const currentColor = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];

  const handleRandomize = () => {
    soundManager.playClick(1050);
    setAvatarIndex(Math.floor(Math.random() * PLAYER_AVATARS.length));
    setColorIndex(Math.floor(Math.random() * COLOR_PALETTE.length));
  };

  const handleCycleColor = () => {
    soundManager.playClick(950);
    setColorIndex((prev) => (prev + 1) % COLOR_PALETTE.length);
  };

  const handleCycleAvatar = () => {
    soundManager.playClick(850);
    setAvatarIndex((prev) => (prev + 1) % PLAYER_AVATARS.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter party code on TV');
      return;
    }
    setError(null);
    setIsJoining(true);
    soundManager.playClick(900);

    const res = await onJoinParty({
      code: code.trim().toUpperCase(),
      name: name.trim() || currentAvatar.name.split(' ')[0],
      avatar: currentAvatar.id,
      color: currentColor,
      skin: 'synth',
    });

    setIsJoining(false);
    if (!res.success) setError(res.error || 'Could not connect to host.');
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-3xl bg-black/60 border border-white/15 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_0_60px_rgba(0,245,160,0.15)] space-y-5"
      >
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white/5 border border-white/10 text-xl shadow-lg mx-auto">
            👑
          </div>
          <h2 className="font-arcade text-xl sm:text-2xl font-black tracking-wider text-white">
            JOIN PARTY
          </h2>
          <p className="font-mono text-[11px] text-white/50 uppercase tracking-widest">
            INSTANT PHONE GAMEPAD
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* 1. Party Code Input with Built-In Camera Scanner Icon */}
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PARTY CODE (ON TV)"
              maxLength={7}
              required
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-white/5 border border-white/15 text-center font-arcade text-xl tracking-widest text-arcade-amber placeholder:text-white/30 placeholder:font-mono placeholder:text-xs placeholder:tracking-normal uppercase focus:outline-none focus:border-arcade-amber shadow-inner"
            />
            <button
              type="button"
              onClick={() => {
                soundManager.playClick(900);
                setShowScanner(true);
              }}
              title="Scan QR Code on TV"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-arcade-cyan border border-white/10 active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Pilot Name Input */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PILOT NAME"
              maxLength={14}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-center font-display text-sm tracking-wide text-white placeholder:text-white/30 focus:outline-none focus:border-arcade-mint"
            />
          </div>

          {/* 3. Compact 1-Tap Avatar & Color Cycler Pill */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/5 border border-white/10">
            {/* Tap Avatar to Cycle Character */}
            <button
              type="button"
              onClick={handleCycleAvatar}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors flex-1 min-w-0"
              title="Tap to change avatar"
            >
              <CuteCharacter
                avatar={currentAvatar.id}
                color={currentColor}
                size={34}
                mood="happy"
              />
              <span className="font-mono text-xs text-white font-bold truncate">
                {currentAvatar.name.split(' ')[0]}
              </span>
            </button>

            {/* Tap Color Aura to Cycle Color Palette */}
            <button
              type="button"
              onClick={handleCycleColor}
              style={{ backgroundColor: currentColor }}
              className="w-7 h-7 rounded-full ring-2 ring-white/40 shadow-lg shrink-0 hover:scale-110 active:scale-90 transition-transform"
              title="Tap to cycle color"
            />

            {/* Randomize Dice */}
            <button
              type="button"
              onClick={handleRandomize}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 shrink-0 active:scale-90 transition-all"
              title="Randomize avatar & color"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          {/* 4. Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={isJoining}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-arcade-cyan via-teal-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-widest shadow-[0_0_30px_rgba(0,229,255,0.5)] border border-white/40 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {isJoining ? 'CONNECTING...' : 'JOIN PARTY ▶'}
          </motion.button>
        </form>

        {/* In-App Camera QR Scanner Modal */}
        <QRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanSuccess={(scannedCode) => {
            soundManager.playClick(1000);
            setCode(scannedCode.toUpperCase());
            setShowScanner(false);
          }}
        />
      </motion.div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   2. MINIMAL WAITING ROOM SCREEN
   ═══════════════════════════════════════════════════════════════ */
const LobbyScreen: React.FC<{
  room: RoomState;
  playerId: string;
  color: string;
  onLeave: () => void;
  onSendInput: (input: ControllerInput) => void;
}> = ({ room, playerId, color, onLeave, onSendInput }) => {
  const player = room.players[playerId];
  const isOwner = player?.isOwner || player?.isHost;
  const [isReady, setIsReady] = useState(player?.isReady ?? false);

  useEffect(() => {
    if (player) setIsReady(player.isReady);
  }, [player?.isReady]);

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    soundManager.playClick(next ? 1100 : 800);
    socketClient.setReady(next);
    onSendInput({ x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() });
  };

  const gameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];
  const playerName = player?.name || 'PILOT';

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm rounded-3xl bg-black/60 border border-white/15 backdrop-blur-2xl p-6 space-y-5 shadow-2xl">
        {/* Contender Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-1 rounded-2xl border-2 shadow-lg"
              style={{ borderColor: color, backgroundColor: `${color}20` }}
            >
              <CuteCharacter
                avatar={player?.avatar || 'cat'}
                color={color}
                mood={isReady ? 'ready' : 'idle'}
                size={40}
                showCrown={isOwner}
              />
            </div>
            <div>
              <h3 className="font-arcade text-sm text-white">{playerName}</h3>
              <p className="font-mono text-[11px] text-white/50">
                ROOM: <strong className="text-arcade-amber">{room.code}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={toggleReady}
            className={`px-4 py-2 rounded-xl font-arcade text-xs font-black transition-all ${
              isReady
                ? 'bg-arcade-mint text-black shadow-glow-mint'
                : 'bg-white/10 text-white/70 border border-white/15'
            }`}
          >
            {isReady ? 'READY ✓' : 'WAIT'}
          </button>
        </div>

        {/* Selected Game Banner */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 uppercase">
            <span>SELECTED GAME</span>
            <span className="text-arcade-amber font-bold">{room.selectedGame.replace('-', ' ')}</span>
          </div>
          <h4 className="font-arcade text-base text-white">{gameMeta.title}</h4>
          <p className="font-mono text-[11px] text-white/70 leading-relaxed">
            {gameMeta.tagline}
          </p>
        </div>

        {/* Ready Action Hint */}
        <p className="text-center font-mono text-[11px] text-white/50">
          Raise your status on phone. Match begins when all pilots are ready on TV.
        </p>

        <button
          onClick={onLeave}
          className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-mono text-xs transition-colors"
        >
          LEAVE PARTY
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   3. ARCADE IN-GAME CONTROLLER (LANDSCAPE SPLIT VIEW)
   ═══════════════════════════════════════════════════════════════ */
const ArcadeController: React.FC<{
  room: RoomState;
  playerId: string;
  gameId: GameId;
  hudState: PlayerClientHUDState | null;
  allHudStates?: Record<string, PlayerClientHUDState>;
  onSendInput: (input: ControllerInput) => void;
  onLeave: () => void;
}> = ({ room, playerId, gameId, hudState, onSendInput }) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [stickActive, setStickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const stickPosRef = useRef({ x: 0, y: 0 });
  const action1Ref = useRef(false);
  const action2Ref = useRef(false);
  const [action1Pressed, setAction1Pressed] = useState(false);
  const [action2Pressed, setAction2Pressed] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const emitInput = useCallback((normX = 0, normY = 0, a1?: boolean, a2?: boolean) => {
    const act1 = a1 ?? action1Ref.current;
    const act2 = a2 ?? action2Ref.current;
    const now = Date.now();
    const mag = Math.min(1, Math.hypot(normX, normY));
    const angle = Math.atan2(normY, normX);

    onSendInput({
      x: normX,
      y: normY,
      angle,
      magnitude: mag,
      action1: act1,
      action2: act2,
      timestamp: now,
    });
  }, [onSendInput]);

  const updateStickFromPoint = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const normX = (clampedDist / maxRadius) * Math.cos(angle);
    const normY = (clampedDist / maxRadius) * Math.sin(angle);
    const px = normX * (rect.width / 2 - 24);
    const py = normY * (rect.height / 2 - 24);
    stickPosRef.current = { x: px, y: py };
    setStickPos({ x: px, y: py });
    emitInput(normX, normY);
  }, [emitInput]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setStickActive(true);
    updateStickFromPoint(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stickActive || e.pointerId !== pointerIdRef.current) return;
    e.preventDefault();
    updateStickFromPoint(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    setStickActive(false);
    stickPosRef.current = { x: 0, y: 0 };
    setStickPos({ x: 0, y: 0 });
    emitInput(0, 0);
  };

  const onA1Down = (e: React.SyntheticEvent) => {
    e.preventDefault();
    action1Ref.current = true;
    setAction1Pressed(true);
    soundManager.playClick(1000);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 60 : 0, stickPosRef.current.y ? stickPosRef.current.y / 60 : 0, true, action2Ref.current);
  };

  const onA1Up = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    action1Ref.current = false;
    setAction1Pressed(false);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 60 : 0, stickPosRef.current.y ? stickPosRef.current.y / 60 : 0, false, action2Ref.current);
  };

  const onA2Down = (e: React.SyntheticEvent) => {
    e.preventDefault();
    action2Ref.current = true;
    setAction2Pressed(true);
    soundManager.playClick(1200);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 60 : 0, stickPosRef.current.y ? stickPosRef.current.y / 60 : 0, action1Ref.current, true);
  };

  const onA2Up = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    action2Ref.current = false;
    setAction2Pressed(false);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 60 : 0, stickPosRef.current.y ? stickPosRef.current.y / 60 : 0, action1Ref.current, false);
  };

  const action1Label = gameId === 'serpent-arena' ? '🚀 BOOST' : gameId === 'neon-relay' ? '⬆️ JUMP' : gameId === 'void-tag' ? '⚡ DASH' : '💥 TACKLE';
  const hasAction2 = ['void-tag', 'relic-rush', 'last-platform'].includes(gameId);
  const action2Label = gameId === 'last-platform' ? '⚡ FREEZE' : '📡 EMP';

  return (
    <div className="fixed inset-0 z-50 bg-[#07080E] flex flex-col justify-between p-3 select-none touch-none overflow-hidden">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <span className="font-arcade text-xs text-white">
          {hudState?.score !== undefined ? `SCORE: ${hudState.score}` : gameId.toUpperCase()}
        </span>
        <span className="font-mono text-xs text-arcade-amber font-bold">
          ROOM: {room.code}
        </span>
      </div>

      {/* Controller Split: Left 360 Joystick, Right Action Buttons */}
      <div className="flex-1 flex items-center justify-between gap-4 max-w-2xl mx-auto w-full px-2">
        {/* Left: 360 Virtual Analog Joystick */}
        <div className="w-1/2 flex items-center justify-center">
          <div
            ref={joystickRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="w-40 h-40 rounded-full bg-white/5 border-2 border-white/20 relative flex items-center justify-center shadow-[0_0_40px_rgba(0,245,160,0.15)] active:border-arcade-mint transition-colors"
          >
            {/* Center Thumb Knob */}
            <motion.div
              style={{
                transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
              }}
              className={`w-16 h-16 rounded-full border-2 transition-shadow ${
                stickActive
                  ? 'bg-arcade-mint text-black border-white shadow-[0_0_25px_rgba(0,245,160,0.8)]'
                  : 'bg-white/20 border-white/40'
              } flex items-center justify-center`}
            >
              <div className="w-4 h-4 rounded-full bg-white/40" />
            </motion.div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="w-1/2 flex flex-col items-center justify-center gap-3">
          <button
            onPointerDown={onA1Down}
            onPointerUp={onA1Up}
            onPointerCancel={onA1Up}
            className={`w-full py-5 rounded-2xl font-arcade text-sm font-black tracking-wider transition-all border-2 ${
              action1Pressed
                ? 'bg-arcade-mint text-black border-white shadow-[0_0_30px_rgba(0,245,160,0.8)] scale-98'
                : 'bg-white/10 hover:bg-white/15 text-white border-white/20 shadow-lg'
            }`}
          >
            {action1Label}
          </button>

          {hasAction2 && (
            <button
              onPointerDown={onA2Down}
              onPointerUp={onA2Up}
              onPointerCancel={onA2Up}
              className={`w-full py-4 rounded-2xl font-arcade text-xs font-black tracking-wider transition-all border-2 ${
                action2Pressed
                  ? 'bg-arcade-amber text-black border-white shadow-[0_0_30px_rgba(255,178,36,0.8)] scale-98'
                  : 'bg-white/5 hover:bg-white/10 text-white/80 border-white/15 shadow-md'
              }`}
            >
              {action2Label}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="text-center font-mono text-[10px] text-white/40 uppercase">
        📺 WATCH ACTION ON TV SCREEN &bull; 60 FPS AUTHORITATIVE SYNC
      </div>
    </div>
  );
};
