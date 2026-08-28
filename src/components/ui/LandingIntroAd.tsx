import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';
import { ArrowRight, Volume2, Sparkles, ShieldCheck, Play, VolumeX, Maximize2 } from 'lucide-react';

interface LandingIntroAdProps {
  onEnter: () => void;
}

// Visual cue stages mapped to the 10-second Living Room Transforms Into Arcade MP4 video:
// 0.0s - 3.2s: Living room setup + Phones beaming neon data streams into TV (Serpent Arena)
// 3.2s - 5.8s: Relic Rush holographic combat & gem collisions
// 5.8s - 8.2s: Last Platform quantum hex crumbling & jump physics
// 8.2s - 10.0s: Hypercade Stadium finale with all contenders celebrating
const STORYBOARD_CUES = [
  {
    start: 0,
    end: 3.2,
    badge: 'STAGE 1: LIVING ROOM TAKEOVER',
    title: 'PLAY ON TV',
    subtitle: 'CONTROL WITH PHONE',
    desc: 'Zero app downloads. Phone gamepads connect directly via WebRTC P2P.',
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
  const [stage, setStage] = useState<'click_to_enter' | 'playing_video' | 'fading_out'>('click_to_enter');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play sub-bass boom & voice stinger
  const playAudioEffects = () => {
    try {
      soundManager.init();

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Cinematic sub-bass impact boom at 50% volume
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 2.0);
        gain.gain.setValueAtTime(0.50, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        sub.connect(gain);
        gain.connect(ctx.destination);
        sub.start(now);
        sub.stop(now + 2.5);
      }
    } catch {}
  };

  // Play high quality human-like neural studio voiceover as the main page fades in
  const playRealisticVoiceover = () => {
    if (isMuted) return;
    try {
      const voiceAudio = new Audio('/audio/voiceover_welcome.mp3');
      voiceAudio.volume = 0.85;
      voiceAudio.play().catch(() => {});
    } catch {}
  };

  // 1. Force Fullscreen and Start Video + 50% Audio
  const handleEnterAndCook = async () => {
    // Attempt fullscreen
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen().catch(() => {});
      }
    } catch {}

    setStage('playing_video');
    playAudioEffects();

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.volume = 0.50; // 50% audio volume
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    }

    // Fallback timer in case video finishes
    setTimeout(() => {
      handleFinish();
    }, 10500);
  };

  const handleFinish = () => {
    setStage('fading_out');
    playRealisticVoiceover(); // Triggers human neural studio voice as main page emerges
    setTimeout(() => {
      onEnter();
    }, 1200);
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
        videoRef.current.volume = 0.50;
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
      animate={{ opacity: stage === 'fading_out' ? 0 : 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[250] bg-[#040508] flex flex-col justify-between items-center select-none overflow-hidden touch-none font-display text-white"
    >
      {/* ─── 1. FULLSCREEN VIDEO ELEMENT ─── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          src="/landing_arcade.mp4"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleFinish}
          className={`w-full h-full object-cover filter contrast-115 brightness-95 transition-opacity duration-1000 ${
            stage === 'click_to_enter' ? 'opacity-25 filter blur-md scale-105' : 'opacity-90 scale-100'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/70 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
      </div>

      {/* ─── 2. CLICK-TO-ENTER PRESENTATION CARD (FULLSCREEN ACTIVATOR) ─── */}
      {stage === 'click_to_enter' && (
        <div className="relative z-30 flex flex-col items-center justify-center text-center p-4 sm:p-6 max-w-sm sm:max-w-md mx-auto space-y-6 my-auto w-full">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,245,160,0.3)_0%,rgba(157,78,221,0.2)_45%,transparent_75%)] animate-pulse pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 sm:p-8 rounded-3xl bg-black/80 border-2 border-white/20 backdrop-blur-3xl shadow-[0_0_90px_rgba(0,245,160,0.35)] space-y-6 relative overflow-hidden w-full"
          >
            <motion.div
              animate={{ rotate: [-3, 3, -3], scale: [1, 1.08, 1] }}
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
                LIVING ROOM MULTIPLAYER ARCADE
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleEnterAndCook}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-arcade-amber via-yellow-400 to-arcade-mint text-black font-arcade text-xs sm:text-sm font-black tracking-widest shadow-[0_0_40px_rgba(0,245,160,0.9)] flex items-center justify-center gap-2.5 border border-white/40 active:scale-95"
            >
              <Maximize2 className="w-4 h-4 stroke-[2.5]" />
              <span>ENTER EXPERIENCE ▶</span>
            </motion.button>

            <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-mono text-white/60">
              <Volume2 className="w-3.5 h-3.5 text-arcade-mint" />
              <span>50% AUDIO &bull; GOES FULLSCREEN &bull; 10S VIDEO</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── 3. VIDEO RUNNING: LIVE SYNCHRONIZED STORYBOARD CUES ─── */}
      {(stage === 'playing_video' || stage === 'fading_out') && (
        <div className="relative w-full h-full flex flex-col justify-between p-4 sm:p-10 z-20">
          {/* Top Bar with Controls */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-xl flex items-center justify-center text-lg shadow-lg">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-arcade text-sm sm:text-base font-black tracking-widest text-white">
                  HYPER<span className="text-arcade-amber">CADE</span>
                </span>
                <span className="font-mono text-[9px] text-white/60 tracking-widest uppercase">
                  LIVING ROOM ARCADE
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
                <span className="hidden sm:inline">{isMuted ? 'UNMUTE' : '50% AUDIO'}</span>
              </button>

              {/* Skip Intro */}
              <button
                onClick={handleFinish}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-mono text-white backdrop-blur-xl transition-all flex items-center gap-2 active:scale-95 shadow-md font-bold"
              >
                <span>SKIP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Center Storyboard Headline synced with Video Frame Action */}
          <main className="max-w-3xl mx-auto text-center space-y-4 sm:space-y-6 my-auto px-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCue.badge}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 1.04 }}
                transition={{ duration: 0.4 }}
                className="space-y-3 sm:space-y-4"
              >
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/70 border border-arcade-amber/60 text-arcade-amber font-mono text-[10px] sm:text-xs font-bold backdrop-blur-2xl shadow-xl">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeCue.badge}</span>
                </div>

                <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-[0_0_30px_rgba(0,0,0,0.95)]">
                  {activeCue.title}<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-arcade-amber via-yellow-300 to-arcade-mint">
                    {activeCue.subtitle}
                  </span>
                </h1>

                <p className="text-xs sm:text-sm md:text-base text-white max-w-lg mx-auto font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                  {activeCue.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      )}
    </motion.div>
  );
};
