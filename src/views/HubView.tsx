import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAMES_DATA } from '../data/games';
import { GameCard } from '../components/ui/GameCard';
import { CosmicBlackHoleCanvas } from '../components/ui/CosmicBlackHoleCanvas';
import { Tv, Smartphone, Trophy, ChevronDown, Music, Volume2, VolumeX } from 'lucide-react';
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
  const [isPlayingMusic, setIsPlayingMusic] = useState<boolean>(false);

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

  const scrollToCatalog = () => {
    soundManager.playClick(900);
    const catalogElement = document.getElementById('games-catalog');
    if (catalogElement) {
      catalogElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleBackgroundMusic = () => {
    soundManager.init();
    if (isPlayingMusic) {
      soundManager.playMusic('none');
      setIsPlayingMusic(false);
    } else {
      soundManager.playMusic('lobby');
      setIsPlayingMusic(true);
    }
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

      {/* ─── 3. FULL-HEIGHT HERO SECTION (FOCUSED & DECENT) ─── */}
      <section className="relative z-10 min-h-[calc(100vh-4rem)] flex flex-col justify-between items-center text-center px-4 py-8 max-w-5xl mx-auto">
        {/* Top Badges & Controls */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono text-arcade-mint backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-arcade-mint animate-pulse" />
            <span>WebRTC Direct P2P &bull; 60 FPS Authoritative</span>
          </div>

          <button
            onClick={toggleBackgroundMusic}
            className={`px-3 py-1 rounded-full border text-[11px] font-mono transition-all flex items-center gap-1.5 backdrop-blur-xl ${
              isPlayingMusic
                ? 'bg-arcade-amber/20 border-arcade-amber/50 text-arcade-amber shadow-glow-amber'
                : 'bg-white/5 hover:bg-white/15 border-white/10 text-white/70'
            }`}
            title="Toggle Lobby Background Music"
          >
            <Music className="w-3.5 h-3.5" />
            <span>{isPlayingMusic ? 'MUSIC PLAYING 🎵' : 'PLAY BG MUSIC'}</span>
          </button>

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

        {/* Center Hero Card */}
        <div className="space-y-6 my-auto max-w-3xl">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight text-white drop-shadow-[0_0_35px_rgba(0,0,0,0.8)]">
              Play on TV.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                Control with Phone.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-white/70 font-medium max-w-lg mx-auto leading-relaxed drop-shadow-md">
              Zero app downloads. One big TV screen. Any number of smartphones connect instantly as wireless arcade gamepads.
            </p>
          </div>

          {/* Quick Action CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2 max-w-md mx-auto">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onHostGame()}
              className="w-full sm:w-1/2 py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-amber-500 text-black font-arcade text-xs sm:text-sm font-black tracking-wider shadow-[0_0_30px_rgba(255,178,36,0.6)] border border-white/40 flex items-center justify-center gap-2 active:scale-95"
            >
              <Tv className="w-4 h-4 stroke-[2.5]" />
              <span>HOST ON TV</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onJoinParty}
              className="w-full sm:w-1/2 py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-cyan via-teal-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-wider shadow-[0_0_30px_rgba(0,229,255,0.6)] border border-white/40 flex items-center justify-center gap-2 active:scale-95"
            >
              <Smartphone className="w-4 h-4 stroke-[2.5]" />
              <span>JOIN ON PHONE</span>
            </motion.button>
          </div>
        </div>

        {/* Scroll Down Indicator */}
        <motion.button
          onClick={scrollToCatalog}
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-1.5 text-white/50 hover:text-white transition-colors pb-4 cursor-pointer"
        >
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
            SCROLL TO EXPLORE GAMES
          </span>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/15 flex items-center justify-center backdrop-blur-md shadow-lg">
            <ChevronDown className="w-4 h-4" />
          </div>
        </motion.button>
      </section>

      {/* ─── 4. BELOW-THE-FOLD GAMES CATALOG (REVEALS ON SCROLL) ─── */}
      <section
        id="games-catalog"
        className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 border-t border-white/10"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="font-arcade text-2xl sm:text-3xl font-black text-white tracking-wider flex items-center gap-2.5">
              <span>ARCADE GAMES CATALOG</span>
              <span className="px-2.5 py-0.5 rounded-full bg-arcade-mint/20 border border-arcade-mint/30 font-mono text-xs text-arcade-mint font-bold">
                {allGames.length} TITLES
              </span>
            </h2>
            <p className="text-xs font-mono text-white/60 mt-1">
              Real-time physics &bull; 1 to 8 players & smart AI bots &bull; 60 FPS authoritative sync
            </p>
          </div>

          <button
            onClick={onViewLeaderboards}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-arcade-amber transition-all flex items-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            <span>STANDINGS &rarr;</span>
          </button>
        </div>

        {/* Game Cards Grid */}
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
  );
};
