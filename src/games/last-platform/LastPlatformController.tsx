import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControllerInput, PlayerClientHUDState } from '../../types';
import { Zap, ArrowUp, Skull, Trophy, ShieldAlert, Sparkles } from 'lucide-react';

interface LastPlatformControllerProps {
  playerId: string;
  playerName: string;
  playerColor: string;
  hudState?: PlayerClientHUDState;
  onSendInput: (input: ControllerInput) => void;
}

export const LastPlatformController: React.FC<LastPlatformControllerProps> = ({
  playerId,
  playerName,
  playerColor,
  hudState,
  onSendInput,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const inputStateRef = useRef<ControllerInput>({
    x: 0,
    y: 0,
    angle: 0,
    magnitude: 0,
    action1: false, // Jump / Air Hop / Air Dash
    action2: false, // Gravity Shockwave
    timestamp: Date.now(),
  });

  const sendInput = useCallback(() => {
    inputStateRef.current.timestamp = Date.now();
    onSendInput({ ...inputStateRef.current });
  }, [onSendInput]);

  // Touch handlers for Virtual Joystick
  const handleTouchStart = (e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    updateJoystick(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setStickPos({ x: 0, y: 0 });
        inputStateRef.current.x = 0;
        inputStateRef.current.y = 0;
        inputStateRef.current.magnitude = 0;
        sendInput();
        break;
      }
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2 - 10;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);

    const normX = clampedDist > 0 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
    const normY = clampedDist > 0 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

    setStickPos({
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
    });

    inputStateRef.current.x = normX;
    inputStateRef.current.y = normY;
    inputStateRef.current.angle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    inputStateRef.current.magnitude = clampedDist / maxRadius;

    sendInput();
  };

  // Button Action Handlers
  const handleJumpStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (navigator.vibrate) navigator.vibrate(30);
    inputStateRef.current.action1 = true;
    sendInput();
  };

  const handleJumpEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    inputStateRef.current.action1 = false;
    sendInput();
  };

  const handleShockwaveStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if ((hudState?.action2Cooldown || 0) <= 0.05) {
      if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
      inputStateRef.current.action2 = true;
      sendInput();
    }
  };

  const handleShockwaveEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    inputStateRef.current.action2 = false;
    sendInput();
  };

  const isEliminated = hudState?.status === 'eliminated';
  const isWinner = hudState?.status === 'winner';
  const shockwaveCooldown = hudState?.action2Cooldown || 0;

  return (
    <div className="flex flex-col h-full w-full bg-arcade-obsidian select-none touch-none p-4 justify-between overflow-hidden">
      {/* Top Mobile Status Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-arcade-dark/80 border border-arcade-crimson/30 backdrop-blur shadow-lg">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shadow-lg"
            style={{ backgroundColor: playerColor, boxShadow: `0 0 10px ${playerColor}` }}
          />
          <div>
            <div className="text-xs font-mono text-white/50">PILOT</div>
            <div className="text-sm font-bold text-white tracking-wide">{playerName}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-mono text-white/50">RANK</div>
            <div className="text-base font-black font-arcade text-arcade-cyan">
              #{hudState?.rank || 1}
              <span className="text-xs text-white/40 font-mono ml-1">/ {hudState?.totalPlayers || 1}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-mono text-white/50">SCORE</div>
            <div className="text-base font-black font-mono text-arcade-mint">
              {hudState?.score || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Central Notification Banner */}
      {isEliminated ? (
        <div className="my-auto py-8 text-center bg-red-950/40 rounded-3xl border border-red-500/40 p-6 animate-pulse">
          <Skull className="w-14 h-14 text-arcade-crimson mx-auto mb-2" />
          <div className="text-2xl font-black font-arcade text-arcade-crimson mb-1">PLUNGED INTO VOID</div>
          <div className="text-sm font-mono text-white/80 font-bold mb-1">
            {hudState?.rank ? `PLACEMENT: RANK #${hudState.rank} / ${hudState.totalPlayers}` : ''}
          </div>
          <div className="text-xs font-mono text-white/50">Spectating remaining gladiators...</div>
        </div>
      ) : isWinner ? (
        <div className="my-auto py-8 text-center bg-emerald-950/40 rounded-3xl border border-arcade-mint/50 p-6 animate-bounce">
          <Trophy className="w-14 h-14 text-arcade-mint mx-auto mb-2" />
          <div className="text-2xl font-black font-arcade text-arcade-mint mb-1">ARENA CHAMPION!</div>
          <div className="text-xs font-mono text-white/80">You conquered the Last Platform!</div>
        </div>
      ) : (
        <div className="my-auto text-center">
          <div className="text-xs font-mono text-arcade-crimson tracking-widest uppercase mb-1">
            {hudState?.message || 'SURVIVE ON PLATFORMS'}
          </div>
          <div className="text-xs text-white/40 font-mono">
            SHOVES LANDED: <span className="text-arcade-amber font-bold">{hudState?.customStatValue || 0}</span>
          </div>
        </div>
      )}

      {/* Bottom Controls: Touch Joystick (Left) + Big Action Buttons (Right) */}
      <div className={`grid grid-cols-2 gap-4 items-center ${isEliminated ? 'opacity-30 pointer-events-none' : ''}`}>
        {/* Virtual Joystick */}
        <div className="flex items-center justify-center">
          <div
            ref={joystickRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-36 h-36 rounded-full bg-arcade-dark/80 border-2 border-white/20 backdrop-blur shadow-2xl flex items-center justify-center active:border-arcade-cyan/60"
          >
            {/* Center crosshair */}
            <div className="absolute w-2 h-2 rounded-full bg-white/20" />

            {/* Moving Stick Thumb */}
            <div
              className="w-14 h-14 rounded-full bg-gradient-to-tr from-arcade-cyan to-arcade-mint shadow-lg shadow-arcade-cyan/30 flex items-center justify-center transform transition-transform duration-75"
              style={{
                transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
              }}
            >
              <div className="w-4 h-4 rounded-full bg-white/80" />
            </div>
          </div>
        </div>

        {/* Action Buttons Column */}
        <div className="flex flex-col gap-3 items-center justify-center">
          {/* Freeze Shot Button (action2 - 7s Cooldown) */}
          <button
            onTouchStart={handleShockwaveStart}
            onTouchEnd={handleShockwaveEnd}
            onMouseDown={handleShockwaveStart}
            onMouseUp={handleShockwaveEnd}
            disabled={shockwaveCooldown > 0.05}
            className={`relative w-full py-4 rounded-2xl font-black font-arcade text-sm flex items-center justify-center gap-2 border shadow-lg transition-all active:scale-95 ${
              shockwaveCooldown > 0.05
                ? 'bg-zinc-900 border-white/10 text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-arcade-cyan to-arcade-crimson border-arcade-cyan text-white shadow-arcade-cyan/30 animate-pulse'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>FREEZE SHOT</span>
            {shockwaveCooldown > 0.05 && (
              <span className="text-xs font-mono text-arcade-cyan ml-1">
                {Math.ceil(shockwaveCooldown * 7.0)}s
              </span>
            )}
          </button>

          {/* Jump / Air Hop / Air Dash Button (action1) */}
          <button
            onTouchStart={handleJumpStart}
            onTouchEnd={handleJumpEnd}
            onMouseDown={handleJumpStart}
            onMouseUp={handleJumpEnd}
            className="relative w-full py-6 rounded-2xl bg-gradient-to-r from-arcade-mint to-arcade-cyan border-2 border-arcade-mint text-arcade-bg font-black font-arcade text-base flex items-center justify-center gap-2 shadow-xl shadow-arcade-mint/30 active:scale-95 active:bg-white"
          >
            <ArrowUp className="w-6 h-6 stroke-[3]" />
            <span>JUMP / DASH</span>
          </button>
        </div>
      </div>
    </div>
  );
};
