import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ControllerInput, Player, MatchResults, GameEventPayload, RoomState } from '../../types';
import { LastPlatformEngine } from './LastPlatformEngine';
import { ArcadeButton } from '../../components/ui/ArcadeButton';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { soundManager } from '../../audio/SoundManager';
import { Volume2, VolumeX, Pause, Play, RotateCcw, Trophy, Layers, Zap } from 'lucide-react';

interface LastPlatformViewProps {
  players: Record<string, Player>;
  localPlayerId?: string;
  isHost?: boolean;
  roundDuration?: number;
  onMatchEnd?: (results: MatchResults) => void;
  onBroadcastState?: (state: any) => void;
  onBroadcastEvent?: (event: GameEventPayload) => void;
  clientInputs?: Record<string, ControllerInput>;
}

export const LastPlatformView: React.FC<LastPlatformViewProps> = ({
  players,
  localPlayerId = 'p_host_local',
  isHost = true,
  roundDuration = 75,
  onMatchEnd,
  onBroadcastState,
  onBroadcastEvent,
  clientInputs = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<LastPlatformEngine | null>(null);
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
    action1: false, // Jump / Air Hop / Air Dash
    action2: false, // Gravity Shockwave Push
    timestamp: Date.now(),
  });

  const keysDownRef = useRef<Set<string>>(new Set());

  // Initialize Last Platform Engine
  useEffect(() => {
    const mockRoomState: RoomState = {
      code: 'LOCAL',
      hostSocketId: 'host',
      selectedGame: 'last-platform',
      state: 'playing',
      players,
      botCount: Object.values(players).filter((p) => p.isBot).length,
      config: {
        roundDuration,
        difficulty: 'normal',
        powerupsEnabled: true,
      },
      createdAt: Date.now(),
    };

    const engine = new LastPlatformEngine(mockRoomState, (event) => {
      if (onBroadcastEvent) {
        onBroadcastEvent(event);
      }
    });

    engineRef.current = engine;

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [players, roundDuration, onBroadcastEvent]);

  // Sync keyboard inputs into direction, jump, and shockwave
  const updateLocalInputFromKeys = useCallback(() => {
    const keys = keysDownRef.current;
    let dx = 0;
    let dy = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    const isJump = keys.has('Space') || keys.has('KeyK') || keys.has('KeyZ');
    const isShockwave = keys.has('KeyJ') || keys.has('KeyX') || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyE');

    const mag = Math.hypot(dx, dy);
    const angle = mag > 0 ? Math.atan2(dy, dx) : localInputRef.current.angle;

    localInputRef.current = {
      x: mag > 0 ? dx / mag : 0,
      y: mag > 0 ? dy / mag : 0,
      angle: (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2),
      magnitude: mag > 0 ? 1.0 : 0,
      action1: isJump,
      action2: isShockwave,
      timestamp: Date.now(),
    };
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

  // Mouse Click Handlers (Left Click = Jump / Air Hop, Right Click = Shockwave)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      localInputRef.current.action1 = true;
    } else if (e.button === 2) {
      localInputRef.current.action2 = true;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      localInputRef.current.action1 = false;
    } else if (e.button === 2) {
      localInputRef.current.action2 = false;
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

        // Merge local keyboard/mouse input with remote controller inputs
        const allInputs: Record<string, ControllerInput> = {
          ...clientInputs,
          [localPlayerId]: localInputRef.current,
        };

        // 1. Authoritative Engine Tick
        engine.tick(dt, allInputs);

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
        engine.render(ctx, displayW, displayH);
        ctx.restore();

        // 3. Periodic Host State Broadcast (15Hz throttle)
        broadcastThrottle += dt;
        if (broadcastThrottle >= 0.066) {
          broadcastThrottle = 0;
          if (onBroadcastState) {
            onBroadcastState(engine.getState());
          }
        }

        // 4. Check Match Over
        if (engine.isGameOver && !matchOverResults) {
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
  }, [isPaused, clientInputs, localPlayerId, onBroadcastState, onMatchEnd, matchOverResults]);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleRestart = () => {
    setMatchOverResults(null);
    const mockRoomState: RoomState = {
      code: 'LOCAL',
      hostSocketId: 'host',
      selectedGame: 'last-platform',
      state: 'playing',
      players,
      botCount: Object.values(players).filter((p) => p.isBot).length,
      config: {
        roundDuration,
        difficulty: 'normal',
        powerupsEnabled: true,
      },
      createdAt: Date.now(),
    };

    engineRef.current = new LastPlatformEngine(mockRoomState, (event) => {
      if (onBroadcastEvent) {
        onBroadcastEvent(event);
      }
    });
  };

  return (
    <div className="relative w-full h-full min-h-[600px] bg-arcade-obsidian overflow-hidden select-none">
      {/* 60FPS High-DPI Canvas */}
      <canvas
        ref={canvasRef}
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
        <div className="px-4 py-2 rounded-full bg-arcade-dark/85 backdrop-blur border border-arcade-crimson/30 text-xs font-mono text-white/90 flex items-center gap-3 shadow-lg shadow-arcade-crimson/10">
          <span className="text-arcade-cyan font-bold">MOVE:</span> WASD / Arrows
          <span className="text-white/30">|</span>
          <span className="text-arcade-mint font-bold">JUMP / AIR-DASH:</span> Spacebar / Left Click
          <span className="text-white/30">|</span>
          <span className="text-arcade-cyan font-bold">⚡ FREEZE SHOT (7s):</span> Shift / E / Right Click
        </div>
      </div>

      {/* Pause Modal Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassPanel className="p-8 max-w-sm w-full text-center border-arcade-crimson/40">
            <h2 className="text-2xl font-black font-arcade text-arcade-crimson mb-2">GAME PAUSED</h2>
            <p className="text-sm font-mono text-white/60 mb-6">Last Platform simulation suspended.</p>
            <div className="flex flex-col gap-3">
              <ArcadeButton variant="crimson" onClick={() => setIsPaused(false)}>
                RESUME MATCH
              </ArcadeButton>
              <ArcadeButton variant="ghost" onClick={handleRestart}>
                RESTART ROUND
              </ArcadeButton>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Match Over Podium Modal Overlay */}
      {matchOverResults && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <GlassPanel className="p-8 max-w-lg w-full text-center border-arcade-crimson/50 animate-in fade-in zoom-in duration-300">
            <div className="inline-flex p-3 rounded-full bg-arcade-crimson/20 text-arcade-crimson mb-4 ring-2 ring-arcade-crimson/40">
              <Trophy className="w-10 h-10" />
            </div>

            <h2 className="text-3xl font-black font-arcade text-white tracking-wider mb-1">
              LAST SURVIVOR
            </h2>
            <p className="text-xl font-bold font-mono text-arcade-crimson mb-6">
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
              <ArcadeButton variant="crimson" onClick={handleRestart} icon={<RotateCcw className="w-4 h-4" />}>
                PLAY AGAIN
              </ArcadeButton>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};
