import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { Play, ArrowRight, Volume2, Sparkles, Tv, Smartphone, ShieldCheck } from 'lucide-react';

interface LandingIntroAdProps {
  onEnter: () => void;
}

// Visual cue stages perfectly mapped to the 10-second Living Room Transforms Into Arcade MP4 video:
// 0.0s - 3.2s: Living room setup + Phones beaming neon data streams into TV (Serpent Arena)
// 3.2s - 5.8s: Relic Rush holographic combat & gem collisions
// 5.8s - 8.2s: Last Platform quantum hex crumbling & jump physics
// 8.2s - 10.0s: Hypercade Stadium finale with all contenders on couch celebrating
const STORYBOARD_CUES = [
  {
    start: 0,
    end: 3.2,
    badge: 'STAGE 1: LIVING ROOM TAKEOVER',
    title: 'PLAY ON TV',
    subtitle: 'CONTROL WITH PHONE',
    desc: 'Zero app downloads. Point streams connect instantly via WebRTC P2P.',
  },
  {
    start: 3.2,
    end: 5.8,
    badge: 'STAGE 2: RELIC RUSH & SERPENT ARENA',
    title: '6 REAL-TIME ARENAS',
    subtitle: '1 TO 8 PLAYERS & SMART AI',
    desc: 'Kinetic dash collisions, gem bursts, and 60 FPS authoritative arcade physics.',
  },
  {
    start: 5.8,
    end: 8.2,
    badge: 'STAGE 3: LAST PLATFORM MATRIX',
    title: 'COLLAPSING HEX TILES',
    subtitle: 'SURVIVE OR PLUNGE',
    desc: '3D jumps, freeze shot projectiles, and sudden death shockwaves.',
  },
  {
    start: 8.2,
    end: 10.2,
    badge: 'STAGE 4: HYPERCADE CHAMPIONSHIP',
    title: 'READY FOR LAUNCH',
    subtitle: 'STEP INTO THE ARENA',
    desc: 'Entering arcade hub now...',
  },
];

export const LandingIntroAd: React.FC<LandingIntroAdProps> = ({ onEnter }) => {
  const [stage, setStage] = useState<'enter_screen' | 'playing_video' | 'fading_out'>('enter_screen');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize Sub-Bass Boom & Natural Voice
  const startAudio = () => {
    try {
      soundManager.init();
      soundManager.playClick(1000);

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Cinematic sub-bass boom
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 2.0);
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        sub.connect(gain);
        gain.connect(ctx.destination);
        sub.start(now);
        sub.stop(now + 2.5);
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

  const handleStartExperience = () => {
    setStage('playing_video');
    startAudio();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const finishAndFadeOut = () => {
    setStage('fading_out');
    setTimeout(() => {
      onEnter();
    }, 1000);
  };

  // Video time tracking
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Current active cue based on video timestamp
  const activeCue = STORYBOARD_CUES.find(
    (c) => currentTime >= c.start && currentTime < c.end
  ) || STORYBOARD_CUES[STORYBOARD_CUES.length - 1];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: stage === 'fading_out' ? 0 : 1 }}
      transition={{ duration: 1.0, ease: 'easeInOut' }}
      className="fixed inset-0 z-[250] bg-[#040508] flex flex-col items-center justify-center select-none overflow-hidden touch-none font-display text-white"
    >
      {/* ─── BACKGROUND MP4 VIDEO PLAYER ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          src="/landing_arcade.mp4"
          playsInline
          muted={false}
          onTimeUpdate={handleTimeUpdate}
          onEnded={finishAndFadeOut}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${
            stage === 'enter_screen' ? 'opacity-35 scale-105 filter blur-sm' : 'opacity-90 scale-100'
          }`}
        />
        {/* Cinematic Vignette Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/70 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />
      </div>

      {/* ─── STAGE 1: INITIAL CLICK-TO-ENTER PRESENTATION CARD ─── */}
      {stage === 'enter_screen' && (
        <div className="relative z-20 flex flex-col items-center justify-center text-center p-4 sm:p-6 max-w-sm sm:max-w-md mx-auto space-y-6 w-full">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,160,0.25)_0%,rgba(157,78,221,0.15)_45%,transparent_75%)] animate-pulse pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 sm:p-8 rounded-3xl bg-black/75 border-2 border-white/15 backdrop-blur-2xl shadow-[0_0_90px_rgba(0,245,160,0.3)] space-y-5 relative overflow-hidden w-full"
          >
            <motion.div
              animate={{ rotate: [-3, 3, -3], scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="text-5xl sm:text-6xl drop-shadow-[0_0_35px_rgba(255,178,36,0.95)]"
            >
              👑
            </motion.div>

            <div className="space-y-1.5">
              <h1 className="font-arcade text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-white to-arcade-mint tracking-wider">
                HYPERCADE
              </h1>
              <p className="font-mono text-[11px] sm:text-xs text-white/70 uppercase tracking-widest">
                LIVING ROOM TRANSFORMS INTO ARCADE
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleStartExperience}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-widest shadow-[0_0_35px_rgba(0,245,160,0.8)] flex items-center justify-center gap-2 border border-white/40 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>WATCH TRANSFORMATION ▶</span>
            </motion.button>

            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-mono text-white/60">
              <Volume2 className="w-3.5 h-3.5 text-arcade-mint" />
              <span>10-SEC CINEMATIC VIDEO &bull; SOUND ON</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── STAGE 2: LIVE VIDEO SYNCHRONIZED HUD & STORYBOARD TEXT ─── */}
      {(stage === 'playing_video' || stage === 'fading_out') && (
        <div className="relative w-full h-full flex flex-col justify-between p-4 sm:p-10 z-10">
          {/* Top Bar with Skip Action */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center text-lg shadow-lg">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-arcade text-sm sm:text-base font-black tracking-widest text-white">
                  HYPER<span className="text-arcade-amber">CADE</span>
                </span>
                <span className="font-mono text-[9px] text-white/50 tracking-widest uppercase">
                  LIVING ROOM ARCADE
                </span>
              </div>
            </div>

            <button
              onClick={finishAndFadeOut}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/90 hover:text-white backdrop-blur-xl transition-all flex items-center gap-2 active:scale-95 shadow-md"
            >
              <span>ENTER HUB</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </header>

          {/* Center Storyboard Headline synced with Video Frame Action */}
          <main className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6 my-auto px-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCue.badge}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 1.04 }}
                transition={{ duration: 0.45 }}
                className="space-y-3 sm:space-y-4"
              >
                {/* Cyber Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/60 border border-arcade-amber/50 text-arcade-amber font-mono text-[10px] sm:text-xs font-bold backdrop-blur-xl shadow-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeCue.badge}</span>
                </div>

                {/* Animated Headline */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]">
                  {activeCue.title}<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                    {activeCue.subtitle}
                  </span>
                </h1>

                {/* Description */}
                <p className="text-xs sm:text-sm md:text-base text-white/90 max-w-lg mx-auto font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                  {activeCue.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Bottom Progress Bar */}
          <footer className="flex items-center justify-between border-t border-white/10 pt-3 text-xs font-mono text-white/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-arcade-mint" />
              <span>WebRTC Direct Phone Controller</span>
            </div>

            {/* Video Progress Bar */}
            <div className="w-32 sm:w-48 h-1.5 rounded-full bg-white/20 overflow-hidden relative">
              <motion.div
                style={{ width: `${(currentTime / 10.0) * 100}%` }}
                className="h-full bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint transition-all"
              />
            </div>
          </footer>
        </div>
      )}
    </motion.div>
  );
};
