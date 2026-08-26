import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundManager } from '../../audio/SoundManager';

interface CountdownOverlayProps {
  durationSeconds?: number;
  onComplete: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
  durationSeconds = 3,
  onComplete,
}) => {
  const [count, setCount] = useState<number>(durationSeconds);
  const [isGo, setIsGo] = useState<boolean>(false);

  useEffect(() => {
    soundManager.playCountdownBeep(false);

    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsGo(true);
          soundManager.playCountdownBeep(true);
          setTimeout(() => {
            onComplete();
          }, 800);
          return 0;
        }
        soundManager.playCountdownBeep(false);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [durationSeconds, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg select-none">
      {/* Background Radial Atmosphere Glow */}
      <div className={`absolute w-[600px] h-[600px] rounded-full blur-[140px] transition-colors duration-500 pointer-events-none ${
        isGo ? 'bg-arcade-mint/30' : 'bg-arcade-amber/25'
      }`} />

      <AnimatePresence mode="wait">
        {!isGo ? (
          <motion.div
            key={count}
            initial={{ scale: 2.8, opacity: 0, filter: 'blur(12px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 0.3, opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 450, damping: 22 }}
            className="flex flex-col items-center justify-center text-center z-10"
          >
            <div className="relative flex items-center justify-center">
              <span className="font-arcade text-[10rem] sm:text-[13rem] md:text-[16rem] font-black text-arcade-amber leading-none drop-shadow-[0_0_60px_rgba(255,178,36,0.9)] select-none">
                {count}
              </span>
            </div>
            <div className="mt-6 px-6 py-2 rounded-full bg-arcade-amber/20 border-2 border-arcade-amber/40 shadow-glow-amber">
              <span className="font-mono font-black text-base sm:text-lg md:text-xl tracking-widest text-arcade-cream uppercase animate-pulse">
                [ GET READY &bull; CONTROLLERS LOCKED ]
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="go"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.9, 1.25, 1.1], opacity: 1 }}
            exit={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center text-center z-10"
          >
            <span className="font-arcade text-[8rem] sm:text-[11rem] md:text-[14rem] font-black text-arcade-mint leading-none drop-shadow-[0_0_80px_rgba(0,245,160,1)] select-none">
              LAUNCH!
            </span>
            <div className="mt-6 px-8 py-2.5 rounded-full bg-arcade-mint/25 border-2 border-arcade-mint/60 shadow-glow-mint">
              <span className="font-mono font-black text-lg sm:text-xl md:text-2xl tracking-widest text-white uppercase">
                BATTLE ARENA ENGAGED
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
