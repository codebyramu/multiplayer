import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Gamepad2, Tv, Smartphone, Trophy, User, Volume2, VolumeX, Monitor, Menu, X, Sparkles 
} from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

import { RoomState } from '../../types';

interface NavbarProps {
  currentTab: 'hub' | 'host' | 'join' | 'leaderboards' | 'profile';
  onSelectTab: (tab: 'hub' | 'host' | 'join' | 'leaderboards' | 'profile') => void;
  inGame?: boolean;
  room?: RoomState | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  inGame = false,
  room = null,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    soundManager.setMuted(nextMuted);
    setIsMuted(nextMuted);
    if (!nextMuted) soundManager.playClick(900);
  };

  const navItems: Array<{ id: 'hub' | 'host' | 'join' | 'leaderboards' | 'profile'; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'hub', label: 'GAMES HUB', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'host', label: 'HOST PARTY (TV)', icon: <Tv className="w-4 h-4" />, badge: 'TV MODE' },
    { id: 'join', label: 'PHONE CONTROLLER', icon: <Smartphone className="w-4 h-4" />, badge: 'JOIN' },
    { id: 'leaderboards', label: 'LEADERBOARD', icon: <Trophy className="w-4 h-4" /> },
    { id: 'profile', label: 'PILOT ID', icon: <User className="w-4 h-4" /> },
  ];

  const joinedPlayers = room?.players ? Object.values(room.players) : [];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-arcade-bg/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            soundManager.playClick(700);
            onSelectTab('hub');
          }}
          className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-arcade-amber via-arcade-crimson to-arcade-violet p-[2px] shadow-glow-amber">
            <div className="w-full h-full bg-arcade-bg rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-arcade-amber group-hover:rotate-45 transition-transform duration-300" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-arcade text-base sm:text-lg font-black tracking-wider text-arcade-cream drop-shadow-[0_0_12px_rgba(255,178,36,0.6)]">
                HYPER<span className="text-arcade-amber">CADE</span>
              </span>
            </div>
            <span className="font-mono text-[9px] tracking-widest text-arcade-cream-muted uppercase hidden sm:block">
              ATMOSPHERIC MULTIPLAYER ENGINE
            </span>
          </div>
        </motion.div>

        {/* Joined Players Live Profile Avatars in Header */}
        {joinedPlayers.length > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md max-w-xl overflow-x-auto shadow-inner">
            <span className="text-[10px] font-mono text-arcade-amber uppercase font-bold tracking-wider shrink-0 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-arcade-mint animate-ping" />
              PILOTS:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none">
              {joinedPlayers.map((p) => {
                const isLeader = p.isOwner || p.isHost;
                const isReady = p.isReady === true;
                const badgeLabel = isLeader ? '👑 LEADER' : isReady ? '✅ READY' : '⏳ WAIT';
                const badgeColorClass = isLeader
                  ? 'bg-arcade-amber/20 text-arcade-amber border-arcade-amber/40 shadow-glow-amber'
                  : isReady
                  ? 'bg-green-500/20 text-green-400 border-green-500/40 shadow-glow-mint'
                  : 'bg-white/5 text-arcade-cream-muted border-white/15';

                return (
                  <div
                    key={p.id}
                    className={`relative flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 border shrink-0 transition-all ${
                      isReady ? 'border-green-400/40' : 'border-white/10'
                    }`}
                  >
                    {/* Mini-avatar with custom color */}
                    <div
                      className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold text-black shadow-md shrink-0 border border-white/30"
                      style={{ backgroundColor: p.color || '#00F5A0' }}
                    >
                      {p.isBot ? '🤖' : (p.avatar === 'skull' ? '💀' : p.avatar === 'alien' ? '👽' : p.avatar === 'crown' ? '👑' : p.name ? p.name.charAt(0).toUpperCase() : 'P')}
                    </div>

                    {/* Name */}
                    <span className="text-[11px] font-display font-bold text-arcade-cream max-w-[70px] truncate">
                      {p.name.replace('[AI] ', '')}
                    </span>

                    {/* Ready Badge: 👑 LEADER | ✅ READY | ⏳ WAIT */}
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${badgeColorClass}`}>
                      {badgeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl shrink-0">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundManager.playClick(850);
                  onSelectTab(item.id);
                }}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-display uppercase tracking-wider font-semibold transition-all flex items-center gap-2 ${
                  isActive
                    ? 'text-arcade-bg bg-arcade-amber shadow-glow-amber font-bold'
                    : 'text-arcade-cream/70 hover:text-arcade-cream hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && !isActive && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-arcade-amber/20 text-arcade-amber border border-arcade-amber/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Utilities & Mobile Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Mute/Unmute Toggle */}
          <button
            onClick={toggleMute}
            aria-label="Toggle Audio"
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-arcade-cream transition-colors"
            title={isMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-arcade-crimson" />
            ) : (
              <Volume2 className="w-4 h-4 text-arcade-mint animate-pulse" />
            )}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-arcade-cream"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden border-t border-white/10 bg-arcade-surface/95 backdrop-blur-2xl px-4 py-4 space-y-2"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                soundManager.playClick(850);
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-display font-semibold transition-all ${
                currentTab === item.id
                  ? 'bg-arcade-amber text-arcade-bg'
                  : 'bg-white/5 text-arcade-cream hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </header>
  );
};
