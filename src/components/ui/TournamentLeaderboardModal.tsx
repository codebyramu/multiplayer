import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { TournamentState, TournamentStanding } from '../../types';
import { GlassPanel } from './GlassPanel';
import { ArcadeButton } from './ArcadeButton';
import { Trophy, Crown, Play, RotateCcw, Home, Sparkles } from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

interface TournamentLeaderboardModalProps {
  state?: TournamentState;
  tournament?: TournamentState;
  isHost: boolean;
  onNextRound?: () => void;
  onNextMatch?: () => void;
  onRestartTournament?: () => void;
  onEndTournament?: () => void;
  onReturnToLobby?: () => void;
}

export const TournamentLeaderboardModal: React.FC<TournamentLeaderboardModalProps> = ({
  state,
  tournament,
  isHost,
  onNextRound,
  onNextMatch,
  onRestartTournament,
  onEndTournament,
  onReturnToLobby,
}) => {
  const activeTournament = state || tournament;
  if (!activeTournament) return null;

  const standings: TournamentStanding[] = [...(activeTournament.standings || [])].sort(
    (a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins
  );
  const isFinalChampion = activeTournament.isComplete;
  const champion = activeTournament.grandChampion || standings[0];
  const nextGame = activeTournament.gameSequence[activeTournament.currentRound] || activeTournament.gameSequence[0];

  const handleNext = onNextRound || onNextMatch || (() => {});
  const handleEnd = onRestartTournament || onEndTournament || onReturnToLobby || (() => {});
  const handleLobby = onReturnToLobby || onEndTournament || (() => {});

  useEffect(() => {
    if (isFinalChampion) {
      soundManager.playGrandCrownFanfare?.();
      confetti({
        particleCount: 250,
        spread: 120,
        origin: { y: 0.6 },
        colors: ['#FFB224', '#00F5A0', '#00E5FF', '#FF3366', '#9D4EDD'],
      });
    } else {
      soundManager.playPointTally?.(880);
    }
  }, [isFinalChampion]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-3xl my-auto"
      >
        <GlassPanel className="p-6 md:p-8 border-arcade-amber/50 shadow-glow-amber space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arcade-amber/20 border border-arcade-amber/40 text-arcade-amber text-xs font-mono">
              <Trophy className="w-4 h-4" />
              <span>
                {isFinalChampion
                  ? 'GRAND TOURNAMENT FINALE'
                  : `TOURNAMENT STANDINGS — ROUND ${activeTournament.currentRound} OF ${activeTournament.totalRounds}`}
              </span>
            </div>
            <h2 className="font-arcade text-2xl md:text-4xl text-arcade-cream">
              {isFinalChampion ? 'PARTY CHAMPION CROWNED' : 'CHAMPIONSHIP LEADERBOARD'}
            </h2>
            <p className="text-xs md:text-sm font-mono text-arcade-cream-muted">
              {isFinalChampion
                ? 'All rounds completed! The ultimate party master has emerged.'
                : '1st: 10 pts • 2nd: 7 pts • 3rd: 5 pts • 4th: 3 pts • 5th+: 1 pt'}
            </p>
          </div>

          {/* Grand Champion Spotlight (If Finished) */}
          {isFinalChampion && champion && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="p-6 rounded-2xl bg-gradient-to-br from-arcade-amber/30 via-arcade-surface to-arcade-surface border-2 border-arcade-amber shadow-glow-amber text-center space-y-3"
            >
              <div className="text-5xl animate-bounce">👑</div>
              <h3 className="font-arcade text-2xl md:text-3xl text-arcade-amber">
                {champion.name}
              </h3>
              <p className="font-mono text-sm text-arcade-cream">
                GRAND PARTY CHAMPION &bull; <strong className="text-arcade-mint">{champion.totalPoints} TOTAL PTS</strong>
              </p>
              <div className="flex items-center justify-center gap-6 text-xs font-mono text-white/80 pt-1">
                <span>🏆 WINS: {champion.wins}</span>
                <span>🔥 PODIUMS: {champion.podiums}</span>
              </div>
            </motion.div>
          )}

          {/* Standings Table */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {standings.map((p: TournamentStanding, idx: number) => (
              <div
                key={p.playerId || idx}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-mono ${
                  idx === 0
                    ? 'bg-arcade-amber/15 border-arcade-amber/50 shadow-glow-amber'
                    : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-arcade text-sm font-bold w-6 text-center">
                    {idx === 0 ? '👑' : `#${idx + 1}`}
                  </span>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <div>
                    <span className="font-display font-bold text-sm text-arcade-cream block">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-arcade-cream-muted">
                      {p.wins} match {p.wins === 1 ? 'win' : 'wins'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-arcade text-sm text-arcade-amber block">
                    {p.totalPoints} PTS
                  </span>
                  <span className="text-[10px] text-white/50">
                    Podiums: {p.podiums}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {isHost ? (
              <>
                {!isFinalChampion ? (
                  <ArcadeButton
                    variant="amber"
                    size="lg"
                    icon={<Play className="w-5 h-5 fill-current" />}
                    onClick={handleNext}
                  >
                    START ROUND {activeTournament.currentRound + 1} ({nextGame ? nextGame.toUpperCase() : 'NEXT'})
                  </ArcadeButton>
                ) : (
                  <ArcadeButton
                    variant="amber"
                    size="lg"
                    icon={<RotateCcw className="w-5 h-5" />}
                    onClick={handleEnd}
                  >
                    NEW TOURNAMENT
                  </ArcadeButton>
                )}
                <ArcadeButton
                  variant="neutral"
                  size="lg"
                  icon={<Home className="w-5 h-5" />}
                  onClick={handleLobby}
                >
                  RETURN TO LOBBY
                </ArcadeButton>
              </>
            ) : (
              <div className="text-center font-mono text-sm text-arcade-cream-muted animate-pulse">
                WAITING FOR HOST TO ADVANCE TOURNAMENT...
              </div>
            )}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
};
