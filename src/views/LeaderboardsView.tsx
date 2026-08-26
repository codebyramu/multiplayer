import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Trophy, Medal, Crown, Sparkles, Filter, Zap, Disc, Radio, Layers } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  color: string;
  game: string;
  score: number;
  metric: string;
  date: string;
}

const SAMPLE_LEADERBOARDS: Record<string, LeaderboardEntry[]> = {
  all: [
    { rank: 1, name: 'ViperX', avatar: '👑', color: '#00F5A0', game: 'Serpent Arena', score: 14850, metric: 'Length: 320 segs', date: '2 mins ago' },
    { rank: 2, name: 'CyberVolt', avatar: '⚡', color: '#00E5FF', game: 'Neon Relay', score: 12400, metric: 'Lap Time: 28.4s', date: '10 mins ago' },
    { rank: 3, name: 'VoidWalker', avatar: '👻', color: '#9D4EDD', game: 'Void Tag', score: 9800, metric: 'Surv Time: 88s', date: '1 hour ago' },
    { rank: 4, name: 'RelicHoarder', avatar: '💎', color: '#FFB224', game: 'Relic Rush', score: 8750, metric: 'Gems: 42 Cores', date: '2 hours ago' },
    { rank: 5, name: 'PlatformKing', avatar: '🔥', color: '#FF3366', game: 'Last Platform', score: 7600, metric: 'Elims: 7 Shoves', date: '3 hours ago' },
    { rank: 6, name: 'GlitchHunter', avatar: '🤖', color: '#FF7700', game: 'Serpent Arena', score: 6900, metric: 'Length: 195 segs', date: 'Yesterday' },
  ],
  'serpent-arena': [
    { rank: 1, name: 'ViperX', avatar: '👑', color: '#00F5A0', game: 'Serpent Arena', score: 14850, metric: 'Length: 320 segs', date: '2 mins ago' },
    { rank: 2, name: 'GlitchHunter', avatar: '🤖', color: '#FF7700', game: 'Serpent Arena', score: 6900, metric: 'Length: 195 segs', date: 'Yesterday' },
    { rank: 3, name: 'SolarDrake', avatar: '🔥', color: '#FFB224', game: 'Serpent Arena', score: 6100, metric: 'Length: 170 segs', date: '2 days ago' },
  ],
  'neon-relay': [
    { rank: 1, name: 'CyberVolt', avatar: '⚡', color: '#00E5FF', game: 'Neon Relay', score: 12400, metric: 'Lap Time: 28.4s', date: '10 mins ago' },
    { rank: 2, name: 'DriftMaster', avatar: '🚀', color: '#00F5A0', game: 'Neon Relay', score: 9300, metric: 'Lap Time: 31.1s', date: 'Yesterday' },
  ],
  'void-tag': [
    { rank: 1, name: 'VoidWalker', avatar: '👻', color: '#9D4EDD', game: 'Void Tag', score: 9800, metric: 'Surv Time: 88s', date: '1 hour ago' },
    { rank: 2, name: 'PhaseShifter', avatar: '👾', color: '#00E5FF', game: 'Void Tag', score: 8200, metric: 'Surv Time: 74s', date: 'Yesterday' },
  ],
  'relic-rush': [
    { rank: 1, name: 'RelicHoarder', avatar: '💎', color: '#FFB224', game: 'Relic Rush', score: 8750, metric: 'Gems: 42 Cores', date: '2 hours ago' },
  ],
  'last-platform': [
    { rank: 1, name: 'PlatformKing', avatar: '🔥', color: '#FF3366', game: 'Last Platform', score: 7600, metric: 'Elims: 7 Shoves', date: '3 hours ago' },
  ],
};

export const LeaderboardsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'OVERALL ARCADE' },
    { id: 'serpent-arena', label: 'SERPENT ARENA' },
    { id: 'neon-relay', label: 'NEON RELAY' },
    { id: 'void-tag', label: 'VOID TAG' },
    { id: 'relic-rush', label: 'RELIC RUSH' },
    { id: 'last-platform', label: 'LAST PLATFORM' },
  ];

  const entries = SAMPLE_LEADERBOARDS[selectedCategory] || SAMPLE_LEADERBOARDS.all;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-arcade-amber/15 border border-arcade-amber/30 text-arcade-amber text-xs font-mono">
          <Trophy className="w-3.5 h-3.5" />
          <span>HALL OF CHAMPIONS</span>
        </div>
        <h2 className="font-arcade text-2xl sm:text-4xl text-arcade-cream">
          ARCADE LEADERBOARD
        </h2>
        <p className="text-xs sm:text-sm font-mono text-arcade-cream-muted">
          Global high scores, fastest circuit times, and legendary serpent records
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              soundManager.playClick(900);
              setSelectedCategory(cat.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-all ${
              selectedCategory === cat.id
                ? 'bg-arcade-amber text-black font-bold shadow-glow-amber'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <GlassPanel className="p-4 sm:p-6 border-white/10">
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const isTop3 = entry.rank <= 3;
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all ${
                  entry.rank === 1
                    ? 'bg-arcade-amber/10 border-arcade-amber/40 shadow-glow-amber'
                    : entry.rank === 2
                    ? 'bg-white/10 border-gray-400/30'
                    : entry.rank === 3
                    ? 'bg-amber-900/10 border-amber-700/30'
                    : 'bg-white/5 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Left: Rank & Avatar & Name */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-8 flex items-center justify-center font-arcade text-sm">
                    {entry.rank === 1 ? (
                      <Crown className="w-5 h-5 text-arcade-amber fill-arcade-amber" />
                    ) : entry.rank === 2 ? (
                      <span className="text-gray-300 font-bold">#2</span>
                    ) : entry.rank === 3 ? (
                      <span className="text-amber-600 font-bold">#3</span>
                    ) : (
                      <span className="text-white/40 font-mono text-xs">#{entry.rank}</span>
                    )}
                  </div>

                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border border-white/10"
                    style={{ backgroundColor: `${entry.color}20`, borderColor: entry.color }}
                  >
                    {entry.avatar}
                  </div>

                  <div>
                    <span className="font-display font-bold text-sm sm:text-base text-arcade-cream block">
                      {entry.name}
                    </span>
                    <span className="text-[10px] font-mono text-arcade-cream-muted">
                      {entry.game} &bull; {entry.date}
                    </span>
                  </div>
                </div>

                {/* Right: Score & Metric */}
                <div className="text-right">
                  <span className="font-arcade text-sm sm:text-base text-arcade-amber block">
                    {entry.score.toLocaleString()} PTS
                  </span>
                  <span className="text-[10px] font-mono text-arcade-mint font-semibold">
                    {entry.metric}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
};
