import React, { useEffect, useRef } from 'react';

interface CosmicBlackHoleCanvasProps {
  cursorX: number;
  cursorY: number;
}

interface AmbientDustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
}

export const CosmicBlackHoleCanvas: React.FC<CosmicBlackHoleCanvasProps> = ({ cursorX, cursorY }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: cursorX, y: cursorY });

  useEffect(() => {
    cursorRef.current = { x: cursorX, y: cursorY };
  }, [cursorX, cursorY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Responsive / Device performance detection
    const isMobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const isLowEnd = isMobile || cores <= 4;
    
    // Adaptive particle target: 35 for mobile/low-end, 70 for mid-range, 120 for desktop
    const targetParticleCount = isLowEnd ? (isMobile ? 35 : 55) : 110;
    let activeParticleCount = targetParticleCount;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // Elegant, organic drifting stardust particles
    const particles: AmbientDustParticle[] = [];
    const colors = [
      'rgba(0, 245, 160, ',   // Mint
      'rgba(255, 178, 36, ',   // Amber
      'rgba(0, 229, 255, ',   // Cyan
      'rgba(157, 78, 221, ',  // Violet
      'rgba(255, 51, 102, ',  // Crimson
      'rgba(255, 255, 255, ', // Pure Star
    ];

    for (let i = 0; i < targetParticleCount; i++) {
      const colorPrefix = colors[i % colors.length];
      const baseR = Math.random() * 1.6 + 0.8;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45 - 0.15, // Gentle upwards drift
        baseRadius: baseR,
        radius: baseR,
        alpha: Math.random() * 0.6 + 0.2,
        maxAlpha: Math.random() * 0.5 + 0.4,
        color: colorPrefix,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // Dynamic FPS Degradation Monitoring
    let lastFrameTime = performance.now();
    let slowFramesCount = 0;
    let totalFramesSampled = 0;

    const render = (currentTime: number) => {
      const delta = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Low FPS detection: frame taking longer than 28ms (< 35 FPS)
      if (delta > 28) {
        slowFramesCount++;
      }
      totalFramesSampled++;

      // Every 60 frames, evaluate performance and scale particles down if needed
      if (totalFramesSampled >= 60) {
        if (slowFramesCount > 18 && activeParticleCount > 25) {
          activeParticleCount = Math.max(25, Math.floor(activeParticleCount * 0.7));
        }
        slowFramesCount = 0;
        totalFramesSampled = 0;
      }

      ctx.clearRect(0, 0, width, height);

      const targetX = cursorRef.current.x;
      const targetY = cursorRef.current.y;
      const hasCursor = targetX > 0 && targetY > 0 && !isMobile;

      // Soft ambient cursor illumination (only on desktop pointer devices)
      if (hasCursor) {
        const radGrad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, 240);
        radGrad.addColorStop(0, 'rgba(0, 245, 160, 0.07)');
        radGrad.addColorStop(0.4, 'rgba(0, 229, 255, 0.03)');
        radGrad.addColorStop(0.8, 'rgba(255, 178, 36, 0.01)');
        radGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 240, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render floating foreground particles up to activeParticleCount
      for (let i = 0; i < activeParticleCount; i++) {
        const p = particles[i];

        // Smooth organic drift
        p.x += p.vx;
        p.y += p.vy;

        // Interactive subtle cursor repulsion
        if (hasCursor) {
          const dx = p.x - targetX;
          const dy = p.y - targetY;
          const distSq = dx * dx + dy * dy;

          if (distSq < 32400 && distSq > 1) { // 180px radius
            const dist = Math.sqrt(distSq);
            const push = (180 - dist) / 180;
            p.x += (dx / dist) * push * 1.8;
            p.y += (dy / dist) * push * 1.8;
          }
        }

        // Wrap edges smoothly
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        // Organic twinkling brightness pulsation
        p.twinklePhase += p.twinkleSpeed;
        const currentAlpha = p.alpha + Math.sin(p.twinklePhase) * 0.25;
        const clampedAlpha = Math.max(0.1, Math.min(p.maxAlpha, currentAlpha));

        // Draw glowing particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${clampedAlpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 opacity-90"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
};
