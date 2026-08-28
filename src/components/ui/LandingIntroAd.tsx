import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { Sparkles, Tv, Smartphone, Play, ShieldCheck, ArrowRight, Volume2 } from 'lucide-react';

interface LandingIntroAdProps {
  onEnter: () => void;
}

// 4 Cinematic slides directly matching the storyboard narrative
const CINEMATIC_SLIDES = [
  {
    image: '/cinematics/slide_1.jpg',
    tag: 'NEXT-GEN MULTIPLAYER',
    title: 'PLAY ON TV',
    subtitle: 'CONTROL WITH PHONE',
    desc: 'Zero app downloads. 60 FPS authoritative sync. Scan to join instantly.',
  },
  {
    image: '/cinematics/slide_2.jpg',
    tag: 'PHONE CONTROLLER ARENA',
    title: '6 DYNAMIC ARCADE GAMES',
    subtitle: '1 TO 8 PLAYERS & BOTS',
    desc: 'Battle friends in high-speed racing, snake battle royales, and stealth flashlight heists.',
  },
  {
    image: '/cinematics/slide_3.jpg',
    tag: 'READY FOR LAUNCH',
    title: 'STEP INTO THE ARENA',
    subtitle: 'HYPERCADE STUDIO',
    desc: 'Entering arcade arena now...',
  },
];

export const LandingIntroAd: React.FC<LandingIntroAdProps> = ({ onEnter }) => {
  const [stage, setStage] = useState<'enter_screen' | 'playing_commercial' | 'fading_out'>('enter_screen');
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize atmosphere + AI Voice
  const startAudioAndVoice = () => {
    try {
      soundManager.init();
      soundManager.playClick(950);

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Sub-bass impact
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 1.8);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
        sub.connect(gain);
        gain.connect(ctx.destination);
        sub.start(now);
        sub.stop(now + 2.3);

        // Cyber harmonic chords
        setTimeout(() => {
          if (!audioContextRef.current) return;
          const c = audioContextRef.current;
          const t = c.currentTime;
          [220, 277.18, 329.63, 440].forEach((freq) => {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.4, t + 1.6);
            g.gain.setValueAtTime(0.12, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
            osc.connect(g);
            g.connect(c.destination);
            osc.start(t);
            osc.stop(t + 1.9);
          });
        }, 2600);
      }

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

  const handleStartLandingPresentation = () => {
    setStage('playing_commercial');
    startAudioAndVoice();
  };

  const finishAndFadeOut = () => {
    setStage('fading_out');
    setTimeout(() => {
      onEnter();
    }, 1200);
  };

  // Synchronized Slide Progression: Slide 0 (0-2.6s) -> Slide 1 (2.6-5.2s) -> Slide 2 (5.2-7.8s) -> Auto Exit
  useEffect(() => {
    if (stage !== 'playing_commercial') return;

    const s1Timer = setTimeout(() => setActiveSlide(1), 2600);
    const s2Timer = setTimeout(() => setActiveSlide(2), 5200);
    const autoFinishTimer = setTimeout(() => finishAndFadeOut(), 7800);

    return () => {
      clearTimeout(s1Timer);
      clearTimeout(s2Timer);
      clearTimeout(autoFinishTimer);
    };
  }, [stage]);

  const currentSlide = CINEMATIC_SLIDES[activeSlide];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: stage === 'fading_out' ? 0 : 1 }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
      className="fixed inset-0 z-[200] bg-[#040508] flex flex-col items-center justify-center select-none overflow-hidden touch-none font-display"
    >
      {/* ─── 1. CLICK TO ENTER INITIAL CARD ─── */}
      {stage === 'enter_screen' && (
        <div className="relative z-20 flex flex-col items-center justify-center text-center p-4 sm:p-6 max-w-md mx-auto space-y-6 w-full">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,160,0.18)_0%,rgba(157,78,221,0.12)_45%,transparent_75%)] animate-pulse pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="p-6 sm:p-8 rounded-3xl bg-black/70 border-2 border-white/15 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,245,160,0.25)] space-y-6 relative overflow-hidden w-full"
          >
            <motion.div
              animate={{ rotate: [-3, 3, -3], scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="text-5xl sm:text-6xl drop-shadow-[0_0_30px_rgba(255,178,36,0.9)]"
            >
              👑
            </motion.div>

            <div className="space-y-1.5">
              <h1 className="font-arcade text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-white to-arcade-mint tracking-wider">
                HYPERCADE
              </h1>
              <p className="font-mono text-[11px] sm:text-xs text-white/70 uppercase tracking-widest">
                LIVING ROOM MULTIPLAYER ARCADE
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartLandingPresentation}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-widest shadow-[0_0_35px_rgba(0,245,160,0.8)] flex items-center justify-center gap-2 border border-white/40 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>ENTER EXPERIENCE ▶</span>
            </motion.button>

            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-mono text-white/50">
              <Volume2 className="w-3.5 h-3.5 text-arcade-mint" />
              <span>TURN UP VOLUME &bull; 7-SEC INTRO</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── 2. PLAYING SYNCHRONIZED CINEMATIC STORYBOARD ─── */}
      {(stage === 'playing_commercial' || stage === 'fading_out') && (
        <div className="relative w-full h-full flex flex-col justify-between p-4 sm:p-12">
          {/* Background image animated & crossfaded strictly with current storyboard scene */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <AnimatePresence mode="sync">
              <motion.div
                key={currentSlide.image}
                initial={{ opacity: 0, scale: 1.15, filter: 'blur(12px)' }}
                animate={{ opacity: 1, scale: 1.02, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-[0.7] contrast-125"
                style={{ backgroundImage: `url(${currentSlide.image})` }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
          </div>

          {/* Top Bar with Skip Action */}
          <header className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center text-base sm:text-lg shadow-lg">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-arcade text-sm sm:text-base font-black tracking-widest text-white">
                  HYPER<span className="text-arcade-amber">CADE</span>
                </span>
                <span className="font-mono text-[8px] sm:text-[9px] text-white/50 tracking-widest uppercase">
                  ATMOSPHERIC MULTIPLAYER
                </span>
              </div>
            </div>

            <button
              onClick={finishAndFadeOut}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] sm:text-xs font-mono text-white/80 hover:text-white backdrop-blur-xl transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>SKIP</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </header>

          {/* Center Storyboard Text synced strictly with the Active Background */}
          <main className="relative z-10 max-w-3xl mx-auto text-center space-y-4 sm:space-y-6 my-auto px-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={`scene-${activeSlide}`}
                initial={{ opacity: 0, y: 25, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 1.05 }}
                transition={{ duration: 0.6 }}
                className="space-y-3 sm:space-y-4"
              >
                {/* Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arcade-amber/20 border border-arcade-amber/40 text-arcade-amber font-mono text-[10px] sm:text-xs font-bold backdrop-blur-md">
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{currentSlide.tag}</span>
                </div>

                {/* Animated Headline */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                  {currentSlide.title}<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                    {currentSlide.subtitle}
                  </span>
                </h1>

                {/* Description */}
                <p className="text-xs sm:text-sm md:text-base text-white/80 max-w-lg mx-auto font-medium leading-relaxed drop-shadow-md">
                  {currentSlide.desc}
                </p>

                {/* Dynamic device icons for slide 1 */}
                {activeSlide === 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-4 sm:gap-6 pt-2"
                  >
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl flex items-center gap-2.5">
                      <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-arcade-amber" />
                      <span className="font-arcade text-[10px] sm:text-xs text-white">TV HOST</span>
                    </div>
                    <span className="text-white/40 font-bold">+</span>
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl flex items-center gap-2.5">
                      <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-arcade-mint" />
                      <span className="font-arcade text-[10px] sm:text-xs text-white">PHONE GAMEPAD</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer Bar with Active Step Indicator */}
          <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] sm:text-xs font-mono text-white/40">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-arcade-mint" />
              <span>WebRTC Direct P2P</span>
            </div>

            <div className="flex items-center gap-1.5">
              {CINEMATIC_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    activeSlide === i ? 'w-6 bg-arcade-amber' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
          </footer>
        </div>
      )}
    </motion.div>
  );
};
