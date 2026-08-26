import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { MatchResults, TournamentState } from '../../types';
import { TournamentEngine } from '../../multiplayer/TournamentEngine';
import { ArcadeButton } from './ArcadeButton';
import { GlassPanel } from './GlassPanel';
import { Trophy, Medal, RotateCcw, Home, Sparkles, Zap, Bot, ArrowRight } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

interface PodiumModalProps {
  results: MatchResults;
  isHost: boolean;
  tournament?: TournamentState | null;
  onPlayAgain: () => void;
  onContinueTournament?: () => void;
  onReturnToLobby: () => void;
}

export const PodiumModal: React.FC<PodiumModalProps> = ({
  results,
  isHost,
  tournament,
  onPlayAgain,
  onContinueTournament,
  onReturnToLobby,
}) => {
  useEffect(() => {
    soundManager.playVictoryFanfare();

    // Trigger confetti explosion
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#FFB224', '#00F5A0', '#00E5FF'] });
    fire(0.2, { spread: 60, colors: ['#FF3366', '#9D4EDD', '#FFB224'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, colors: ['#00F5A0', '#00E5FF'] });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, []);

  const firstPlace = results.rankings[0];
  const secondPlace = results.rankings[1];
  const thirdPlace = results.rankings[2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg overflow-y-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-3xl my-auto"
      >
        <GlassPanel className="p-6 md:p-8 border-arcade-amber/40 shadow-glow-amber">
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arcade-amber/20 border border-arcade-amber/40 text-arcade-amber text-xs font-mono mb-2"
            >
              <Trophy className="w-4 h-4 text-arcade-amber" />
              <span>
                {tournament?.isActive
                  ? `PLAYLIST ARENA: GAME ${tournament.currentRound} OF ${tournament.totalRounds}`
                  : 'MATCH CONCLUDED'}
              </span>
            </motion.div>
            <h2 className="font-arcade text-2xl md:text-4xl text-arcade-cream drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              VICTORY PODIUM
            </h2>
            <p className="text-sm font-mono text-arcade-cream-muted mt-1">
              {tournament?.isActive
                ? `1st +10 pts • 2nd +7 pts • 3rd +5 pts • 4th +3 pts • 5th+ +1 pt`
                : 'Authoritative match summary & score distribution'}
            </p>
          </div>

          {/* Podium 3-Tier Display */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 items-end mb-8 pt-6">
            {/* 2nd Place */}
            {secondPlace ? (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-2 relative">
                  <Medal className="w-6 h-6 md:w-8 md:h-8 text-gray-300" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-400 text-black font-arcade text-[10px] flex items-center justify-center">
                    2
                  </span>
                </div>
                <span className="font-display font-bold text-xs md:text-sm text-arcade-cream truncate max-w-full text-center">
                  {secondPlace.name}
                </span>
                <span className="text-xs font-mono text-arcade-cyan">{secondPlace.score} PTS</span>
                {tournament?.isActive && (
                  <span className="text-[10px] font-mono text-arcade-mint font-bold">+7 TOURNAMENT PTS</span>
                )}
                <div className="w-full h-20 md:h-28 mt-2 rounded-t-xl bg-gradient-to-t from-gray-600/30 to-gray-500/10 border-t border-gray-400/40 flex items-center justify-center font-arcade text-xs text-gray-400">
                  2ND
                </div>
              </motion.div>
            ) : <div />}

            {/* 1st Place (Champion) */}
            {firstPlace && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="flex flex-col items-center z-10"
              >
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 flex items-center justify-center mb-2 relative shadow-glow-amber"
                  style={{
                    backgroundColor: `${firstPlace.color}25`,
                    borderColor: firstPlace.color,
                  }}
                >
                  <Trophy className="w-8 h-8 md:w-10 md:h-10 text-arcade-amber animate-pulse" />
                  <span className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-arcade-amber text-black font-arcade text-xs flex items-center justify-center shadow-md">
                    👑
                  </span>
                </div>
                <span className="font-display font-extrabold text-sm md:text-base text-arcade-amber truncate max-w-full text-center">
                  {firstPlace.name}
                </span>
                <span className="text-sm font-mono text-arcade-mint font-bold">{firstPlace.score} PTS</span>
                {tournament?.isActive && (
                  <span className="text-xs font-mono text-arcade-amber font-bold">+10 TOURNAMENT PTS</span>
                )}
                <div className="w-full h-28 md:h-36 mt-2 rounded-t-xl bg-gradient-to-t from-arcade-amber/40 to-arcade-amber/10 border-t-2 border-arcade-amber flex flex-col items-center justify-center font-arcade text-sm text-arcade-amber">
                  <span>CHAMPION</span>
                  <span className="text-[10px] font-mono text-white/80 mt-1">1ST PLACE</span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place */}
            {thirdPlace ? (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-amber-900/20 border border-amber-700/30 flex items-center justify-center mb-2 relative">
                  <Medal className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-700 text-white font-arcade text-[10px] flex items-center justify-center">
                    3
                  </span>
                </div>
                <span className="font-display font-bold text-xs md:text-sm text-arcade-cream truncate max-w-full text-center">
                  {thirdPlace.name}
                </span>
                <span className="text-xs font-mono text-arcade-crimson">{thirdPlace.score} PTS</span>
                {tournament?.isActive && (
                  <span className="text-[10px] font-mono text-arcade-mint font-bold">+5 TOURNAMENT PTS</span>
                )}
                <div className="w-full h-16 md:h-20 mt-2 rounded-t-xl bg-gradient-to-t from-amber-900/30 to-amber-800/10 border-t border-amber-700/40 flex items-center justify-center font-arcade text-xs text-amber-600">
                  3RD
                </div>
              </motion.div>
            ) : <div />}
          </div>

          {/* Full Rankings Table */}
          <div className="bg-black/40 rounded-xl p-3 mb-6 border border-white/10 max-h-48 overflow-y-auto">
            <div className="text-xs font-mono text-arcade-cream-muted uppercase mb-2 px-2 flex justify-between">
              <span>Pilot / Contender</span>
              <span>Score & Points</span>
            </div>
            <div className="space-y-1.5">
              {results.rankings.map((p, idx) => {
                const tourneyPts = TournamentEngine.getPointsForRank(p.rank || idx + 1);
                return (
                  <div
                    key={p.id || idx}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-arcade-cream-muted font-bold">#{idx + 1}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: p.color || '#00F5A0' }}
                      />
                      <span className="font-display font-medium text-arcade-cream">{p.name}</span>
                      {p.isBot && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/60">
                          <Bot className="w-2.5 h-2.5" /> AI
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {p.statSummary && <span className="text-white/40 text-[10px]">{p.statSummary}</span>}
                      <span className="text-arcade-amber font-bold">{p.score} PTS</span>
                      {tournament?.isActive && (
                        <span className="text-arcade-mint font-bold px-1.5 py-0.5 rounded bg-arcade-mint/15 text-[10px]">
                          +{tourneyPts} TOURNAMENT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MVP Showcase Banner */}
          {results.mvpStat && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="p-3 rounded-xl bg-arcade-amber/15 border border-arcade-amber/40 text-center mb-6 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-arcade-amber" />
              <span className="font-arcade text-xs text-arcade-amber tracking-wider">
                MVP: {results.mvpStat}
              </span>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isHost ? (
              <>
                {tournament?.isActive && onContinueTournament ? (
                  <ArcadeButton
                    variant="amber"
                    size="xl"
                    icon={<ArrowRight className="w-5 h-5" />}
                    onClick={onContinueTournament}
                    className="w-full sm:w-auto px-8"
                  >
                    NEXT PLAYLIST GAME (Game {tournament.currentRound} of {tournament.totalRounds}) &rarr;
                  </ArcadeButton>
                ) : (
                  <ArcadeButton
                    variant="amber"
                    size="lg"
                    icon={<RotateCcw className="w-5 h-5" />}
                    onClick={() => {
                      onPlayAgain();
                    }}
                  >
                    PLAY AGAIN
                  </ArcadeButton>
                )}
                <ArcadeButton
                  variant="neutral"
                  size="lg"
                  icon={<Home className="w-5 h-5" />}
                  onClick={() => {
                    onReturnToLobby();
                  }}
                >
                  RETURN TO LOBBY
                </ArcadeButton>
              </>
            ) : (
              <div className="text-center font-mono text-sm text-arcade-cream-muted animate-pulse">
                WAITING FOR HOST TO ADVANCE PLAYLIST...
              </div>
            )}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};
