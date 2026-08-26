import { FloatingText, ParticleEffect, GoldenStormZone, SingularityVortexZone } from './types';

export class SerpentParticleSystem {
  private particles: ParticleEffect[] = [];
  private floatingTexts: FloatingText[] = [];
  private maxParticles: number = 800;

  public update(dt: number): void {
    // 1. UPDATE PARTICLES
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
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
        this.particles.splice(i, 1);
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
    // 1. RENDER PARTICLES (Optimized for 60 FPS on low-end hardware)
    for (const p of this.particles) {
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

    // 2. RENDER FLOATING TEXTS
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.translate(ft.x, ft.y);
      ctx.scale(ft.scale, ft.scale);

      ctx.font = 'bold 16px "Chakra Petch", monospace, system-ui';
      ctx.shadowBlur = 10;
      ctx.shadowColor = ft.color;

      // Dark border
      ctx.strokeStyle = '#0B0D12';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, 0, 0);

      // Main vibrant fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // PARTICLE EMITTER HELPERS
  // -------------------------------------------------------------

  // Explosive Death Jackpot
  public emitExplosion(x: number, y: number, color: string, count: number = 40): void {
    const shapes: Array<'circle' | 'square' | 'spark' | 'star'> = ['circle', 'spark', 'square', 'star'];

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 320;
      const life = 0.4 + Math.random() * 0.6;
      const radius = 2 + Math.random() * 5;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        color,
        alpha: 1,
        life: 0,
        maxLife: life,
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  // Boost exhaust sparks from snake tail
  public emitBoostTrail(x: number, y: number, angle: number, color: string): void {
    if (this.particles.length >= this.maxParticles) return;

    // Opposite to movement angle
    const exhaustAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    const speed = 60 + Math.random() * 120;

    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(exhaustAngle) * speed,
      vy: Math.sin(exhaustAngle) * speed,
      radius: 2 + Math.random() * 3,
      color,
      alpha: 0.9,
      life: 0,
      maxLife: 0.25 + Math.random() * 0.15,
      shape: 'spark',
      rotation: exhaustAngle,
    });
  }

  // Intense overheat flame & burning ember particles
  public emitOverheatFlames(x: number, y: number): void {
    if (this.particles.length >= this.maxParticles) return;

    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 100;
      const colors = ['#FF0055', '#FF3300', '#FF7700', '#FFE600'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        radius: 2.5 + Math.random() * 3.5,
        color,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        shape: Math.random() > 0.5 ? 'spark' : 'ember',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  // Food pickup particle burst
  public emitFoodAbsorbed(x: number, y: number, color: string): void {
    for (let i = 0; i < 6; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        shape: 'circle',
      });
    }
  }

  // Golden Storm ambient energy arcs
  public emitGoldenStormParticles(zone: GoldenStormZone): void {
    if (this.particles.length >= this.maxParticles || Math.random() > 0.4) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * zone.radius;
    const px = zone.x + Math.cos(angle) * dist;
    const py = zone.y + Math.sin(angle) * dist;

    // Vortex swirling velocity
    const tangent = angle + Math.PI / 2;
    const swirlSpeed = 60 + (1 - dist / zone.radius) * 100;

    this.particles.push({
      x: px,
      y: py,
      vx: Math.cos(tangent) * swirlSpeed,
      vy: Math.sin(tangent) * swirlSpeed,
      radius: 3 + Math.random() * 4,
      color: Math.random() > 0.3 ? '#FFD700' : '#FFF275',
      alpha: 1,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4,
      shape: 'star',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: 6,
    });
  }

  // Singularity Vortex gravitational accretion & matter inflow particles
  public emitSingularityVortexParticles(vortex: SingularityVortexZone): void {
    if (this.particles.length >= this.maxParticles || Math.random() > 0.35) return;

    const spawnDist = vortex.radius * 0.8 + Math.random() * (vortex.pullRadius * 0.7);
    const angle = Math.random() * Math.PI * 2;
    const px = vortex.x + Math.cos(angle) * spawnDist;
    const py = vortex.y + Math.sin(angle) * spawnDist;

    // Inward spiral velocity: radial inward + strong tangential orbit
    const inwardSpeed = 90 + (1 - spawnDist / vortex.pullRadius) * 160;
    const swirlSpeed = 120 + (1 - spawnDist / vortex.pullRadius) * 200;
    const tangentAngle = angle + Math.PI / 2;

    const vx = -Math.cos(angle) * inwardSpeed + Math.cos(tangentAngle) * swirlSpeed;
    const vy = -Math.sin(angle) * inwardSpeed + Math.sin(tangentAngle) * swirlSpeed;

    const colors = ['#9D4EDD', '#FF007F', '#00E5FF', '#E0AAFF', '#240046'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.particles.push({
      x: px,
      y: py,
      vx,
      vy,
      radius: 2 + Math.random() * 3.5,
      color,
      alpha: 0.9,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.5,
      shape: Math.random() > 0.5 ? 'spark' : 'circle',
      rotation: angle,
      rotationSpeed: (Math.random() - 0.5) * 12,
    });
  }

  // Corpse particle disintegration lasting 1.2s for visual satisfaction
  public emitCorpseDisintegration(body: Array<{ x: number; y: number }>, color: string, duration: number = 1.2): void {
    const step = Math.max(1, Math.floor(body.length / 30));
    for (let i = 0; i < body.length; i += step) {
      const seg = body[i];
      for (let p = 0; p < 3; p++) {
        if (this.particles.length >= this.maxParticles) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = 15 + Math.random() * 65;
        this.particles.push({
          x: seg.x + (Math.random() - 0.5) * 10,
          y: seg.y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 4,
          color,
          alpha: 0.9,
          life: 0,
          maxLife: duration * (0.7 + Math.random() * 0.5),
          shape: Math.random() > 0.5 ? 'ember' : 'spark',
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 4,
        });
      }
    }
  }

  // Golden victory celebration burst
  public emitVictoryBurst(x: number, y: number): void {
    const colors = ['#FFD700', '#FFA500', '#00F5A0', '#00E5FF', '#FFFFFF'];
    for (let i = 0; i < 60; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.8,
        shape: 'star',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  // Add floating text
  public addFloatingText(text: string, x: number, y: number, color: string = '#FFB224'): void {
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
    this.particles = [];
    this.floatingTexts = [];
  }
}
