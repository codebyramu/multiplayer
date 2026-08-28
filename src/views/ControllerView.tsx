import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shuffle,
  AlertTriangle,
  Zap,
  Gamepad2,
  Tv,
  Radio,
  Sliders,
  Check,
} from 'lucide-react';
import { RoomState, ControllerInput, GameId, PlayerClientHUDState } from '../types';
import { GAMES_DATA, PLAYER_AVATARS } from '../data/games';
import { soundManager } from '../audio/SoundManager';
import { socketClient } from '../multiplayer/SocketClient';
import { p2pClient } from '../multiplayer/P2PClient';
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

const COLOR_PALETTE = [
  { id: 'mint', hex: '#00F5A0', name: 'Cyber Mint' },
  { id: 'cyan', hex: '#00E5FF', name: 'Neon Cyan' },
  { id: 'amber', hex: '#FFB224', name: 'Arcade Amber' },
  { id: 'crimson', hex: '#FF3366', name: 'Laser Crimson' },
  { id: 'violet', hex: '#9D4EDD', name: 'Void Violet' },
  { id: 'orange', hex: '#FF7700', name: 'Solar Orange' },
  { id: 'blue', hex: '#3A86FF', name: 'Quantum Blue' },
  { id: 'rose', hex: '#FF007F', name: 'Hyper Rose' },
];

export const ControllerView: React.FC<ControllerViewProps> = ({
  initialCode,
  room,
  playerId,
  inGame,
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

  if (room) {
    const safePlayerId = playerId || Object.keys(room.players)[0] || '';
    if (room.state === 'lobby' && !inGame) {
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

  return <CyberPhoneJoinScreen initialCode={initialCode} onJoinParty={joinHandler} />;
};

/* ═══════════════════════════════════════════════════════════════
   1. CYBERPUNK VINTAGE PHONE CONTROLLER WITH CHROMATIC GLITCH & DUST
   ═══════════════════════════════════════════════════════════════ */
const CyberPhoneJoinScreen: React.FC<{
  initialCode?: string;
  onJoinParty: (data: { code: string; name: string; avatar: string; color: string; skin: string }) => Promise<{ success: boolean; error?: string }>;
}> = ({ initialCode, onJoinParty }) => {
  const [code, setCode] = useState(initialCode || '');
  const [name, setName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState(PLAYER_AVATARS[0].id);
  const [selectedColorHex, setSelectedColorHex] = useState(COLOR_PALETTE[0].hex);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
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

  const currentAvatar = PLAYER_AVATARS.find((a) => a.id === selectedAvatarId) || PLAYER_AVATARS[0];
  const currentColorObj = COLOR_PALETTE.find((c) => c.hex === selectedColorHex) || COLOR_PALETTE[0];

  const handleRandomize = () => {
    soundManager.playClick(1050);
    const randAvatar = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)];
    const randColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    setSelectedAvatarId(randAvatar.id);
    setSelectedColorHex(randColor.hex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('ENTER PARTY CODE ON TV');
      return;
    }
    setError(null);
    setIsJoining(true);
    soundManager.playClick(900);

    const res = await onJoinParty({
      code: code.trim().toUpperCase(),
      name: name.trim() || currentAvatar.name.split(' ')[0],
      avatar: selectedAvatarId,
      color: selectedColorHex,
      skin: 'synth',
    });

    setIsJoining(false);
    if (!res.success) setError(res.error || 'COULD NOT CONNECT TO HOST.');
  };

  return (
    <div className="relative min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 select-none overflow-hidden font-display">
      {/* ─── A. VINTAGE RETRO GRID & SCANLINE OVERLAYS ─── */}
      <div className="absolute inset-0 bg-[#06070D] pointer-events-none" />
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#00F5A008_1px,transparent_1px),linear-gradient(to_bottom,#00F5A008_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none opacity-60"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,245,160,0.15)_0%,rgba(157,78,221,0.12)_45%,transparent_75%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[size:100%_4px] pointer-events-none opacity-40 z-10" />

      {/* ─── B. CYBER DECK TERMINAL CHASSIS ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-20 w-full max-w-md rounded-3xl bg-black/85 border-2 border-white/20 backdrop-blur-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(0,245,160,0.25)] space-y-6 overflow-hidden"
      >
        {/* Glowing Top Cyber Bevel Strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-arcade-amber via-arcade-mint to-arcade-cyan" />

        {/* Vintage Header with Chromatic Glitch Badge */}
        <div className="text-center space-y-2 border-b border-white/10 pb-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 px-1">
            <span className="flex items-center gap-1.5 text-arcade-mint">
              <Radio className="w-3 h-3 animate-pulse" /> P2P DATALINK
            </span>
            <span className="text-arcade-amber font-bold">HYP-DECK v2.4</span>
          </div>

          <div className="space-y-1">
            <h2 className="font-arcade text-2xl sm:text-3xl font-black text-white tracking-widest leading-none drop-shadow-[0_0_20px_rgba(0,245,160,0.7)]">
              <motion.span
                animate={{
                  textShadow: [
                    '0 0 15px rgba(255,255,255,0.7)',
                    '0 0 25px rgba(0,245,160,0.9), 2px 2px #FF0055',
                    '0 0 25px rgba(0,229,255,0.9), -2px -2px #00F5A0',
                    '0 0 15px rgba(255,255,255,0.7)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 3.0, ease: 'easeInOut' }}
              >
                PHONE GAMEPAD
              </motion.span>
            </h2>
            <p className="font-mono text-[10px] sm:text-[11px] text-white/60 uppercase tracking-widest">
              PAIR WITH LIVING ROOM TV SCREEN
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-mono flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Party Code with Camera QR Trigger */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/60">
              <span>1. PARTY CODE (ON TV)</span>
              <span className="text-arcade-cyan flex items-center gap-1">
                <Camera className="w-3 h-3" /> SCAN QR
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. HYP42"
                maxLength={7}
                required
                className="w-full pl-4 pr-14 py-3.5 rounded-2xl bg-white/5 border-2 border-white/20 text-center font-arcade text-2xl tracking-widest text-arcade-amber placeholder:text-white/20 uppercase focus:outline-none focus:border-arcade-amber shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"
              />
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick(900);
                  setShowScanner(true);
                }}
                title="Scan QR Code on TV"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-arcade-cyan/25 hover:bg-arcade-cyan/35 text-arcade-cyan border border-arcade-cyan/50 active:scale-95 transition-all shadow-glow-cyan"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Pilot Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-white/60">
              2. PILOT CALLSIGN
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CyberViper"
              maxLength={14}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border-2 border-white/15 text-center font-display text-sm tracking-wide text-white placeholder:text-white/30 focus:outline-none focus:border-arcade-mint shadow-inner"
            />
          </div>

          {/* 3. Avatar & Aura Color Customizer with Expandable Gallery */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/60">
              <span>3. PILOT AVATAR & AURA</span>
              <button
                type="button"
                onClick={handleRandomize}
                className="text-arcade-amber hover:underline flex items-center gap-1 font-bold"
              >
                <Shuffle className="w-3 h-3" />
                <span>RANDOMIZE</span>
              </button>
            </div>

            {/* Selected Avatar Pill (Tapping expands gallery) */}
            <button
              type="button"
              onClick={() => {
                soundManager.playClick(900);
                setIsGalleryOpen(!isGalleryOpen);
              }}
              className="w-full p-2.5 rounded-2xl bg-white/5 border-2 border-white/20 hover:border-arcade-mint/50 transition-all flex items-center justify-between gap-3 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-1 rounded-xl border-2 shadow-lg"
                  style={{ borderColor: selectedColorHex, backgroundColor: `${selectedColorHex}25` }}
                >
                  <CuteCharacter
                    avatar={selectedAvatarId}
                    color={selectedColorHex}
                    size={38}
                    mood="happy"
                  />
                </div>
                <div className="text-left">
                  <div className="font-arcade text-xs text-white flex items-center gap-1.5">
                    <span>{currentAvatar.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/60 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full inline-block ring-1 ring-white/30" style={{ backgroundColor: selectedColorHex }} />
                    {currentColorObj.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-arcade-mint font-mono text-xs font-bold pr-2">
                <Sliders className="w-3.5 h-3.5" />
                <span>{isGalleryOpen ? 'CLOSE' : 'GALLERY'}</span>
                {isGalleryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Expandable Character & Aura Color Gallery Dropdown */}
            <AnimatePresence>
              {isGalleryOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <div className="p-4 rounded-2xl bg-black/90 border-2 border-arcade-mint/40 space-y-4 shadow-2xl">
                    {/* Character Avatars Gallery Grid */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-arcade-mint uppercase font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> SELECT PILOT (8 AVATARS)
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {PLAYER_AVATARS.map((av) => {
                          const isSelected = selectedAvatarId === av.id;
                          return (
                            <button
                              key={av.id}
                              type="button"
                              onClick={() => {
                                soundManager.playClick(950);
                                setSelectedAvatarId(av.id);
                              }}
                              className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                                isSelected
                                  ? 'border-arcade-mint bg-arcade-mint/25 text-arcade-mint shadow-glow-mint scale-105'
                                  : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                              }`}
                            >
                              <CuteCharacter
                                avatar={av.id}
                                color={isSelected ? selectedColorHex : '#888888'}
                                size={32}
                                mood={isSelected ? 'happy' : 'idle'}
                              />
                              <span className="text-[9px] font-mono truncate w-full text-center">
                                {av.name.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hologram Aura Colors Grid */}
                    <div className="space-y-1.5 border-t border-white/10 pt-3">
                      <span className="text-[10px] font-mono text-arcade-amber uppercase font-bold flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> SELECT AURA COLOR (8 HUES)
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PALETTE.map((c) => {
                          const isSelected = selectedColorHex === c.hex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                soundManager.playClick(1050);
                                setSelectedColorHex(c.hex);
                              }}
                              className={`p-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                                isSelected
                                  ? 'border-white bg-white/20 shadow-lg scale-102 ring-1 ring-white'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full ring-1 ring-white/40 shrink-0"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span className="text-[9px] font-mono text-white/80 truncate">
                                {c.name.split(' ')[1] || c.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. Action Button with Cyber Glow */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={isJoining}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-arcade-cyan via-teal-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-widest shadow-[0_0_35px_rgba(0,229,255,0.7)] border-2 border-white/50 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 mt-2"
          >
            {isJoining ? 'SYNCHRONIZING...' : 'CONNECT CONTROLLER ▶'}
          </motion.button>
        </form>

        {/* QR Scanner Modal */}
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
   2. MINIMAL WAITING ROOM SCREEN WITH GIANT READY TOGGLE
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
    p2pClient.setReady(next);
    onSendInput({ x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() });
  };

  const gameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];
  const playerName = player?.name || 'PILOT';

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-center justify-center p-4 select-none font-display">
      <div className="w-full max-w-md rounded-3xl bg-[#090A14]/90 border-2 border-white/20 backdrop-blur-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_70px_rgba(0,245,160,0.2)]">
        {/* Contender Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div
              className="p-1 rounded-2xl border-2 shadow-lg"
              style={{ borderColor: color, backgroundColor: `${color}25` }}
            >
              <CuteCharacter
                avatar={player?.avatar || 'cat'}
                color={color}
                mood={isReady ? 'ready' : 'idle'}
                size={44}
                showCrown={isOwner}
              />
            </div>
            <div>
              <h3 className="font-arcade text-base text-white">{playerName}</h3>
              <p className="font-mono text-xs text-white/60">
                PARTY: <strong className="text-arcade-amber font-bold">{room.code}</strong>
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full font-mono text-[11px] font-bold border ${
              isReady
                ? 'bg-arcade-mint/20 border-arcade-mint text-arcade-mint shadow-glow-mint'
                : 'bg-white/10 border-white/20 text-white/60'
            }`}
          >
            {isReady ? 'READY ✓' : 'NOT READY'}
          </span>
        </div>

        {/* Selected Game Card */}
        <div className="rounded-2xl bg-white/5 border border-white/15 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 uppercase">
            <span>SELECTED ARENA</span>
            <span className="text-arcade-amber font-bold">{room.selectedGame.replace('-', ' ')}</span>
          </div>
          <h4 className="font-arcade text-lg text-white">{gameMeta.title}</h4>
          <p className="font-mono text-xs text-white/70 leading-relaxed">
            {gameMeta.tagline}
          </p>
        </div>

        {/* GIANT READY ACTION BUTTON */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggleReady}
          className={`w-full py-5 rounded-2xl font-arcade text-base font-black tracking-widest transition-all border-2 shadow-2xl active:scale-95 flex items-center justify-center gap-2 ${
            isReady
              ? 'bg-arcade-mint text-black border-white shadow-[0_0_40px_rgba(0,245,160,0.85)]'
              : 'bg-gradient-to-r from-arcade-amber via-yellow-400 to-amber-500 text-black border-white shadow-[0_0_35px_rgba(255,178,36,0.6)]'
          }`}
        >
          {isReady ? '✅ READY! (TAP TO CANCEL)' : '🚀 TAP TO READY UP!'}
        </motion.button>

        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-[11px] text-white/50">
            Rotate phone to landscape in-game 🔄
          </span>
          <button
            onClick={onLeave}
            className="text-white/50 hover:text-red-400 font-mono text-xs transition-colors underline"
          >
            LEAVE
          </button>
        </div>
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

  // Detect portrait orientation on mobile devices
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#07080E] flex flex-col justify-between p-3 select-none touch-none overflow-hidden font-display">
      {/* 1. PORTRAIT ROTATION WARNING OVERLAY */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center space-y-5 animate-pulse">
          <div className="w-20 h-20 rounded-3xl bg-arcade-mint/15 border-2 border-arcade-mint flex items-center justify-center text-4xl shadow-[0_0_50px_rgba(0,245,160,0.4)]">
            🔄
          </div>
          <div className="space-y-2">
            <h2 className="font-arcade text-xl text-white tracking-wider">
              ROTATE PHONE TO LANDSCAPE
            </h2>
            <p className="font-mono text-xs text-white/70 max-w-xs">
              Hypercade controller is optimized for two-thumb landscape gameplay. Turn your device horizontally.
            </p>
          </div>
          <button
            onClick={() => setIsPortrait(false)}
            className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 font-mono text-xs hover:bg-white/20"
          >
            CONTINUE ANYWAY ✕
          </button>
        </div>
      )}

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
      <div className="flex-1 flex items-center justify-between gap-6 max-w-3xl mx-auto w-full px-4">
        {/* Left: 360 Virtual Analog Joystick */}
        <div className="w-1/2 flex items-center justify-center">
          <div
            ref={joystickRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-white/5 border-2 border-white/25 relative flex items-center justify-center shadow-[0_0_50px_rgba(0,245,160,0.2)] active:border-arcade-mint transition-colors"
          >
            <div className="absolute inset-0 rounded-full border border-dashed border-white/10 pointer-events-none" />
            <motion.div
              style={{
                transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
              }}
              className={`w-18 h-18 rounded-full border-2 transition-shadow ${
                stickActive
                  ? 'bg-arcade-mint text-black border-white shadow-[0_0_30px_rgba(0,245,160,0.9)]'
                  : 'bg-white/25 border-white/40 shadow-lg'
              } flex items-center justify-center`}
            >
              <div className="w-5 h-5 rounded-full bg-white/50" />
            </motion.div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="w-1/2 flex flex-col items-center justify-center gap-3.5 max-w-xs">
          <button
            onPointerDown={onA1Down}
            onPointerUp={onA1Up}
            onPointerCancel={onA1Up}
            className={`w-full py-6 sm:py-7 rounded-3xl font-arcade text-base sm:text-lg font-black tracking-widest transition-all border-2 ${
              action1Pressed
                ? 'bg-arcade-mint text-black border-white shadow-[0_0_40px_rgba(0,245,160,0.9)] scale-98'
                : 'bg-gradient-to-r from-arcade-mint/90 to-teal-400 text-black border-white/60 shadow-[0_0_30px_rgba(0,245,160,0.4)] hover:brightness-110 active:scale-95'
            }`}
          >
            {action1Label}
          </button>

          {hasAction2 && (
            <button
              onPointerDown={onA2Down}
              onPointerUp={onA2Up}
              onPointerCancel={onA2Up}
              className={`w-full py-4 sm:py-5 rounded-2xl font-arcade text-xs sm:text-sm font-black tracking-wider transition-all border-2 ${
                action2Pressed
                  ? 'bg-arcade-amber text-black border-white shadow-[0_0_35px_rgba(255,178,36,0.9)] scale-98'
                  : 'bg-white/10 hover:bg-white/15 text-arcade-amber border-arcade-amber/40 shadow-md active:scale-95'
              }`}
            >
              {action2Label}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="text-center font-mono text-[10px] text-white/40 uppercase">
        📺 WATCH ACTION ON BIG SCREEN &bull; ULTRA LOW-LATENCY WEBRTC
      </div>
    </div>
  );
};
