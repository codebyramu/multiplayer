import { Particle, Vector2D } from './types';

export class ParticleSystem {
  private static readonly POOL_SIZE = 600;
  private particlePool: Particle[] = [];
  private activeCount: number = 0;
  private maxActiveParticles: number = 600;

  constructor() {
    for (let i = 0; i < ParticleSystem.POOL_SIZE; i++) {
      this.particlePool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 2,
        maxSize: 4,
        color: '#FFFFFF',
        glowColor: '#FFFFFF',
        alpha: 1,
        life: 0,
        maxLife: 1,
        type: 'spark',
      });
    }
  }

  public reset(): void {
    this.activeCount = 0;
  }

  private spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    maxSize: number,
    color: string,
    glowColor: string,
    alpha: number,
    maxLife: number,
    type: Particle['type'],
    rotation: number = 0,
    vRot: number = 0,
    shape?: Particle['shape'],
    text?: string
  ): void {
    if (this.activeCount >= this.maxActiveParticles || this.activeCount >= ParticleSystem.POOL_SIZE) return;

    const p = this.particlePool[this.activeCount];
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.maxSize = maxSize;
    p.color = color;
    p.glowColor = glowColor;
    p.alpha = alpha;
    p.life = 0;
    p.maxLife = maxLife;
    p.type = type;
    p.rotation = rotation;
    p.vRot = vRot;
    p.shape = shape;
    p.text = text;

    this.activeCount++;
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
    if (this.activeCount >= this.maxActiveParticles) return;

    const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
    const baseSpeed = isBoosting ? 220 + Math.random() * 120 : 90 + Math.random() * 60;
    const particleSpeed = baseSpeed * (0.6 + 0.4 * speedRatio);

    const count = isBoosting ? 3 : 1;
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;

      const spreadAngle = exhaustAngle + (Math.random() - 0.5) * (isBoosting ? 0.6 : 0.3);
      this.spawn(
        x + (Math.random() - 0.5) * 6,
        y + (Math.random() - 0.5) * 6,
        Math.cos(spreadAngle) * particleSpeed,
        Math.sin(spreadAngle) * particleSpeed,
        isBoosting ? 6 + Math.random() * 5 : 3 + Math.random() * 3,
        isBoosting ? 9 : 5,
        isBoosting ? '#00E5FF' : color,
        isBoosting ? '#FFFFFF' : color,
        0.9,
        isBoosting ? 0.35 + Math.random() * 0.15 : 0.25 + Math.random() * 0.1,
        'flame'
      );
    }
  }

  // 2. Wall / Hovercraft Collision Sparks
  public emitSparks(x: number, y: number, normal: Vector2D, color: string = '#FFB224', count: number = 16): void {
    const baseAngle = Math.atan2(normal.y, normal.x);
    for (let i = 0; i < count; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 150 + Math.random() * 320;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2 + Math.random() * 3,
        4,
        Math.random() > 0.4 ? color : '#FFFFFF',
        color,
        1.0,
        0.3 + Math.random() * 0.3,
        'spark'
      );
    }
  }

  // 3. Laser Electric Arc Burst
  public emitLaserZap(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 200 + Math.random() * 350;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        3 + Math.random() * 4,
        6,
        Math.random() > 0.5 ? '#FF3366' : '#00E5FF',
        '#FF3366',
        1.0,
        0.4 + Math.random() * 0.3,
        'laser_arc'
      );
    }

    // Expanding shock ring
    this.spawn(x, y, 0, 0, 15, 110, '#FF3366', '#FF3366', 1.0, 0.45, 'ring');
  }

  // 4. Checkpoint Capture Ripple / Explosion
  public emitCheckpointCapture(x: number, y: number, color: string = '#00F5A0', label?: string): void {
    for (let r = 0; r < 2; r++) {
      this.spawn(x, y, 0, 0, 20 + r * 15, 160 + r * 30, color, color, 0.9, 0.6 + r * 0.15, 'ring');
    }

    for (let i = 0; i < 28; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 120 + Math.random() * 260;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        3 + Math.random() * 3,
        5,
        color,
        '#FFFFFF',
        1.0,
        0.5 + Math.random() * 0.3,
        'spark'
      );
    }

    if (label) {
      this.emitFloatingText(x, y - 25, label, color);
    }
  }

  // 4b. Grand Finish Line Checkered Burst & Confetti
  public emitFinishCheckeredBurst(x: number, y: number, color: string = '#00F5A0', rankText: string = '🏆 1ST PLACE'): void {
    const ringColors = ['#FFD700', '#00F5A0', '#00E5FF', '#FF3366'];
    for (let r = 0; r < 3; r++) {
      this.spawn(x, y, 0, 0, 15 + r * 20, 220 + r * 60, ringColors[r % ringColors.length], '#FFD700', 1.0, 0.8 + r * 0.2, 'ring');
    }

    // Checkered flag square particles
    for (let i = 0; i < 24; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 160 + Math.random() * 300;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 60,
        8 + Math.random() * 6,
        14,
        '#FFFFFF',
        '#FFD700',
        1.0,
        1.4 + Math.random() * 0.6,
        'checkered',
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 12,
        'square'
      );
    }

    // Vibrant confetti pieces
    const confettiColors = ['#FFD700', '#00F5A0', '#00E5FF', '#FF3366', '#FFB224', '#B026FF', '#FFFFFF'];
    for (let i = 0; i < 36; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 340;
      const pColor = confettiColors[i % confettiColors.length];
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 80,
        5 + Math.random() * 5,
        10,
        pColor,
        pColor,
        1.0,
        1.5 + Math.random() * 0.7,
        'confetti',
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 10,
        'square'
      );
    }

    // Sparkle fireworks
    for (let i = 0; i < 30; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 280;
      this.spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2.5 + Math.random() * 3.5,
        6,
        '#FFD700',
        '#FFFFFF',
        1.0,
        0.8 + Math.random() * 0.5,
        'spark'
      );
    }

    this.emitFloatingText(x, y - 35, `🏁 ${rankText} 🏁`, '#FFD700');
  }

  // 4c. Ring Shockwave
  public emitRingShockwave(x: number, y: number, color: string = '#FF3366', maxRadius: number = 90): void {
    this.spawn(x, y, 0, 0, 10, maxRadius, color, color, 1.0, 0.4, 'ring');
  }

  // 4d. Celebratory Trail Sparkles
  public emitCelebratorySparkles(x: number, y: number, color: string = '#FFD700'): void {
    if (this.activeCount >= this.maxActiveParticles) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    this.spawn(
      x + (Math.random() - 0.5) * 16,
      y + (Math.random() - 0.5) * 16,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 20,
      2 + Math.random() * 3,
      5,
      Math.random() > 0.4 ? '#FFD700' : color,
      '#FFFFFF',
      0.85,
      0.5 + Math.random() * 0.3,
      'spark'
    );
  }

  // 5. Supersonic Speed Streaks
  public emitSpeedStreak(racerX: number, racerY: number, angle: number, color: string = '#00E5FF'): void {
    if (this.activeCount >= this.maxActiveParticles) return;
    const lateralOffset = (Math.random() - 0.5) * 60;
    const perpAngle = angle + Math.PI / 2;
    const spawnX = racerX + Math.cos(perpAngle) * lateralOffset - Math.cos(angle) * 30;
    const spawnY = racerY + Math.sin(perpAngle) * lateralOffset - Math.sin(angle) * 30;

    this.spawn(
      spawnX,
      spawnY,
      -Math.cos(angle) * (300 + Math.random() * 200),
      -Math.sin(angle) * (300 + Math.random() * 200),
      2,
      2,
      color,
      '#FFFFFF',
      0.8,
      0.25,
      'streak',
      angle
    );
  }

  // 6. Slipstream / Drafting Energy Particles
  public emitSlipstream(leadX: number, leadY: number, followX: number, followY: number, color: string = '#00E5FF'): void {
    if (this.activeCount >= this.maxActiveParticles) return;
    const t = Math.random();
    const px = leadX * (1 - t) + followX * t + (Math.random() - 0.5) * 18;
    const py = leadY * (1 - t) + followY * t + (Math.random() - 0.5) * 18;

    this.spawn(
      px,
      py,
      (leadX - followX) * 0.4 + (Math.random() - 0.5) * 30,
      (leadY - followY) * 0.4 + (Math.random() - 0.5) * 30,
      2 + Math.random() * 2.5,
      4,
      color,
      '#FFFFFF',
      0.75,
      0.3,
      'spark'
    );
  }

  // 7. Floating Text Notifications
  public emitFloatingText(x: number, y: number, text: string, color: string = '#00F5A0'): void {
    this.spawn(x, y, 0, -55, 16, 16, color, color, 1.0, 1.1, 'text', 0, 0, undefined, text);
  }

  // Tick step with dynamic capping and O(1) swap-and-pop
  public update(dt: number): void {
    if (dt > 0.025) {
      this.maxActiveParticles = 250;
    } else if (dt > 0.018) {
      this.maxActiveParticles = 400;
    } else {
      this.maxActiveParticles = 600;
    }

    for (let i = this.activeCount - 1; i >= 0; i--) {
      const p = this.particlePool[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.activeCount--;
        if (i !== this.activeCount) {
          const temp = this.particlePool[i];
          this.particlePool[i] = this.particlePool[this.activeCount];
          this.particlePool[this.activeCount] = temp;
        }
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
        p.vy += 35 * dt;
      } else if (p.type === 'confetti') {
        p.alpha = Math.max(0, 1.0 - Math.pow(progress, 1.8));
        p.vx *= 0.95;
        p.vy += 45 * dt;
      } else if (p.type === 'text') {
        p.alpha = Math.max(0, 1.0 - Math.pow(progress, 2));
      } else if (p.type === 'streak') {
        p.alpha = Math.max(0, 0.8 * (1.0 - progress));
      }
    }
  }

  // High-performance canvas drawing (0 shadowBlur)
  public render(ctx: CanvasRenderingContext2D): void {
    if (this.activeCount === 0) return;

    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particlePool[i];
      if (p.alpha <= 0.01) continue;

      if (p.type === 'text' && p.text) {
        ctx.save();
        ctx.font = 'bold 15px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = p.alpha;
        // Clean dark outline pass
        ctx.strokeStyle = '#0B0F19';
        ctx.lineWidth = 3;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.5, 3 * (1 - p.life / p.maxLife));
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.globalAlpha = p.alpha;
        const angle = p.rotation || 0;
        const len = 35;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(angle) * len, p.y - Math.sin(angle) * len);
        ctx.stroke();
      } else if (p.type === 'checkered') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = p.alpha;
        const s = p.size;
        const half = s / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-half, -half, half, half);
        ctx.fillRect(0, 0, half, half);
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(0, -half, half, half);
        ctx.fillRect(-half, 0, half, half);

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.strokeRect(-half, -half, s, s);
        ctx.restore();
      } else if (p.type === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        ctx.restore();
      } else {
        // Sparks / Flames / Laser arcs
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }
}
