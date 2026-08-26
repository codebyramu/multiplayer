import { Particle, Vector2D } from './types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number = 600;

  public reset(): void {
    this.particles = [];
  }

  // 1. Hovercraft Engine Plasma Exhaust
  public emitExhaust(
    x: number,
    y: number,
    angle: number,
    color: string,
    isBoosting: boolean,
    speedRatio: number
  ): void {
    if (this.particles.length >= this.maxParticles) return;

    // Thrusters emit in opposite direction of heading
    const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
    const baseSpeed = isBoosting ? 220 + Math.random() * 120 : 90 + Math.random() * 60;
    const particleSpeed = baseSpeed * (0.6 + 0.4 * speedRatio);

    const count = isBoosting ? 3 : 1;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const spreadAngle = exhaustAngle + (Math.random() - 0.5) * (isBoosting ? 0.6 : 0.3);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(spreadAngle) * particleSpeed,
        vy: Math.sin(spreadAngle) * particleSpeed,
        size: isBoosting ? 6 + Math.random() * 5 : 3 + Math.random() * 3,
        maxSize: isBoosting ? 9 : 5,
        color: isBoosting ? '#00E5FF' : color,
        glowColor: isBoosting ? '#FFFFFF' : color,
        alpha: 0.9,
        life: 0,
        maxLife: isBoosting ? 0.35 + Math.random() * 0.15 : 0.25 + Math.random() * 0.1,
        type: 'flame',
      });
    }
  }

  // 2. Wall / Hovercraft Collision Sparks
  public emitSparks(x: number, y: number, normal: Vector2D, color: string = '#FFB224', count: number = 16): void {
    const baseAngle = Math.atan2(normal.y, normal.x);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 150 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        maxSize: 4,
        color: Math.random() > 0.4 ? color : '#FFFFFF',
        glowColor: color,
        alpha: 1.0,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.3,
        type: 'spark',
      });
    }
  }

  // 3. Laser Electric Arc Burst
  public emitLaserZap(x: number, y: number): void {
    // Sharp electric arcs
    for (let i = 0; i < 24; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 350;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        maxSize: 6,
        color: Math.random() > 0.5 ? '#FF3366' : '#00E5FF',
        glowColor: '#FF3366',
        alpha: 1.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        type: 'laser_arc',
      });
    }

    // Expanding shock ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 15,
      maxSize: 110,
      color: '#FF3366',
      glowColor: '#FF3366',
      alpha: 1.0,
      life: 0,
      maxLife: 0.45,
      type: 'ring',
    });
  }

  // 4. Checkpoint Capture Ripple / Explosion
  public emitCheckpointCapture(x: number, y: number, color: string = '#00F5A0', label?: string): void {
    // Expanding rings
    for (let r = 0; r < 2; r++) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        size: 20 + r * 15,
        maxSize: 160 + r * 30,
        color,
        glowColor: color,
        alpha: 0.9,
        life: 0,
        maxLife: 0.6 + r * 0.15,
        type: 'ring',
      });
    }

    // Burst sparks
    for (let i = 0; i < 28; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 120 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3,
        maxSize: 5,
        color,
        glowColor: '#FFFFFF',
        alpha: 1.0,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        type: 'spark',
      });
    }

    if (label) {
      this.emitFloatingText(x, y - 25, label, color);
    }
  }

  // 4b. Grand Finish Line Checkered Burst & Confetti
  public emitFinishCheckeredBurst(x: number, y: number, color: string = '#00F5A0', rankText: string = '🏆 1ST PLACE'): void {
    // Expanding golden & rainbow victory shockwave rings
    const ringColors = ['#FFD700', '#00F5A0', '#00E5FF', '#FF3366'];
    for (let r = 0; r < 3; r++) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        size: 15 + r * 20,
        maxSize: 220 + r * 60,
        color: ringColors[r % ringColors.length],
        glowColor: '#FFD700',
        alpha: 1.0,
        life: 0,
        maxLife: 0.8 + r * 0.2,
        type: 'ring',
      });
    }

    // Checkered flag square particles
    for (let i = 0; i < 24; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 160 + Math.random() * 300;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60, // Arch upward
        size: 8 + Math.random() * 6,
        maxSize: 14,
        color: '#FFFFFF',
        glowColor: '#FFD700',
        alpha: 1.0,
        life: 0,
        maxLife: 1.4 + Math.random() * 0.6,
        type: 'checkered',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        shape: 'square',
      });
    }

    // Vibrant confetti pieces
    const confettiColors = ['#FFD700', '#00F5A0', '#00E5FF', '#FF3366', '#FFB224', '#B026FF', '#FFFFFF'];
    for (let i = 0; i < 36; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 340;
      const pColor = confettiColors[i % confettiColors.length];
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 5 + Math.random() * 5,
        maxSize: 10,
        color: pColor,
        glowColor: pColor,
        alpha: 1.0,
        life: 0,
        maxLife: 1.5 + Math.random() * 0.7,
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        shape: 'square',
      });
    }

    // Sparkle fireworks
    for (let i = 0; i < 30; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 3.5,
        maxSize: 6,
        color: '#FFD700',
        glowColor: '#FFFFFF',
        alpha: 1.0,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
        type: 'spark',
      });
    }

    // Floating grand announcement text
    this.emitFloatingText(x, y - 35, `🏁 ${rankText} 🏁`, '#FFD700');
  }

  // 4c. Ring Shockwave
  public emitRingShockwave(x: number, y: number, color: string = '#FF3366', maxRadius: number = 90): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 10,
      maxSize: maxRadius,
      color,
      glowColor: color,
      alpha: 1.0,
      life: 0,
      maxLife: 0.4,
      type: 'ring',
    });
  }

  // 4d. Celebratory Trail Sparkles (for Finished Racers)
  public emitCelebratorySparkles(x: number, y: number, color: string = '#FFD700'): void {
    if (this.particles.length >= this.maxParticles) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      size: 2 + Math.random() * 3,
      maxSize: 5,
      color: Math.random() > 0.4 ? '#FFD700' : color,
      glowColor: '#FFFFFF',
      alpha: 0.85,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
      type: 'spark',
    });
  }

  // 5. Supersonic Speed Streaks (Screen / World Lines)
  public emitSpeedStreak(racerX: number, racerY: number, angle: number, color: string = '#00E5FF'): void {
    if (this.particles.length >= this.maxParticles) return;
    const lateralOffset = (Math.random() - 0.5) * 60;
    const perpAngle = angle + Math.PI / 2;
    const spawnX = racerX + Math.cos(perpAngle) * lateralOffset - Math.cos(angle) * 30;
    const spawnY = racerY + Math.sin(perpAngle) * lateralOffset - Math.sin(angle) * 30;

    this.particles.push({
      x: spawnX,
      y: spawnY,
      vx: -Math.cos(angle) * (300 + Math.random() * 200),
      vy: -Math.sin(angle) * (300 + Math.random() * 200),
      size: 2,
      maxSize: 2,
      color,
      glowColor: '#FFFFFF',
      alpha: 0.8,
      life: 0,
      maxLife: 0.25,
      type: 'streak',
      rotation: angle,
    });
  }

  // 6. Slipstream / Drafting Energy Particles
  public emitSlipstream(leadX: number, leadY: number, followX: number, followY: number, color: string = '#00E5FF'): void {
    if (this.particles.length >= this.maxParticles) return;
    const t = Math.random();
    const px = leadX * (1 - t) + followX * t + (Math.random() - 0.5) * 18;
    const py = leadY * (1 - t) + followY * t + (Math.random() - 0.5) * 18;

    this.particles.push({
      x: px,
      y: py,
      vx: (leadX - followX) * 0.4 + (Math.random() - 0.5) * 30,
      vy: (leadY - followY) * 0.4 + (Math.random() - 0.5) * 30,
      size: 2 + Math.random() * 2.5,
      maxSize: 4,
      color,
      glowColor: '#FFFFFF',
      alpha: 0.75,
      life: 0,
      maxLife: 0.3,
      type: 'spark',
    });
  }

  // 7. Floating Text Notifications
  public emitFloatingText(x: number, y: number, text: string, color: string = '#00F5A0'): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -55, // Floats upward
      size: 16,
      maxSize: 16,
      color,
      glowColor: color,
      alpha: 1.0,
      life: 0,
      maxLife: 1.1,
      type: 'text',
      text,
    });
  }

  // Tick step
  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      const progress = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.rotation !== undefined && p.vRot !== undefined) {
        p.rotation += p.vRot * dt;
      }

      if (p.type === 'ring') {
        p.size = p.size + (p.maxSize - p.size) * (dt / (p.maxLife - p.life + 0.01));
        p.alpha = Math.max(0, 1.0 - progress);
      } else if (p.type === 'flame') {
        p.alpha = Math.max(0, 0.9 * (1.0 - progress));
        p.size = Math.max(1, p.size * (1.0 - dt * 2.2));
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else if (p.type === 'spark' || p.type === 'laser_arc') {
        p.alpha = Math.max(0, 1.0 - progress);
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else if (p.type === 'checkered') {
        p.alpha = Math.max(0, 1.0 - Math.pow(progress, 2));
        p.vx *= 0.96;
        p.vy += 35 * dt; // Gentle gravity
      } else if (p.type === 'confetti') {
        p.alpha = Math.max(0, 1.0 - Math.pow(progress, 1.8));
        p.vx *= 0.95;
        p.vy += 45 * dt; // Confetti flutter
      } else if (p.type === 'text') {
        p.alpha = Math.max(0, 1.0 - Math.pow(progress, 2));
      } else if (p.type === 'streak') {
        p.alpha = Math.max(0, 0.8 * (1.0 - progress));
      }
    }
  }

  // High-performance canvas drawing
  public render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();
    for (const p of this.particles) {
      if (p.alpha <= 0.01) continue;

      if (p.type === 'text' && p.text) {
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.5, 4 * (1 - p.life / p.maxLife));
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = p.alpha;
        const angle = p.rotation || 0;
        const len = 35;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(angle) * len, p.y - Math.sin(angle) * len);
        ctx.stroke();
      } else if (p.type === 'checkered') {
        // Draw 2x2 high contrast checkered square
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = p.alpha;
        const s = p.size;
        const half = s / 2;

        // Black & white checker quadrants
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-half, -half, half, half);
        ctx.fillRect(0, 0, half, half);
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(0, -half, half, half);
        ctx.fillRect(-half, 0, half, half);

        // Neon gold edge outline
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 4;
        ctx.strokeRect(-half, -half, s, s);
        ctx.restore();
      } else if (p.type === 'confetti') {
        // Draw rotating rectangular confetti ribbon
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = 6;
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        ctx.restore();
      } else {
        // Sparks / Flames / Laser arcs
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.glowColor;
        ctx.shadowBlur = p.type === 'laser_arc' ? 12 : 6;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
