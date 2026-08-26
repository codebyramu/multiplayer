import React, { useState, useEffect } from 'react';

export const CRTOverlay: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hypercade_crt');
      if (saved !== null) setEnabled(saved === 'true');
    } catch {}
  }, []);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      {/* Scanline pattern */}
      <div 
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.9) 0px, rgba(0, 0, 0, 0.9) 1px, transparent 1px, transparent 3px)',
          backgroundSize: '100% 3px',
        }}
      />
      {/* Subtle arcade vignette */}
      <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/60" />
      {/* Moving faint scanline sweep */}
      <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent animate-scanline" />
    </div>
  );
};
