import React from 'react';
import { motion } from 'framer-motion';
import { PLAYER_AVATARS, SNAKE_SKINS } from '../../data/games';
import { 
  Rocket, Ghost, Zap, Crown, Gem, Bot, Sparkles, Flame, Check
} from 'lucide-react';
import { soundManager } from '../../audio/SoundManager';

const ICON_MAP: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="w-5 h-5" />,
  Ghost: <Ghost className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Crown: <Crown className="w-5 h-5" />,
  Gem: <Gem className="w-5 h-5" />,
  Bot: <Bot className="w-5 h-5" />,
  Alien: <Sparkles className="w-5 h-5" />,
  Flame: <Flame className="w-5 h-5" />,
};

const COLOR_PALETTE = [
  '#00F5A0', // Mint
  '#00E5FF', // Cyan
  '#FFB224', // Amber
  '#FF3366', // Crimson
  '#9D4EDD', // Violet
  '#FF7700', // Orange
  '#3A86FF', // Blue
  '#E63946', // Rose
];

interface AvatarSelectorProps {
  selectedAvatar: string;
  selectedColor: string;
  selectedSkin?: string;
  onSelectAvatar: (avatar: string) => void;
  onSelectColor: (color: string) => void;
  onSelectSkin?: (skin: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedAvatar,
  selectedColor,
  selectedSkin = 'synth',
  onSelectAvatar,
  onSelectColor,
  onSelectSkin,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Avatars */}
      <div>
        <label className="block text-xs font-mono text-arcade-cream-muted uppercase mb-2">
          Select Pilot Emblem
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PLAYER_AVATARS.map((av) => {
            const isSelected = selectedAvatar === av.id;
            return (
              <motion.button
                key={av.id}
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  soundManager.playClick(900);
                  onSelectAvatar(av.id);
                }}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? 'border-arcade-amber bg-arcade-amber/15 text-arcade-amber shadow-glow-amber'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                }`}
              >
                {ICON_MAP[av.icon] || <Rocket className="w-5 h-5" />}
                <span className="text-[10px] font-mono tracking-tight truncate w-full text-center">
                  {av.name.split(' ')[0]}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 2. Color Swatches */}
      <div>
        <label className="block text-xs font-mono text-arcade-cream-muted uppercase mb-2">
          Hologram Aura Color
        </label>
        <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
          {COLOR_PALETTE.map((hex) => {
            const isSelected = selectedColor === hex;
            return (
              <motion.button
                key={hex}
                type="button"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  soundManager.playClick(1000);
                  onSelectColor(hex);
                }}
                style={{ backgroundColor: hex }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                  isSelected ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-80 hover:opacity-100'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 3. Cosmetic Skin (For Serpent Arena & Flagship) */}
      {onSelectSkin && (
        <div>
          <label className="block text-xs font-mono text-arcade-cream-muted uppercase mb-2">
            Cosmetic Shaders (Serpent / Flagship)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SNAKE_SKINS.map((skin) => {
              const isSelected = selectedSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => {
                    soundManager.playClick(850);
                    onSelectSkin(skin.id);
                  }}
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'border-arcade-mint bg-arcade-mint/15 text-arcade-mint'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: skin.headColor }}
                  />
                  <span className="text-xs font-display truncate">{skin.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
