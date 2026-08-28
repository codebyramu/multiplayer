import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { Sparkles, Tv, Smartphone, Play, ShieldCheck, ArrowRight, Volume2 } from 'lucide-react';

interface LandingIntroAdProps {
  onEnter: () => void;
}

// 4 High-definition cinematic slides synced with the 3 storyboard scenes
const CINEMATIC_SLIDES = [
  '/cinematics/slide_1.jpg', // Scene 1: Neon Highway Cyber Intro
  '/cinematics/slide_2.jpg', // Scene 2: Big Screen TV meets Phone Arena
  '/cinematics/slide_3.jpg', // Scene 3: Shadow Vault & Backrooms Heist
  '/cinematics/slide_4.jpg', // Scene 3b: Quantum Hex Matrix Launch
];

export const LandingIntroAd: React.FC<LandingIntroAdProps> = ({ onEnter }) => {
  // Stage state: 'initial_enter_screen' -> 'playing_commercial' -> 'fading_out'
  const [stage, setStage] = useState<'enter_screen' | 'playing_commercial' | 'fading_out'>('enter_screen');
  const [phase, setPhase] = useState<number>(1);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synchronized Slide Index strictly matching the current storyboard scene phase
  const currentSlideImage =
    phase === 1
      ? CINEMATIC_SLIDES[0]
      : phase === 2
      ? CINEMATIC_SLIDES[1]
      : CINEMATIC_SLIDES[2];

  // Play Web Audio Chords & Natural AI Voice
  const startAudioAndVoice = () => {
    try {
      soundManager.init();
      soundManager.playClick(900);

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Cinematic deep sub-bass boom
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

        // Cyber harmonic synth riser at 2.4s (Scene 2 transition)
        setTimeout(() => {
          if (!audioContextRef.current) return;
          const c = audioContextRef.current;
          const t = c.currentTime;
          [220, 277.18, 329.63, 440].forEach((freq) => {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 1.6);
            g.gain.setValueAtTime(0.15, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
            osc.connect(g);
            g.connect(c.destination);
            osc.start(t);
            osc.stop(t + 1.9);
          });
        }, 2400);
      }

      // Natural AI Voiceover
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
    // Slow cinematic 1.2-second fade out to reveal main page
    setTimeout(() => {
      onEnter();
    }, 1200);
  };

  // Storyboard timing loop: Scene 1 (0.0s) -> Scene 2 (2.6s) -> Scene 3 (5.2s) -> Auto Fade-Out (7.8s)
  useEffect(() => {
    if (stage !== 'playing_commercial') return;

    const p2Timer = setTimeout(() => setPhase(2), 2600);
    const p3Timer = setTimeout(() => setPhase(3), 5200);

    // Full 7.8s commercial finishes -> automatically triggers slow cinematic fade out
    const autoFinishTimer = setTimeout(() => {
      finishAndFadeOut();
    }, 7800);

    return () => {
      clearTimeout(p2Timer);
      clearTimeout(p3Timer);
      clearTimeout(autoFinishTimer);
    };
  }, [stage]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: stage === 'fading_out' ? 0 : 1 }}
      transition={{ duration: 1.2, ease: 'easeInOut' }}
      className="fixed inset-0 z-[200] bg-[#040508] flex flex-col items-center justify-center select-none overflow-hidden touch-none font-display"
    >
      {/* ─── 1. INITIAL CLICK-TO-ENTER STAGE ─── */}
      {stage === 'enter_screen' && (
        <div className="relative z-20 flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto space-y-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,160,0.18)_0%,rgba(157,78,221,0.12)_45%,transparent_75%)] animate-pulse pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="p-8 rounded-3xl bg-black/60 border-2 border-white/15 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,245,160,0.25)] space-y-6 relative overflow-hidden"
          >
            <motion.div
              animate={{ rotate: [-3, 3, -3], scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="text-6xl drop-shadow-[0_0_30px_rgba(255,178,36,0.9)]"
            >
              👑
            </motion.div>

            <div className="space-y-2">
              <h1 className="font-arcade text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-white to-arcade-mint tracking-wider">
                HYPERCADE
              </h1>
              <p className="font-mono text-xs text-white/70 uppercase tracking-widest">
                LIVING ROOM MULTIPLAYER ARCADE
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.06, filter: 'brightness(1.15)' }}
              whileTap={{ scale: 0.94 }}
              onClick={handleStartLandingPresentation}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-arcade-mint text-black font-arcade text-sm font-black tracking-widest shadow-[0_0_35px_rgba(0,245,160,0.8)] flex items-center justify-center gap-3 active:scale-95 border border-white/40"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>ENTER EXPERIENCE ▶</span>
            </motion.button>

            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-white/50">
              <Volume2 className="w-3.5 h-3.5 text-arcade-mint" />
              <span>TURN UP VOLUME &bull; 7-SEC CINEMATIC INTRO</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── 2. PLAYING 7-SECOND VIDEO SLIDESHOW COMMERCIAL (SYNCED WITH ANIMATIONS) ─── */}
      {(stage === 'playing_commercial' || stage === 'fading_out') && (
        <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-12">
          {/* Background Image strictly synced with storyboard phase */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <AnimatePresence mode="sync">
              <motion.div
                key={currentSlideImage}
                initial={{ opacity: 0, scale: 1.15, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1.02, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-[0.75] contrast-125"
                style={{ backgroundImage: `url(${currentSlideImage})` }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
          </div>

          {/* Top Bar with Skip Action */}
          <header className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center text-lg shadow-lg">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-arcade text-base font-black tracking-widest text-white">
                  HYPER<span className="text-arcade-amber">CADE</span>
                </span>
                <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase">
                  ATMOSPHERIC MULTIPLAYER ENGINE
                </span>
              </div>
            </div>

            <button
              onClick={finishAndFadeOut}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/80 hover:text-white backdrop-blur-xl transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <span>SKIP INTRO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </header>

          {/* Center Storyboard Text synced with Background Imagery */}
          <main className="relative z-10 max-w-4xl mx-auto text-center space-y-6 my-auto">
            <AnimatePresence mode="wait">
              {/* SCENE 1: Neon Highway Headline */}
              {phase === 1 && (
                <motion.div
                  key="scene1"
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

              {/* SCENE 2: Big Screen TV + Phone Stadium */}
              {phase === 2 && (
                <motion.div
                  key="scene2"
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

              {/* SCENE 3: Shadow Vault & Quantum Arena Climax */}
              {phase >= 3 && (
                <motion.div
                  key="scene3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-6"
                >
                  <h2 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arcade-mint via-white to-arcade-cyan tracking-tight">
                    Ready for Party Launch.
                  </h2>
                  <p className="font-mono text-xs sm:text-sm text-white/70 max-w-md mx-auto">
                    Entering the Arcade Arena now...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Footer Bar */}
          <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-mono text-white/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-arcade-mint" />
              <span>WebRTC P2P &bull; 60 FPS Canvas</span>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    phase === step ? 'w-6 bg-arcade-amber' : 'w-1.5 bg-white/20'
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
