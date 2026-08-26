import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { AvatarSelector } from '../components/ui/AvatarSelector';
import { 
  User, Award, Zap, Trophy, Shield, Flame, Sparkles, CheckCircle2, RotateCcw, Lock
} from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  game: string;
}

export const ProfileView: React.FC = () => {
  const [name, setName] = useState('ArcadePilot');
  const [avatar, setAvatar] = useState('ship');
  const [color, setColor] = useState('#00F5A0');
  const [skin, setSkin] = useState('synth');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const sName = localStorage.getItem('hypercade_pilot_name');
      if (sName) setName(sName);
      const sAv = localStorage.getItem('hypercade_avatar');
      if (sAv) setAvatar(sAv);
      const sCol = localStorage.getItem('hypercade_color');
      if (sCol) setColor(sCol);
    } catch {}
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem('hypercade_pilot_name', name);
      localStorage.setItem('hypercade_avatar', avatar);
      localStorage.setItem('hypercade_color', color);
    } catch {}
    soundManager.playVictoryFanfare();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_win', title: 'First Blood', desc: 'Achieve your first victory in any arcade arena', icon: '🏆', unlocked: true, game: 'General' },
    { id: 'giant_serpent', title: 'Apex Leviathan', desc: 'Reach 200+ body segments in Serpent Arena', icon: '🐍', unlocked: true, game: 'Serpent Arena' },
    { id: 'speed_demon', title: 'Sonic Drift', desc: 'Complete 3 laps in Neon Relay under 30 seconds', icon: '⚡', unlocked: true, game: 'Neon Relay' },
    { id: 'lone_survivor', title: 'Untagged Phantom', desc: 'Survive an entire match of Void Tag without infection', icon: '👻', unlocked: false, game: 'Void Tag' },
    { id: 'vault_thief', title: 'Mythic Hoarder', desc: 'Steal 50+ relic points from opponents in a single tackle', icon: '💎', unlocked: true, game: 'Relic Rush' },
    { id: 'platform_master', title: 'Airborn King', desc: 'Win Last Platform as the final single tile collapses', icon: '🔥', unlocked: false, game: 'Last Platform' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2"
            style={{ backgroundColor: `${color}20`, borderColor: color }}
          >
            🎮
          </div>
          <div>
            <span className="text-[10px] font-mono text-arcade-mint uppercase px-2 py-0.5 rounded bg-arcade-mint/20 border border-arcade-mint/30">
              PILOT DOSSIER
            </span>
            <h2 className="font-arcade text-xl sm:text-2xl text-arcade-cream mt-1">{name}</h2>
            <p className="text-xs font-mono text-arcade-cream-muted">RANK: ARCADE VETERAN &bull; LEVEL 24</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ArcadeButton
            variant="mint"
            size="md"
            icon={<CheckCircle2 className="w-4 h-4" />}
            onClick={handleSave}
          >
            {savedSuccess ? 'SAVED!' : 'SAVE PILOT ID'}
          </ArcadeButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Pilot ID Customization */}
        <div className="lg:col-span-6 space-y-6">
          <GlassPanel className="p-6 space-y-4">
            <h3 className="font-arcade text-sm text-arcade-cream">PILOT CONFIGURATION</h3>
            
            <div>
              <label className="block text-xs font-mono text-arcade-cream-muted uppercase mb-1.5">
                Pilot Call-Sign
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={14}
                className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-sm font-display text-arcade-cream focus:outline-none focus:border-arcade-mint"
              />
            </div>

            <AvatarSelector
              selectedAvatar={avatar}
              selectedColor={color}
              selectedSkin={skin}
              onSelectAvatar={setAvatar}
              onSelectColor={setColor}
              onSelectSkin={setSkin}
            />
          </GlassPanel>

          {/* Career Stats Grid */}
          <GlassPanel className="p-6 space-y-3">
            <h3 className="font-arcade text-sm text-arcade-cream">CAREER TELEMETRY</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="font-arcade text-lg text-arcade-amber block">48</span>
                <span className="text-[10px] font-mono text-arcade-cream-muted">MATCHES WON</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="font-arcade text-lg text-arcade-cyan block">112</span>
                <span className="text-[10px] font-mono text-arcade-cream-muted">GAMES PLAYED</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="font-arcade text-lg text-arcade-mint block">42.8%</span>
                <span className="text-[10px] font-mono text-arcade-cream-muted">WIN RATE</span>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Right Column: Achievements & Badges */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-arcade text-sm text-arcade-cream flex items-center gap-2">
              <Award className="w-4 h-4 text-arcade-amber" /> ARCADE ACHIEVEMENTS
            </h3>
            <span className="text-xs font-mono text-arcade-amber">
              {ACHIEVEMENTS.filter(a => a.unlocked).length} / {ACHIEVEMENTS.length} UNLOCKED
            </span>
          </div>

          <div className="space-y-2.5">
            {ACHIEVEMENTS.map((ach) => (
              <GlassPanel
                key={ach.id}
                className={`p-4 transition-all ${
                  ach.unlocked
                    ? 'border-arcade-amber/30 bg-arcade-surface/80'
                    : 'border-white/5 bg-black/40 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                      ach.unlocked ? 'bg-arcade-amber/20 border border-arcade-amber/40 shadow-glow-amber' : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    {ach.unlocked ? ach.icon : <Lock className="w-5 h-5 text-white/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-bold text-sm text-arcade-cream truncate">
                        {ach.title}
                      </h4>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        {ach.game}
                      </span>
                    </div>
                    <p className="text-xs text-arcade-cream-muted line-clamp-1 mt-0.5">
                      {ach.desc}
                    </p>
                  </div>
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
