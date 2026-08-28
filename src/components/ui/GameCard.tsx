import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { GameMetadata } from '../../types';
import { Users, Clock, Play, Sparkles } from 'lucide-react';
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 3D Tilt Cursor Physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 350 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  // Luxury Translucent Glass Gradients per Game (No plain black)
  const getCardTheme = () => {
    switch (game.id) {
      case 'neon-relay':
        return {
          bg: 'bg-gradient-to-br from-cyan-950/40 via-slate-900/50 to-blue-950/40',
          border: 'border-cyan-500/30 group-hover:border-cyan-400 group-hover:shadow-[0_0_40px_rgba(0,229,255,0.4)]',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          glowSpotlight: 'rgba(0, 229, 255, 0.18)',
        };
      case 'void-tag':
        return {
          bg: 'bg-gradient-to-br from-purple-950/40 via-slate-900/50 to-fuchsia-950/40',
          border: 'border-purple-500/30 group-hover:border-purple-400 group-hover:shadow-[0_0_40px_rgba(157,78,221,0.4)]',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          glowSpotlight: 'rgba(157, 78, 221, 0.18)',
        };
      case 'relic-rush':
        return {
          bg: 'bg-gradient-to-br from-amber-950/40 via-slate-900/50 to-yellow-950/40',
          border: 'border-amber-500/30 group-hover:border-amber-400 group-hover:shadow-[0_0_40px_rgba(255,178,36,0.4)]',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          glowSpotlight: 'rgba(255, 178, 36, 0.18)',
        };
      case 'last-platform':
        return {
          bg: 'bg-gradient-to-br from-rose-950/40 via-slate-900/50 to-pink-950/40',
          border: 'border-rose-500/30 group-hover:border-rose-400 group-hover:shadow-[0_0_40px_rgba(255,51,102,0.4)]',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          glowSpotlight: 'rgba(255, 51, 102, 0.18)',
        };
      case 'serpent-arena':
        return {
          bg: 'bg-gradient-to-br from-emerald-950/40 via-slate-900/50 to-teal-950/40',
          border: 'border-emerald-500/30 group-hover:border-emerald-400 group-hover:shadow-[0_0_40px_rgba(0,245,160,0.4)]',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          glowSpotlight: 'rgba(0, 245, 160, 0.18)',
        };
      case 'shadow-outrun':
        return {
          bg: 'bg-gradient-to-br from-yellow-950/40 via-slate-900/50 to-amber-950/40',
          border: 'border-yellow-500/30 group-hover:border-yellow-400 group-hover:shadow-[0_0_40px_rgba(255,178,36,0.4)]',
          badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          glowSpotlight: 'rgba(255, 178, 36, 0.18)',
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-900/40 via-slate-900/50 to-slate-950/40',
          border: 'border-white/20 group-hover:border-white/40',
          badge: 'bg-white/10 text-white border-white/20',
          glowSpotlight: 'rgba(255, 255, 255, 0.12)',
        };
    }
  };

  const theme = getCardTheme();

  return (
    <motion.div
      ref={cardRef}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        soundManager.playClick(900);
        onHost(game.id);
      }}
      className={`relative group rounded-3xl p-6 flex flex-col justify-between overflow-hidden cursor-pointer select-none transition-all duration-500 ${theme.bg} border-2 ${theme.border} backdrop-blur-2xl shadow-2xl ${
        featured ? 'md:col-span-2' : ''
      }`}
    >
      {/* ─── REACTIVE CURSOR SPOTLIGHT GLOW ─── */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(420px circle at ${useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])} ${useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])}, ${theme.glowSpotlight}, transparent 75%)`,
        }}
      />

      {/* Top Meta Header */}
      <div className="flex items-center justify-between gap-2 z-10 mb-3">
        <span className={`px-3 py-1 rounded-full border text-[10px] font-mono tracking-widest uppercase font-bold backdrop-blur-md shadow-sm ${theme.badge}`}>
          {game.category}
        </span>
        <span className="text-[10px] font-mono tracking-widest text-white/60 uppercase font-bold">
          {game.difficulty}
        </span>
      </div>

      {/* Title & Subtitle */}
      <div className="z-10 space-y-1">
        <h3 className="font-arcade text-xl sm:text-2xl font-black text-white tracking-wide group-hover:text-arcade-amber transition-colors drop-shadow-md">
          {game.title}
        </h3>
        <p className="font-mono text-xs text-white/70 line-clamp-1">
          {game.subtitle || game.tagline}
        </p>
      </div>

      {/* Visual Glassmorphic Preview Image Container */}
      <div className="my-4 h-36 rounded-2xl bg-black/30 border border-white/15 overflow-hidden relative group-hover:border-white/30 transition-all z-10 shadow-inner">
        {game.coverImage ? (
          <img
            src={game.coverImage}
            alt={game.title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-108 transition-all duration-700 filter contrast-115 brightness-95"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🕹️
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Players & Duration Tag */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/90">
          <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-white/10 backdrop-blur-sm">
            <Users className="w-3 h-3 text-arcade-amber" /> {game.playersLabel}
          </span>
          <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg border border-white/10 backdrop-blur-sm">
            <Clock className="w-3 h-3 text-arcade-cyan" /> {game.durationLabel}
          </span>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between z-10 pt-3 border-t border-white/10">
        <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-arcade-mint animate-pulse" />
          60 FPS ONLINE
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundManager.playClick(1000);
            onPlay(game.id);
          }}
          className="px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-xs font-mono font-bold text-white group-hover:border-arcade-amber group-hover:text-arcade-amber transition-all shadow-md active:scale-95 flex items-center gap-1.5 backdrop-blur-md"
        >
          <span>PLAY</span>
          <Play className="w-3 h-3 fill-current" />
        </button>
      </div>
    </motion.div>
  );
};
