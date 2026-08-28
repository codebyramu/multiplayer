import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAMES_DATA } from '../data/games';
import { GameCard } from '../components/ui/GameCard';
import { CosmicBlackHoleCanvas } from '../components/ui/CosmicBlackHoleCanvas';
import { Tv, Smartphone, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface HubViewProps {
  onPlayGame: (gameId: string) => void;
  onHostGame: (gameId?: string) => void;
  onJoinParty: () => void;
  onViewLeaderboards: () => void;
  onReplayIntro?: () => void;
}

const CYBER_PIXEL_WALLPAPERS = [
  '/wallpapers/1.png',
  '/wallpapers/2.png',
  '/wallpapers/3.png',
  '/wallpapers/4.png',
  '/wallpapers/5.png',
  '/wallpapers/6.png',
  '/wallpapers/7.png',
];

export const HubView: React.FC<HubViewProps> = ({
  onPlayGame,
  onHostGame,
  onJoinParty,
  onViewLeaderboards,
  onReplayIntro,
}) => {
  const allGames = Object.values(GAMES_DATA);
  const [bgIndex, setBgIndex] = useState<number>(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: -1, y: -1 });

  // Smoothly cycle wallpapers every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % CYBER_PIXEL_WALLPAPERS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen select-none overflow-x-hidden text-white font-display"
    >
      {/* 1. Organic Foreground Twinkling Dust */}
      <CosmicBlackHoleCanvas cursorX={mousePos.x} cursorY={mousePos.y} />

      {/* 2. Cyberpunk Arcade Wallpaper Background */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <AnimatePresence mode="sync">
          <motion.div
            key={CYBER_PIXEL_WALLPAPERS[bgIndex]}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-90 contrast-110"
            style={{ backgroundImage: `url(${CYBER_PIXEL_WALLPAPERS[bgIndex]})` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080E] via-[#07080E]/40 to-[#07080E]/85" />
      </div>

      {/* 3. Hero Header Section */}
      <div className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <section className="text-center space-y-4 pt-2">
          {/* Top Pill */}
          <div className="flex items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono text-arcade-mint backdrop-blur-xl">
              <span className="w-2 h-2 rounded-full bg-arcade-mint animate-pulse" />
              <span>WebRTC Direct P2P &bull; 60 FPS Authoritative</span>
            </div>

            {onReplayIntro && (
              <button
                onClick={() => {
                  soundManager.playClick(900);
                  onReplayIntro();
                }}
                className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white font-mono text-[11px] transition-all"
              >
                Replay Intro
              </button>
            )}
          </div>

          {/* Headline */}
          <div className="space-y-1.5 max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              Play on TV.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                Control with Phone.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-white/60 font-medium">
              Zero app downloads. Scan to join. 1–8 players and smart AI bots.
            </p>
          </div>

          {/* Quick Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onHostGame()}
              className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-amber-500 text-black font-arcade text-xs font-black tracking-wider shadow-[0_0_25px_rgba(255,178,36,0.5)] border border-white/40 flex items-center justify-center gap-2"
            >
              <Tv className="w-4 h-4 stroke-[2.5]" />
              <span>HOST ON TV</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onJoinParty}
              className="w-full sm:w-1/2 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-arcade-cyan via-teal-400 to-arcade-mint text-black font-arcade text-xs font-black tracking-wider shadow-[0_0_25px_rgba(0,229,255,0.5)] border border-white/40 flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4 stroke-[2.5]" />
              <span>JOIN ON PHONE</span>
            </motion.button>
          </div>
        </section>

        {/* 4. Game Catalog Grid */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="font-arcade text-lg sm:text-xl font-black text-white tracking-wider">
                GAMES CATALOG
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 font-mono text-[10px] text-arcade-mint font-bold">
                6 TITLES
              </span>
            </div>

            <button
              onClick={onViewLeaderboards}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-arcade-amber transition-all flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>STANDINGS &rarr;</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
      </div>
    </div>
  );
};
