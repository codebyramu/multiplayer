import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAMES_DATA } from '../data/games';
import { GameCard } from '../components/ui/GameCard';
import { CosmicBlackHoleCanvas } from '../components/ui/CosmicBlackHoleCanvas';
import { Tv, Smartphone, Trophy, Sparkles, Flame, Shield, ArrowRight } from 'lucide-react';
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

  // Smoothly cycle retro cyberpunk pixel-art wallpaper on the main hub
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
      {/* ─── 1. DUST PARTICLES & BLACK HOLE GRAVITATIONAL SIMULATION CANVAS ─── */}
      <CosmicBlackHoleCanvas cursorX={mousePos.x} cursorY={mousePos.y} />

      {/* ─── 2. CYBERPUNK ARCADE RETRO WALLPAPER (MAIN GAMES HUB ONLY) ─── */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <AnimatePresence mode="sync">
          <motion.div
            key={CYBER_PIXEL_WALLPAPERS[bgIndex]}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-90 contrast-110"
            style={{ backgroundImage: `url(${CYBER_PIXEL_WALLPAPERS[bgIndex]})` }}
          />
        </AnimatePresence>

        {/* Ambient Dark Gradient Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080E] via-transparent to-[#07080E]/80" />
      </div>

      {/* ─── 3. MAIN HERO SECTION (GLITCH ANIMATED WORDS) ─── */}
      <div className="relative z-10 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <section className="relative text-center space-y-5 pt-4 pb-2">
          {/* Top Status Badge */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-white/15 text-xs font-mono text-arcade-mint backdrop-blur-xl shadow-lg"
            >
              <span className="w-2 h-2 rounded-full bg-arcade-mint animate-pulse" />
              <span>ZERO INSTALL &bull; INSTANT P2P MULTIPLAYER</span>
            </motion.div>

            {onReplayIntro && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  soundManager.playClick(900);
                  onReplayIntro();
                }}
                className="px-4 py-1.5 rounded-full bg-arcade-amber/20 hover:bg-arcade-amber/30 border border-arcade-amber/40 text-arcade-amber font-mono text-xs font-bold transition-all flex items-center gap-1.5 backdrop-blur-xl shadow-md"
              >
                <span>⚡ REPLAY 7S CINEMATIC</span>
              </motion.button>
            )}
          </div>

          {/* Glitch Animated Headline: PLAY, ON, CONTROL, WITH */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-2"
          >
            <h1 className="font-arcade text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-widest leading-tight">
              <motion.span
                animate={{
                  color: ['#FFFFFF', '#00F5A0', '#00E5FF', '#FFB224', '#FFFFFF'],
                  textShadow: [
                    '0 0 20px rgba(255,255,255,0.6)',
                    '0 0 30px rgba(0,245,160,0.8), 2px 2px #FF0055',
                    '0 0 30px rgba(0,229,255,0.8), -2px -2px #00F5A0',
                    '0 0 25px rgba(255,178,36,0.8)',
                    '0 0 20px rgba(255,255,255,0.6)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                className="inline-block"
              >
                PLAY
              </motion.span>{' '}
              <motion.span
                animate={{
                  color: ['#FFB224', '#FF3366', '#9D4EDD', '#00E5FF', '#FFB224'],
                  textShadow: [
                    '0 0 25px rgba(255,178,36,0.8)',
                    '0 0 30px rgba(255,51,102,0.8), -2px 2px #00E5FF',
                    '0 0 25px rgba(157,78,221,0.8)',
                    '0 0 25px rgba(0,229,255,0.8)',
                    '0 0 25px rgba(255,178,36,0.8)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 4.0, ease: 'easeInOut' }}
                className="inline-block"
              >
                ON
              </motion.span>{' '}
              <span className="text-arcade-amber drop-shadow-[0_0_25px_rgba(255,178,36,0.9)]">TV</span>.<br />

              <motion.span
                animate={{
                  color: ['#00F5A0', '#00E5FF', '#FFB224', '#FF3366', '#00F5A0'],
                  textShadow: [
                    '0 0 25px rgba(0,245,160,0.8)',
                    '0 0 30px rgba(0,229,255,0.8), 2px -2px #FFB224',
                    '0 0 25px rgba(255,178,36,0.8)',
                    '0 0 30px rgba(255,51,102,0.8)',
                    '0 0 25px rgba(0,245,160,0.8)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                className="inline-block"
              >
                CONTROL
              </motion.span>{' '}
              <motion.span
                animate={{
                  color: ['#FFFFFF', '#9D4EDD', '#00F5A0', '#FFB224', '#FFFFFF'],
                  textShadow: [
                    '0 0 20px rgba(255,255,255,0.6)',
                    '0 0 25px rgba(157,78,221,0.8), -2px -2px #FF3366',
                    '0 0 25px rgba(0,245,160,0.8)',
                    '0 0 25px rgba(255,178,36,0.8)',
                    '0 0 20px rgba(255,255,255,0.6)',
                  ],
                }}
                transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
                className="inline-block"
              >
                WITH
              </motion.span>{' '}
              <span className="text-arcade-mint drop-shadow-[0_0_25px_rgba(0,245,160,0.9)]">PHONE</span>.
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-lg mx-auto font-medium leading-relaxed drop-shadow-md">
              Open on your screen. Scan with your phone. Battle your friends instantly.
            </p>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3 max-w-lg mx-auto">
            <button
              onClick={() => onHostGame()}
              className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-500 to-amber-600 text-black font-arcade text-xs sm:text-sm font-black tracking-wider shadow-[0_0_25px_rgba(255,178,36,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white/30"
            >
              <Tv className="w-4 h-4 stroke-[2.5]" />
              <span>CREATE PARTY (HOST TV)</span>
            </button>

            <button
              onClick={onJoinParty}
              className="w-full sm:w-1/2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-arcade-cyan via-teal-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-wider shadow-[0_0_25px_rgba(0,229,255,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white/30"
            >
              <Smartphone className="w-4 h-4 stroke-[2.5]" />
              <span>JOIN WITH PHONE</span>
            </button>
          </div>
        </section>

        {/* ─── 4. ARCADE ARENAS (LUXURY GLASSMORPHIC CARDS) ─── */}
        <section className="space-y-6 pt-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="font-arcade text-2xl sm:text-3xl font-black text-white tracking-wider flex items-center gap-2">
                <span>ARCADE TITLES</span>
                <span className="px-2.5 py-0.5 rounded-full bg-arcade-mint/20 border border-arcade-mint/30 font-mono text-xs text-arcade-mint font-bold">
                  {allGames.length} TITLES
                </span>
              </h2>
              <p className="text-xs font-mono text-white/50 mt-1">
                Real-time physics &bull; 1 to 8 players & bots &bull; 60 FPS authoritative sync
              </p>
            </div>

            <button
              onClick={onViewLeaderboards}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-arcade-amber transition-all flex items-center gap-2"
            >
              <Trophy className="w-4 h-4" />
              <span>LEADERBOARDS &rarr;</span>
            </button>
          </div>

          {/* Cards Grid */}
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
      </div>
    </div>
  );
};
