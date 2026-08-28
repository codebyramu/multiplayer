import { 
  VoidTagPlayerEntity, 
  SanctuaryZone, 
  NebulaZone, 
  SpaceDebris, 
  Particle, 
  ShockwaveFX, 
  FloatingCombatText,
  VoidTagEngineConfig 
} from './types';

export class VoidTagRenderer {
  private starfield: Array<{ x: number; y: number; size: number; alpha: number; twinkleSpeed: number; layer: number }> = [];
  private radarAngle: number = 0;
  private radarRadius: number = 0;
  private animTimer: number = 0;

  constructor() {
    this.initStarfield(1920, 1080);
  }

  private initStarfield(width: number, height: number) {
    this.starfield = [];
    for (let i = 0; i < 160; i++) {
      this.starfield.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.0 + 0.5,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 2.5 + 1.0,
        layer: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  /**
   * Main render method for Void Tag.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    viewWidth: number,
    viewHeight: number,
    players: Record<string, VoidTagPlayerEntity>,
    sanctuaries: SanctuaryZone[],
    nebulae: NebulaZone[],
    debris: SpaceDebris[],
    particles: Particle[],
    shockwaves: ShockwaveFX[],
    floatingTexts: FloatingCombatText[],
    screenShake: { x: number; y: number; intensity: number },
    screenFlash: { color: string; alpha: number; text?: string },
    radarPulseRadius: number,
    matchTimeRemaining: number,
    gameState: 'intro' | 'active' | 'sudden_death' | 'finished',
    localPlayerId?: string,
    config?: VoidTagEngineConfig,
    introTimer?: number
  ): void {
    const arenaW = config?.arenaWidth || 1920;
    const arenaH = config?.arenaHeight || 1080;

    this.animTimer += 0.016;
    this.radarAngle = (this.radarAngle + 0.02) % (Math.PI * 2);

    ctx.save();

    // 1. Screen Shake
    if (screenShake.intensity > 0.1) {
      ctx.translate(screenShake.x, screenShake.y);
    }

    // Scale arena to fit canvas view while maintaining aspect ratio
    const scaleX = viewWidth / arenaW;
    const scaleY = viewHeight / arenaH;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (viewWidth - arenaW * scale) * 0.5;
    const offsetY = (viewHeight - arenaH * scale) * 0.5;

    // Clear background
    ctx.fillStyle = '#06070B';
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 2. Render Cosmic Deep Space Background
    this.renderCosmicBackground(ctx, arenaW, arenaH);

    // 3. Render Stealth Cosmic Nebulae (Floor Layer)
    this.renderNebulae(ctx, nebulae);

    // 4. Render Light Sanctuaries (Floor & Halos)
    this.renderSanctuaries(ctx, sanctuaries);

    // 5. Render Floating Space Debris
    this.renderSpaceDebris(ctx, debris);

    // 6. Render Radar Pulse Wave
    if (radarPulseRadius > 0) {
      this.renderRadarPulse(ctx, radarPulseRadius, arenaW, arenaH, players, localPlayerId);
    }

    // 7. Render Shockwaves (EMP & Warp)
    this.renderShockwaves(ctx, shockwaves);

    // 8. Render Particles (Wisps, Sparks, Trails)
    this.renderParticles(ctx, particles);

    // 9. Render Player Entities (Survivors & Void Hunters)
    this.renderPlayers(ctx, players, localPlayerId);

    // 10. Render Sanctuary Shield Energy Domes (Above players)
    this.renderSanctuaryDomes(ctx, sanctuaries, players);

    // 11. Render Arena Borders & Cyberpunk Corner Brackets
    this.renderArenaBorders(ctx, arenaW, arenaH, gameState);

    // 12. Render Floating Combat Text
    this.renderFloatingCombatText(ctx, floatingTexts);

    // 13. Render Intro Countdown Display
    if (gameState === 'intro' && introTimer !== undefined) {
      this.renderIntroCountdown(ctx, arenaW, arenaH, introTimer);
    }

    ctx.restore();

    // 14. Screen-Space Flash / Corruption Vignette
    if (screenFlash.alpha > 0.01) {
      this.renderScreenFlash(ctx, viewWidth, viewHeight, screenFlash);
    }

    // 15. Off-screen Indicator Arrows (for radar navigation)
    this.renderOffscreenIndicators(ctx, viewWidth, viewHeight, offsetX, offsetY, scale, players, localPlayerId);

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // BACKGROUND & ENVIRONMENT
  // --------------------------------------------------------------------------
  private renderCosmicBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Galactic Radial Glows
    const grad1 = ctx.createRadialGradient(width * 0.3, height * 0.4, 50, width * 0.3, height * 0.4, width * 0.6);
    grad1.addColorStop(0, 'rgba(38, 12, 60, 0.45)');
    grad1.addColorStop(1, 'rgba(6, 7, 11, 0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, width, height);

    const grad2 = ctx.createRadialGradient(width * 0.75, height * 0.7, 80, width * 0.75, height * 0.7, width * 0.5);
    grad2.addColorStop(0, 'rgba(10, 30, 65, 0.35)');
    grad2.addColorStop(1, 'rgba(6, 7, 11, 0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, width, height);

    // Subtle Sci-Fi Grid
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.06)';
    ctx.lineWidth = 1;
    const gridSize = 64;

    ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Starfield
    for (const star of this.starfield) {
      const alpha = star.alpha * (0.6 + 0.4 * Math.sin(this.animTimer * star.twinkleSpeed));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --------------------------------------------------------------------------
  // NEBULAE (STEALTH ZONES)
  // --------------------------------------------------------------------------
  private renderNebulae(ctx: CanvasRenderingContext2D, nebulae: NebulaZone[]): void {
    for (const neb of nebulae) {
      ctx.save();

      // Outer gas cloud gradients
      const grad = ctx.createRadialGradient(neb.x, neb.y, neb.radius * 0.1, neb.x, neb.y, neb.radius);
      grad.addColorStop(0, 'rgba(157, 78, 221, 0.45)');
      grad.addColorStop(0.5, 'rgba(76, 29, 149, 0.28)');
      grad.addColorStop(0.85, 'rgba(30, 27, 75, 0.12)');
      grad.addColorStop(1, 'rgba(15, 10, 30, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner swirling cloud lobes
      for (const cloud of neb.cloudOffsets) {
        const cx = neb.x + cloud.x + Math.sin(this.animTimer * cloud.speed + cloud.phase) * 16;
        const cy = neb.y + cloud.y + Math.cos(this.animTimer * cloud.speed + cloud.phase) * 16;

        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloud.r);
        cGrad.addColorStop(0, cloud.color);
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, cloud.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stealth Zone Perimeter Indicator
      ctx.strokeStyle = 'rgba(157, 78, 221, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -this.animTimer * 15;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stealth label
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = 'rgba(216, 180, 254, 0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('STEALTH NEBULA', neb.x, neb.y - neb.radius + 18);

      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // LIGHT SANCTUARIES
  // --------------------------------------------------------------------------
  private renderSanctuaries(ctx: CanvasRenderingContext2D, sanctuaries: SanctuaryZone[]): void {
    for (const sanc of sanctuaries) {
      ctx.save();
      const energyPercent = sanc.energy / sanc.maxEnergy;

      // Color scheme based on charge
      let primaryColor = '#00F5A0'; // Mint
      let glowColor = 'rgba(0, 245, 160, 0.3)';
      if (sanc.isDepleted || energyPercent < 0.2) {
        primaryColor = '#FF3366'; // Crimson warning
        glowColor = 'rgba(255, 51, 102, 0.25)';
      } else if (energyPercent < 0.55) {
        primaryColor = '#FFB224'; // Amber
        glowColor = 'rgba(255, 178, 36, 0.25)';
      }

      // Base floor glow
      const floorGrad = ctx.createRadialGradient(sanc.x, sanc.y, 0, sanc.x, sanc.y, sanc.radius);
      floorGrad.addColorStop(0, glowColor);
      floorGrad.addColorStop(0.7, glowColor.replace('0.3', '0.08').replace('0.25', '0.05'));
      floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.arc(sanc.x, sanc.y, sanc.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Glyph Outer Ring
      ctx.save();
      ctx.translate(sanc.x, sanc.y);
      ctx.rotate(sanc.rotationAngle);

      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, sanc.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Glyphs / Notch ticks
      const notchCount = 12;
      for (let i = 0; i < notchCount; i++) {
        const a = (i / notchCount) * Math.PI * 2;
        const innerR = sanc.radius - 8;
        const outerR = sanc.radius + 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
        ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
        ctx.stroke();
      }
      ctx.restore();

      // Energy Gauge Arc
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + energyPercent * Math.PI * 2;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sanc.x, sanc.y, sanc.radius - 5, startAngle, endAngle);
      ctx.stroke();

      // Central Light Beacon Core
      const beaconRadius = 16 + Math.sin(this.animTimer * 3 + sanc.id) * 3;
      const beaconGrad = ctx.createRadialGradient(sanc.x, sanc.y, 0, sanc.x, sanc.y, beaconRadius * 2);
      beaconGrad.addColorStop(0, '#FFFFFF');
      beaconGrad.addColorStop(0.3, primaryColor);
      beaconGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = beaconGrad;
      ctx.beginPath();
      ctx.arc(sanc.x, sanc.y, beaconRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Energy Percentage Text
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillStyle = primaryColor;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(energyPercent * 100)}%`, sanc.x, sanc.y + 36);

      if (sanc.isDepleted) {
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillStyle = '#FF3366';
        ctx.fillText('DEPLETED', sanc.x, sanc.y + 50);
      }

      ctx.restore();
    }
  }

  private renderSanctuaryDomes(
    ctx: CanvasRenderingContext2D,
    sanctuaries: SanctuaryZone[],
    players: Record<string, VoidTagPlayerEntity>
  ): void {
    for (const sanc of sanctuaries) {
      if (sanc.isDepleted || sanc.energy < 5) continue;

      // Check if any survivor is currently inside
      const survivorsInside = Object.values(players).filter(p => !p.isHunter && p.isInSanctuary && p.sanctuaryId === sanc.id);
      if (survivorsInside.length === 0) continue;

      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(this.animTimer * 6);
      ctx.strokeStyle = `rgba(0, 245, 160, ${0.4 + pulse * 0.3})`;
      ctx.lineWidth = 3;

      // Draw forcefield dome perimeter
      ctx.beginPath();
      ctx.arc(sanc.x, sanc.y, sanc.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Energy tether rays from beacon to survivors
      for (const s of survivorsInside) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sanc.x, sanc.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Shimmering shield bubble around survivor
        ctx.strokeStyle = 'rgba(0, 245, 160, 0.8)';
        ctx.fillStyle = 'rgba(0, 245, 160, 0.15)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // SPACE DEBRIS
  // --------------------------------------------------------------------------
  private renderSpaceDebris(ctx: CanvasRenderingContext2D, debris: SpaceDebris[]): void {
    for (const deb of debris) {
      ctx.save();
      ctx.translate(deb.x, deb.y);
      ctx.rotate(deb.rotation);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.moveTo(deb.vertices[0].x + 4, deb.vertices[0].y + 4);
      for (let i = 1; i < deb.vertices.length; i++) {
        ctx.lineTo(deb.vertices[i].x + 4, deb.vertices[i].y + 4);
      }
      ctx.closePath();
      ctx.fill();

      // Debris Body
      ctx.fillStyle = deb.color;
      ctx.beginPath();
      ctx.moveTo(deb.vertices[0].x, deb.vertices[0].y);
      for (let i = 1; i < deb.vertices.length; i++) {
        ctx.lineTo(deb.vertices[i].x, deb.vertices[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Neon Rim
      ctx.strokeStyle = deb.glowColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner metallic core highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(deb.vertices[0].x * 0.5, deb.vertices[0].y * 0.5);
      for (let i = 1; i < deb.vertices.length; i += 2) {
        ctx.lineTo(deb.vertices[i].x * 0.5, deb.vertices[i].y * 0.5);
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // PLAYER ENTITIES (SURVIVORS & VOID HUNTERS)
  // --------------------------------------------------------------------------
  private renderPlayers(
    ctx: CanvasRenderingContext2D,
    players: Record<string, VoidTagPlayerEntity>,
    localPlayerId?: string
  ): void {
    for (const p of Object.values(players)) {
      if (p.isEliminated) continue;

      ctx.save();
      // Apply stealth opacity if hidden
      let alpha = p.stealthAlpha;
      // If local player is viewing themselves, give them slight visibility cue even in stealth
      if (p.id === localPlayerId && p.isStealthed) {
        alpha = Math.max(0.4, p.stealthAlpha);
      }
      ctx.globalAlpha = alpha;

      // Motion Trail
      this.renderPlayerTrail(ctx, p);

      if (p.isHunter) {
        this.renderHunterEntity(ctx, p);
      } else {
        this.renderSurvivorEntity(ctx, p, p.id === localPlayerId);
      }

      // Player Name & Role Label
      this.renderPlayerLabel(ctx, p, p.id === localPlayerId);

      // Stun visual overlay
      if (p.isStunned) {
        this.renderStunOverlay(ctx, p);
      }

      ctx.restore();
    }
  }

  private renderPlayerTrail(ctx: CanvasRenderingContext2D, p: VoidTagPlayerEntity): void {
    if (p.trailHistory.length < 2) return;

    ctx.save();
    for (let i = 0; i < p.trailHistory.length; i++) {
      const pt = p.trailHistory[i];
      const trailAlpha = pt.alpha * (p.isHunter ? 0.4 : 0.3) * (p.isDashing ? 2.0 : 1.0);
      const r = p.radius * (0.3 + (i / p.trailHistory.length) * 0.6);

      ctx.fillStyle = p.isHunter ? `rgba(157, 78, 221, ${trailAlpha})` : `rgba(0, 229, 255, ${trailAlpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // VOID HUNTER RENDERING (WITH PROCEDURAL TENTACLES)
  // --------------------------------------------------------------------------
  private renderHunterEntity(ctx: CanvasRenderingContext2D, hunter: VoidTagPlayerEntity): void {
    ctx.save();
    ctx.translate(hunter.x, hunter.y);

    // 1. Eerie Void Singularity Aura
    const auraRadius = hunter.radius * 2.8;
    const auraGrad = ctx.createRadialGradient(0, 0, hunter.radius * 0.5, 0, 0, auraRadius);
    auraGrad.addColorStop(0, 'rgba(157, 78, 221, 0.7)');
    auraGrad.addColorStop(0.4, 'rgba(90, 0, 140, 0.45)');
    auraGrad.addColorStop(0.8, 'rgba(255, 0, 90, 0.2)');
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Procedural Void Tentacles
    const tentacleCount = 5;
    ctx.lineCap = 'round';

    for (let i = 0; i < tentacleCount; i++) {
      const baseAngle = hunter.angle + Math.PI + ((i - (tentacleCount - 1) / 2) * 0.5);
      const phase = hunter.tentaclePhases[i] || 0;
      const tentacleLength = hunter.radius * 2.2 + Math.sin(this.animTimer * 4 + phase) * 8;

      ctx.strokeStyle = i % 2 === 0 ? '#9D4EDD' : '#FF007F';
      ctx.lineWidth = 3.5;

      ctx.beginPath();
      ctx.moveTo(Math.cos(baseAngle) * hunter.radius * 0.8, Math.sin(baseAngle) * hunter.radius * 0.8);

      // Chained Bezier Joints
      const midAngle = baseAngle + Math.sin(this.animTimer * 6 + phase) * 0.6;
      const midX = Math.cos(midAngle) * (tentacleLength * 0.5);
      const midY = Math.sin(midAngle) * (tentacleLength * 0.5);

      const tipAngle = midAngle + Math.cos(this.animTimer * 5 + phase) * 0.7;
      const tipX = Math.cos(tipAngle) * tentacleLength;
      const tipY = Math.sin(tipAngle) * tentacleLength;

      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Tip node
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Central Dark Core Chassis
    ctx.rotate(hunter.angle);

    ctx.fillStyle = '#0E0416';
    ctx.strokeStyle = '#FF3366';
    ctx.lineWidth = 2.5;

    // Menacing Spiked Hull
    ctx.beginPath();
    ctx.moveTo(hunter.radius + 6, 0);
    ctx.lineTo(-hunter.radius * 0.8, hunter.radius * 0.9);
    ctx.lineTo(-hunter.radius * 0.4, 0);
    ctx.lineTo(-hunter.radius * 0.8, -hunter.radius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Glowing Crimson Void Eye
    ctx.fillStyle = '#FF0055';
    ctx.beginPath();
    ctx.arc(hunter.radius * 0.2, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // SURVIVOR RENDERING
  // --------------------------------------------------------------------------
  private renderSurvivorEntity(
    ctx: CanvasRenderingContext2D,
    survivor: VoidTagPlayerEntity,
    isLocal: boolean
  ): void {
    ctx.save();
    ctx.translate(survivor.x, survivor.y);
    ctx.rotate(survivor.angle);

    const shipColor = survivor.color || '#00F5A0';

    // 1. Thruster Glow
    const thrustLen = 12 + Math.random() * 8;
    const thrustGrad = ctx.createLinearGradient(0, 0, -thrustLen, 0);
    thrustGrad.addColorStop(0, '#00E5FF');
    thrustGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

    ctx.fillStyle = thrustGrad;
    ctx.beginPath();
    ctx.moveTo(-survivor.radius * 0.7, -4);
    ctx.lineTo(-survivor.radius * 0.7 - thrustLen, 0);
    ctx.lineTo(-survivor.radius * 0.7, 4);
    ctx.closePath();
    ctx.fill();

    // 2. Main Hull
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = shipColor;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(survivor.radius + 4, 0);
    ctx.lineTo(-survivor.radius * 0.7, survivor.radius * 0.85);
    ctx.lineTo(-survivor.radius * 0.3, 0);
    ctx.lineTo(-survivor.radius * 0.7, -survivor.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Cockpit Canopy / Energy Core
    ctx.fillStyle = isLocal ? '#00F5A0' : '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(survivor.radius * 0.1, 0, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. Local Player Focus Indicator
    if (isLocal) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, survivor.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private renderPlayerLabel(
    ctx: CanvasRenderingContext2D,
    p: VoidTagPlayerEntity,
    isLocal: boolean
  ): void {
    ctx.save();
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';

    const label = p.name + (isLocal ? ' (YOU)' : '');
    const color = p.isHunter ? '#FF3366' : '#00F5A0';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(p.x - 45, p.y - p.radius - 22, 90, 14);

    ctx.fillStyle = color;
    ctx.fillText(label, p.x, p.y - p.radius - 11);

    if (p.isHunter) {
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.fillStyle = '#FF0055';
      ctx.fillText('[HUNTER]', p.x, p.y - p.radius - 24);
    }

    ctx.restore();
  }

  private renderStunOverlay(ctx: CanvasRenderingContext2D, p: VoidTagPlayerEntity): void {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Crackling EMP Lightning Sparks
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + (Math.random() * 0.4);
      const r = p.radius + 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.5));
      ctx.lineTo(Math.cos(a + 0.3) * (r * 0.8), Math.sin(a + 0.3) * (r * 0.8));
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }

    // Stun Text
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillStyle = '#00E5FF';
    ctx.textAlign = 'center';
    ctx.fillText(`STUNNED (${p.stunTimer.toFixed(1)}s)`, 0, p.radius + 18);

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // RADAR PULSE
  // --------------------------------------------------------------------------
  private renderRadarPulse(
    ctx: CanvasRenderingContext2D,
    radius: number,
    arenaW: number,
    arenaH: number,
    players: Record<string, VoidTagPlayerEntity>,
    localPlayerId?: string
  ): void {
    const centerX = arenaW * 0.5;
    const centerY = arenaH * 0.5;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Secondary echo
    if (radius > 60) {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ping blips near wave
    for (const p of Object.values(players)) {
      if (p.isEliminated) continue;
      const d = Math.hypot(p.x - centerX, p.y - centerY);
      if (Math.abs(d - radius) < 35) {
        ctx.fillStyle = p.isHunter ? '#FF0055' : '#00F5A0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // SHOCKWAVES & PARTICLES
  // --------------------------------------------------------------------------
  private renderShockwaves(ctx: CanvasRenderingContext2D, shockwaves: ShockwaveFX[]): void {
    for (const sw of shockwaves) {
      ctx.save();
      const progress = sw.life / sw.maxLife; // 1 to 0
      const alpha = progress * 0.8;

      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4 * progress + 1;

      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Jagged EMP electric arcs
      const sparks = 8;
      for (let i = 0; i < sparks; i++) {
        const a = (i / sparks) * Math.PI * 2;
        const r1 = sw.radius * 0.85;
        const r2 = sw.radius * 1.1;
        ctx.beginPath();
        ctx.moveTo(sw.x + Math.cos(a) * r1, sw.y + Math.sin(a) * r1);
        ctx.lineTo(sw.x + Math.cos(a + 0.1) * sw.radius, sw.y + Math.sin(a + 0.1) * sw.radius);
        ctx.lineTo(sw.x + Math.cos(a) * r2, sw.y + Math.sin(a) * r2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    ctx.save();
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.alpha));

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // ARENA BORDERS & HUD OVERLAYS
  // --------------------------------------------------------------------------
  private renderArenaBorders(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    gameState: 'intro' | 'active' | 'sudden_death' | 'finished'
  ): void {
    ctx.save();
    const borderColor = gameState === 'sudden_death' ? '#FF3366' : '#9D4EDD';

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;

    ctx.strokeRect(0, 0, width, height);

    // Cyberpunk Corner Brackets
    const bracketSize = 36;
    ctx.lineWidth = 5;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(0, bracketSize);
    ctx.lineTo(0, 0);
    ctx.lineTo(bracketSize, 0);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - bracketSize, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, bracketSize);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(0, height - bracketSize);
    ctx.lineTo(0, height);
    ctx.lineTo(bracketSize, height);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - bracketSize, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, height - bracketSize);
    ctx.stroke();

    ctx.restore();
  }

  private renderFloatingCombatText(ctx: CanvasRenderingContext2D, texts: FloatingCombatText[]): void {
    ctx.save();
    for (const t of texts) {
      const alpha = t.life / t.maxLife;
      ctx.font = `bold ${t.fontSize}px "Courier New", monospace`;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.textAlign = 'center';

      // Outline pass
      ctx.strokeStyle = '#06070B';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  private renderScreenFlash(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    flash: { color: string; alpha: number; text?: string }
  ): void {
    ctx.save();
    ctx.fillStyle = flash.color;
    ctx.globalAlpha = Math.max(0, Math.min(1, flash.alpha));
    ctx.fillRect(0, 0, width, height);

    // Dark Corruption Vignette
    const vigGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.3, width * 0.5, height * 0.5, width * 0.7);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(15, 0, 30, 0.85)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    if (flash.text) {
      ctx.font = '900 42px "Courier New", monospace';
      ctx.textAlign = 'center';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeText(flash.text, width * 0.5, height * 0.45);

      ctx.fillStyle = '#FF0055';
      ctx.fillText(flash.text, width * 0.5, height * 0.45);
    }
    ctx.restore();
  }

  private renderOffscreenIndicators(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    players: Record<string, VoidTagPlayerEntity>,
    localPlayerId?: string
  ): void {
    if (!localPlayerId || !players[localPlayerId]) return;
    const local = players[localPlayerId];

    for (const p of Object.values(players)) {
      if (p.id === localPlayerId || p.isEliminated) continue;

      const screenX = offsetX + p.x * scale;
      const screenY = offsetY + p.y * scale;

      const margin = 28;
      const isOffscreen = screenX < margin || screenX > viewW - margin || screenY < margin || screenY > viewH - margin;

      if (isOffscreen) {
        const clampedX = Math.max(margin, Math.min(viewW - margin, screenX));
        const clampedY = Math.max(margin, Math.min(viewH - margin, screenY));

        const angle = Math.atan2(p.y - local.y, p.x - local.x);

        ctx.save();
        ctx.translate(clampedX, clampedY);
        ctx.rotate(angle);

        ctx.fillStyle = p.isHunter ? '#FF0055' : '#00F5A0';

        // Draw pointer arrow
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }
  }

  // --------------------------------------------------------------------------
  // INTRO COUNTDOWN OVERLAY
  // --------------------------------------------------------------------------
  private renderIntroCountdown(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    introTimer: number
  ): void {
    ctx.save();
    const cx = width * 0.5;
    const cy = height * 0.5;

    const countNumber = Math.max(1, Math.ceil(introTimer));
    const fraction = introTimer % 1;
    const pulseScale = 1.0 + (1.0 - fraction) * 0.25;

    // Dark backdrop pill
    ctx.fillStyle = 'rgba(6, 7, 11, 0.85)';
    ctx.strokeStyle = '#9D4EDD';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - 220, cy - 80, 440, 160, 16);
    ctx.fill();
    ctx.stroke();

    // Outer pulsating energy ring
    ctx.strokeStyle = 'rgba(157, 78, 221, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 10, 50 * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Title
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillStyle = '#D8B4FE';
    ctx.textAlign = 'center';
    ctx.fillText('VOID HUNTER AWAKENS IN', cx, cy - 45);

    // Big Countdown Digit
    ctx.font = `900 ${Math.floor(48 * pulseScale)}px "Courier New", monospace`;
    ctx.fillStyle = countNumber === 1 ? '#FF0055' : countNumber === 2 ? '#FFB224' : '#00F5A0';
    ctx.fillText(`${countNumber}`, cx, cy + 12);

    // Subtext instruction
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#00F5A0';
    ctx.fillText('SEEK SANCTUARY OR PREPARE EMP PULSE', cx, cy + 55);

    ctx.restore();
  }
}
