import React from 'react';
import { motion } from 'framer-motion';

export type CharacterAvatarId = 
  | 'cat' 
  | 'doge' 
  | 'axolotl' 
  | 'robot' 
  | 'ghost' 
  | 'dragon' 
  | 'knight' 
  | 'phoenix'
  | 'ship'
  | 'skull'
  | 'spark'
  | 'crown'
  | 'diamond'
  | 'alien'
  | 'flame';

export type CharacterMood = 'idle' | 'ready' | 'happy' | 'spectating' | 'eliminated' | 'winner';

interface CuteCharacterProps {
  avatar: string;
  color?: string;
  mood?: CharacterMood;
  size?: number;
  className?: string;
  showCrown?: boolean;
}

export const CUTE_AVATARS_LIST: Array<{ id: CharacterAvatarId; name: string; iconEmoji: string; desc: string }> = [
  { id: 'cat', name: 'Neko Pilot', iconEmoji: '🐱', desc: 'Cute Cyber Kitty with glowing cyber-whiskers' },
  { id: 'doge', name: 'Astro Doge', iconEmoji: '🐶', desc: 'Brave Space Pup with floppy ears & goggles' },
  { id: 'axolotl', name: 'Hydro Loti', iconEmoji: '🦎', desc: 'Adorable Cosmic Axolotl with soft pink gills' },
  { id: 'robot', name: 'Mecha Puffer', iconEmoji: '🤖', desc: 'Mini Droid with animated LED face emotes' },
  { id: 'ghost', name: 'Spooky Boo', iconEmoji: '👻', desc: 'Friendly Glowing Phantom with blush cheeks' },
  { id: 'dragon', name: 'Chibi Drake', iconEmoji: '🐲', desc: 'Baby Star Dragon with cute horns & tiny wings' },
  { id: 'knight', name: 'Star Paladin', iconEmoji: '👑', desc: 'Tiny Golden King with arcade pixel crown' },
  { id: 'phoenix', name: 'Solar Pippin', iconEmoji: '🐥', desc: 'Chibi Flame Bird with blazing feather crest' },
];

export const CuteCharacter: React.FC<CuteCharacterProps> = ({
  avatar,
  color = '#00F5A0',
  mood = 'idle',
  size = 64,
  className = '',
  showCrown = false,
}) => {
  // Normalize avatar key
  let key: CharacterAvatarId = 'cat';
  if (['cat', 'ship'].includes(avatar)) key = 'cat';
  else if (['doge', 'spark'].includes(avatar)) key = 'doge';
  else if (['axolotl', 'alien'].includes(avatar)) key = 'axolotl';
  else if (['robot'].includes(avatar)) key = 'robot';
  else if (['ghost', 'skull'].includes(avatar)) key = 'ghost';
  else if (['dragon', 'diamond'].includes(avatar)) key = 'dragon';
  else if (['knight', 'crown'].includes(avatar)) key = 'knight';
  else if (['phoenix', 'flame'].includes(avatar)) key = 'phoenix';
  else if (avatar as CharacterAvatarId) key = avatar as CharacterAvatarId;

  const isEliminated = mood === 'eliminated';
  const isWinner = mood === 'winner';
  const isReady = mood === 'ready';

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Crown for winners or party leaders */}
      {showCrown && (
        <motion.div
          animate={{ y: [-2, 2, -2], rotate: [-4, 4, -4] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute -top-[30%] left-1/2 -translate-x-1/2 z-20 pointer-events-none drop-shadow-[0_2px_8px_rgba(255,178,36,0.9)]"
          style={{ fontSize: size * 0.4 }}
        >
          👑
        </motion.div>
      )}

      {/* Main 2D SVG Vector Character */}
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        animate={
          isEliminated
            ? { y: [0, 2, 0], opacity: 0.75, filter: 'grayscale(0.6)' }
            : isReady
            ? { y: [-3, 3, -3], scale: [1, 1.05, 1] }
            : isWinner
            ? { y: [-4, 4, -4], rotate: [-3, 3, -3], scale: [1, 1.1, 1] }
            : { y: [-1.5, 1.5, -1.5] }
        }
        transition={{ repeat: Infinity, duration: isReady ? 1.4 : isWinner ? 1.2 : 2.2, ease: 'easeInOut' }}
      >
        <defs>
          {/* Hologram Aura Glow Filter */}
          <filter id={`glow-${color.replace('#', '')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={color} floodOpacity="0.6" />
          </filter>

          <linearGradient id={`bodyGrad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="60%" stopColor={color} />
            <stop offset="100%" stopColor="#0A0A0F" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* ─── CHARACTER SPECIFIC 2D VECTOR ASSETS ─── */}
        {key === 'cat' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Cat Ears */}
            <polygon points="22,35 12,12 36,22" fill={color} stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="20,32 15,16 32,24" fill="#FF80BF" />
            <polygon points="78,35 88,12 64,22" fill={color} stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="80,32 85,16 68,24" fill="#FF80BF" />

            {/* Cute Rounded Head Body */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            
            {/* Cyber Helmet Visor Glass */}
            <path d="M 28 46 Q 50 40 72 46 Q 74 64 50 66 Q 26 64 28 46 Z" fill="#0A0A0F" opacity="0.75" />
            
            {/* Blushing Cheeks */}
            <ellipse cx="32" cy="58" rx="5" ry="3" fill="#FF66A3" opacity="0.8" />
            <ellipse cx="68" cy="58" rx="5" ry="3" fill="#FF66A3" opacity="0.8" />

            {/* Eyes */}
            {isEliminated ? (
              // Dizzy swirl / X eyes
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="36" y1="48" x2="44" y2="56" />
                <line x1="44" y1="48" x2="36" y2="56" />
                <line x1="56" y1="48" x2="64" y2="56" />
                <line x1="64" y1="48" x2="56" y2="56" />
              </g>
            ) : (
              // Big Anime Sparkle Eyes
              <g>
                <circle cx="40" cy="52" r="5" fill="#FFFFFF" />
                <circle cx="60" cy="52" r="5" fill="#FFFFFF" />
                <circle cx="41" cy="51" r="2.5" fill="#0A0A0F" />
                <circle cx="61" cy="51" r="2.5" fill="#0A0A0F" />
                <circle cx="39" cy="50" r="1.2" fill="#FFFFFF" />
                <circle cx="59" cy="50" r="1.2" fill="#FFFFFF" />
              </g>
            )}

            {/* Cute Kitty Mouth */}
            <path d="M 46 60 Q 50 63 54 60" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            {/* Cyber Whiskers */}
            <line x1="20" y1="52" x2="10" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="56" x2="10" y2="58" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="80" y1="52" x2="90" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1="80" y1="56" x2="90" y2="58" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {key === 'doge' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Floppy Doge Ears */}
            <ellipse cx="20" cy="40" rx="10" ry="18" fill={color} transform="rotate(-20 20 40)" stroke="#FFFFFF" strokeWidth="2.5" />
            <ellipse cx="80" cy="40" rx="10" ry="18" fill={color} transform="rotate(20 80 40)" stroke="#FFFFFF" strokeWidth="2.5" />
            {/* Round Head */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            
            {/* Doge Snout */}
            <ellipse cx="50" cy="62" rx="14" ry="10" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="50" cy="57" rx="4.5" ry="3" fill="#0A0A0F" />
            {/* W-mouth */}
            <path d="M 44 64 Q 47 67 50 64 Q 53 67 56 64" fill="none" stroke="#0A0A0F" strokeWidth="2" strokeLinecap="round" />
            {/* Tongue */}
            <path d="M 48 65 Q 50 71 52 65 Z" fill="#FF4D88" />

            {/* Pilot Goggles on Forehead */}
            <rect x="26" y="26" width="20" height="12" rx="5" fill="#00E5FF" stroke="#FFFFFF" strokeWidth="2" />
            <rect x="54" y="26" width="20" height="12" rx="5" fill="#00E5FF" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="46" y1="32" x2="54" y2="32" stroke="#FFFFFF" strokeWidth="2.5" />

            {/* Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="36" y1="46" x2="44" y2="54" />
                <line x1="44" y1="46" x2="36" y2="54" />
                <line x1="56" y1="46" x2="64" y2="54" />
                <line x1="64" y1="46" x2="56" y2="54" />
              </g>
            ) : (
              <g>
                <circle cx="39" cy="48" r="4.5" fill="#0A0A0F" />
                <circle cx="61" cy="48" r="4.5" fill="#0A0A0F" />
                <circle cx="38" cy="46" r="1.5" fill="#FFFFFF" />
                <circle cx="60" cy="46" r="1.5" fill="#FFFFFF" />
              </g>
            )}
          </g>
        )}

        {key === 'axolotl' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Cute Gills */}
            <path d="M 20 40 Q 6 36 12 48 Q 6 56 20 54" fill="#FF80BF" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M 80 40 Q 94 36 88 48 Q 94 56 80 54" fill="#FF80BF" stroke="#FFFFFF" strokeWidth="2" />
            {/* Round Head */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            {/* Cheeks */}
            <ellipse cx="32" cy="59" rx="6" ry="3.5" fill="#FF4D94" opacity="0.85" />
            <ellipse cx="68" cy="59" rx="6" ry="3.5" fill="#FF4D94" opacity="0.85" />

            {/* Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="35" y1="48" x2="43" y2="56" />
                <line x1="43" y1="48" x2="35" y2="56" />
                <line x1="57" y1="48" x2="65" y2="56" />
                <line x1="65" y1="48" x2="57" y2="56" />
              </g>
            ) : (
              <g>
                <ellipse cx="38" cy="50" rx="4.5" ry="5.5" fill="#0A0A0F" />
                <ellipse cx="62" cy="50" rx="4.5" ry="5.5" fill="#0A0A0F" />
                <circle cx="37" cy="48" r="1.8" fill="#FFFFFF" />
                <circle cx="61" cy="48" r="1.8" fill="#FFFFFF" />
                <circle cx="40" cy="53" r="0.8" fill="#FFFFFF" />
                <circle cx="64" cy="53" r="0.8" fill="#FFFFFF" />
              </g>
            )}
            {/* Smile */}
            <path d="M 44 60 Q 50 66 56 60" fill="none" stroke="#0A0A0F" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {key === 'robot' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Antenna */}
            <line x1="50" y1="12" x2="50" y2="24" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
            <circle cx="50" cy="10" r="4.5" fill="#FFB224" stroke="#FFFFFF" strokeWidth="2" />
            {/* Robot Chassis Head */}
            <rect x="18" y="24" width="64" height="58" rx="18" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            {/* Ear Bolts */}
            <rect x="11" y="44" width="7" height="18" rx="3" fill="#FFFFFF" />
            <rect x="82" y="44" width="7" height="18" rx="3" fill="#FFFFFF" />
            {/* LCD Screen */}
            <rect x="26" y="34" width="48" height="38" rx="10" fill="#0A0A0F" stroke="#00E5FF" strokeWidth="2" />

            {/* LED Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="34" y1="46" x2="44" y2="56" />
                <line x1="44" y1="46" x2="34" y2="56" />
                <line x1="56" y1="46" x2="66" y2="56" />
                <line x1="66" y1="46" x2="56" y2="56" />
              </g>
            ) : (
              <g fill="#00E5FF">
                <rect x="34" y="46" width="10" height="12" rx="3" />
                <rect x="56" y="46" width="10" height="12" rx="3" />
                {/* Heart / Emote Mouth */}
                <circle cx="48" cy="62" r="1.5" fill="#00F5A0" />
                <circle cx="52" cy="62" r="1.5" fill="#00F5A0" />
              </g>
            )}
          </g>
        )}

        {key === 'ghost' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Ghost Body Tail Wave */}
            <path
              d="M 50 18 C 30 18 20 34 20 54 C 20 74 24 86 30 80 C 36 74 42 86 50 80 C 58 74 64 86 70 80 C 76 74 80 74 80 54 C 80 34 70 18 50 18 Z"
              fill={`url(#bodyGrad-${color.replace('#', '')})`}
              stroke="#FFFFFF"
              strokeWidth="3"
            />
            {/* Blush */}
            <ellipse cx="32" cy="54" rx="5" ry="3" fill="#FF80BF" opacity="0.9" />
            <ellipse cx="68" cy="54" rx="5" ry="3" fill="#FF80BF" opacity="0.9" />

            {/* Ghost Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="36" y1="42" x2="44" y2="50" />
                <line x1="44" y1="42" x2="36" y2="50" />
                <line x1="56" y1="42" x2="64" y2="50" />
                <line x1="64" y1="42" x2="56" y2="50" />
              </g>
            ) : (
              <g>
                <ellipse cx="40" cy="44" rx="4.5" ry="6" fill="#0A0A0F" />
                <ellipse cx="60" cy="44" rx="4.5" ry="6" fill="#0A0A0F" />
                <circle cx="39" cy="42" r="2" fill="#FFFFFF" />
                <circle cx="59" cy="42" r="2" fill="#FFFFFF" />
              </g>
            )}
            {/* O-mouth */}
            <ellipse cx="50" cy="56" rx="4" ry="5" fill="#0A0A0F" />
          </g>
        )}

        {key === 'dragon' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Baby Horns */}
            <polygon points="32,28 20,8 40,20" fill="#FFB224" stroke="#FFFFFF" strokeWidth="2" />
            <polygon points="68,28 80,8 60,20" fill="#FFB224" stroke="#FFFFFF" strokeWidth="2" />
            {/* Tiny Wings */}
            <path d="M 18 52 Q 2 40 12 64 Z" fill="#9D4EDD" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M 82 52 Q 98 40 88 64 Z" fill="#9D4EDD" stroke="#FFFFFF" strokeWidth="2" />
            {/* Head */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            {/* Belly scale plate */}
            <ellipse cx="50" cy="70" rx="14" ry="10" fill="#FFD166" opacity="0.9" stroke="#FFFFFF" strokeWidth="1.5" />
            {/* Cute Flame Sneeze */}
            <circle cx="50" cy="60" r="3" fill="#FF5722" />

            {/* Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="36" y1="46" x2="44" y2="54" />
                <line x1="44" y1="46" x2="36" y2="54" />
                <line x1="56" y1="46" x2="64" y2="54" />
                <line x1="64" y1="46" x2="56" y2="54" />
              </g>
            ) : (
              <g>
                <circle cx="39" cy="48" r="5" fill="#0A0A0F" />
                <circle cx="61" cy="48" r="5" fill="#0A0A0F" />
                <circle cx="38" cy="46" r="2" fill="#FFFFFF" />
                <circle cx="60" cy="46" r="2" fill="#FFFFFF" />
              </g>
            )}
          </g>
        )}

        {key === 'knight' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Mini Gold Crown */}
            <polygon points="34,26 34,14 42,20 50,12 58,20 66,14 66,26" fill="#FFB224" stroke="#FFFFFF" strokeWidth="2" />
            {/* Head */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            {/* Hero Cape */}
            <path d="M 24 64 Q 10 90 28 88 Z" fill="#E63946" />
            <path d="M 76 64 Q 90 90 72 88 Z" fill="#E63946" />

            {/* Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="36" y1="48" x2="44" y2="56" />
                <line x1="44" y1="48" x2="36" y2="56" />
                <line x1="56" y1="48" x2="64" y2="56" />
                <line x1="64" y1="48" x2="56" y2="56" />
              </g>
            ) : (
              <g>
                <circle cx="39" cy="50" r="4.5" fill="#0A0A0F" />
                <circle cx="61" cy="50" r="4.5" fill="#0A0A0F" />
                <circle cx="38" cy="48" r="1.8" fill="#FFFFFF" />
                <circle cx="60" cy="48" r="1.8" fill="#FFFFFF" />
                {/* Star glint */}
                <polygon points="50,44 52,48 56,50 52,52 50,56 48,52 44,50 48,48" fill="#FFD700" opacity="0.8" />
              </g>
            )}
            <path d="M 45 62 Q 50 66 55 62" fill="none" stroke="#0A0A0F" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {key === 'phoenix' && (
          <g filter={`url(#glow-${color.replace('#', '')})`}>
            {/* Flaming Crest */}
            <path d="M 44 24 Q 50 6 56 24 Z" fill="#FF3366" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M 38 28 Q 44 14 50 28 Z" fill="#FFB224" />
            <path d="M 50 28 Q 56 14 62 28 Z" fill="#FFB224" />
            {/* Head */}
            <circle cx="50" cy="54" r="34" fill={`url(#bodyGrad-${color.replace('#', '')})`} stroke="#FFFFFF" strokeWidth="3" />
            {/* Cute Beak */}
            <polygon points="50,56 44,64 56,64" fill="#FFB224" stroke="#FFFFFF" strokeWidth="1.5" />
            {/* Cheeks */}
            <ellipse cx="32" cy="58" rx="5" ry="3" fill="#FF5722" opacity="0.8" />
            <ellipse cx="68" cy="58" rx="5" ry="3" fill="#FF5722" opacity="0.8" />

            {/* Eyes */}
            {isEliminated ? (
              <g stroke="#FF3366" strokeWidth="3" strokeLinecap="round">
                <line x1="35" y1="46" x2="43" y2="54" />
                <line x1="43" y1="46" x2="35" y2="54" />
                <line x1="57" y1="46" x2="65" y2="54" />
                <line x1="65" y1="46" x2="57" y2="54" />
              </g>
            ) : (
              <g>
                <circle cx="38" cy="48" r="4.5" fill="#0A0A0F" />
                <circle cx="62" cy="48" r="4.5" fill="#0A0A0F" />
                <circle cx="37" cy="46" r="1.8" fill="#FFFFFF" />
                <circle cx="61" cy="46" r="1.8" fill="#FFFFFF" />
              </g>
            )}
          </g>
        )}
      </motion.svg>
    </div>
  );
};
