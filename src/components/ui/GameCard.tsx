import React from 'react';
import { motion } from 'framer-motion';
import { GameMetadata } from '../../types';
import { ArcadeButton } from './ArcadeButton';
import { GlassPanel } from './GlassPanel';
import { Users, Clock, Flame, Play, Tv, Sparkles } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

interface GameCardProps {
  game: GameMetadata;
  onPlay: (gameId: string) => void;
  onHost: (gameId: string) => void;
  featured?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onPlay,
  onHost,
  featured = false,
}) => {
  const getGlowVariant = () => {
    switch (game.id) {
      case 'neon-relay': return 'glow-cyan';
      case 'void-tag': return 'glow-violet';
      case 'relic-rush': return 'glow-amber';
      case 'last-platform': return 'glow-crimson';
      case 'serpent-arena': return 'glow-mint';
      default: return 'default';
    }
  };

  const getButtonVariant = () => {
    switch (game.id) {
      case 'neon-relay': return 'cyan';
      case 'void-tag': return 'violet';
      case 'relic-rush': return 'amber';
      case 'last-platform': return 'crimson';
      case 'serpent-arena': return 'mint';
      default: return 'amber';
    }
  };

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative group ${featured ? 'md:col-span-2' : ''}`}
    >
      <GlassPanel
        variant={getGlowVariant() as any}
        className="h-full flex flex-col justify-between p-5 md:p-6 transition-all duration-300 group-hover:border-white/30"
      >
        {/* Top Badges */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-mono tracking-wider text-arcade-cream uppercase border border-white/10">
                {game.category}
              </span>
              {game.isFlagship && (
                <span className="px-2.5 py-1 rounded-md bg-arcade-mint/20 text-arcade-mint text-[10px] font-mono font-bold tracking-wider uppercase border border-arcade-mint/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> FLAGSHIP
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-arcade-cream-muted uppercase">
              {game.difficulty}
            </span>
          </div>

          {/* Title & Subtitle */}
          <h3 className="font-arcade text-lg md:text-xl font-bold text-arcade-cream tracking-wide group-hover:text-white transition-colors">
            {game.title}
          </h3>
          <p className="font-mono text-xs text-arcade-amber font-semibold uppercase tracking-wider mt-0.5">
            {game.subtitle}
          </p>

          {/* Description */}
          <p className="text-xs md:text-sm text-arcade-cream-muted leading-relaxed mt-3 line-clamp-3">
            {game.description}
          </p>
        </div>

        {/* Visual Animated Preview Thumbnail */}
        <div className="my-4 h-24 md:h-32 rounded-xl bg-black/40 border border-white/10 overflow-hidden relative flex items-center justify-center">
          {/* Animated background grid */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(${game.accentHex} 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />

          {/* Game-specific geometric icon abstraction */}
          {game.id === 'neon-relay' && (
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-arcade-cyan animate-spin" />
              <div className="absolute w-8 h-8 rounded-lg bg-arcade-cyan/30 rotate-45 border border-arcade-cyan shadow-glow-cyan" />
            </div>
          )}

          {game.id === 'void-tag' && (
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-arcade-violet/20 border-2 border-arcade-violet animate-pulse shadow-glow-violet flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-arcade-violet animate-ping" />
              </div>
            </div>
          )}

          {game.id === 'relic-rush' && (
            <div className="relative flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-arcade-amber/20 border-2 border-arcade-amber rotate-12 shadow-glow-amber flex items-center justify-center text-arcade-amber font-mono font-bold">
                💎
              </div>
            </div>
          )}

          {game.id === 'last-platform' && (
            <div className="grid grid-cols-3 gap-1.5 p-2">
              <div className="w-7 h-7 rounded bg-arcade-crimson/40 border border-arcade-crimson" />
              <div className="w-7 h-7 rounded bg-arcade-crimson/20 border border-white/20" />
              <div className="w-7 h-7 rounded bg-arcade-crimson/60 border border-arcade-crimson shadow-glow-crimson" />
            </div>
          )}

          {game.id === 'serpent-arena' && (
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-arcade-mint border-2 border-white shadow-glow-mint flex items-center justify-center text-xs">
                👀
              </div>
              <div className="w-6 h-6 rounded-full bg-arcade-cyan/80" />
              <div className="w-5 h-5 rounded-full bg-arcade-violet/80" />
              <div className="w-4 h-4 rounded-full bg-arcade-amber/80" />
            </div>
          )}

          {/* Quick info overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-white/70 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-arcade-amber" /> {game.playersLabel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-arcade-cyan" /> {game.durationLabel}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <ArcadeButton
            variant={getButtonVariant() as any}
            size="md"
            icon={<Play className="w-4 h-4 fill-current" />}
            className="flex-1"
            onClick={() => onPlay(game.id)}
          >
            PLAY NOW
          </ArcadeButton>
          <ArcadeButton
            variant="neutral"
            size="md"
            icon={<Tv className="w-4 h-4" />}
            title="Host party on TV / Big Screen"
            onClick={() => onHost(game.id)}
          >
            HOST
          </ArcadeButton>
        </div>
      </GlassPanel>
    </motion.div>
  );
};
