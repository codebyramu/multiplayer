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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 140 Elegant, organic drifting stardust particles
    const particles: AmbientDustParticle[] = [];
    const colors = [
      'rgba(0, 245, 160, ',   // Mint
      'rgba(255, 178, 36, ',   // Amber
      'rgba(0, 229, 255, ',   // Cyan
      'rgba(157, 78, 221, ',  // Violet
      'rgba(255, 51, 102, ',  // Crimson
      'rgba(255, 255, 255, ', // Pure Star
    ];

    for (let i = 0; i < 140; i++) {
      const colorPrefix = colors[i % colors.length];
      const baseR = Math.random() * 1.8 + 0.8;
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

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      const targetX = cursorRef.current.x;
      const targetY = cursorRef.current.y;
      const hasCursor = targetX > 0 && targetY > 0;

      // Soft ambient cursor illumination (no spinning vortex)
      if (hasCursor) {
        const radGrad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, 260);
        radGrad.addColorStop(0, 'rgba(0, 245, 160, 0.08)');
        radGrad.addColorStop(0.4, 'rgba(0, 229, 255, 0.04)');
        radGrad.addColorStop(0.8, 'rgba(255, 178, 36, 0.015)');
        radGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(targetX, targetY, 260, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render floating foreground particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Smooth organic drift
        p.x += p.vx;
        p.y += p.vy;

        // Interactive subtle cursor repulsion (particles gently part away when mouse approaches)
        if (hasCursor) {
          const dx = p.x - targetX;
          const dy = p.y - targetY;
          const dist = Math.hypot(dx, dy);

          if (dist < 180 && dist > 1) {
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
        ctx.shadowColor = `${p.color}0.8)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 opacity-90"
    />
  );
};
