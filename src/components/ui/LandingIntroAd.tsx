import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { ArrowRight, Volume2, Sparkles, Tv, Smartphone, ShieldCheck, Play, VolumeX } from 'lucide-react';

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
    end: 10.5,
    badge: 'STAGE 4: HYPERCADE CHAMPIONSHIP',
    title: 'READY FOR LAUNCH',
    subtitle: 'STEP INTO THE ARENA',
    desc: 'Entering arcade hub now...',
  },
];

export const LandingIntroAd: React.FC<LandingIntroAdProps> = ({ onEnter }) => {
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play audio synthesizer & voice
  const playAudioEffects = () => {
    try {
      soundManager.init();

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

  // Autoplay video immediately on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            playAudioEffects();
          })
          .catch(() => {
            // Browser autoplay restrictions: mute to force immediate play
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(() => {});
            }
          });
      }
    }

    // Safety timeout: transition after 10.5s if video finishes or stalls
    const timeout = setTimeout(() => {
      handleFinish();
    }, 10500);

    return () => clearTimeout(timeout);
  }, []);

  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onEnter();
    }, 1000);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !videoRef.current.muted;
      videoRef.current.muted = next;
      setIsMuted(next);
      if (!next) {
        playAudioEffects();
      }
    }
  };

  // Active cue based on real-time video timestamp
  const activeCue = STORYBOARD_CUES.find(
    (c) => currentTime >= c.start && currentTime < c.end
  ) || STORYBOARD_CUES[STORYBOARD_CUES.length - 1];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      transition={{ duration: 1.0, ease: 'easeInOut' }}
      className="fixed inset-0 z-[250] bg-[#040508] flex flex-col justify-between select-none overflow-hidden touch-none font-display text-white"
    >
      {/* ─── 1. FULLSCREEN AUTOPLAY MP4 VIDEO ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          src="/landing_arcade.mp4"
          autoPlay
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleFinish}
          className="w-full h-full object-cover filter contrast-115 brightness-95"
        />
        {/* Cinematic Vignette Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/70 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
      </div>

      {/* ─── 2. TOP BRANDING & CONTROLS ─── */}
      <header className="relative z-20 flex items-center justify-between p-4 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xl flex items-center justify-center text-lg shadow-lg">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="font-arcade text-sm sm:text-base font-black tracking-widest text-white">
              HYPER<span className="text-arcade-amber">CADE</span>
            </span>
            <span className="font-mono text-[9px] text-white/60 tracking-widest uppercase">
              LIVING ROOM TRANSFORMS INTO ARCADE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Unmute / Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-mono text-white/90 backdrop-blur-xl transition-all flex items-center gap-1.5"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-arcade-crimson" /> : <Volume2 className="w-4 h-4 text-arcade-mint" />}
            <span className="hidden sm:inline">{isMuted ? 'UNMUTE' : 'SOUND ON'}</span>
          </button>

          {/* Skip Intro */}
          <button
            onClick={handleFinish}
            className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-mono text-white backdrop-blur-xl transition-all flex items-center gap-2 active:scale-95 shadow-md font-bold"
          >
            <span>SKIP INTRO</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ─── 3. LIVE SYNCHRONIZED STORYBOARD CUES & HEADLINES ─── */}
      <main className="relative z-20 max-w-3xl mx-auto text-center space-y-4 sm:space-y-6 my-auto px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCue.badge}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 1.04 }}
            transition={{ duration: 0.4 }}
            className="space-y-3 sm:space-y-4"
          >
            {/* Cyber Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/70 border border-arcade-amber/60 text-arcade-amber font-mono text-[10px] sm:text-xs font-bold backdrop-blur-2xl shadow-xl">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{activeCue.badge}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-[0_0_30px_rgba(0,0,0,0.95)]">
              {activeCue.title}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                {activeCue.subtitle}
              </span>
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm md:text-base text-white max-w-lg mx-auto font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              {activeCue.desc}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ─── 4. BOTTOM VIDEO PROGRESS BAR ─── */}
      <footer className="relative z-20 flex items-center justify-between p-4 sm:p-8 border-t border-white/10 text-xs font-mono text-white/60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-arcade-mint" />
          <span>WebRTC Direct Phone Controller</span>
        </div>

        {/* Dynamic Video Progress Indicator */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/50">
            {Math.floor(currentTime)}s / 10s
          </span>
          <div className="w-32 sm:w-48 h-1.5 rounded-full bg-white/20 overflow-hidden relative">
            <motion.div
              style={{ width: `${Math.min(100, (currentTime / 10.0) * 100)}%` }}
              className="h-full bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint transition-all"
            />
          </div>
        </div>
      </footer>
    </motion.div>
  );
};
