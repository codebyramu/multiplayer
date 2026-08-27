import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { GameMetadata } from '../../types';
import { Sparkles, Users, Clock, Play, Tv } from 'lucide-react';
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

  const springConfig = { damping: 20, stiffness: 300 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);

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

  const getBorderColor = () => {
    switch (game.id) {
      case 'neon-relay': return 'group-hover:border-cyan-400 group-hover:shadow-[0_0_35px_rgba(0,229,255,0.4)]';
      case 'void-tag': return 'group-hover:border-purple-400 group-hover:shadow-[0_0_35px_rgba(157,78,221,0.4)]';
      case 'relic-rush': return 'group-hover:border-amber-400 group-hover:shadow-[0_0_35px_rgba(255,178,36,0.4)]';
      case 'last-platform': return 'group-hover:border-pink-500 group-hover:shadow-[0_0_35px_rgba(255,51,102,0.4)]';
      case 'serpent-arena': return 'group-hover:border-emerald-400 group-hover:shadow-[0_0_35px_rgba(0,245,160,0.4)]';
      case 'shadow-outrun': return 'group-hover:border-yellow-400 group-hover:shadow-[0_0_35px_rgba(255,178,36,0.4)]';
      default: return 'group-hover:border-white/40';
    }
  };

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
      className={`relative group rounded-3xl p-6 flex flex-col justify-between overflow-hidden cursor-pointer select-none transition-all duration-500 bg-black/60 border border-white/10 backdrop-blur-2xl ${getBorderColor()} ${
        featured ? 'md:col-span-2' : ''
      }`}
    >
      {/* ─── REACTIVE CURSOR SPOTLIGHT ─── */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])} ${useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])}, rgba(255,255,255,0.08), transparent 80%)`,
        }}
      />

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 z-10 mb-3">
        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-white/80 uppercase font-semibold">
          {game.category}
        </span>
        <span className="text-[10px] font-mono tracking-widest text-white/50 uppercase font-bold">
          {game.difficulty}
        </span>
      </div>

      {/* Title & Subtitle */}
      <div className="z-10 space-y-1">
        <h3 className="font-arcade text-xl sm:text-2xl font-black text-white tracking-wide group-hover:text-arcade-amber transition-colors">
          {game.title}
        </h3>
        <p className="font-mono text-xs text-white/60 line-clamp-1">
          {game.subtitle || game.tagline}
        </p>
      </div>

      {/* Visual Glassmorphic Preview Image */}
      <div className="my-4 h-36 rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative group-hover:border-white/20 transition-all z-10">
        {game.coverImage ? (
          <img
            src={game.coverImage}
            alt={game.title}
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-108 transition-all duration-700 filter contrast-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🕹️
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

        {/* Players & Duration Tag */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white/80">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-arcade-amber" /> {game.playersLabel}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-arcade-cyan" /> {game.durationLabel}
          </span>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between z-10 pt-3 border-t border-white/10">
        <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest font-semibold">
          60 FPS &bull; ONLINE
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            soundManager.playClick(1000);
            onPlay(game.id);
          }}
          className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono font-bold text-white group-hover:border-arcade-amber group-hover:text-arcade-amber transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <span>PLAY</span>
          <Play className="w-3 h-3 fill-current" />
        </button>
      </div>
    </motion.div>
  );
};
