import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameId, ControllerInput, RoomState, PlayerClientHUDState } from '../types';
import { GAMES_DATA } from '../data/games';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { AvatarSelector } from '../components/ui/AvatarSelector';
import { Gamepad2, Zap, Shield, Flame, Check, AlertTriangle, Trophy, Crown, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';
import { socketClient } from '../multiplayer/SocketClient';
import { QRScannerModal } from '../components/ui/QRScannerModal';

interface ControllerViewProps {
  initialCode?: string;
  room?: RoomState | null;
  playerId?: string | null;
  inGame: boolean;
  gameId?: GameId;
  hudState?: PlayerClientHUDState | null;
  onJoin: (data: { code: string; name: string; avatar: string; color: string; skin: string }) => Promise<{ success: boolean; error?: string }>;
  onSendInput: (input: ControllerInput) => void;
  onLeave: () => void;
}

const triggerHaptic = (ms = 30) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(ms); } catch {}
  }
};

/* ─── JOIN FORM ─── */
const JoinForm: React.FC<{
  initialCode: string;
  onJoin: ControllerViewProps['onJoin'];
}> = ({ initialCode, onJoin }) => {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('ship');
  const [color, setColor] = useState('#00F5A0');
  const [skin, setSkin] = useState('synth');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const n = localStorage.getItem('hypercade_pilot_name'); if (n) setName(n);
      const a = localStorage.getItem('hypercade_avatar'); if (a) setAvatar(a);
      const c = localStorage.getItem('hypercade_color'); if (c) setColor(c);
    } catch {}
  }, []);

  useEffect(() => { if (initialCode) setCode(initialCode.toUpperCase()); }, [initialCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setJoinError('Enter a valid Party Code shown on the TV'); return; }
    const finalName = name.trim() || `Pilot_${100 + Math.floor(Math.random() * 899)}`;
    setIsJoining(true); setJoinError(null);
    try {
      localStorage.setItem('hypercade_pilot_name', finalName);
      localStorage.setItem('hypercade_avatar', avatar);
      localStorage.setItem('hypercade_color', color);
    } catch {}
    const res = await onJoin({ code: code.trim().toUpperCase(), name: finalName, avatar, color, skin });
    setIsJoining(false);
    if (!res.success) setJoinError(res.error || 'Failed to join. Check the code and try again.');
  };

  const [showScanner, setShowScanner] = useState(false);

  const handleScanSuccess = async (scannedCode: string) => {
    setCode(scannedCode);
    setShowScanner(false);
    const finalName = name.trim() || `Pilot_${100 + Math.floor(Math.random() * 899)}`;
    setIsJoining(true);
    setJoinError(null);
    try {
      localStorage.setItem('hypercade_pilot_name', finalName);
      localStorage.setItem('hypercade_avatar', avatar);
      localStorage.setItem('hypercade_color', color);
    } catch {}
    const res = await onJoin({ code: scannedCode, name: finalName, avatar, color, skin });
    setIsJoining(false);
    if (!res.success) setJoinError(res.error || 'Failed to join with scanned code.');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 flex items-start sm:items-center justify-center overflow-y-auto">
      <GlassPanel className="w-full max-w-md p-5 sm:p-8 space-y-5 border-arcade-cyan/30 shadow-glow-cyan my-auto">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-arcade-cyan/15 border border-arcade-cyan/40 text-arcade-cyan flex items-center justify-center mx-auto mb-3 shadow-glow-cyan">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <h2 className="font-arcade text-xl sm:text-2xl text-arcade-cream">JOIN ARCADE PARTY</h2>
          <p className="text-xs font-mono text-arcade-cream-muted">Connect your phone as an instant game controller</p>
        </div>

        {/* Scan TV QR Code Button */}
        <button
          type="button"
          onClick={() => {
            soundManager.playClick(900);
            setShowScanner(true);
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-arcade-cyan/25 via-arcade-cyan/40 to-arcade-cyan/25 border-2 border-arcade-cyan text-arcade-cyan font-arcade text-xs sm:text-sm font-black flex items-center justify-center gap-2 hover:brightness-110 shadow-glow-cyan active:scale-98 transition-all"
        >
          <span>📷 SCAN QR CODE TO JOIN</span>
        </button>

        {joinError && (
          <div className="p-3 rounded-xl bg-arcade-crimson/15 border border-arcade-crimson/40 text-arcade-crimson text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{joinError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-arcade-cream-muted uppercase">Party Code (on TV)</label>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="text-[10px] font-mono text-arcade-cyan hover:underline flex items-center gap-1"
              >
                <span>SCAN QR</span>
              </button>
            </div>
            <input
              type="text" value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. HYP42" maxLength={7}
              className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/20 text-center font-arcade text-2xl tracking-widest text-arcade-amber uppercase focus:outline-none focus:border-arcade-amber shadow-inner"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-arcade-cream-muted uppercase mb-1.5">Pilot Handle</label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ShadowViper" maxLength={14}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-sm font-display text-arcade-cream focus:outline-none focus:border-arcade-mint"
            />
          </div>
          <AvatarSelector
            selectedAvatar={avatar} selectedColor={color} selectedSkin={skin}
            onSelectAvatar={setAvatar} onSelectColor={setColor} onSelectSkin={setSkin}
          />
          <ArcadeButton type="submit" variant="cyan" size="lg" fullWidth disabled={isJoining}>
            {isJoining ? 'SYNCHRONIZING...' : 'CONNECT CONTROLLER'}
          </ArcadeButton>
        </form>

        {/* In-App QR Scanner Modal */}
        <QRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleScanSuccess}
        />
      </GlassPanel>
    </div>
  );
};

/* ─── LOBBY WAITING SCREEN ─── */
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
    if (player && typeof player.isReady === 'boolean') {
      setIsReady(player.isReady);
    }
  }, [player?.isReady]);

  const toggleReady = () => {
    const next = !isReady;
    setIsReady(next);
    triggerHaptic(50);
    soundManager.playClick(next ? 1100 : 800);
    socketClient.setReady(next);
    onSendInput({ x: 0, y: 0, angle: 0, magnitude: 0, action1: false, action2: false, timestamp: Date.now() });
  };

  const allGameKeys: GameId[] = ['serpent-arena', 'neon-relay', 'void-tag', 'relic-rush', 'last-platform'];
  const gameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];
  const playerName = player?.name || 'PILOT';

  const selectGame = (gId: GameId) => {
    soundManager.playClick(1000);
    socketClient.selectGame(gId);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 flex flex-col items-center justify-between max-w-md mx-auto space-y-4 overflow-y-auto">
      {/* Player Header Badge */}
      <GlassPanel className="w-full p-4 flex items-center justify-between border-arcade-mint/30 shadow-glow-mint">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold text-black shadow-lg relative"
            style={{ backgroundColor: color }}
          >
            🎮
            {isOwner && (
              <span className="absolute -top-2 -right-1 text-xs" title="Party Leader">👑</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-arcade text-sm text-arcade-cream">{playerName}</span>
              {isOwner && (
                <span className="px-1.5 py-0.2 rounded bg-arcade-amber/20 text-arcade-amber font-mono text-[9px] font-bold border border-arcade-amber/40">
                  PARTY LEADER
                </span>
              )}
            </div>
            <span className="font-mono text-xs text-arcade-cream-muted">ROOM: <strong className="text-arcade-amber">{room.code}</strong></span>
          </div>
        </div>

        <button
          onClick={toggleReady}
          className={`px-3.5 py-2 rounded-xl border font-arcade text-xs font-bold transition-all flex items-center gap-1.5 ${
            isReady
              ? 'bg-green-500/20 border-green-400 text-green-400 shadow-glow-mint'
              : 'bg-white/5 border-white/20 text-arcade-cream-muted'
          }`}
        >
          {isReady ? <Check className="w-4 h-4" /> : '⏳'}
          {isReady ? 'READY' : 'WAIT'}
        </button>
      </GlassPanel>

      {/* Selected Arena Card */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-arcade-cream-muted uppercase tracking-wider">
            {isOwner ? '🎮 SELECT ARENA (YOU ARE LEADER)' : '📺 SELECTED ARENA ON TV'}
          </span>
        </div>

        <div className="relative h-40 w-full rounded-2xl overflow-hidden border-2 border-arcade-amber/50 shadow-glow-amber">
          {gameMeta.coverImage ? (
            <img src={gameMeta.coverImage} alt={gameMeta.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-arcade-amber/20 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute top-2 left-3">
            <span className="px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono text-arcade-amber uppercase font-bold backdrop-blur-sm border border-white/10">
              {gameMeta.category}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="font-arcade text-lg text-arcade-cream">{gameMeta.title}</h3>
            <p className="text-xs text-arcade-cream-muted line-clamp-1">{gameMeta.tagline}</p>
          </div>
        </div>

        {/* Quick Arena Selector Pills for Party Leader */}
        {isOwner && (
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {allGameKeys.map((gId) => {
              const isSelected = room.selectedGame === gId;
              const g = GAMES_DATA[gId];
              return (
                <button
                  key={gId}
                  onClick={() => selectGame(gId)}
                  className={`p-1.5 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-arcade-amber text-black border-arcade-amber font-bold shadow-glow-amber scale-105'
                      : 'bg-white/5 border-white/10 text-arcade-cream hover:bg-white/10'
                  }`}
                >
                  <span className="text-[9px] font-arcade block truncate">
                    {g.title.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Giant Main Ready Button */}
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={toggleReady}
        className={`w-full py-5 rounded-2xl border-2 font-arcade text-lg font-black flex items-center justify-center gap-3 shadow-xl transition-all ${
          isReady
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400 text-black shadow-[0_0_30px_rgba(34,197,94,0.7)]'
            : 'bg-arcade-amber/20 hover:bg-arcade-amber/30 border-arcade-amber text-arcade-amber shadow-glow-amber'
        }`}
      >
        {isReady ? (
          <>
            <Check className="w-6 h-6 stroke-[3]" />
            <span>YOU ARE READY!</span>
          </>
        ) : (
          <>
            <Flame className="w-6 h-6" />
            <span>TAP TO READY UP</span>
          </>
        )}
      </motion.button>

      <div className="text-center font-mono text-[11px] text-arcade-cream-muted animate-pulse">
        {isReady ? '⚡ WAITING FOR ALL CONTENDERS &bull; MATCH AUTO-STARTS' : 'TAP THE BUTTON ABOVE TO SIGNAL READY'}
      </div>

      <button onClick={onLeave} className="text-xs font-mono text-arcade-crimson hover:underline py-2">
        Disconnect from Party
      </button>
    </div>
  );
};

/* ─── FULL MOBILE ARCADE CONTROLLER ─── */
const ArcadeController: React.FC<{
  gameId: GameId;
  room?: RoomState | null;
  playerId?: string | null;
  hudState?: PlayerClientHUDState | null;
  playerColor: string;
  playerName: string;
  onSendInput: (input: ControllerInput) => void;
}> = ({ gameId, room, playerId, hudState, playerColor, playerName, onSendInput }) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [stickActive, setStickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const stickPosRef = useRef({ x: 0, y: 0 });
  const [action1Pressed, setAction1Pressed] = useState(false);
  const [action2Pressed, setAction2Pressed] = useState(false);
  const action1Ref = useRef(false);
  const action2Ref = useRef(false);

  const isEliminated = hudState?.status === 'eliminated';
  const isWinner = hudState?.status === 'winner';

  const [spectateMode, setSpectateMode] = useState<'arena' | 'pilot'>('arena');
  const [spectateIndex, setSpectateIndex] = useState(0);

  const contenders = Object.values(room?.players || {}).filter((p) => p.id !== playerId);
  const currentSpectated = contenders.length > 0 ? contenders[spectateIndex % contenders.length] : null;

  const handleNextSpectate = () => {
    soundManager.playClick(900);
    triggerHaptic(20);
    setSpectateIndex((prev) => (prev + 1) % Math.max(1, contenders.length));
  };

  const handlePrevSpectate = () => {
    soundManager.playClick(800);
    triggerHaptic(20);
    setSpectateIndex((prev) => (prev - 1 + contenders.length) % Math.max(1, contenders.length));
  };

  const sendEmote = (emoji: string) => {
    triggerHaptic(30);
    soundManager.playClick(1200);
    socketClient.sendEmote(emoji, playerName, playerColor);
  };

  const lastSentInputRef = useRef<{ x: number; y: number; a1: boolean; a2: boolean; time: number }>({ x: 0, y: 0, a1: false, a2: false, time: 0 });

  const emitInput = useCallback((normX = 0, normY = 0, a1?: boolean, a2?: boolean) => {
    const act1 = a1 ?? action1Ref.current;
    const act2 = a2 ?? action2Ref.current;
    const now = Date.now();
    const last = lastSentInputRef.current;

    // Delta-compression: If inputs are unchanged and joystick is idle, don't spam network
    const isStationary = Math.abs(normX) < 0.02 && Math.abs(normY) < 0.02;
    const isSameButtonState = act1 === last.a1 && act2 === last.a2;
    const isSameVector = Math.hypot(normX - last.x, normY - last.y) < 0.015;

    if (isStationary && last.x === 0 && last.y === 0 && isSameButtonState && now - last.time < 300) {
      return;
    }

    if (isSameVector && isSameButtonState && now - last.time < 20) {
      return;
    }

    const finalX = isStationary ? 0 : normX;
    const finalY = isStationary ? 0 : normY;
    const mag = Math.min(1, Math.sqrt(finalX * finalX + finalY * finalY));
    const angle = Math.atan2(finalY, finalX);

    lastSentInputRef.current = { x: finalX, y: finalY, a1: act1, a2: act2, time: now };

    onSendInput({
      x: finalX,
      y: finalY,
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
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const normX = (clampedDist / maxRadius) * Math.cos(angle);
    const normY = (clampedDist / maxRadius) * Math.sin(angle);
    const px = normX * (rect.width / 2 - 20);
    const py = normY * (rect.height / 2 - 20);
    stickPosRef.current = { x: px, y: py };
    setStickPos({ x: px, y: py });
    emitInput(normX, normY);
  }, [emitInput]);

  // Pointer Event Handlers for 100% Reliable Touch/Mouse Tracking
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Fallback Touch Handlers for Older WebViews
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touch) {
      setStickActive(true);
      updateStickFromPoint(touch.clientX, touch.clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!stickActive) return;
    const touch = e.changedTouches[0];
    if (touch) {
      updateStickFromPoint(touch.clientX, touch.clientY);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setStickActive(false);
    stickPosRef.current = { x: 0, y: 0 };
    setStickPos({ x: 0, y: 0 });
    emitInput(0, 0);
  };

  // Action Buttons with unified touch & pointer handling
  const onA1Down = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    action1Ref.current = true;
    setAction1Pressed(true);
    triggerHaptic(40);
    soundManager.playClick(1000);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 67.5 : 0, stickPosRef.current.y ? stickPosRef.current.y / 67.5 : 0, true, action2Ref.current);
  };

  const onA1Up = (e?: React.SyntheticEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    action1Ref.current = false;
    setAction1Pressed(false);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 67.5 : 0, stickPosRef.current.y ? stickPosRef.current.y / 67.5 : 0, false, action2Ref.current);
  };

  const a2Cooldown = hudState?.action2Cooldown ?? 0;
  const a2OnCooldown = a2Cooldown > 0;

  const onA2Down = (e?: React.SyntheticEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (a2OnCooldown) { triggerHaptic(10); return; }
    action2Ref.current = true;
    setAction2Pressed(true);
    triggerHaptic(45);
    soundManager.playClick(1200);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 67.5 : 0, stickPosRef.current.y ? stickPosRef.current.y / 67.5 : 0, action1Ref.current, true);
  };

  const onA2Up = (e?: React.SyntheticEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    action2Ref.current = false;
    setAction2Pressed(false);
    emitInput(stickPosRef.current.x ? stickPosRef.current.x / 67.5 : 0, stickPosRef.current.y ? stickPosRef.current.y / 67.5 : 0, action1Ref.current, false);
  };

  const action1Label = gameId === 'serpent-arena' ? '🚀 HYPER BOOST'
    : gameId === 'neon-relay' ? '⬆️ JUMP / HOP'
    : gameId === 'void-tag' ? '⚡ PHASE DASH'
    : gameId === 'relic-rush' ? '💥 TACKLE SLAM'
    : '⬆️ JUMP / HOP';

  const hasAction2 = ['void-tag', 'relic-rush', 'last-platform', 'neon-relay'].includes(gameId);
  const action2Label = gameId === 'last-platform' ? '⚡ FREEZE SHOT'
    : gameId === 'void-tag' ? '📡 EMP STUN'
    : gameId === 'neon-relay' ? '🚀 NITRO BOOST'
    : '🛡️ KINETIC SHIELD';

  if (isWinner || isEliminated) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col justify-between p-3 sm:p-4 text-center select-none overflow-hidden touch-none">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{isWinner ? '👑' : '💀'}</span>
            <span className="font-arcade text-xs text-arcade-cream">{isWinner ? 'CHAMPION' : 'ELIMINATED — SPECTATOR'}</span>
          </div>
          <span className="font-mono text-xs text-arcade-amber font-bold">{hudState?.score ?? 0} PTS</span>
        </div>

        <div className="my-auto max-w-sm mx-auto w-full space-y-3">
          {!isWinner && (
            <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-black/60 border border-white/15">
              <button
                onClick={() => { soundManager.playClick(850); setSpectateMode('arena'); }}
                className={`flex-1 py-2 px-3 rounded-xl font-arcade text-xs transition-all ${
                  spectateMode === 'arena'
                    ? 'bg-arcade-cyan/30 text-arcade-cyan border border-arcade-cyan shadow-glow-cyan font-bold'
                    : 'text-arcade-cream-muted hover:text-white'
                }`}
              >
                🌐 ARENA OVERVIEW
              </button>
              <button
                onClick={() => { soundManager.playClick(850); setSpectateMode('pilot'); }}
                className={`flex-1 py-2 px-3 rounded-xl font-arcade text-xs transition-all ${
                  spectateMode === 'pilot'
                    ? 'bg-arcade-amber/30 text-arcade-amber border border-arcade-amber shadow-glow-amber font-bold'
                    : 'text-arcade-cream-muted hover:text-white'
                }`}
              >
                👤 PILOT SPECTATE
              </button>
            </div>
          )}

          {isWinner ? (
            <div className="p-6 rounded-3xl bg-arcade-amber/20 border-2 border-arcade-amber shadow-glow-amber space-y-2">
              <div className="text-5xl animate-bounce">👑</div>
              <h3 className="font-arcade text-2xl text-arcade-amber">CHAMPION OF THE ARENA!</h3>
              <p className="font-mono text-xs text-arcade-cream">Congratulations! You conquered the match.</p>
            </div>
          ) : spectateMode === 'arena' ? (
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="text-4xl animate-pulse">📺</div>
              <h4 className="font-arcade text-sm text-arcade-cream">GLOBAL ARENA BROADCAST</h4>
              <p className="font-mono text-xs text-arcade-cream-muted">
                Watching full arena battle stream on main TV screen.
              </p>
              <div className="flex items-center justify-center gap-3 text-xs font-mono text-white/70 pt-1">
                <span>PILOTS: <strong>{contenders.length}</strong></span>
                <span>GAME: <strong>{(GAMES_DATA[gameId] || GAMES_DATA['serpent-arena']).title.split(' ')[0]}</strong></span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-3xl bg-white/5 border border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevSpectate}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-mono text-arcade-cyan flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> PREV
                </button>
                <span className="font-mono text-xs text-white/50">
                  {contenders.length > 0 ? `${(spectateIndex % contenders.length) + 1} / ${contenders.length}` : '0 PILOTS'}
                </span>
                <button
                  onClick={handleNextSpectate}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-mono text-arcade-cyan flex items-center gap-1"
                >
                  NEXT <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {currentSpectated ? (
                <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-black/40 border border-white/10">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-black shadow-lg border-2 border-white/60 shrink-0"
                    style={{ backgroundColor: currentSpectated.color || '#00F5A0' }}
                  >
                    {currentSpectated.isBot ? '🤖' : '👤'}
                  </div>
                  <div className="text-left min-w-0">
                    <span className="font-display text-sm font-bold text-arcade-cream block truncate">
                      {currentSpectated.name}
                    </span>
                    <span className="text-[10px] font-mono text-arcade-amber font-bold block">
                      SCORE: {currentSpectated.score || 0} PTS
                    </span>
                    <span className="text-[9px] font-mono text-white/50 uppercase">
                      {currentSpectated.isBot ? 'AUTONOMOUS BOT' : 'CONTENDER'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs text-white/50">No other pilots available to spectate.</p>
              )}
            </div>
          )}

          <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10">
            <span className="text-[9px] font-mono text-arcade-cream-muted block mb-1.5">SEND LIVE EMOTE TO TV:</span>
            <div className="flex items-center justify-center gap-1.5">
              {['🔥', '⚡', '💀', '👑', '👏', '🎉'].map((emo) => (
                <button
                  key={emo}
                  onClick={() => sendEmote(emo)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 text-lg flex items-center justify-center transition-transform shadow-sm"
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="font-mono text-[9px] text-arcade-mint animate-pulse shrink-0">
          👀 SPECTATING MATCH ON TV DISPLAY
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col justify-between select-none overflow-hidden touch-none p-2 sm:p-3"
      style={{ touchAction: 'none' }}
    >
      {/* ─── 1. TOP CONTROLLER HUD BAR ─── */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shrink-0 shadow-lg gap-2"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white/30 shrink-0" style={{ backgroundColor: playerColor }} />
          <span className="font-display font-bold text-xs text-arcade-cream truncate">{playerName}</span>
        </div>

        {hudState && (
          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
            <span className="text-arcade-amber font-bold">{hudState.score} PTS</span>
            <span className="text-arcade-cyan font-bold">#{hudState.rank}/{hudState.totalPlayers ?? 1}</span>
          </div>
        )}

        <span className="font-arcade text-[9px] text-arcade-cream-muted shrink-0 hidden xs:block">
          {(GAMES_DATA[gameId] || GAMES_DATA['serpent-arena']).title.split(' ')[0]}
        </span>
      </div>

      {/* ─── 2. HUNTER / FROZEN / STATUS ALERTS ─── */}
      {hudState?.status === 'hunter' && (
        <div className="text-center py-1 rounded-lg bg-arcade-violet/30 border border-arcade-violet font-arcade text-[10px] text-arcade-violet animate-pulse shadow-glow-violet shrink-0">
          ⚡ YOU ARE THE VOID HUNTER — TAG SURVIVORS!
        </div>
      )}

      {/* ─── 3. MAIN CONTROLLER INTERACTION REGION ─── */}
      {/* Portrait: stacked column. Landscape: side-by-side split (joystick left 48%, buttons right 48%) */}
      <div className="flex-1 flex flex-col landscape:flex-row items-center landscape:items-stretch justify-around landscape:justify-between gap-3 landscape:gap-2 min-h-0 py-1 landscape:py-0">

        {/* ═══ 360° ANALOG JOYSTICK — Left side in landscape ═══ */}
        <div className="flex flex-col items-center justify-center gap-1.5 landscape:w-[48%] landscape:py-2">
          <div
            ref={joystickRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="relative flex items-center justify-center rounded-full cursor-pointer touch-none shadow-2xl"
            style={{
              width: 'min(44vw, 180px)',
              height: 'min(44vw, 180px)',
              background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(10,10,15,0.85) 100%)',
              border: `2px solid ${stickActive ? '#FFB224' : 'rgba(255,255,255,0.18)'}`,
              boxShadow: stickActive ? '0 0 30px rgba(255,178,36,0.3) inset, 0 0 20px rgba(255,178,36,0.3)' : 'none',
              transition: 'border-color 0.1s, box-shadow 0.1s',
            }}
          >
            {/* Center Reference Guide Rings */}
            <div className="absolute w-[55%] h-[55%] rounded-full border border-dashed border-white/15 pointer-events-none" />
            <div className="absolute w-[28%] h-[28%] rounded-full border border-white/10 pointer-events-none" />

            {/* Glowing Draggable Stick Knob */}
            <motion.div
              animate={{ x: stickPos.x, y: stickPos.y }}
              transition={{ type: 'spring', stiffness: 850, damping: 40 }}
              className="absolute w-12 h-12 rounded-full pointer-events-none flex items-center justify-center font-bold text-[9px] text-black shadow-2xl"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #FFE27A, #FF7700)',
                boxShadow: '0 4px 20px rgba(255,140,0,0.9), 0 0 10px rgba(255,178,36,0.8)',
                border: '2px solid rgba(255,255,255,0.6)',
              }}
            >
              STEER
            </motion.div>
          </div>
          <span className="text-[9px] font-mono text-arcade-cream-muted uppercase tracking-widest">
            360&deg; Virtual Touch
          </span>
        </div>

        {/* ═══ TACTICAL ACTION BUTTONS — Right side in landscape ═══ */}
        <div className="flex flex-col items-stretch justify-center gap-2.5 landscape:w-[48%] w-full max-w-[300px] landscape:max-w-none landscape:py-2">

          {/* Action 2 Button (Tactical Ability: Freeze Shot / EMP / Shield / Nitro) */}
          {hasAction2 && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onPointerDown={onA2Down}
              onPointerUp={onA2Up}
              onTouchStart={onA2Down}
              onTouchEnd={onA2Up}
              disabled={a2OnCooldown}
              className={`w-full py-3 rounded-2xl border font-arcade text-xs font-black flex items-center justify-center gap-2 transition-all relative overflow-hidden shadow-lg min-h-[48px] ${
                action2Pressed && !a2OnCooldown
                  ? 'bg-arcade-cyan text-black border-arcade-cyan shadow-glow-cyan scale-95'
                  : a2OnCooldown
                  ? 'bg-black/40 border-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-arcade-cyan/20 border-arcade-cyan/50 text-arcade-cyan hover:bg-arcade-cyan/30 shadow-glow-cyan'
              }`}
            >
              {/* Cooldown progress bar */}
              {a2OnCooldown && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-arcade-cyan transition-all"
                  style={{ width: `${(1 - a2Cooldown) * 100}%` }}
                />
              )}
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">{action2Label}</span>
              {a2OnCooldown && <span className="text-[9px] opacity-70 ml-1 font-mono shrink-0">(WAIT)</span>}
            </motion.button>
          )}

          {/* Action 1 Button (Primary: Jump / Boost / Tackle / Dash) */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onPointerDown={onA1Down}
            onPointerUp={onA1Up}
            onTouchStart={onA1Down}
            onTouchEnd={onA1Up}
            className={`w-full rounded-2xl border-2 font-arcade font-black flex items-center justify-center gap-2 shadow-2xl transition-all min-h-[52px] ${
              action1Pressed
                ? 'bg-arcade-amber text-black border-arcade-amber shadow-[0_0_35px_rgba(255,178,36,1)] scale-95'
                : 'bg-gradient-to-r from-arcade-amber/25 to-amber-600/30 border-arcade-amber text-arcade-amber hover:bg-arcade-amber/40 shadow-glow-amber'
            }`}
            style={{
              fontSize: hasAction2 ? 13 : 15,
              paddingTop: hasAction2 ? 14 : 22,
              paddingBottom: hasAction2 ? 14 : 22,
            }}
          >
            <Zap className="w-5 h-5 fill-current shrink-0" />
            <span className="truncate">{action1Label}</span>
          </motion.button>

          {/* Spectator / Live Emotes Pill Row */}
          <div className="flex items-center justify-center gap-1.5">
            {['🔥', '⚡', '👑', '🎉'].map((emo) => (
              <button
                key={emo}
                onClick={() => sendEmote(emo)}
                className="flex-1 min-w-0 h-9 rounded-lg bg-white/5 hover:bg-white/15 active:scale-90 text-base flex items-center justify-center border border-white/10 transition-transform"
                title="Send TV reaction"
              >
                {emo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 4. BOTTOM TV ORIENTATION HINT ─── */}
      <div className="text-center font-mono text-[8px] text-arcade-cream-muted uppercase py-0.5 shrink-0">
        LOOK AT THE TV / MAIN DISPLAY FOR AUTHORITATIVE ARENA ACTION
      </div>
    </div>
  );
};

/* ─── MAIN EXPORT ─── */
export const ControllerView: React.FC<ControllerViewProps> = ({
  initialCode = '',
  room,
  playerId,
  inGame,
  gameId = 'serpent-arena',
  hudState,
  onJoin,
  onSendInput,
  onLeave,
}) => {
  // Attempt device orientation lock if available
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'screen' in window && 'orientation' in window.screen) {
        (window.screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {});
      }
    } catch {}
  }, []);

  const player = room && playerId ? room.players[playerId] : null;
  const playerColor = player?.color || '#00F5A0';
  const playerName = player?.name || '';

  // 1. Not connected → show join form
  if (!room || !playerId) {
    return <JoinForm initialCode={initialCode} onJoin={onJoin} />;
  }

  // 2. In lobby → show lobby screen
  if (!inGame) {
    return (
      <LobbyScreen
        room={room}
        playerId={playerId}
        color={playerColor}
        onLeave={onLeave}
        onSendInput={onSendInput}
      />
    );
  }

  // 3. In game → show full arcade controller with portrait rotation helper
  return (
    <>
      {/* Forced Landscape Portrait Guide (Appears on portrait mobile screens) */}
      <div className="md:hidden portrait:flex landscape:hidden fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex-col items-center justify-center p-6 text-center text-white space-y-4">
        <motion.div
          animate={{ rotate: [0, -90, -90, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="text-7xl drop-shadow-[0_0_25px_rgba(255,178,36,0.8)]"
        >
          📱
        </motion.div>
        <div className="space-y-1.5">
          <h3 className="font-arcade text-lg text-arcade-amber">ROTATE PHONE TO LANDSCAPE</h3>
          <p className="font-mono text-xs text-white/70 max-w-xs leading-relaxed">
            Turn your phone sideways for 360° virtual joystick & tactical action buttons!
          </p>
        </div>
      </div>

      <ArcadeController
        gameId={gameId}
        room={room}
        playerId={playerId}
        hudState={hudState}
        playerColor={playerColor}
        playerName={playerName}
        onSendInput={onSendInput}
      />
    </>
  );
};
