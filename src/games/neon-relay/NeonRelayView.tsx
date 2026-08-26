import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ControllerInput, Player, MatchResults, GameEventPayload } from '../../types';
import { NeonRelayEngine } from './NeonRelayEngine';
import { ArcadeButton } from '../../components/ui/ArcadeButton';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { soundManager } from '../../audio/SoundManager';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Trophy, Zap, Flag } from 'lucide-react';

interface NeonRelayViewProps {
  players: Record<string, Player>;
  localPlayerId?: string;
  isHost?: boolean;
  roundDuration?: number;
  totalLaps?: number;
  onMatchEnd?: (results: MatchResults) => void;
  onBroadcastState?: (state: any) => void;
  onBroadcastEvent?: (event: GameEventPayload) => void;
  clientInputs?: Record<string, ControllerInput>;
}

export const NeonRelayView: React.FC<NeonRelayViewProps> = ({
  players,
  localPlayerId = 'p_host_local',
  isHost = true,
  roundDuration = 90,
  totalLaps = 3,
  onMatchEnd,
  onBroadcastState,
  onBroadcastEvent,
  clientInputs = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<NeonRelayEngine | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [matchOverResults, setMatchOverResults] = useState<MatchResults | null>(null);

  // Local Keyboard / Mouse Input State
  const localInputRef = useRef<ControllerInput>({
    x: 0,
    y: 0,
    angle: 0,
    magnitude: 0,
    action1: false,
    action2: false,
    timestamp: Date.now(),
  });

  const keysDownRef = useRef<Set<string>>(new Set());

  // Initialize Neon Relay Engine
  useEffect(() => {
    const engine = new NeonRelayEngine({
      roundDuration,
      totalLaps,
    });

    engine.init(players);
    engineRef.current = engine;

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [players, roundDuration, totalLaps]);

  // Sync keyboard inputs into direction angle, 3D jump, and nitro boost
  const updateLocalInputFromKeys = useCallback(() => {
    const keys = keysDownRef.current;
    let dx = 0;
    let dy = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    // Action 1: 3D Jump (Spacebar, KeyJ)
    const isJumping = keys.has('Space') || keys.has('KeyJ');

    // Action 2: Nitro Boost (Shift, KeyE, KeyK)
    const isBoosting = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyE') || keys.has('KeyK');

    if (dx !== 0 || dy !== 0) {
      const angle = Math.atan2(dy, dx);
      localInputRef.current = {
        x: dx,
        y: dy,
        angle: (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2),
        magnitude: 1.0,
        action1: isJumping,
        action2: isBoosting,
        timestamp: Date.now(),
      };
    } else {
      localInputRef.current.action1 = isJumping;
      localInputRef.current.action2 = isBoosting;
      localInputRef.current.magnitude = 0;
    }
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current.add(e.code);
      updateLocalInputFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current.delete(e.code);
      updateLocalInputFromKeys();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [updateLocalInputFromKeys]);

  // Mouse Direction Tracking (Alternative smooth steering)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > 20) {
      const angle = Math.atan2(dy, dx);
      localInputRef.current.angle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      localInputRef.current.magnitude = Math.min(1.0, dist / 180);
      localInputRef.current.x = Math.cos(angle);
      localInputRef.current.y = Math.sin(angle);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click = Nitro Boost (action2)
      localInputRef.current.action2 = true;
    } else if (e.button === 2) {
      // Right click = 3D Jump (action1)
      localInputRef.current.action1 = true;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      localInputRef.current.action2 = false;
    } else if (e.button === 2) {
      localInputRef.current.action1 = false;
    }
  }, []);

  // Main 60FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let broadcastThrottle = 0;

    const loop = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (!isPaused && engineRef.current) {
        const engine = engineRef.current;

        // Merge local input with remote controller inputs
        const allInputs: Record<string, ControllerInput> = {
          ...clientInputs,
          [localPlayerId]: localInputRef.current,
        };

        // 1. Authoritative Physics & Progression Tick
        engine.tick(dt, allInputs);

        // Process audio/haptic events
        const events = engine.getEvents();
        for (const evt of events) {
          if (evt.type === 'hit') soundManager.playZap();
          else if (evt.type === 'score') soundManager.playPickup(750);
          else if (evt.type === 'haptic' && evt.payload?.text?.includes('BOOST')) soundManager.playBoost();
          else if (evt.type === 'announcement' && evt.payload?.title?.includes('Finished')) soundManager.playVictoryFanfare();

          if (onBroadcastEvent) {
            onBroadcastEvent(evt);
          }
        }

        // 2. High-Performance Canvas 2D Render
        const dpr = window.devicePixelRatio || 1;
        const displayW = canvas.clientWidth;
        const displayH = canvas.clientHeight;

        if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
          canvas.width = displayW * dpr;
          canvas.height = displayH * dpr;
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        engine.render(ctx, displayW, displayH, localPlayerId);
        ctx.restore();

        // 3. Periodic Host State Broadcast (15Hz throttle)
        broadcastThrottle += dt;
        if (broadcastThrottle >= 0.066) {
          broadcastThrottle = 0;
          if (onBroadcastState) {
            onBroadcastState(engine.getState());
          }
        }

        // 4. Check Match Over Condition
        if (engine.state === 'finished' && !matchOverResults) {
          const results = engine.getResults();
          setMatchOverResults(results);
          if (onMatchEnd) onMatchEnd(results);
        }
      }

      animationFrameId.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animationFrameId.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPaused, clientInputs, localPlayerId, onBroadcastState, onBroadcastEvent, onMatchEnd, matchOverResults]);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleRestart = () => {
    setMatchOverResults(null);
    if (engineRef.current) {
      engineRef.current.init(players);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[600px] bg-arcade-obsidian overflow-hidden select-none">
      {/* 60FPS High-DPI Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating Controls Bar (Top Left) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={toggleSound}
          className="p-2.5 rounded-lg bg-arcade-dark/80 backdrop-blur border border-white/10 text-white hover:text-arcade-cyan hover:border-arcade-cyan/40 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {isHost && (
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2.5 rounded-lg bg-arcade-dark/80 backdrop-blur border border-white/10 text-white hover:text-arcade-amber hover:border-arcade-amber/40 transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Instructions Pill (Bottom Center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="px-4 py-2 rounded-full bg-arcade-dark/85 backdrop-blur border border-arcade-cyan/30 text-xs font-mono text-white/90 flex items-center gap-3 shadow-lg shadow-arcade-cyan/10">
          <span className="text-arcade-cyan font-bold">STEER:</span> WASD / Mouse
          <span className="text-white/30">|</span>
          <span className="text-arcade-mint font-bold">3D JUMP:</span> Space / Right Click
          <span className="text-white/30">|</span>
          <span className="text-arcade-amber font-bold">NITRO BOOST:</span> Shift / Left Click
          <span className="text-white/30">|</span>
          <span className="text-arcade-cyan font-bold">DRAFT:</span> Tail Opponents
        </div>
      </div>

      {/* Pause Modal Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassPanel className="p-8 max-w-sm w-full text-center border-arcade-cyan/40">
            <h2 className="text-2xl font-black font-arcade text-arcade-cyan mb-2">RACE PAUSED</h2>
            <p className="text-sm font-mono text-white/60 mb-6">Neon Relay simulation suspended.</p>
            <div className="flex flex-col gap-3">
              <ArcadeButton variant="cyan" onClick={() => setIsPaused(false)}>
                RESUME RACE
              </ArcadeButton>
              <ArcadeButton variant="ghost" onClick={handleRestart}>
                RESTART RACE
              </ArcadeButton>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Match Over Podium Modal Overlay */}
      {matchOverResults && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <GlassPanel className="p-8 max-w-lg w-full text-center border-arcade-cyan/50 animate-in fade-in zoom-in duration-300">
            <div className="inline-flex p-3 rounded-full bg-arcade-cyan/20 text-arcade-cyan mb-4 ring-2 ring-arcade-cyan/40">
              <Trophy className="w-10 h-10" />
            </div>

            <h2 className="text-3xl font-black font-arcade text-white tracking-wider mb-1">
              CIRCUIT CHAMPION
            </h2>
            <p className="text-xl font-bold font-mono text-arcade-cyan mb-6">
              {matchOverResults.winnerName}
            </p>

            {matchOverResults.mvpStat && (
              <div className="px-4 py-2 rounded-lg bg-arcade-dark/80 border border-arcade-amber/30 text-arcade-amber font-mono text-xs mb-6">
                {matchOverResults.mvpStat}
              </div>
            )}

            <div className="space-y-2 mb-8 max-h-48 overflow-y-auto pr-1">
              {matchOverResults.rankings.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-arcade-dark/60 border border-white/10 font-mono text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-arcade-cyan">#{r.rank}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-white">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-white/50">{r.statSummary}</span>
                    <span className="font-bold text-arcade-mint">{r.score} pts</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <ArcadeButton variant="cyan" onClick={handleRestart} icon={<RotateCcw className="w-4 h-4" />}>
                RACE AGAIN
              </ArcadeButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};
