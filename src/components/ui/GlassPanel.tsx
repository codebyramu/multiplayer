import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glow-amber' | 'glow-crimson' | 'glow-mint' | 'glow-cyan' | 'glow-violet' | 'dark';
  glow?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className,
  variant = 'default',
  glow = false,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-arcade-surface/75 border-arcade-border',
    'glow-amber': 'bg-arcade-surface/80 border-arcade-amber/30 shadow-glow-amber',
    'glow-crimson': 'bg-arcade-surface/80 border-arcade-crimson/30 shadow-glow-crimson',
    'glow-mint': 'bg-arcade-surface/80 border-arcade-mint/30 shadow-glow-mint',
    'glow-cyan': 'bg-arcade-surface/80 border-arcade-cyan/30 shadow-glow-cyan',
    'glow-violet': 'bg-arcade-surface/80 border-arcade-violet/30 shadow-glow-violet',
    dark: 'bg-arcade-bg/90 border-white/5',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'backdrop-blur-xl border rounded-2xl shadow-glass-edge transition-all duration-300 relative overflow-hidden',
          variantStyles[variant],
          glow && 'ring-1 ring-white/15',
          className
        )
      )}
      {...props}
    >
      {/* Subtle top glare highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};
