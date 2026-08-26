import React, { useState, useRef, useCallback } from 'react';
import { ControllerInput, PlayerClientHUDState } from '../../types';
import { Zap, Flame, Trophy, Navigation, Gauge, AlertTriangle, Rocket } from 'lucide-react';

interface NeonRelayControllerProps {
  playerId: string;
  playerName: string;
  playerColor?: string;
  hudState?: PlayerClientHUDState;
  onSendInput: (input: ControllerInput) => void;
}

export const NeonRelayController: React.FC<NeonRelayControllerProps> = ({
  playerName,
  playerColor = '#00E5FF',
  hudState,
  onSendInput,
}) => {
  const [isBoosting, setIsBoosting] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const stickRef = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const inputStateRef = useRef<ControllerInput>({
    x: 0,
    y: 0,
    angle: 0,
    magnitude: 0,
    action1: false, // 3D Jump
    action2: false, // Nitro Boost
    timestamp: Date.now(),
  });

  // Haptic feedback trigger helper
  const triggerHaptic = (ms: number = 30) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  // Dispatch input updates to host (throttled at ~30-60Hz)
  const emitCurrentInput = useCallback(() => {
    onSendInput({
      ...inputStateRef.current,
      timestamp: Date.now(),
    });
  }, [onSendInput]);

  // Touch joystick handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsDragging(true);

    if (stickRef.current) {
      const rect = stickRef.current.getBoundingClientRect();
      centerRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateJoystickVector(touch.clientX, touch.clientY);
    }
    triggerHaptic(15);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystickVector(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsDragging(false);
        setJoystickPos({ x: 0, y: 0 });
        inputStateRef.current.magnitude = 0;
        emitCurrentInput();
        break;
      }
    }
  };

  const updateJoystickVector = (clientX: number, clientY: number) => {
    const maxRadius = 65;
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const distance = Math.hypot(dx, dy);

    const clampedDist = Math.min(maxRadius, distance);
    const angle = Math.atan2(dy, dx);

    const normX = Math.cos(angle) * (clampedDist / maxRadius);
    const normY = Math.sin(angle) * (clampedDist / maxRadius);

    setJoystickPos({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });

    const normalizedAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    inputStateRef.current.x = normX;
    inputStateRef.current.y = normY;
    inputStateRef.current.angle = normalizedAngle;
    inputStateRef.current.magnitude = clampedDist / maxRadius;

    emitCurrentInput();
  };

  // Action 1: 3D Jump Button handlers
  const handleJump = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsJumping(true);
    inputStateRef.current.action1 = true;
    emitCurrentInput();
    triggerHaptic(40);

    setTimeout(() => {
      setIsJumping(false);
      inputStateRef.current.action1 = false;
      emitCurrentInput();
    }, 150);
  };

  // Action 2: Nitro Boost Button handlers
  const handleNitroStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsBoosting(true);
    inputStateRef.current.action2 = true;
    emitCurrentInput();
    triggerHaptic(50);
  };

  const handleNitroEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsBoosting(false);
    inputStateRef.current.action2 = false;
    emitCurrentInput();
  };

  const jumpCooldownPct = Math.round((hudState?.action1Cooldown || 0) * 100);
  const nitroFillPct = Math.round((1.0 - (hudState?.action2Cooldown || 0)) * 100);

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-[#07090E] text-white flex flex-col justify-between p-4 select-none touch-none overflow-hidden font-mono">
      {/* Top Header HUD Bar */}
      <div className="flex items-center justify-between bg-arcade-dark/85 backdrop-blur border border-arcade-cyan/20 rounded-xl px-4 py-3 shadow-lg shadow-arcade-cyan/5">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20" style={{ backgroundColor: playerColor }} />
          <div>
            <div className="text-[10px] text-white/50 uppercase tracking-widest leading-tight">PILOT</div>
            <div className="text-sm font-bold text-white tracking-wide truncate max-w-[120px]">
              {playerName}
            </div>
          </div>
        </div>

        {/* Live Position Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-arcade-obsidian border border-arcade-cyan/40">
          <Trophy className="w-4 h-4 text-arcade-amber" />
          <span className="text-sm font-black text-arcade-cyan">
            #{hudState?.rank || 1}
          </span>
          <span className="text-[10px] text-white/40">/ {hudState?.totalPlayers || 4}</span>
        </div>

        {/* Live Lap & Speed Stat */}
        <div className="text-right">
          <div className="text-xs text-arcade-cyan font-black">
            {hudState?.customStatValue || 'LAP 1/3 • 0 KPH'}
          </div>
          <div className="text-[10px] text-arcade-mint font-bold">
            {hudState?.score || 0} PTS
          </div>
        </div>
      </div>

      {/* Center Contextual Notification / Status Banner */}
      {hudState?.message && (
        <div className={`mx-auto px-5 py-2 rounded-full border text-xs font-mono font-bold tracking-wide flex items-center gap-2 shadow-lg transition-all ${
          hudState.status === 'winner' || hudState.status === 'finished' || hudState.message.includes('FINISHED') || hudState.message.includes('WINNER')
            ? 'bg-arcade-mint/20 border-arcade-mint text-arcade-mint ring-1 ring-arcade-mint/40 shadow-arcade-mint/20 animate-pulse'
            : hudState.message.includes('STUNNED')
            ? 'bg-arcade-crimson/20 border-arcade-crimson text-arcade-crimson animate-bounce'
            : hudState.message.includes('DRAFTING')
            ? 'bg-arcade-cyan/20 border-arcade-cyan text-arcade-cyan animate-pulse'
            : 'bg-arcade-dark/80 border-white/10 text-white/80'
        }`}>
          {hudState.status === 'winner' || hudState.status === 'finished' || hudState.message.includes('FINISHED') || hudState.message.includes('WINNER') ? (
            <Trophy className="w-4 h-4 text-arcade-amber" />
          ) : hudState.message.includes('STUNNED') ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Zap className="w-4 h-4 text-arcade-amber" />
          )}
          <span>{hudState.message}</span>
        </div>
      )}

      {/* Main Touch Controls Layout */}
      <div className="grid grid-cols-2 gap-4 items-center my-auto w-full max-w-md mx-auto">
        {/* Left: 360° Touch Steering Joystick */}
        <div className="flex flex-col items-center justify-center">
          <div
            ref={stickRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className="relative w-40 h-40 rounded-full bg-arcade-dark/80 border-2 border-arcade-cyan/30 shadow-inner flex items-center justify-center touch-none"
          >
            {/* Compass Rings & Angle Guides */}
            <div className="w-28 h-28 rounded-full border border-arcade-cyan/10 pointer-events-none" />
            <div className="w-14 h-14 rounded-full border border-arcade-cyan/15 pointer-events-none" />

            {/* Thumb Stick Head */}
            <div
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                isDragging
                  ? 'bg-arcade-cyan text-black shadow-arcade-cyan/50'
                  : 'bg-white/15 text-white'
              }`}
            >
              <Navigation className="w-6 h-6 rotate-45" />
            </div>
          </div>
          <span className="text-[11px] text-white/50 mt-2 font-bold flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-arcade-cyan" /> 360° STEERING
          </span>
        </div>

        {/* Right: Dual Action Buttons (3D Jump & Nitro Boost) */}
        <div className="flex flex-col gap-3 items-center justify-center">
          {/* Action 1: 3D JUMP Button (Leap over lasers) */}
          <button
            onTouchStart={handleJump}
            onMouseDown={handleJump}
            disabled={jumpCooldownPct > 10}
            className={`relative w-36 h-16 rounded-xl flex items-center justify-center gap-2 transition-all border-2 active:scale-95 shadow-lg overflow-hidden ${
              isJumping
                ? 'bg-gradient-to-r from-arcade-mint to-arcade-cyan border-white text-black font-black scale-105 shadow-arcade-mint/60'
                : jumpCooldownPct > 10
                ? 'bg-arcade-dark/60 border-white/10 text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-arcade-mint/30 to-arcade-dark border-arcade-mint/60 text-white shadow-arcade-mint/20 hover:border-arcade-mint'
            }`}
          >
            {/* Cooldown overlay */}
            {jumpCooldownPct > 10 && (
              <div
                className="absolute inset-0 bg-arcade-obsidian/70 pointer-events-none"
                style={{ width: `${jumpCooldownPct}%` }}
              />
            )}
            <Rocket className={`w-5 h-5 relative z-10 ${isJumping ? 'text-black animate-bounce' : 'text-arcade-mint'}`} />
            <div className="flex flex-col text-left relative z-10">
              <span className="text-xs font-black font-arcade tracking-wider leading-tight">3D JUMP</span>
              <span className="text-[8px] text-arcade-mint/80 font-mono">LEAP LASERS</span>
            </div>
          </button>

          {/* Action 2: NITRO BOOST Button with Live Fill */}
          <button
            onTouchStart={handleNitroStart}
            onTouchEnd={handleNitroEnd}
            onTouchCancel={handleNitroEnd}
            onMouseDown={handleNitroStart}
            onMouseUp={handleNitroEnd}
            className={`relative w-36 h-20 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border-2 active:scale-95 shadow-xl overflow-hidden ${
              isBoosting
                ? 'bg-gradient-to-br from-arcade-cyan to-arcade-amber border-white shadow-arcade-cyan/60 scale-105'
                : 'bg-gradient-to-br from-arcade-cyan/30 to-arcade-dark border-arcade-cyan/50 shadow-arcade-cyan/20'
            }`}
          >
            {/* Live Fill Progress Backdrop */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-arcade-cyan/30 transition-all pointer-events-none"
              style={{ height: `${nitroFillPct}%` }}
            />

            <Flame
              className={`w-6 h-6 transition-transform relative z-10 ${
                isBoosting ? 'scale-125 text-white animate-bounce' : 'text-arcade-cyan'
              }`}
            />
            <span className="text-xs font-black font-arcade tracking-wider text-white relative z-10">
              NITRO BOOST
            </span>
            <span className="text-[9px] text-arcade-amber font-mono font-bold relative z-10">
              {nitroFillPct}% ENERGY
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Status Footer */}
      <div className="flex items-center justify-between text-xs text-white/40 px-2">
        <span className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-arcade-cyan" /> NEON RELAY v1.0
        </span>
        <span className="text-arcade-mint font-mono">60FPS LOW-LATENCY</span>
      </div>
    </div>
  );
};
