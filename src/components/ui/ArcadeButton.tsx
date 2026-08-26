import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { soundManager } from '../../audio/SoundManager';

interface ArcadeButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'amber' | 'mint' | 'crimson' | 'cyan' | 'violet' | 'neutral' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  soundPitch?: number;
  fullWidth?: boolean;
}

export const ArcadeButton: React.FC<ArcadeButtonProps> = ({
  children,
  className,
  variant = 'amber',
  size = 'md',
  icon,
  soundPitch = 800,
  fullWidth = false,
  onClick,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-mono tracking-wider',
    md: 'px-5 py-2.5 text-sm font-semibold tracking-wide',
    lg: 'px-7 py-3.5 text-base font-bold tracking-wider',
    xl: 'px-9 py-4.5 text-lg font-extrabold tracking-widest',
  };

  const variantStyles = {
    amber: 'bg-arcade-amber text-arcade-bg hover:bg-amber-300 shadow-glow-amber border-arcade-amber/60',
    mint: 'bg-arcade-mint text-arcade-bg hover:bg-emerald-300 shadow-glow-mint border-arcade-mint/60',
    crimson: 'bg-arcade-crimson text-white hover:bg-rose-400 shadow-glow-crimson border-arcade-crimson/60',
    cyan: 'bg-arcade-cyan text-arcade-bg hover:bg-cyan-300 shadow-glow-cyan border-arcade-cyan/60',
    violet: 'bg-arcade-violet text-white hover:bg-purple-400 shadow-glow-violet border-arcade-violet/60',
    neutral: 'bg-white/10 hover:bg-white/15 text-arcade-cream border-white/20 backdrop-blur-md',
    ghost: 'bg-transparent hover:bg-white/10 text-arcade-cream border-transparent',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    soundManager.playClick(soundPitch);
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.96, y: 1 }}
      transition={{ type: 'spring', stiffness: 450, damping: 20 }}
      onClick={handleClick}
      className={twMerge(
        clsx(
          'relative inline-flex items-center justify-center gap-2 rounded-xl font-display uppercase transition-colors select-none border cursor-pointer overflow-hidden group',
          sizeStyles[size],
          variantStyles[variant],
          fullWidth && 'w-full',
          className
        )
      )}
      {...props}
    >
      {/* Light sheen animation */}
      <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-700 pointer-events-none" />
      
      {icon && <span className="flex-shrink-0 transition-transform group-hover:scale-110">{icon}</span>}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
};
