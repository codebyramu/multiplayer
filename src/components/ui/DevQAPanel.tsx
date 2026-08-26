import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RoomState, 
  GameId, 
  Player, 
  GameModifiers, 
  MatchState 
} from '../../types';
import { GAMES_DATA } from '../../data/games';
import { soundManager } from '../../audio/SoundManager';
import { GlassPanel } from './GlassPanel';
import { ArcadeButton } from './ArcadeButton';
import { inputSanitizer, PlayerInputTelemetry } from '../../multiplayer/InputSanitizer';
import { 
  Wrench, 
  Bot, 
  Skull, 
  Trophy, 
  Sparkles, 
  Zap, 
  Activity, 
  Wifi, 
  WifiOff, 
  FastForward, 
  Play, 
  Square, 
  Flame, 
  Shield, 
  Compass, 
  Swords, 
  X, 
  ChevronRight, 
  Sliders, 
  RefreshCw,
  Gauge
} from 'lucide-react';

export interface DevQAPanelProps {
  room: RoomState;
  matchState: MatchState;
  activeModifiers: GameModifiers;
  onSpawnBot: (archetype: 'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic', name?: string) => void;
  onForceEliminate: (playerId: string) => void;
  onForceWin: (playerId: string) => void;
  onTriggerEvent: (eventType?: string) => void;
  onSimulateDisconnect: (playerId: string) => void;
  onSimulateReconnect: (playerId: string) => void;
  onSkipCountdown: () => void;
  onInstantMatchEnd: () => void;
  onForceFinalDuel?: () => void;
  onToggleModifier: (key: keyof GameModifiers, enabled: boolean) => void;
  onReturnToLobby?: () => void;
  onSelectGame?: (gameId: GameId) => void;
  isOpen?: boolean;
  onToggleOpen?: (open: boolean) => void;
}

export const DevQAPanel: React.FC<DevQAPanelProps> = ({
  room,
  matchState,
  activeModifiers,
  onSpawnBot,
  onForceEliminate,
  onForceWin,
  onTriggerEvent,
  onSimulateDisconnect,
  onSimulateReconnect,
  onSkipCountdown,
  onInstantMatchEnd,
  onForceFinalDuel,
  onToggleModifier,
  onReturnToLobby,
  onSelectGame,
  isOpen: externalIsOpen,
  onToggleOpen: externalSetIsOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalSetIsOpen || setInternalIsOpen;

  const [activeTab, setActiveTab] = useState<'bots' | 'events' | 'modifiers' | 'flow' | 'telemetry'>('bots');
  const [telemetry, setTelemetry] = useState<Record<string, PlayerInputTelemetry>>({});
  const [fps, setFps] = useState<number>(60);

  // FPS Counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, []);

  // Update telemetry periodically while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const stats = inputSanitizer.getTelemetry() as Record<string, PlayerInputTelemetry>;
      setTelemetry(stats);
    }, 400);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Global Hotkey Listener: `~` (Backquote) or `F1` or `\`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Backquote' || e.key === '`' || e.key === '~' || e.code === 'F1') {
        e.preventDefault();
        soundManager.playClick(1100);
        setIsOpen(!isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  const playersList = Object.values(room.players || {});
  const currentGameMeta = GAMES_DATA[room.selectedGame] || GAMES_DATA['serpent-arena'];

  // Game-specific event definitions
  const GAME_EVENTS: Record<GameId, Array<{ id: string; name: string; icon: string; desc: string }>> = {
    'serpent-arena': [
      { id: 'golden_storm', name: '⚡ Golden Storm', icon: '⚡', desc: 'Spawns high-yield golden energy vortex' },
      { id: 'jackpot_rain', name: '💎 Jackpot Rain', icon: '💎', desc: 'Scatters 30 massive jackpot pellets' },
    ],
    'neon-relay': [
      { id: 'laser_overdrive', name: '🚨 Laser Overdrive', icon: '🚨', desc: 'Overdrives track defense grid speed x3' },
      { id: 'super_charge', name: '🚀 Super Charge', icon: '🚀', desc: 'Instant full nitro & boost pads surge' },
    ],
    'void-tag': [
      { id: 'solar_flare', name: '☀️ Solar Flare', icon: '☀️', desc: 'Drains all sanctuaries & reveals all stealth' },
      { id: 'emp_storm', name: '⚡ EMP Storm', icon: '⚡', desc: 'Stuns all active Void Hunters' },
    ],
    'relic-rush': [
      { id: 'gold_meteor', name: '☄️ Gold Meteor', icon: '☄️', desc: 'Meteoric shower of diamond & mythic relics' },
      { id: 'cosmic_core', name: '🌟 Cosmic Core', icon: '🌟', desc: 'Materializes 100-pt legendary cosmic core' },
      { id: 'magnetic_surge', name: '🧲 Magnetic Surge', icon: '🧲', desc: 'Global magnetic pull active on all pilots' },
    ],
    'last-platform': [
      { id: 'quake', name: '💥 Platform Quake', icon: '💥', desc: 'Crumbles 8 tiles & launches seismic shockwave' },
      { id: 'sudden_death', name: '🌋 Sudden Death', icon: '🌋', desc: 'Collapses perimeter tiles & triggers final storm' },
      { id: 'anti_gravity', name: '🦘 Low-G Bounce', icon: '🦘', desc: 'Pops all contenders into anti-gravity jump' },
    ],
  };

  const currentEvents = GAME_EVENTS[room.selectedGame] || [];

  return (
    <>
      {/* 1. FLOATING TOGGLE BUTTON (Host Screen Corner) */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 select-none">
        {/* Modifier Badges */}
        <div className="hidden sm:flex items-center gap-1">
          {activeModifiers.turboSpeed && (
            <span className="px-2 py-1 rounded-lg bg-arcade-amber/20 border border-arcade-amber/40 text-[10px] font-mono text-arcade-amber animate-pulse">
              ⚡ TURBO
            </span>
          )}
          {activeModifiers.doubleGrowthOrScore && (
            <span className="px-2 py-1 rounded-lg bg-arcade-mint/20 border border-arcade-mint/40 text-[10px] font-mono text-arcade-mint">
              ⭐ 2X SCORE
            </span>
          )}
          {activeModifiers.lowGravity && (
            <span className="px-2 py-1 rounded-lg bg-arcade-cyan/20 border border-arcade-cyan/40 text-[10px] font-mono text-arcade-cyan">
              🪶 LOW-G
            </span>
          )}
          {activeModifiers.chaosMode && (
            <span className="px-2 py-1 rounded-lg bg-arcade-crimson/20 border border-arcade-crimson/40 text-[10px] font-mono text-arcade-crimson animate-bounce">
              🔥 CHAOS
            </span>
          )}
        </div>

        <button
          onClick={() => {
            soundManager.playClick(1000);
            setIsOpen(!isOpen);
          }}
          className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 text-xs font-mono font-bold shadow-2xl transition-all ${
            isOpen
              ? 'bg-arcade-amber text-black border-arcade-amber shadow-glow-amber scale-105'
              : 'bg-arcade-surface/90 hover:bg-white/10 text-arcade-cream border-white/20 backdrop-blur-md'
          }`}
          title="Toggle Dev/QA Panel (Hotkeys: ~ or F1)"
        >
          <Wrench className={`w-3.5 h-3.5 ${isOpen ? 'animate-spin' : ''}`} />
          <span>DEV/QA</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-arcade-amber font-mono hidden md:inline">
            [~ / F1]
          </span>
        </button>
      </div>

      {/* 2. DEV / QA DRAWER MODAL */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md select-none">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-arcade-surface border border-arcade-amber/40 shadow-[0_0_50px_rgba(255,178,36,0.25)] overflow-hidden"
            >
              {/* HEADER BAR */}
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-arcade-amber/15 border border-arcade-amber/30 text-arcade-amber">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-arcade text-sm sm:text-base text-arcade-cream tracking-wide">
                        HYPERCADE DEV/QA WORKBENCH
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-arcade-amber/20 text-arcade-amber uppercase font-bold">
                        HOST AUTHORITATIVE
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-arcade-cream-muted">
                      Active Arena: <strong className="text-arcade-cream">{currentGameMeta.title}</strong> &bull; Room:{' '}
                      <strong className="text-arcade-amber">{room.code}</strong>
                    </p>
                  </div>
                </div>

                {/* State Machine Status & Close Button */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end text-[10px] font-mono">
                    <span className="text-arcade-cream-muted">STATE MACHINE:</span>
                    <span className="px-2 py-0.5 rounded bg-arcade-mint/20 text-arcade-mint font-bold uppercase">
                      {matchState}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playClick(800);
                      setIsOpen(false);
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* NAVIGATION TABS */}
              <div className="flex items-center gap-1 px-4 py-2 bg-black/20 border-b border-white/10 overflow-x-auto">
                <button
                  onClick={() => {
                    soundManager.playClick(900);
                    setActiveTab('bots');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'bots'
                      ? 'bg-arcade-amber text-black shadow-glow-amber'
                      : 'text-arcade-cream-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>BOTS & CONTENDERS ({playersList.length})</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playClick(900);
                    setActiveTab('events');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'events'
                      ? 'bg-arcade-amber text-black shadow-glow-amber'
                      : 'text-arcade-cream-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>ARENA EVENTS ({currentEvents.length})</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playClick(900);
                    setActiveTab('modifiers');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'modifiers'
                      ? 'bg-arcade-amber text-black shadow-glow-amber'
                      : 'text-arcade-cream-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>MODIFIERS</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playClick(900);
                    setActiveTab('flow');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'flow'
                      ? 'bg-arcade-amber text-black shadow-glow-amber'
                      : 'text-arcade-cream-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>MATCH FLOW & STATES</span>
                </button>

                <button
                  onClick={() => {
                    soundManager.playClick(900);
                    setActiveTab('telemetry');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                    activeTab === 'telemetry'
                      ? 'bg-arcade-amber text-black shadow-glow-amber'
                      : 'text-arcade-cream-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>TELEMETRY & 200HZ</span>
                </button>
              </div>

              {/* TAB CONTENTS BODY */}
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                {/* ----------------- TAB 1: BOTS & CONTENDERS ----------------- */}
                {activeTab === 'bots' && (
                  <div className="space-y-5">
                    {/* Instant Bot Spawn Section */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                          <Bot className="w-4 h-4 text-arcade-cyan" /> SPAWN BOT BY ARCHETYPE
                        </span>
                        <span className="text-[10px] font-mono text-arcade-cream-muted">
                          Instant insertion into live physics loop
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {(
                          [
                            { key: 'aggressive', label: 'Aggressive', icon: '⚔️', color: '#FF3366', desc: 'Direct rush & combat' },
                            { key: 'defensive', label: 'Defensive', icon: '🛡️', color: '#00E5FF', desc: 'Safety & evasion' },
                            { key: 'collector', label: 'Collector', icon: '💎', color: '#FFB224', desc: 'High-yield hoarding' },
                            { key: 'ambusher', label: 'Ambusher', icon: '🎯', color: '#9D4EDD', desc: 'Patience & cut-offs' },
                            { key: 'chaotic', label: 'Chaotic', icon: '🎲', color: '#00F5A0', desc: 'Unpredictable paths' },
                          ] as const
                        ).map((arch) => (
                          <button
                            key={arch.key}
                            onClick={() => {
                              soundManager.playClick(1000);
                              onSpawnBot(arch.key);
                            }}
                            className="p-2.5 rounded-xl border border-white/10 bg-black/40 hover:border-arcade-amber/60 hover:bg-white/10 transition-all text-left flex flex-col justify-between group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{arch.icon}</span>
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: arch.color }}
                              />
                            </div>
                            <div className="mt-2">
                              <span className="text-xs font-mono font-bold text-arcade-cream group-hover:text-arcade-amber block">
                                + {arch.label}
                              </span>
                              <span className="text-[9px] font-mono text-arcade-cream-muted block">
                                {arch.desc}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Contenders Management Table */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                          <Swords className="w-4 h-4 text-arcade-amber" /> ACTIVE CONTENDERS ({playersList.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              playersList
                                .filter((p) => p.isBot)
                                .forEach((p) => onForceEliminate(p.id));
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-arcade-crimson/20 border border-arcade-crimson/40 text-arcade-crimson hover:bg-arcade-crimson/40 transition-colors"
                          >
                            ☠️ ELIMINATE ALL BOTS
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {playersList.length === 0 ? (
                          <p className="text-xs font-mono text-arcade-cream-muted text-center py-4">
                            No contenders connected. Spawn a bot above!
                          </p>
                        ) : (
                          playersList.map((p) => {
                            const isConnected = p.connected !== false;
                            return (
                              <div
                                key={p.id}
                                className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-[180px]">
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: p.color || '#00F5A0' }}
                                  />
                                  <div className="truncate">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-mono font-bold text-arcade-cream truncate">
                                        {p.name}
                                      </span>
                                      {p.isHost && (
                                        <span className="text-[9px] font-mono px-1 rounded bg-arcade-amber/20 text-arcade-amber">
                                          HOST
                                        </span>
                                      )}
                                      {p.isBot && (
                                        <span className="text-[9px] font-mono px-1 rounded bg-arcade-cyan/20 text-arcade-cyan">
                                          {p.botArchetype || 'BOT'}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-mono text-arcade-cream-muted">
                                      ID: {p.id} &bull; Score: {p.score || 0}
                                    </span>
                                  </div>
                                </div>

                                {/* Actions for this Contender */}
                                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                                  {/* Disconnect / Reconnect Simulator */}
                                  <button
                                    onClick={() => {
                                      soundManager.playClick(700);
                                      if (isConnected) {
                                        onSimulateDisconnect(p.id);
                                      } else {
                                        onSimulateReconnect(p.id);
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 border transition-colors ${
                                      isConnected
                                        ? 'bg-white/5 border-white/10 text-arcade-mint hover:border-arcade-crimson hover:text-arcade-crimson'
                                        : 'bg-arcade-crimson/20 border-arcade-crimson/40 text-arcade-crimson hover:bg-arcade-mint/20 hover:text-arcade-mint'
                                    }`}
                                    title={isConnected ? 'Simulate Disconnect' : 'Simulate Reconnect'}
                                  >
                                    {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                    <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                                  </button>

                                  {/* Force Eliminate */}
                                  <button
                                    onClick={() => {
                                      soundManager.playClick(600);
                                      onForceEliminate(p.id);
                                    }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-arcade-crimson/15 border border-arcade-crimson/30 text-arcade-crimson hover:bg-arcade-crimson hover:text-white transition-all flex items-center gap-1"
                                  >
                                    <Skull className="w-3 h-3" />
                                    <span>ELIMINATE</span>
                                  </button>

                                  {/* Force Win */}
                                  <button
                                    onClick={() => {
                                      soundManager.playClick(1000);
                                      onForceWin(p.id);
                                    }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-arcade-amber/15 border border-arcade-amber/30 text-arcade-amber hover:bg-arcade-amber hover:text-black transition-all flex items-center gap-1 font-bold"
                                  >
                                    <Trophy className="w-3 h-3" />
                                    <span>FORCE WIN</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- TAB 2: ARENA EVENTS & HAZARDS ----------------- */}
                {activeTab === 'events' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-arcade-amber" /> RANDOM ARENA EVENTS (
                          {currentGameMeta.title.toUpperCase()})
                        </span>
                        <button
                          onClick={() => {
                            soundManager.playClick(1000);
                            onTriggerEvent();
                          }}
                          className="px-3 py-1 rounded-lg bg-arcade-amber text-black text-xs font-mono font-bold shadow-glow-amber hover:scale-105 transition-transform"
                        >
                          🎲 TRIGGER RANDOM EVENT
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                        {currentEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-3"
                          >
                            <div>
                              <span className="text-xl mb-1 block">{evt.icon}</span>
                              <h4 className="text-xs font-mono font-bold text-arcade-cream">
                                {evt.name}
                              </h4>
                              <p className="text-[10px] font-mono text-arcade-cream-muted mt-1">
                                {evt.desc}
                              </p>
                            </div>
                            <ArcadeButton
                              variant="amber"
                              size="sm"
                              fullWidth
                              onClick={() => {
                                soundManager.playClick(950);
                                onTriggerEvent(evt.id);
                              }}
                            >
                              FIRE EVENT
                            </ArcadeButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- TAB 3: GAMEPLAY MODIFIERS ----------------- */}
                {activeTab === 'modifiers' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-arcade-mint" /> LIVE GAMEPLAY MODIFIERS
                        </span>
                        <span className="text-[10px] font-mono text-arcade-cream-muted">
                          Applies dynamically across active simulation ticks
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* 1. Turbo Speed */}
                        <div
                          onClick={() => onToggleModifier('turboSpeed', !activeModifiers.turboSpeed)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                            activeModifiers.turboSpeed
                              ? 'bg-arcade-amber/15 border-arcade-amber shadow-glow-amber'
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-arcade-cream flex items-center gap-2">
                              ⚡ TURBO SPEED
                            </span>
                            <p className="text-[10px] font-mono text-arcade-cream-muted">
                              Increases movement velocity and dash/boost thrust by +75%.
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              activeModifiers.turboSpeed
                                ? 'bg-arcade-amber text-black'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {activeModifiers.turboSpeed ? 'ON' : 'OFF'}
                          </span>
                        </div>

                        {/* 2. Double Growth / Score */}
                        <div
                          onClick={() =>
                            onToggleModifier('doubleGrowthOrScore', !activeModifiers.doubleGrowthOrScore)
                          }
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                            activeModifiers.doubleGrowthOrScore
                              ? 'bg-arcade-mint/15 border-arcade-mint shadow-glow-mint'
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-arcade-cream flex items-center gap-2">
                              ⭐ 2X SCORE & GROWTH
                            </span>
                            <p className="text-[10px] font-mono text-arcade-cream-muted">
                              Doubles all points scored, mass gained, and length growth.
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              activeModifiers.doubleGrowthOrScore
                                ? 'bg-arcade-mint text-black'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {activeModifiers.doubleGrowthOrScore ? 'ON' : 'OFF'}
                          </span>
                        </div>

                        {/* 3. Low Gravity */}
                        <div
                          onClick={() => onToggleModifier('lowGravity', !activeModifiers.lowGravity)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                            activeModifiers.lowGravity
                              ? 'bg-arcade-cyan/15 border-arcade-cyan shadow-glow-cyan'
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-arcade-cream flex items-center gap-2">
                              🪶 LOW GRAVITY PHYSICS
                            </span>
                            <p className="text-[10px] font-mono text-arcade-cream-muted">
                              Floaty jumps, reduced friction, and slow-descent knockbacks.
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              activeModifiers.lowGravity
                                ? 'bg-arcade-cyan text-black'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {activeModifiers.lowGravity ? 'ON' : 'OFF'}
                          </span>
                        </div>

                        {/* 4. Chaos Mode */}
                        <div
                          onClick={() => onToggleModifier('chaosMode', !activeModifiers.chaosMode)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                            activeModifiers.chaosMode
                              ? 'bg-arcade-crimson/15 border-arcade-crimson shadow-glow-crimson'
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-arcade-cream flex items-center gap-2">
                              🔥 HYPER CHAOS MODE
                            </span>
                            <p className="text-[10px] font-mono text-arcade-cream-muted">
                              Zero ability cooldowns, 3x faster arena collapse & hazard pulses.
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              activeModifiers.chaosMode
                                ? 'bg-arcade-crimson text-white'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {activeModifiers.chaosMode ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- TAB 4: MATCH FLOW & STATES ----------------- */}
                {activeTab === 'flow' && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                        <FastForward className="w-4 h-4 text-arcade-amber" /> STATE MACHINE TRANSITIONS
                      </span>

                      {/* State Machine Flowchart Pill Sequence */}
                      <div className="flex items-center gap-1.5 flex-wrap p-3 rounded-xl bg-black/40 border border-white/10">
                        {(['lobby', 'countdown', 'playing', 'final_duel', 'ending', 'results'] as const).map(
                          (st, idx) => {
                            const isCurrent = matchState === st;
                            return (
                              <React.Fragment key={st}>
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase font-bold transition-all ${
                                    isCurrent
                                      ? 'bg-arcade-amber text-black shadow-glow-amber scale-105'
                                      : 'bg-white/5 text-arcade-cream-muted border border-white/5'
                                  }`}
                                >
                                  {st}
                                </span>
                                {idx < 5 && <ChevronRight className="w-3 h-3 text-white/20" />}
                              </React.Fragment>
                            );
                          }
                        )}
                      </div>

                      {/* Quick State Actions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                        <ArcadeButton
                          variant="mint"
                          size="md"
                          icon={<Play className="w-4 h-4" />}
                          onClick={() => {
                            soundManager.playClick(900);
                            onSkipCountdown();
                          }}
                        >
                          SKIP COUNTDOWN
                        </ArcadeButton>

                        {onForceFinalDuel && (
                          <ArcadeButton
                            variant="amber"
                            size="md"
                            icon={<Swords className="w-4 h-4" />}
                            onClick={() => {
                              soundManager.playHunterStinger();
                              onForceFinalDuel();
                            }}
                          >
                            FORCE FINAL DUEL
                          </ArcadeButton>
                        )}

                        <ArcadeButton
                          variant="crimson"
                          size="md"
                          icon={<Square className="w-4 h-4" />}
                          onClick={() => {
                            soundManager.playVictoryFanfare();
                            onInstantMatchEnd();
                          }}
                        >
                          INSTANT MATCH END
                        </ArcadeButton>

                        {onReturnToLobby && (
                          <ArcadeButton
                            variant="neutral"
                            size="md"
                            icon={<RefreshCw className="w-4 h-4" />}
                            onClick={() => {
                              soundManager.playClick(800);
                              onReturnToLobby();
                            }}
                          >
                            FORCE LOBBY
                          </ArcadeButton>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------- TAB 5: TELEMETRY & 200HZ RATE LIMITER ----------------- */}
                {activeTab === 'telemetry' && (
                  <div className="space-y-4">
                    {/* Live Performance & Rate Limiter Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] font-mono text-arcade-cream-muted block">
                          HOST SIMULATION FPS
                        </span>
                        <span
                          className={`text-xl font-mono font-black ${
                            fps >= 55 ? 'text-arcade-mint' : 'text-arcade-crimson'
                          }`}
                        >
                          {fps} FPS
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] font-mono text-arcade-cream-muted block">
                          RATE LIMIT CEILING
                        </span>
                        <span className="text-xl font-mono font-black text-arcade-cyan">
                          200 Hz MAX
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] font-mono text-arcade-cream-muted block">
                          TOTAL PACKETS PROCESSED
                        </span>
                        <span className="text-xl font-mono font-black text-arcade-cream">
                          {Object.values(telemetry).reduce((acc, t) => acc + t.packetsReceived, 0)}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-[10px] font-mono text-arcade-cream-muted block">
                          MALFORMED DROPS
                        </span>
                        <span className="text-xl font-mono font-black text-arcade-amber">
                          {Object.values(telemetry).reduce(
                            (acc, t) => acc + t.packetsDroppedMalformed + t.packetsDroppedRateLimit,
                            0
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Per-Player Packet Rates Table */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <span className="text-xs font-mono text-arcade-cream font-bold flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-arcade-cyan" /> PER-CONTROLLER INPUT STREAM TELEMETRY
                      </span>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {Object.keys(telemetry).length === 0 ? (
                          <p className="text-xs font-mono text-arcade-cream-muted text-center py-4">
                            No active remote controller streams. Connect a phone or simulate inputs.
                          </p>
                        ) : (
                          Object.values(telemetry).map((t) => (
                            <div
                              key={t.playerId}
                              className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs font-mono"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-arcade-mint" />
                                <span className="text-arcade-cream font-bold">{t.playerId}</span>
                              </div>
                              <div className="flex items-center gap-4 text-[11px]">
                                <span>
                                  Rate: <strong className="text-arcade-mint">{t.currentRateHz} Hz</strong>
                                </span>
                                <span>
                                  Received: <strong>{t.packetsReceived}</strong>
                                </span>
                                <span>
                                  Dropped (&gt;200Hz):{' '}
                                  <strong className="text-arcade-crimson">{t.packetsDroppedRateLimit}</strong>
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER BAR */}
              <div className="px-5 py-2.5 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] font-mono text-arcade-cream-muted">
                <span>⚡ HOTKEY: <strong className="text-arcade-amber">~ (Tilde)</strong> or <strong className="text-arcade-amber">F1</strong></span>
                <span>STATE: <strong className="text-arcade-mint uppercase">{matchState}</strong> &bull; TOTAL PILOTS: <strong className="text-arcade-cream">{playersList.length}</strong></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
