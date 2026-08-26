import { Particle, FloatingText, ShockwaveEffect, EliminationBanner } from './types';

export class ParticleSystem {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public shockwaves: ShockwaveEffect[] = [];
  public eliminationBanners: EliminationBanner[] = [];

  // Trauma-based screen shake
  public trauma: number = 0;
  private maxShakeOffset: number = 18;
  private maxShakeAngle: number = 0.05; // radians

  public update(dt: number): void {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.rotation += p.rotationSpeed * dt;

      // Alpha fadeout
      const progress = p.life / p.maxLife;
      p.alpha = Math.max(0, 1 - progress);
    }

    // 2. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;

      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      ft.y += ft.vy * dt;
      const progress = ft.life / ft.maxLife;
      ft.alpha = Math.max(0, 1 - Math.pow(progress, 2));
    }

    // 3. Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;

      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      const progress = sw.life / sw.maxLife;
      sw.radius += sw.speed * dt;
      sw.alpha = Math.max(0, 1 - progress);
    }

    // 4. Update elimination banners
    for (let i = this.eliminationBanners.length - 1; i >= 0; i--) {
      const eb = this.eliminationBanners[i];
      eb.life += dt;

      if (eb.life >= eb.maxLife) {
        this.eliminationBanners.splice(i, 1);
        continue;
      }

      const progress = eb.life / eb.maxLife;
      // Quick fade in, hold, fade out
      if (progress < 0.15) {
        eb.alpha = progress / 0.15;
      } else if (progress > 0.75) {
        eb.alpha = Math.max(0, (1 - progress) / 0.25);
      } else {
        eb.alpha = 1.0;
      }
    }

    // 5. Decay screen shake trauma
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
    }
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public getShakeTransform(): { offsetX: number; offsetY: number; angle: number } {
    if (this.trauma <= 0) return { offsetX: 0, offsetY: 0, angle: 0 };
    const shake = this.trauma * this.trauma; // Non-linear response
    const offsetX = (Math.random() * 2 - 1) * this.maxShakeOffset * shake;
    const offsetY = (Math.random() * 2 - 1) * this.maxShakeOffset * shake;
    const angle = (Math.random() * 2 - 1) * this.maxShakeAngle * shake;
    return { offsetX, offsetY, angle };
  }

  // --- PARTICLE EMITTERS --- //

  public emitShockwave(sourcePlayerId: string, x: number, y: number, color: string, maxRadius: number = 220): void {
    this.shockwaves.push({
      id: `sw_${Date.now()}_${Math.random()}`,
      sourcePlayerId,
      x,
      y,
      radius: 10,
      maxRadius,
      speed: 480,
      force: 650,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 0.45,
    });

    this.addTrauma(0.35);

    // Emit ring particles
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 200 + Math.random() * 250;
      this.particles.push({
        x,
        y,
        z: 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 30 + Math.random() * 60,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        shape: 'spark',
        rotation: angle,
        rotationSpeed: 0,
        gravity: 100,
        drag: 0.92,
      });
    }
  }

  public emitTileCrumbleDebris(x: number, y: number, tileColor: string = '#FF3366'): void {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        z: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: -20 - Math.random() * 100, // Falling downward into abyss
        size: 4 + Math.random() * 8,
        color: Math.random() < 0.6 ? tileColor : '#FFB224',
        alpha: 1.0,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        shape: 'shard',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 350,
        drag: 0.98,
      });
    }
  }

  /**
   * Emits spiraling cosmic vortex sparks trailing behind a player plunging into the abyss.
   */
  public emitVoidVortexSparks(x: number, y: number, z: number, color: string): void {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const spiralAngle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 25;
      const tangentVx = -Math.sin(spiralAngle) * 90;
      const tangentVy = Math.cos(spiralAngle) * 90;

      this.particles.push({
        x: x + Math.cos(spiralAngle) * dist,
        y: y + Math.sin(spiralAngle) * dist,
        z,
        vx: tangentVx + (Math.random() - 0.5) * 40,
        vy: tangentVy + (Math.random() - 0.5) * 40,
        vz: -80 - Math.random() * 120, // Rapid plunge downward
        size: 3 + Math.random() * 4,
        color: Math.random() < 0.7 ? color : '#FF3366',
        alpha: 1.0,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        shape: 'spark',
        rotation: spiralAngle,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 400,
        drag: 0.96,
      });
    }
  }

  public emitJumpPuff(x: number, y: number, playerColor: string): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 30 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        z: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 10 + Math.random() * 20,
        size: 2 + Math.random() * 3,
        color: playerColor,
        alpha: 0.8,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.15,
        shape: 'circle',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 50,
        drag: 0.9,
      });
    }
  }

  public emitAirDashStreak(x: number, y: number, z: number, dashVector: { x: number; y: number }, color: string): void {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const offset = (Math.random() - 0.5) * 15;
      this.particles.push({
        x: x + offset,
        y: y + offset,
        z,
        vx: -dashVector.x * (100 + Math.random() * 150),
        vy: -dashVector.y * (100 + Math.random() * 150),
        vz: (Math.random() - 0.5) * 40,
        size: 4 + Math.random() * 5,
        color,
        alpha: 0.9,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        shape: 'spark',
        rotation: Math.atan2(dashVector.y, dashVector.x),
        rotationSpeed: 0,
        gravity: 0,
        drag: 0.88,
      });
    }
  }

  public emitEliminationBurst(x: number, y: number, color: string): void {
    this.addTrauma(0.5);

    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 300;
      this.particles.push({
        x,
        y,
        z: -20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 50 + Math.random() * 150,
        size: 3 + Math.random() * 7,
        color: Math.random() < 0.6 ? color : '#FFFFFF',
        alpha: 1.0,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        shape: Math.random() < 0.5 ? 'spark' : 'shard',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
        gravity: 200,
        drag: 0.95,
      });
    }
  }

  public addFloatingText(x: number, y: number, z: number, text: string, color: string, fontSize: number = 14): void {
    this.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      x,
      y,
      z,
      text,
      color,
      fontSize,
      alpha: 1.0,
      life: 0,
      maxLife: 1.2,
      vy: -35,
    });
  }

  public addEliminationBanner(playerId: string, playerName: string, playerColor: string, rank: number, totalPlayers: number): void {
    this.eliminationBanners.push({
      id: `eb_${Date.now()}_${Math.random()}`,
      playerId,
      playerName,
      playerColor,
      rank,
      totalPlayers,
      life: 0,
      maxLife: 2.8,
      alpha: 0,
    });
  }

  public clear(): void {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.eliminationBanners = [];
    this.trauma = 0;
  }
}
