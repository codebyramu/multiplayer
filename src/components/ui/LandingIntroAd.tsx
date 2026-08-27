import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { Sparkles, Tv, Smartphone, Zap, Play, Volume2, ShieldCheck, ArrowRight } from 'lucide-react';

interface LandingIntroAdProps {
  onEnter: () => void;
}

const CINEMATIC_SLIDES = [
  '/cinematics/slide_1.jpg',
  '/cinematics/slide_2.jpg',
  '/cinematics/slide_3.jpg',
  '/cinematics/slide_4.jpg',
];

export const LandingIntroAd: React.FC<LandingIntroAdProps> = ({ onEnter }) => {
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [phase, setPhase] = useState<number>(1);
  const [canSkip, setCanSkip] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Background cinematic video-like slideshow across 4 generated images
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % CINEMATIC_SLIDES.length);
    }, 2200);

    const p2Timer = setTimeout(() => setPhase(2), 2400);
    const p3Timer = setTimeout(() => {
      setPhase(3);
      setCanSkip(true);
    }, 5000);

    // 7 seconds minimum landing duration before auto-entry readiness
    const min7sTimer = setTimeout(() => {
      setCanSkip(true);
    }, 7000);

    return () => {
      clearInterval(slideInterval);
      clearTimeout(p2Timer);
      clearTimeout(p3Timer);
      clearTimeout(min7sTimer);
    };
  }, []);

  // Web Audio Synthetic Atmosphere & AI Voice
  const initAudio = () => {
    try {
      soundManager.init();
      soundManager.playClick(800);
      
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Sub-bass impact
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(130, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 1.8);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
        sub.connect(gain);
        gain.connect(ctx.destination);
        sub.start(now);
        sub.stop(now + 2.3);
      }

      // AI Voiceover synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Welcome to Hypercade. Play on TV, control with phone.");
        utterance.rate = 1.05;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const techVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')));
        if (techVoice) utterance.voice = techVoice;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col justify-between select-none overflow-hidden touch-none font-display">
      {/* ─── 1. VIDEO-LIKE 4-SLIDE CINEMATIC BACKGROUND (LANDING PAGE ONLY) ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="sync">
          <motion.div
            key={CINEMATIC_SLIDES[slideIndex]}
            initial={{ opacity: 0, scale: 1.12, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1.02, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-[0.72] contrast-125"
            style={{ backgroundImage: `url(${CINEMATIC_SLIDES[slideIndex]})` }}
          />
        </AnimatePresence>

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* ─── 2. TOP BAR ─── */}
      <header className="relative z-10 px-6 sm:px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center text-lg shadow-lg">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="font-arcade text-base font-black tracking-widest text-white">
              HYPER<span className="text-arcade-amber">CADE</span>
            </span>
            <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase">
              STUDIO MULTIPLAYER ENGINE
            </span>
          </div>
        </div>

        {/* Enter / Skip Action */}
        <button
          onClick={onEnter}
          className="group px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white backdrop-blur-xl transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
        >
          <span>ENTER HUB</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      {/* ─── 3. HERO CENTER CONTENT (PRO, SLEEK & MINIMAL) ─── */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-6 my-auto">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="p1"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-arcade-amber/15 border border-arcade-amber/30 text-arcade-amber font-mono text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                <span>NEXT-GEN LIVING ROOM MULTIPLAYER</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-tight">
                Play on <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber to-orange-400">TV</span>.<br />
                Control with <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-mint to-cyan-400">Phone</span>.
              </h1>

              <p className="text-sm sm:text-base text-white/70 max-w-lg mx-auto font-medium leading-relaxed">
                Zero app installs. Real-time 60 FPS authoritative sync. Scan room code to battle instantly.
              </p>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="p2"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-center gap-6">
                <div className="p-4 sm:p-5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-2xl flex items-center gap-3">
                  <Tv className="w-8 h-8 text-arcade-amber" />
                  <div className="text-left">
                    <div className="font-arcade text-xs text-white">HOST SCREEN</div>
                    <div className="font-mono text-[10px] text-white/50">60 FPS Authoritative Physics</div>
                  </div>
                </div>

                <div className="text-white/40 text-xl font-bold">+</div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-2xl flex items-center gap-3">
                  <Smartphone className="w-8 h-8 text-arcade-mint" />
                  <div className="text-left">
                    <div className="font-arcade text-xs text-white">PHONE GAMEPAD</div>
                    <div className="font-mono text-[10px] text-white/50">Tactile Low Latency Touch</div>
                  </div>
                </div>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                6 Dynamic Multiplayer Game Arenas
              </h2>
            </motion.div>
          )}

          {phase >= 3 && (
            <motion.div
              key="p3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <h2 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arcade-mint via-white to-arcade-cyan tracking-tight">
                Ready for Party Launch.
              </h2>
              <p className="font-mono text-xs sm:text-sm text-white/70 max-w-md mx-auto">
                Select host or join on your smartphone to enter the party arena.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Launch Button */}
        <div className="pt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              initAudio();
              onEnter();
            }}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-arcade-mint text-black font-arcade text-sm font-black tracking-wider shadow-[0_0_40px_rgba(255,178,36,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>ENTER ARCADE HUB</span>
          </button>
        </div>
      </main>

      {/* ─── 4. BOTTOM FOOTER ─── */}
      <footer className="relative z-10 px-6 sm:px-12 py-6 flex items-center justify-between border-t border-white/10 text-xs font-mono text-white/40">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-arcade-mint" />
          <span>WebRTC P2P &bull; 60 FPS Canvas</span>
        </div>

        {/* Slide indicators */}
        <div className="flex items-center gap-1.5">
          {CINEMATIC_SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                slideIndex === i ? 'w-6 bg-arcade-amber' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
};
