import { FloatingText, ParticleEffect, GoldenStormZone, SingularityVortexZone } from './types';

export class SerpentParticleSystem {
  private static readonly POOL_SIZE = 600;
  private particlePool: ParticleEffect[] = [];
  private activeCount: number = 0;
  private floatingTexts: FloatingText[] = [];
  private maxActiveParticles: number = 600;

  constructor() {
    // Pre-allocate particle pool to completely prevent GC pauses
    for (let i = 0; i < SerpentParticleSystem.POOL_SIZE; i++) {
      this.particlePool.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 2,
        color: '#FFFFFF',
        alpha: 1,
        life: 0,
        maxLife: 1,
        shape: 'circle',
        rotation: 0,
        rotationSpeed: 0,
      });
    }
  }

  public update(dt: number): void {
    // Dynamic particle capping based on frame time: throttle if FPS drops below 50
    if (dt > 0.025) {
      this.maxActiveParticles = 250;
    } else if (dt > 0.018) {
      this.maxActiveParticles = 400;
    } else {
      this.maxActiveParticles = 600;
    }

    // 1. UPDATE PARTICLES (In-place array with O(1) swap-and-pop removal)
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const p = this.particlePool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95; // Atmospheric friction
      p.vy *= 0.95;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed * dt;
      }

      if (p.life >= p.maxLife) {
        // Swap expired particle with last active particle (O(1), 0 allocations)
        this.activeCount--;
        if (i !== this.activeCount) {
          const temp = this.particlePool[i];
          this.particlePool[i] = this.particlePool[this.activeCount];
          this.particlePool[this.activeCount] = temp;
        }
      }
    }

    // 2. UPDATE FLOATING TEXTS
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.vy *= 0.92;
      ft.life += dt;
      ft.alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      ft.scale = 1 + Math.sin((ft.life / ft.maxLife) * Math.PI) * 0.3;

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.activeCount === 0 && this.floatingTexts.length === 0) return;

    // 1. RENDER PARTICLES (Optimized batching without shadowBlur)
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particlePool[i];
      if (p.alpha <= 0.01) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'square') {
        if (p.rotation) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          const s = p.radius * 2;
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        } else {
          ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
        }
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 2.5, p.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate(p.rotation);
        this.drawStar(ctx, 0, 0, 4, p.radius * 2, p.radius * 0.7);
        ctx.restore();
      } else {
        // Fast default circle (no save/restore overhead)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // 2. RENDER FLOATING TEXTS (Clean outline rendering without shadowBlur)
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 16px "Chakra Petch", monospace, system-ui';

      for (const ft of this.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.translate(ft.x, ft.y);
        ctx.scale(ft.scale, ft.scale);

        // Crisp dark outline pass
        ctx.strokeStyle = '#0B0D12';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, 0, 0);

        // Vibrant main fill
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, 0, 0);

        ctx.restore();
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // PARTICLE EMITTER HELPERS (Using pre-allocated pool)
  // -------------------------------------------------------------
  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    radius: number,
    color: string,
    maxLife: number,
    shape: 'circle' | 'square' | 'spark' | 'star' | 'ember' = 'circle',
    rotation: number = 0,
    rotationSpeed: number = 0
  ): void {
    if (this.activeCount >= this.maxActiveParticles || this.activeCount >= SerpentParticleSystem.POOL_SIZE) return;

    const p = this.particlePool[this.activeCount];
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.radius = radius;
    p.color = color;
    p.alpha = 1.0;
    p.life = 0;
    p.maxLife = maxLife;
    p.shape = shape;
    p.rotation = rotation;
    p.rotationSpeed = rotationSpeed;

    this.activeCount++;
  }

  // Explosive Death Jackpot
  public emitExplosion(x: number, y: number, color: string, count: number = 40): void {
    const shapes: Array<'circle' | 'square' | 'spark' | 'star'> = ['circle', 'spark', 'square', 'star'];
    const safeCount = Math.min(count, this.maxActiveParticles - this.activeCount);

    for (let i = 0; i < safeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 320;
      const life = 0.4 + Math.random() * 0.6;
      const radius = 2 + Math.random() * 5;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        radius,
        color,
        life,
        shape,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 10
      );
    }
  }

  // Boost exhaust sparks from snake tail
  public emitBoostTrail(x: number, y: number, angle: number, color: string): void {
    if (this.activeCount >= this.maxActiveParticles) return;

    const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const speed = 60 + Math.random() * 120;

    this.spawnParticle(
      x + (Math.random() - 0.5) * 6,
      y + (Math.random() - 0.5) * 6,
      Math.cos(exhaustAngle) * speed,
      Math.sin(exhaustAngle) * speed,
      2 + Math.random() * 3,
      color,
      0.25 + Math.random() * 0.15,
      'spark',
      exhaustAngle
    );
  }

  // Intense overheat flame & burning ember particles
  public emitOverheatFlames(x: number, y: number): void {
    if (this.activeCount >= this.maxActiveParticles) return;

    const colors = ['#FF0055', '#FF3300', '#FF7700', '#FFE600'];
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 100;
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.spawnParticle(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 20,
        2.5 + Math.random() * 3.5,
        color,
        0.35 + Math.random() * 0.25,
        Math.random() > 0.5 ? 'spark' : 'ember',
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 8
      );
    }
  }

  // Food pickup particle burst
  public emitFoodAbsorbed(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;

      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2 + Math.random() * 2,
        color,
        0.3 + Math.random() * 0.2,
        'circle'
      );
    }
  }

  // Golden Storm ambient energy arcs
  public emitGoldenStormParticles(zone: GoldenStormZone): void {
    if (this.activeCount >= this.maxActiveParticles || Math.random() > 0.4) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * zone.radius;
    const px = zone.x + Math.cos(angle) * dist;
    const py = zone.y + Math.sin(angle) * dist;

    const tangent = angle + Math.PI / 2;
    const swirlSpeed = 60 + (1 - dist / zone.radius) * 100;

    this.spawnParticle(
      px,
      py,
      Math.cos(tangent) * swirlSpeed,
      Math.sin(tangent) * swirlSpeed,
      3 + Math.random() * 4,
      Math.random() > 0.3 ? '#FFD700' : '#FFF275',
      0.6 + Math.random() * 0.4,
      'star',
      Math.random() * Math.PI * 2,
      6
    );
  }

  // Singularity Vortex gravitational accretion & matter inflow particles
  public emitSingularityVortexParticles(vortex: SingularityVortexZone): void {
    if (this.activeCount >= this.maxActiveParticles || Math.random() > 0.35) return;

    const spawnDist = vortex.radius * 0.8 + Math.random() * (vortex.pullRadius * 0.7);
    const angle = Math.random() * Math.PI * 2;
    const px = vortex.x + Math.cos(angle) * spawnDist;
    const py = vortex.y + Math.sin(angle) * spawnDist;

    const inwardSpeed = 90 + (1 - spawnDist / vortex.pullRadius) * 160;
    const swirlSpeed = 120 + (1 - spawnDist / vortex.pullRadius) * 200;
    const tangentAngle = angle + Math.PI / 2;

    const vx = -Math.cos(angle) * inwardSpeed + Math.cos(tangentAngle) * swirlSpeed;
    const vy = -Math.sin(angle) * inwardSpeed + Math.sin(tangentAngle) * swirlSpeed;

    const colors = ['#9D4EDD', '#FF007F', '#00E5FF', '#E0AAFF', '#240046'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.spawnParticle(
      px,
      py,
      vx,
      vy,
      2 + Math.random() * 3.5,
      color,
      0.5 + Math.random() * 0.5,
      Math.random() > 0.5 ? 'spark' : 'circle',
      angle,
      (Math.random() - 0.5) * 12
    );
  }

  // Corpse particle disintegration lasting 1.2s
  public emitCorpseDisintegration(body: Array<{ x: number; y: number }>, color: string, duration: number = 1.2): void {
    const step = Math.max(1, Math.floor(body.length / 30));
    for (let i = 0; i < body.length; i += step) {
      const seg = body[i];
      for (let p = 0; p < 3; p++) {
        if (this.activeCount >= this.maxActiveParticles) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 15 + Math.random() * 65;

        this.spawnParticle(
          seg.x + (Math.random() - 0.5) * 10,
          seg.y + (Math.random() - 0.5) * 10,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          2 + Math.random() * 4,
          color,
          duration * (0.7 + Math.random() * 0.5),
          Math.random() > 0.5 ? 'ember' : 'spark',
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 4
        );
      }
    }
  }

  // Golden victory celebration burst
  public emitVictoryBurst(x: number, y: number): void {
    const colors = ['#FFD700', '#FFA500', '#00F5A0', '#00E5FF', '#FFFFFF'];
    for (let i = 0; i < 60; i++) {
      if (this.activeCount >= this.maxActiveParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 260;

      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        3 + Math.random() * 4,
        colors[Math.floor(Math.random() * colors.length)],
        0.8 + Math.random() * 0.8,
        'star',
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 8
      );
    }
  }

  // Add floating text
  public addFloatingText(text: string, x: number, y: number, color: string = '#FFB224'): void {
    if (this.floatingTexts.length >= 20) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      text,
      x,
      y,
      color,
      scale: 0.5,
      alpha: 1,
      vy: -60,
      life: 0,
      maxLife: 0.9,
    });
  }

  private drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    spikes: number,
    outerRadius: number,
    innerRadius: number
  ): void {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  public clear(): void {
    this.activeCount = 0;
    this.floatingTexts = [];
  }
}
