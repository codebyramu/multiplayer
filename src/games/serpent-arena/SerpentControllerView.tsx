import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ControllerInput, PlayerClientHUDState } from '../../types';
import { Zap, Flame, ShieldAlert, Trophy, Award } from 'lucide-react';

interface SerpentControllerViewProps {
  playerId: string;
  playerName: string;
  playerColor?: string;
  hudState?: PlayerClientHUDState;
  onSendInput: (input: ControllerInput) => void;
}

export const SerpentControllerView: React.FC<SerpentControllerViewProps> = ({
  playerId,
  playerName,
  playerColor = '#00F5A0',
  hudState,
  onSendInput,
}) => {
  const [isBoosting, setIsBoosting] = useState(false);
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
    action1: false,
    action2: false,
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

  // Hyper Boost Button handlers
  const handleBoostStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsBoosting(true);
    inputStateRef.current.action1 = true;
    emitCurrentInput();
    triggerHaptic(50);
  };

  const handleBoostEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsBoosting(false);
    inputStateRef.current.action1 = false;
    emitCurrentInput();
  };

  const isEliminated = hudState?.status === 'eliminated';
  const isWinner = hudState?.status === 'winner';

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-[#07090E] text-white flex flex-col justify-between p-4 select-none touch-none overflow-hidden font-mono">
      {/* Top Header HUD Bar */}
      <div className="flex items-center justify-between bg-arcade-dark/80 backdrop-blur border border-white/10 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: playerColor }} />
          <div>
            <div className="text-xs text-white/50 leading-tight">PILOT</div>
            <div className="text-sm font-bold text-white tracking-wide truncate max-w-[120px]">
              {playerName}
            </div>
          </div>
        </div>

        {/* Live Rank Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-arcade-obsidian border border-arcade-cyan/30">
          <Trophy className="w-4 h-4 text-arcade-amber" />
          <span className="text-sm font-black text-arcade-cyan">
            #{hudState?.rank || 1}
          </span>
          <span className="text-[10px] text-white/40">/ {hudState?.totalPlayers || 4}</span>
        </div>

        {/* Live Score & Length */}
        <div className="text-right">
          <div className="text-xs text-arcade-mint font-black">
            {hudState?.score || 0} PTS
          </div>
          <div className="text-[10px] text-white/50">
            LEN: {hudState?.customStatValue || 25}
          </div>
        </div>
      </div>

      {/* Winner Champion Banner */}
      {isWinner && (
        <div className="my-auto text-center p-6 rounded-2xl bg-arcade-amber/20 border-2 border-arcade-amber/60 animate-bounce shadow-2xl shadow-arcade-amber/30">
          <Trophy className="w-14 h-14 text-arcade-amber mx-auto mb-2" />
          <h3 className="text-2xl font-black text-white font-arcade tracking-wider">ARENA CHAMPION</h3>
          <p className="text-sm font-bold text-arcade-mint mt-1">
            {hudState?.message || 'VICTORY ACHIEVED!'}
          </p>
          <div className="text-xs text-white/60 mt-2">
            FINAL SCORE: {hudState?.score || 0} PTS
          </div>
        </div>
      )}

      {/* Elimination Banner (if dead) */}
      {isEliminated && !isWinner && (
        <div className="my-auto text-center p-6 rounded-2xl bg-arcade-crimson/20 border border-arcade-crimson/50 animate-pulse">
          <ShieldAlert className="w-12 h-12 text-arcade-crimson mx-auto mb-2" />
          <h3 className="text-lg font-black text-white font-arcade">SERPENT DESTROYED</h3>
          <p className="text-xs text-white/70 mt-1">
            {hudState?.message || 'Eliminated from arena'}
          </p>
        </div>
      )}

      {/* Contextual Warning / Overheat Alert Banner */}
      {hudState?.message && !isWinner && !isEliminated && (
        <div className={`mx-auto px-4 py-1.5 rounded-full border text-xs font-mono font-bold tracking-wide flex items-center gap-2 shadow-lg transition-all ${
          hudState.message.includes('OVERHEAT') || hudState.message.includes('BURNING')
            ? 'bg-arcade-crimson/25 border-arcade-crimson text-arcade-crimson animate-pulse ring-1 ring-arcade-crimson/50'
            : 'bg-arcade-dark/80 border-white/10 text-white/80'
        }`}>
          <Flame className="w-4 h-4 text-arcade-crimson animate-bounce" />
          <span>{hudState.message}</span>
        </div>
      )}

      {/* Main Touch Controls Zone */}
      {!isEliminated && !isWinner && (
        <div className="grid grid-cols-2 gap-4 items-center my-auto w-full max-w-md mx-auto">
          {/* Left: 360° Touch Steering Joystick */}
          <div className="flex flex-col items-center justify-center">
            <div
              ref={stickRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className="relative w-40 h-40 rounded-full bg-arcade-dark/70 border-2 border-arcade-cyan/30 shadow-inner flex items-center justify-center touch-none"
            >
              {/* Concentric Guide Rings */}
              <div className="w-24 h-24 rounded-full border border-white/5 pointer-events-none" />
              <div className="w-12 h-12 rounded-full border border-white/10 pointer-events-none" />

              {/* Thumb Stick Head */}
              <div
                style={{
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                  isDragging
                    ? 'bg-arcade-cyan text-black shadow-arcade-cyan/50'
                    : 'bg-white/20 text-white'
                }`}
              >
                <Zap className="w-6 h-6" />
              </div>
            </div>
            <span className="text-[11px] text-white/40 mt-2 font-bold">360° STEERING</span>
          </div>

          {/* Right: Giant HYPER BOOST Button with Overheat Heat Gauge */}
          <div className="flex flex-col items-center justify-center">
            {(() => {
              const boostHeatRatio = hudState?.action1Cooldown || 0;
              const isOverheatWarning = boostHeatRatio >= 0.85; // >= 3.0s
              const isCriticalOverheat = boostHeatRatio >= 1.0; // >= 3.5s
              const heatPercent = Math.round(boostHeatRatio * 100);

              return (
                <>
                  <button
                    onTouchStart={handleBoostStart}
                    onTouchEnd={handleBoostEnd}
                    onTouchCancel={handleBoostEnd}
                    onMouseDown={handleBoostStart}
                    onMouseUp={handleBoostEnd}
                    className={`relative w-36 h-36 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border-2 active:scale-95 shadow-xl overflow-hidden ${
                      isCriticalOverheat
                        ? 'bg-gradient-to-br from-red-600 to-amber-600 border-red-500 shadow-red-500/80 animate-pulse scale-105'
                        : isOverheatWarning
                        ? 'bg-gradient-to-br from-arcade-crimson to-arcade-amber border-arcade-crimson shadow-arcade-crimson/70 animate-bounce'
                        : isBoosting
                        ? 'bg-gradient-to-br from-arcade-crimson to-arcade-amber border-white shadow-arcade-crimson/60 scale-105'
                        : 'bg-gradient-to-br from-arcade-crimson/80 to-arcade-dark border-arcade-crimson/50 shadow-arcade-crimson/20'
                    }`}
                  >
                    {/* Live Heat Gauge Bar */}
                    <div
                      className={`absolute bottom-0 left-0 right-0 transition-all pointer-events-none ${
                        isCriticalOverheat ? 'bg-red-500/40' : isOverheatWarning ? 'bg-amber-500/40' : 'bg-white/20'
                      }`}
                      style={{ height: `${heatPercent}%` }}
                    />

                    <Flame
                      className={`w-10 h-10 transition-transform relative z-10 ${
                        isCriticalOverheat
                          ? 'scale-125 text-white animate-spin'
                          : isBoosting || isOverheatWarning
                          ? 'scale-125 text-white animate-bounce'
                          : 'text-arcade-amber'
                      }`}
                    />
                    <span className="text-sm font-black font-arcade tracking-wider text-white relative z-10">
                      {isCriticalOverheat ? 'BURNING MASS' : isOverheatWarning ? 'OVERHEAT!' : 'HYPER BOOST'}
                    </span>
                    <span className="text-[9px] text-white/80 font-mono font-bold relative z-10">
                      {isCriticalOverheat ? 'SHEDDING SCORE' : isOverheatWarning ? 'RELEASE BOOST!' : '1.8x SPEED'}
                    </span>
                  </button>
                  <span className={`text-[11px] mt-2 font-bold font-mono ${
                    isCriticalOverheat ? 'text-red-400 animate-pulse' : isOverheatWarning ? 'text-amber-400' : 'text-white/40'
                  }`}>
                    {isCriticalOverheat ? '🔥 BURNING MASS' : isOverheatWarning ? '⚠️ OVERHEATING' : 'HOLD TO ACCELERATE'}
                  </span>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between text-xs text-white/40 px-2">
        <span className="flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-arcade-mint" /> SERPENT ARENA v1.0
        </span>
        <span className="text-arcade-cyan font-mono">LATENCY: 12ms</span>
      </div>
    </div>
  );
};
