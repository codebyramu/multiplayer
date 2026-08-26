import React from 'react';
import { motion } from 'framer-motion';
import { GAMES_DATA } from '../data/games';
import { GameCard } from '../components/ui/GameCard';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { 
  Tv, Smartphone, Trophy, Sparkles, Flame, Shield, Users, Radio, Play, Disc
} from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface HubViewProps {
  onPlayGame: (gameId: string) => void;
  onHostGame: (gameId?: string) => void;
  onJoinParty: () => void;
  onViewLeaderboards: () => void;
}

export const HubView: React.FC<HubViewProps> = ({
  onPlayGame,
  onHostGame,
  onJoinParty,
  onViewLeaderboards,
}) => {
  const flagshipGame = GAMES_DATA['serpent-arena'];
  const allGames = Object.values(GAMES_DATA);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* 1. HERO SECTION */}
      <section className="relative pt-4 pb-8">
        {/* Ambient background glow orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-arcade-amber/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-12 right-1/4 w-96 h-96 bg-arcade-mint/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="text-center space-y-6 max-w-4xl mx-auto">
          {/* Live Status Pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-glass-edge"
          >
            <span className="w-2 h-2 rounded-full bg-arcade-mint animate-ping" />
            <span className="text-xs font-mono tracking-widest text-arcade-cream-muted uppercase">
              MULTIPLAYER HOST-CONTROLLER ENGINE ACTIVE
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="font-arcade text-3xl sm:text-5xl lg:text-6xl font-black text-arcade-cream tracking-tight leading-tight"
          >
            PLAY ON <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-arcade-crimson to-arcade-violet">THE TV</span>.
            <br />
            CONTROL WITH <span className="text-arcade-mint">YOUR PHONE</span>.
          </motion.h1>

          <p className="text-sm sm:text-base md:text-lg text-arcade-cream-muted max-w-2xl mx-auto font-display">
            Instant browser multiplayer without downloads. Turn your computer or TV into an authoritative arcade machine, while friends join with their phones via simple 5-character party codes!
          </p>

          {/* Dual Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <ArcadeButton
              variant="amber"
              size="xl"
              icon={<Tv className="w-6 h-6" />}
              onClick={() => onHostGame()}
              className="w-full sm:w-auto text-base"
            >
              CREATE PARTY (HOST)
            </ArcadeButton>
            <ArcadeButton
              variant="cyan"
              size="xl"
              icon={<Smartphone className="w-6 h-6" />}
              onClick={onJoinParty}
              className="w-full sm:w-auto text-base"
            >
              JOIN WITH PHONE
            </ArcadeButton>
          </div>
        </div>
      </section>

      {/* 2. FEATURED FLAGSHIP SPOTLIGHT (SERPENT ARENA) */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-arcade-amber" />
            <h2 className="font-arcade text-lg sm:text-xl text-arcade-cream">FEATURED FLAGSHIP</h2>
          </div>
          <span className="text-xs font-mono text-arcade-amber">60 FPS AUTHORITATIVE SIMULATION</span>
        </div>

        <GlassPanel
          variant="glow-mint"
          className="p-6 md:p-8 border-arcade-mint/40"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-md bg-arcade-mint/20 text-arcade-mint font-mono text-xs font-bold border border-arcade-mint/30">
                  FLAGSHIP SHOWDOWN
                </span>
                <span className="text-xs font-mono text-arcade-cream-muted">1-8 PILOTS + SMART BOTS</span>
              </div>

              <h3 className="font-arcade text-2xl sm:text-3xl text-arcade-cream">
                SERPENT ARENA
              </h3>

              <p className="text-sm md:text-base text-arcade-cream-muted leading-relaxed">
                Experience the next evolution of multi-serpent gladiator combat in a fixed enclosed ring. Features 60FPS historical spine physics, 5 distinct bot AI archetypes (Aggressive, Defensive, Collector, Ambusher, Chaotic), glowing energy storms, tactical boost mass-shedding, and head-to-body explosive collisions!
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <ArcadeButton
                  variant="mint"
                  size="lg"
                  icon={<Play className="w-5 h-5 fill-current" />}
                  onClick={() => onPlayGame('serpent-arena')}
                >
                  PLAY NOW (SOLO / BOTS)
                </ArcadeButton>
                <ArcadeButton
                  variant="neutral"
                  size="lg"
                  icon={<Tv className="w-5 h-5" />}
                  onClick={() => onHostGame('serpent-arena')}
                >
                  HOST SERPENT PARTY
                </ArcadeButton>
              </div>
            </div>

            {/* Visual Feature Hologram Display */}
            <div className="lg:col-span-5 h-56 rounded-2xl bg-black/50 border border-arcade-mint/30 flex flex-col items-center justify-center relative overflow-hidden p-4">
              <div className="absolute inset-0 bg-radial from-arcade-mint/15 via-transparent to-transparent pointer-events-none" />
              <div className="flex items-center gap-2 z-10">
                <div className="w-12 h-12 rounded-full bg-arcade-mint border-2 border-white shadow-glow-mint flex items-center justify-center text-xl">
                  👀
                </div>
                <div className="w-10 h-10 rounded-full bg-arcade-cyan shadow-glow-cyan" />
                <div className="w-8 h-8 rounded-full bg-arcade-violet shadow-glow-violet" />
                <div className="w-6 h-6 rounded-full bg-arcade-amber shadow-glow-amber" />
                <div className="w-5 h-5 rounded-full bg-arcade-crimson shadow-glow-crimson" />
              </div>
              <span className="mt-4 font-arcade text-xs text-arcade-mint tracking-wider z-10">
                MULTI-JOINT SMOOTH SPINE ENGINE
              </span>
              <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-white/60 z-10">
                <span>⚡ BOOST MASS SHED</span>
                <span>💥 COLLISION EXPLOSION</span>
                <span>🤖 5 BOT PERSONALITIES</span>
              </div>
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* 3. COMPLETE 5-GAME COLLECTION */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Disc className="w-5 h-5 text-arcade-cyan" />
              <h2 className="font-arcade text-lg sm:text-xl text-arcade-cream">COMPLETE GAME COLLECTION</h2>
            </div>
            <p className="text-xs font-mono text-arcade-cream-muted mt-1">
              5 original arcade modes built for low-latency party multiplayer
            </p>
          </div>
          <button
            onClick={onViewLeaderboards}
            className="text-xs font-mono text-arcade-amber hover:underline flex items-center gap-1 self-start sm:self-auto"
          >
            <Trophy className="w-3.5 h-3.5" /> GLOBAL LEADERBOARDS &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={onPlayGame}
              onHost={onHostGame}
            />
          ))}
        </div>
      </section>

      {/* 4. PLATFORM HIGHLIGHTS / HOW IT WORKS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <GlassPanel className="p-6">
          <div className="w-10 h-10 rounded-xl bg-arcade-amber/20 border border-arcade-amber/40 flex items-center justify-center text-arcade-amber mb-4">
            <Tv className="w-5 h-5" />
          </div>
          <h4 className="font-arcade text-sm text-arcade-cream mb-2">1. BIG SCREEN DISPLAY</h4>
          <p className="text-xs text-arcade-cream-muted leading-relaxed">
            Run the host on your laptop, desktop, or living room TV. It runs authoritative physics simulations, renders 60FPS graphics, and plays procedural arcade synth audio.
          </p>
        </GlassPanel>

        <GlassPanel className="p-6">
          <div className="w-10 h-10 rounded-xl bg-arcade-cyan/20 border border-arcade-cyan/40 flex items-center justify-center text-arcade-cyan mb-4">
            <Smartphone className="w-5 h-5" />
          </div>
          <h4 className="font-arcade text-sm text-arcade-cream mb-2">2. ZERO-APP PHONE CONTROLLERS</h4>
          <p className="text-xs text-arcade-cream-muted leading-relaxed">
            Scan the host's QR code or enter the 5-character party code on your phone. Your mobile browser immediately turns into an ultra-responsive gamepad with haptic feedback.
          </p>
        </GlassPanel>

        <GlassPanel className="p-6">
          <div className="w-10 h-10 rounded-xl bg-arcade-mint/20 border border-arcade-mint/40 flex items-center justify-center text-arcade-mint mb-4">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-arcade text-sm text-arcade-cream mb-2">3. 5 DISTINCT EXPERIENCES</h4>
          <p className="text-xs text-arcade-cream-muted leading-relaxed">
            Speed racing circuits, tense tag infection, treasure hoarding brawls, collapsing hex platforms, and tactical Slither-style battle royale. All equipped with AI bots!
          </p>
        </GlassPanel>
      </section>
    </div>
  );
};
