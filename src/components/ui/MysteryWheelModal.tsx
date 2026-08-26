import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameId } from '../../types';
import { GAMES_DATA } from '../../data/games';
import { GlassPanel } from './GlassPanel';
import { ArcadeButton } from './ArcadeButton';
import { soundManager } from '../../audio/SoundManager';
import { Dna, Disc, Zap, Radio, Sparkles, Layers, Check, RefreshCw, X, Award } from 'lucide-react';

interface MysteryWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (gameId: GameId) => void;
}

const WHEEL_GAMES: GameId[] = [
  'neon-relay',
  'void-tag',
  'relic-rush',
  'last-platform',
  'serpent-arena',
];

const GAME_ICONS: Record<GameId, React.ReactNode> = {
  'neon-relay': <Zap className="w-5 h-5" />,
  'void-tag': <Radio className="w-5 h-5" />,
  'relic-rush': <Sparkles className="w-5 h-5" />,
  'last-platform': <Layers className="w-5 h-5" />,
  'serpent-arena': <Disc className="w-5 h-5" />,
};

export const MysteryWheelModal: React.FC<MysteryWheelModalProps> = ({
  isOpen,
  onClose,
  onSelectGame,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const [rotation, setRotation] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const spinIntervalRef = useRef<any>(null);

  const numSlices = WHEEL_GAMES.length;
  const sliceAngle = 360 / numSlices; // 72 deg per game

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  const spinWheel = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setSelectedGame(null);
    soundManager.playClick(1000);

    // Random target slice (0 to 4)
    const targetSliceIndex = Math.floor(Math.random() * numSlices);
    const targetGame = WHEEL_GAMES[targetSliceIndex];

    // Extra spins (5-8 full rotations) + target angle offset
    // Pointer is at the top (270 deg / -90 deg or 0 deg depending on orientation)
    // We adjust so slice aligns with top indicator
    const extraRotations = 5 + Math.floor(Math.random() * 4);
    const targetAngle = 360 * extraRotations + (numSlices - targetSliceIndex) * sliceAngle - sliceAngle / 2;

    const startRotation = rotation % 360;
    const finalRotation = startRotation + targetAngle;

    setRotation(finalRotation);

    // Audio ticking simulation during spin
    let currentAngle = startRotation;
    const durationMs = 3800;
    const startTime = performance.now();

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      currentAngle = startRotation + targetAngle * easeProgress;

      const normAngle = ((currentAngle % 360) + 360) % 360;
      const activeIdx = Math.floor((360 - normAngle + sliceAngle / 2) / sliceAngle) % numSlices;
      setHighlightedIndex(activeIdx);

      // Play tick sound with pitch modulating
      soundManager.playWheelTick(900 + activeIdx * 60);

      if (progress >= 1) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
        setIsSpinning(false);
        setSelectedGame(targetGame);
        soundManager.playWheelWinner();
      }
    }, 90);
  };

  if (!isOpen) return null;

  const activeMeta = selectedGame ? GAMES_DATA[selectedGame] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-xl"
      >
        <GlassPanel className="p-6 md:p-8 border-arcade-cyan/40 shadow-glow-cyan text-center relative overflow-hidden">
          {/* Close Button */}
          <button
            onClick={onClose}
            disabled={isSpinning}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-6 space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arcade-cyan/15 border border-arcade-cyan/30 text-arcade-cyan text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>RANDOM ARENA SELECTOR</span>
            </div>
            <h2 className="font-arcade text-2xl md:text-3xl text-arcade-cream tracking-wide">
              MYSTERY WHEEL
            </h2>
            <p className="text-xs font-mono text-arcade-cream-muted">
              Spin to select a randomized battlefield for this showdown
            </p>
          </div>

          {/* Center Wheel Container */}
          <div className="relative w-64 h-64 mx-auto my-6 flex items-center justify-center">
            {/* Pointer / Marker at Top */}
            <div className="absolute -top-3 z-30 flex flex-col items-center">
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-arcade-amber drop-shadow-[0_0_12px_rgba(255,178,36,0.9)]" />
            </div>

            {/* Glowing Outer Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-arcade-cyan/30 shadow-[0_0_30px_rgba(0,229,255,0.25)] pointer-events-none" />

            {/* Rotating SVG Wheel */}
            <motion.div
              animate={{ rotate: rotation }}
              transition={{
                duration: isSpinning ? 3.8 : 0,
                ease: [0.15, 0.9, 0.25, 1], // Realistic roulette friction decel
              }}
              className="w-full h-full rounded-full overflow-hidden shadow-2xl relative"
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {WHEEL_GAMES.map((gameId, idx) => {
                  const meta = GAMES_DATA[gameId];
                  const startA = (idx * sliceAngle * Math.PI) / 180;
                  const endA = ((idx + 1) * sliceAngle * Math.PI) / 180;
                  const midA = ((idx + 0.5) * sliceAngle * Math.PI) / 180;

                  const x1 = 100 + 100 * Math.cos(startA);
                  const y1 = 100 + 100 * Math.sin(startA);
                  const x2 = 100 + 100 * Math.cos(endA);
                  const y2 = 100 + 100 * Math.sin(endA);

                  const path = `M 100 100 L ${x1} ${y1} A 100 100 0 0 1 ${x2} ${y2} Z`;
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <g key={gameId}>
                      <path
                        d={path}
                        fill={meta.accentHex}
                        fillOpacity={isHighlighted ? 0.85 : 0.45}
                        stroke="#0d1117"
                        strokeWidth="2"
                      />
                      {/* Text & Icon in Slice */}
                      <text
                        x={100 + 62 * Math.cos(midA)}
                        y={100 + 62 * Math.sin(midA)}
                        fill="#FFFFFF"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${(midA * 180) / Math.PI + 90}, ${
                          100 + 62 * Math.cos(midA)
                        }, ${100 + 62 * Math.sin(midA)})`}
                      >
                        {meta.title.split(' ')[0]}
                      </text>
                    </g>
                  );
                })}
                {/* Center Hub */}
                <circle cx="100" cy="100" r="28" fill="#121824" stroke="#00E5FF" strokeWidth="3" />
              </svg>
            </motion.div>

            {/* Center Spin Action Button */}
            <button
              onClick={spinWheel}
              disabled={isSpinning}
              className="absolute z-20 w-16 h-16 rounded-full bg-arcade-cyan text-black font-arcade text-xs font-black shadow-glow-cyan hover:scale-105 active:scale-95 transition-transform flex flex-col items-center justify-center disabled:opacity-50"
            >
              {isSpinning ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>SPIN</span>
                  <span className="text-[8px] font-mono">🎲</span>
                </>
              )}
            </button>
          </div>

          {/* Selected Game Details or Spin Prompt */}
          <div className="min-h-[90px] flex flex-col items-center justify-center">
            {selectedGame && activeMeta ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-3 rounded-2xl bg-white/5 border border-arcade-amber/40 w-full text-center space-y-1 shadow-glow-amber"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-arcade-amber font-arcade text-base md:text-lg">
                    🎯 LANDED ON: {activeMeta.title}
                  </span>
                </div>
                <p className="text-xs font-mono text-arcade-cream-muted">
                  {activeMeta.category} &bull; {activeMeta.durationLabel}
                </p>
              </motion.div>
            ) : (
              <p className="text-xs font-mono text-arcade-cream-muted">
                {isSpinning
                  ? 'SELECTING RANDOM ARENA...'
                  : 'Hit SPIN to let the mystery wheel pick your match!'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <ArcadeButton
              variant="neutral"
              size="md"
              onClick={onClose}
              disabled={isSpinning}
            >
              CANCEL
            </ArcadeButton>

            {selectedGame ? (
              <ArcadeButton
                variant="amber"
                size="md"
                icon={<Check className="w-4 h-4" />}
                onClick={() => {
                  onSelectGame(selectedGame);
                  onClose();
                }}
              >
                PLAY {GAMES_DATA[selectedGame]?.title}
              </ArcadeButton>
            ) : (
              <ArcadeButton
                variant="cyan"
                size="md"
                icon={<RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />}
                onClick={spinWheel}
                disabled={isSpinning}
              >
                {isSpinning ? 'SPINNING...' : 'SPIN WHEEL'}
              </ArcadeButton>
            )}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};
