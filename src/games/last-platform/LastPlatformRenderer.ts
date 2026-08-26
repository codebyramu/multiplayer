import { PlatformTileData, PlayerPhysicsState, Point2D, ShockwaveEffect, Particle, FloatingText, ElectricFreezeProjectile } from './types';
import { HexGrid } from './HexGrid';
import { ParticleSystem } from './ParticleSystem';

export class LastPlatformRenderer {
  private starfield: Array<{ x: number; y: number; size: number; alpha: number; pulseSpeed: number }> = [];
  private starsInitialized: boolean = false;
  private currentZoom: number = 1.0;

  constructor() {
    this.initStars();
  }

  private initStars(): void {
    if (this.starsInitialized) return;
    this.starfield = [];
    for (let i = 0; i < 180; i++) {
      this.starfield.push({
        x: (Math.random() - 0.5) * 2400,
        y: (Math.random() - 0.5) * 2400,
        size: 0.8 + Math.random() * 2.2,
        alpha: 0.2 + Math.random() * 0.8,
        pulseSpeed: 1 + Math.random() * 3,
      });
    }
    this.starsInitialized = true;
  }

  /**
   * Main render method called every animation frame.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    hexGrid: HexGrid,
    players: Record<string, PlayerPhysicsState>,
    particles: ParticleSystem,
    timeRemaining: number,
    isSuddenDeath: boolean,
    matchDuration: number,
    projectiles: ElectricFreezeProjectile[] = []
  ): void {
    ctx.save();

    // 1. Clear & Background Gradient (Deep Space Void)
    this.renderCosmicVoid(ctx, width, height, isSuddenDeath);

    // 2. Camera Setup: Center on Arena with dynamic scale and smooth Sudden Death zoom
    ctx.save();
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx, cy);

    // Dynamic zoom to fit arena nicely on any aspect ratio with Sudden Death zoom-in
    const targetZoom = isSuddenDeath ? 1.28 : 1.0;
    this.currentZoom += (targetZoom - this.currentZoom) * 0.04;

    const baseArenaSize = hexGrid.arenaRadius * 2.3;
    const baseScale = Math.min(width / baseArenaSize, height / baseArenaSize, 1.25);
    const scale = baseScale * this.currentZoom;
    ctx.scale(scale, scale);

    // Apply Screen Shake Trauma
    const shake = particles.getShakeTransform();
    ctx.translate(shake.offsetX, shake.offsetY);
    ctx.rotate(shake.angle);

    // 3. Render Abyss Depth Lines & Danger Perimeter with Electric Lightning
    this.renderVoidAbyssRings(ctx, hexGrid, isSuddenDeath);
    this.renderDangerPerimeter(ctx, hexGrid, isSuddenDeath);

    // 4. Render Hexagonal Platform Tiles in 2.5D Isometric Depth Order (sorted by Y)
    this.renderTilePrisms(ctx, hexGrid);

    // 5. Render Player Shadows (projected on floor)
    this.renderPlayerShadows(ctx, players);

    // 6. Render Active Shockwave Rings
    this.renderShockwaves(ctx, particles.shockwaves);

    // 7. Render Electric Freeze Projectiles
    this.renderProjectiles(ctx, projectiles);

    // 8. Render Players (3D mechs, jump elevation, overhead badges, void plunge vortex)
    this.renderPlayers(ctx, players);

    // 9. Render Particles & Floating Combat Text
    this.renderParticles(ctx, particles.particles);
    this.renderFloatingTexts(ctx, particles.floatingTexts);

    ctx.restore(); // Restore Camera transform

    // 10. Screen Overlays (Sudden Death banner, elimination banners, match stats HUD)
    this.renderScreenHUD(ctx, width, height, players, particles, timeRemaining, isSuddenDeath, matchDuration);

    ctx.restore();
  }

  /**
   * Renders high-velocity electric freeze plasma projectiles.
   */
  private renderProjectiles(ctx: CanvasRenderingContext2D, projectiles: ElectricFreezeProjectile[]): void {
    ctx.save();
    for (const proj of projectiles) {
      ctx.save();
      ctx.translate(proj.x, proj.y);

      // Electric bolt plasma glow
      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
      ctx.fill();

      // White core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Arcing electricity whiskers
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 + Date.now() * 0.02;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (proj.radius + 6), Math.sin(a) * (proj.radius + 6));
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renders the deep cosmic void abyss background.
   */
  private renderCosmicVoid(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean): void {
    // Radial gradient from core to edge
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, 50,
      width / 2, height / 2, Math.max(width, height) * 0.8
    );

    if (isSuddenDeath) {
      grad.addColorStop(0, '#1a0510');
      grad.addColorStop(0.5, '#0d0208');
      grad.addColorStop(1, '#050004');
    } else {
      grad.addColorStop(0, '#0d1326');
      grad.addColorStop(0.4, '#080c1a');
      grad.addColorStop(1, '#03050a');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Render animated twinkling starfield
    const now = Date.now() * 0.001;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    for (const star of this.starfield) {
      const pulse = 0.5 + 0.5 * Math.sin(now * star.pulseSpeed + star.x);
      ctx.fillStyle = `rgba(180, 220, 255, ${star.alpha * pulse})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Renders infinite abyss rings spiraling down into the void below the arena.
   */
  private renderVoidAbyssRings(ctx: CanvasRenderingContext2D, hexGrid: HexGrid, isSuddenDeath: boolean): void {
    const time = Date.now() * 0.0015;
    const ringCount = 5;
    const baseColor = isSuddenDeath ? '255, 51, 102' : '0, 229, 255';

    ctx.save();
    ctx.lineWidth = 1.5;

    for (let i = 1; i <= ringCount; i++) {
      const radius = (hexGrid.arenaRadius * (0.3 + i * 0.22)) * (1 + 0.02 * Math.sin(time + i));
      const alpha = (0.04 + 0.03 * (ringCount - i));

      ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Abyss crosshair runes
      if (i === 3) {
        ctx.strokeStyle = `rgba(${baseColor}, 0.05)`;
        ctx.setLineDash([8, 16]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  /**
   * Renders the shrinking danger storm perimeter line with electric arcs and lightning.
   */
  private renderDangerPerimeter(ctx: CanvasRenderingContext2D, hexGrid: HexGrid, isSuddenDeath: boolean): void {
    const r = hexGrid.currentDangerRadius;
    const time = Date.now() * 0.003;
    const color = isSuddenDeath ? '#FF3366' : '#FFB224';

    ctx.save();

    // Outer storm hazard zone fill
    const stormGrad = ctx.createRadialGradient(0, 0, r, 0, 0, hexGrid.arenaRadius * 1.4);
    stormGrad.addColorStop(0, isSuddenDeath ? 'rgba(255, 51, 102, 0.12)' : 'rgba(255, 178, 36, 0.05)');
    stormGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = stormGrad;
    ctx.beginPath();
    ctx.arc(0, 0, hexGrid.arenaRadius * 1.4, 0, Math.PI * 2);
    ctx.arc(0, 0, r, 0, Math.PI * 2, true);
    ctx.fill();

    // Danger perimeter border line
    ctx.strokeStyle = color;
    ctx.lineWidth = isSuddenDeath ? 3.5 : 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = isSuddenDeath ? 20 : 12;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -time * 24;

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);

    // Sudden Death Red Perimeter Lightning Alert
    if (isSuddenDeath) {
      const arcCount = 8;
      const lightningTime = Date.now() * 0.008;

      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#FF3366';
      ctx.shadowBlur = 16;

      for (let i = 0; i < arcCount; i++) {
        const baseAngle = (i / arcCount) * Math.PI * 2 + (lightningTime * 0.4);
        const arcSpan = (Math.PI * 2 / arcCount) * 0.75;
        const steps = 6;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const subAngle = baseAngle + (s / steps) * arcSpan;
          const jitter = (Math.sin(lightningTime * 20 + i * 5 + s * 4) * 8) + ((s % 2 === 0 ? 1 : -1) * 4);
          const arcR = r + jitter;
          const px = Math.cos(subAngle) * arcR;
          const py = Math.sin(subAngle) * arcR;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Renders 3D Hexagonal Prism tiles sorted from top to bottom (Y-axis depth sorting).
   */
  private renderTilePrisms(ctx: CanvasRenderingContext2D, hexGrid: HexGrid): void {
    // Sort tiles by Y coordinate for correct 2.5D isometric overlapping
    const sortedTiles = [...hexGrid.tilesList].sort((a, b) => {
      // If one is falling deep into void, render it behind
      if (a.state === 'collapsed' && b.state !== 'collapsed') return -1;
      if (b.state === 'collapsed' && a.state !== 'collapsed') return 1;
      return a.worldY - b.worldY;
    });

    for (const tile of sortedTiles) {
      if (tile.state === 'collapsed' && tile.fallProgress >= 0.98) continue;
      this.renderSingleTile(ctx, tile);
    }
  }

  /**
   * Renders a single 3D Hexagonal Prism with top face, side extrusions, and state shaders.
   */
  private renderSingleTile(ctx: CanvasRenderingContext2D, tile: PlatformTileData): void {
    ctx.save();

    // Falling / Shake translation
    let drawX = tile.worldX;
    let drawY = tile.worldY;
    let drawZ = 0;
    let alpha = 1.0;
    let scale = 1.0;

    if (tile.shakeIntensity > 0) {
      drawX += (Math.random() - 0.5) * tile.shakeIntensity;
      drawY += (Math.random() - 0.5) * tile.shakeIntensity;
    }

    if (tile.state === 'collapsed') {
      // 3D falling into abyss
      drawZ = tile.fallVelocityZ * tile.fallProgress;
      drawY += drawZ * 0.8; // Isometric downward fall
      alpha = Math.max(0, 1.0 - tile.fallProgress);
      scale = Math.max(0.2, 1.0 - tile.fallProgress * 0.5);
    } else if (tile.state === 'respawning') {
      // 3D ascending from void matrix
      drawZ = 80 * tile.fallProgress;
      drawY += drawZ * 0.8;
      alpha = Math.max(0.2, 1.0 - tile.fallProgress * 0.8);
      scale = Math.max(0.4, 1.0 - tile.fallProgress * 0.4);
    }

    ctx.globalAlpha = alpha;
    ctx.translate(drawX, drawY);

    if ((tile.state === 'collapsed' || tile.state === 'respawning') && tile.fallRotation !== 0) {
      ctx.rotate(tile.fallRotation);
    }
    if (scale !== 1.0) {
      ctx.scale(scale, scale);
    }

    const size = tile.size;
    const h = tile.height;
    const corners = HexGrid.getHexCorners(0, 0, size);

    // Color definitions based on state
    let topColor = '#00F5A0'; // Safe Mint
    let topStroke = '#00E5FF'; // Electric Cyan
    let sideBaseColor = '#006655';
    let glowColor = 'rgba(0, 245, 160, 0.4)';

    switch (tile.state) {
      case 'stable':
        topColor = '#00F5A0';
        topStroke = '#00E5FF';
        sideBaseColor = '#00594C';
        glowColor = 'rgba(0, 245, 160, 0.35)';
        break;

      case 'warning': {
        const pulse = 0.5 + 0.5 * Math.sin(tile.glowPulsePhase * 3);
        topColor = pulse > 0.5 ? '#FFB224' : '#CC8800';
        topStroke = '#FFE600';
        sideBaseColor = '#664400';
        glowColor = 'rgba(255, 178, 36, 0.5)';
        break;
      }

      case 'crumbling': {
        const flash = 0.6 + 0.4 * Math.sin(tile.glowPulsePhase * 8);
        topColor = flash > 0.5 ? '#FF3366' : '#990022';
        topStroke = '#FF88AA';
        sideBaseColor = '#590018';
        glowColor = 'rgba(255, 51, 102, 0.7)';
        break;
      }

      case 'collapsed':
        topColor = '#441122';
        topStroke = '#662233';
        sideBaseColor = '#220811';
        glowColor = 'rgba(255, 51, 102, 0.2)';
        break;

      case 'respawning': {
        const pulse = 0.5 + 0.5 * Math.sin(tile.glowPulsePhase * 4);
        topColor = '#00E5FF';
        topStroke = '#FFFFFF';
        sideBaseColor = '#004466';
        glowColor = `rgba(0, 229, 255, ${0.4 + 0.3 * pulse})`;
        break;
      }
    }

    // --- 1. RENDER 3D EXTRUDED SIDE FACES --- //
    // The front/lower edges of the pointy-topped hexagon are vertices [1, 2, 3, 4]
    // Pointy-topped vertices: 0 (top-right), 1 (bottom-right), 2 (bottom), 3 (bottom-left), 4 (top-left), 5 (top)
    // Facet A: [1 -> 2], Facet B: [2 -> 3], Facet C: [3 -> 4]
    const facets = [
      { i1: 1, i2: 2, shade: 0.85 }, // bottom-right facet
      { i1: 2, i2: 3, shade: 0.70 }, // bottom-center facet
      { i1: 3, i2: 4, shade: 0.55 }, // bottom-left facet
    ];

    for (const f of facets) {
      const p1 = corners[f.i1];
      const p2 = corners[f.i2];

      ctx.fillStyle = sideBaseColor;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p2.x, p2.y + h);
      ctx.lineTo(p1.x, p1.y + h);
      ctx.closePath();
      ctx.fill();

      // Shading overlay
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - f.shade})`;
      ctx.fill();

      // Side facet borders
      ctx.strokeStyle = `rgba(0, 0, 0, 0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Bottom rim line
    ctx.strokeStyle = `rgba(0, 0, 0, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y + h);
    ctx.lineTo(corners[2].x, corners[2].y + h);
    ctx.lineTo(corners[3].x, corners[3].y + h);
    ctx.lineTo(corners[4].x, corners[4].y + h);
    ctx.stroke();

    // --- 2. RENDER TOP HEXAGON FACE --- //
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    // Top face gradient
    const topGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, size);
    topGrad.addColorStop(0, topColor);
    topGrad.addColorStop(0.85, topColor);
    topGrad.addColorStop(1, sideBaseColor);
    ctx.fillStyle = topGrad;
    ctx.fill();

    // Glow border
    ctx.strokeStyle = topStroke;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = tile.state === 'crumbling' ? 14 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- 3. INNER CYBER RUNES & STATE DECALS --- //
    if (tile.state === 'stable') {
      // Subtle concentric inner hexagon rune
      const innerCorners = HexGrid.getHexCorners(0, 0, size * 0.55);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(innerCorners[0].x, innerCorners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(innerCorners[i].x, innerCorners[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Center glowing core dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile.state === 'warning') {
      // Warning Hazard Glyph (exclamation mark)
      ctx.fillStyle = '#FFE600';
      ctx.font = 'bold 16px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠', 0, 0);
    } else if (tile.state === 'crumbling') {
      // Procedural neon fracture cracks
      this.renderTileCracks(ctx, size, tile.crackSeed);
    } else if (tile.state === 'respawning') {
      // Ascending energy matrix glyph
      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬡', 0, 0);
    }

    // Moving platform orbital indicator
    if (tile.isMoving) {
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draws procedural fracture lightning cracks across crumbling tiles.
   */
  private renderTileCracks(ctx: CanvasRenderingContext2D, size: number, seed: number): void {
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#FF3366';
    ctx.shadowBlur = 8;

    const crackCount = 4;
    for (let i = 0; i < crackCount; i++) {
      const angle = (i * Math.PI * 2) / crackCount + (seed % 1);
      const targetR = size * 0.85;

      ctx.beginPath();
      ctx.moveTo(0, 0);

      // 3-segment jagged crack
      const mid1X = Math.cos(angle - 0.2) * (targetR * 0.35);
      const mid1Y = Math.sin(angle - 0.2) * (targetR * 0.35);
      const mid2X = Math.cos(angle + 0.25) * (targetR * 0.7);
      const mid2Y = Math.sin(angle + 0.25) * (targetR * 0.7);
      const endX = Math.cos(angle) * targetR;
      const endY = Math.sin(angle) * targetR;

      ctx.lineTo(mid1X, mid1Y);
      ctx.lineTo(mid2X, mid2Y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * Renders dynamic player drop shadows (scaling and blurring with jump elevation).
   */
  private renderPlayerShadows(ctx: CanvasRenderingContext2D, players: Record<string, PlayerPhysicsState>): void {
    ctx.save();
    for (const pid in players) {
      const p = players[pid];
      if (p.isEliminated || p.isFallingIntoVoid) continue;

      const jumpHeight = Math.max(0, p.z);
      const shadowScale = Math.max(0.3, 1.0 - jumpHeight / 140);
      const shadowAlpha = Math.max(0.1, 0.45 * (1.0 - jumpHeight / 160));

      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 4, 18 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Renders kinetic Gravity Shockwave rings.
   */
  private renderShockwaves(ctx: CanvasRenderingContext2D, shockwaves: ShockwaveEffect[]): void {
    ctx.save();
    for (const sw of shockwaves) {
      ctx.save();
      ctx.translate(sw.x, sw.y);

      // Outer expanding kinetic shock ring
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(2, 6 * (1 - sw.life / sw.maxLife));
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = sw.alpha;

      ctx.beginPath();
      ctx.arc(0, 0, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner distortion wave
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, sw.radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renders 3D player hover mechs, jump elevation, orientation cones, and overhead status.
   */
  private renderPlayers(ctx: CanvasRenderingContext2D, players: Record<string, PlayerPhysicsState>): void {
    for (const pid in players) {
      const p = players[pid];
      if (p.isEliminated) continue;

      ctx.save();

      // 0. Render Cosmic Void Plunge Vortex Whirlpool beneath falling player
      if (p.isFallingIntoVoid) {
        ctx.save();
        const vortexTime = Date.now() * 0.005;
        const vortexR = 36 * p.scale;
        
        ctx.translate(p.x, p.y);
        const vortexGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, vortexR);
        vortexGrad.addColorStop(0, 'rgba(255, 51, 102, 0.7)');
        vortexGrad.addColorStop(0.5, 'rgba(138, 43, 226, 0.35)');
        vortexGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = vortexGrad;
        ctx.beginPath();
        ctx.arc(0, 0, vortexR, 0, Math.PI * 2);
        ctx.fill();

        // Spiral vortex arms
        ctx.strokeStyle = 'rgba(255, 51, 102, 0.6)';
        ctx.lineWidth = 1.5;
        for (let arm = 0; arm < 4; arm++) {
          const armAngle = vortexTime * 3 + (arm * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const endX = Math.cos(armAngle) * vortexR;
          const endY = Math.sin(armAngle) * vortexR;
          ctx.quadraticCurveTo(
            Math.cos(armAngle + 0.6) * (vortexR * 0.6),
            Math.sin(armAngle + 0.6) * (vortexR * 0.6),
            endX,
            endY
          );
          ctx.stroke();
        }
        ctx.restore();
      }

      // Render at visual position (world (x,y) offset by jump height z)
      let visualX = p.x;
      let visualY = p.y - p.z; // Elevation rises upward on screen
      let visualScale = p.scale;
      let visualAlpha = p.opacity;

      if (p.isFallingIntoVoid) {
        // Tumble rotation and shrinkage into void
        ctx.translate(visualX, visualY);
        ctx.rotate(p.fallTumbleAngle);
        ctx.scale(visualScale, visualScale);
        ctx.globalAlpha = visualAlpha;
      } else {
        ctx.translate(visualX, visualY);
        if (visualScale !== 1.0) ctx.scale(visualScale, visualScale);
        ctx.globalAlpha = visualAlpha;
      }

      // 1. Air Dash Trail Rendering
      if (p.trail.length > 0) {
        ctx.save();
        for (const t of p.trail) {
          ctx.fillStyle = t.color;
          ctx.globalAlpha = t.alpha * 0.4;
          ctx.beginPath();
          ctx.arc(t.x - visualX, (t.y - t.z) - visualY, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 2. Thruster Flame Exhaust
      if (p.moveMagnitude > 0.1 && !p.isFallingIntoVoid) {
        ctx.save();
        const thrusterAngle = p.facingAngle + Math.PI; // Exhaust points backwards
        const thrustDist = 16;
        const flameLength = 8 + p.moveMagnitude * 12 + Math.random() * 6;

        ctx.fillStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(thrusterAngle) * thrustDist, Math.sin(thrusterAngle) * thrustDist);
        ctx.lineTo(
          Math.cos(thrusterAngle + 0.3) * (thrustDist + flameLength),
          Math.sin(thrusterAngle + 0.3) * (thrustDist + flameLength)
        );
        ctx.lineTo(
          Math.cos(thrusterAngle - 0.3) * (thrustDist + flameLength),
          Math.sin(thrusterAngle - 0.3) * (thrustDist + flameLength)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 3. Cyber Mech Body Chassis
      ctx.save();
      ctx.rotate(p.facingAngle);

      // Chassis Body (Aerodynamic Cyber Disc)
      const bodyRadius = 16;
      const bodyGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, bodyRadius);
      bodyGrad.addColorStop(0, '#FFFFFF');
      bodyGrad.addColorStop(0.4, p.color);
      bodyGrad.addColorStop(1, '#0B0D12');

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
      ctx.fill();

      // Neon Rim Outline
      ctx.strokeStyle = p.hitFlashTimer > 0 ? '#FFFFFF' : p.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Avatar Icon / Mech Core Glyph in center
      const avatarSymbol = p.avatar === 'robot' || p.isBot ? '🤖' : (p.avatar || '⚡');
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(avatarSymbol, 0, 0);

      // Forward Direction Pointer / Cockpit
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(bodyRadius + 2, 0);
      ctx.lineTo(bodyRadius - 5, -4);
      ctx.lineTo(bodyRadius - 5, 4);
      ctx.closePath();
      ctx.fill();

      // Freeze Shot Ready Halo Ring
      if (p.freezeShotCooldown <= 0 && !p.isFallingIntoVoid && !p.isFrozen) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, bodyRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ⚡ ELECTRIC ICE CRYSTAL PRISON (When Frozen)
      if (p.isFrozen) {
        const freezeTime = Date.now() * 0.01;
        ctx.save();
        ctx.strokeStyle = '#00E5FF';
        ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 16;

        // Crystalline Hexagon Shell
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = Math.cos(a) * (bodyRadius + 8);
          const hy = Math.sin(a) * (bodyRadius + 8);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crackling Electric Arcs
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        for (let arc = 0; arc < 3; arc++) {
          const arcAngle = arc * 2.1 + freezeTime;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(arcAngle) * (bodyRadius + 4), Math.sin(arcAngle) * (bodyRadius + 4));
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.restore();

      // 4. Overhead Nameplate & HUD (Rendered upright without rotation)
      if (!p.isFallingIntoVoid) {
        this.renderPlayerOverheadHUD(ctx, p);
      }

      ctx.restore();
    }
  }

  /**
   * Renders player name badge, avatar icon, and shockwave cooldown meter above player.
   */
  private renderPlayerOverheadHUD(ctx: CanvasRenderingContext2D, p: PlayerPhysicsState): void {
    ctx.save();
    const offsetY = -28;

    // Freeze Shot Cooldown Mini Bar (7s ability)
    if (p.freezeShotCooldown > 0) {
      const barW = 32;
      const barH = 3;
      const progress = 1.0 - p.freezeShotCooldown / p.freezeShotCooldownMax;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-barW / 2, offsetY - 7, barW, barH);

      ctx.fillStyle = '#00E5FF';
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 4;
      ctx.fillRect(-barW / 2, offsetY - 7, barW * progress, barH);
      ctx.shadowBlur = 0;
    }

    // Name badge pill with avatar icon
    const avatar = p.avatar === 'robot' || p.isBot ? '🤖' : (p.avatar || '⚡');
    const name = p.name.length > 10 ? p.name.slice(0, 8) + '..' : p.name;
    const badgeText = `${avatar} ${name}`;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(badgeText).width;
    const pillW = textWidth + 12;
    const pillH = 15;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.roundRect(-pillW / 2, offsetY - pillH, pillW, pillH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Name Text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, 0, offsetY - pillH / 2);

    // Leader / Survivor Crown
    if (p.placementRank === 1 && !p.isEliminated) {
      ctx.fillStyle = '#FFB224';
      ctx.font = '12px sans-serif';
      ctx.fillText('👑', 0, offsetY - pillH - 6);
    }

    ctx.restore();
  }

  /**
   * Renders high-speed particle debris and sparks.
   */
  private renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    ctx.save();
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y - p.z);
      if (p.rotation !== 0) ctx.rotate(p.rotation);

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;

      switch (p.shape) {
        case 'spark':
          ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
          break;
        case 'shard':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.8, p.size * 0.8);
          ctx.lineTo(-p.size * 0.8, p.size * 0.8);
          ctx.closePath();
          ctx.fill();
          break;
        case 'circle':
        default:
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renders floating combat text ("SHOCKWAVE!", "SAVED!").
   */
  private renderFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]): void {
    ctx.save();
    for (const ft of texts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.translate(ft.x, ft.y - ft.z);

      ctx.font = `800 ${ft.fontSize}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, 0, 0);

      // Text
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.fillText(ft.text, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renders the top arcade HUD overlay, Sudden Death alert banners, and active elimination announcements.
   */
  private renderScreenHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    players: Record<string, PlayerPhysicsState>,
    particles: ParticleSystem,
    timeRemaining: number,
    isSuddenDeath: boolean,
    matchDuration: number
  ): void {
    ctx.save();

    // 0. Red pulsing screen border vignette during Sudden Death
    if (isSuddenDeath) {
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.006);
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.45,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignette.addColorStop(0, 'rgba(255, 51, 102, 0)');
      vignette.addColorStop(1, `rgba(255, 51, 102, ${0.15 * pulse})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    }

    // 1. Alive Players Count
    let aliveCount = 0;
    const playerList = Object.values(players);
    for (const p of playerList) {
      if (!p.isEliminated && !p.isFallingIntoVoid) aliveCount++;
    }

    // Top Center HUD Glass Panel
    const topBarW = 340;
    const topBarH = 44;
    const topBarX = (width - topBarW) / 2;
    const topBarY = 16;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#FF3366' : 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(topBarX, topBarY, topBarW, topBarH, 8);
    ctx.fill();
    ctx.stroke();

    // Time Remaining Display
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    ctx.fillStyle = isSuddenDeath ? '#FF3366' : '#00E5FF';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, width / 2, topBarY + topBarH / 2);

    // Alive Count Pill (Left)
    ctx.fillStyle = '#00F5A0';
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`ALIVE: ${aliveCount}/${playerList.length}`, topBarX + 16, topBarY + topBarH / 2);

    // Mode Pill (Right)
    ctx.textAlign = 'right';
    if (isSuddenDeath) {
      ctx.fillStyle = '#FF3366';
      ctx.fillText('SUDDEN DEATH', topBarX + topBarW - 16, topBarY + topBarH / 2);
    } else {
      ctx.fillStyle = '#FFB224';
      ctx.fillText('COLLAPSE', topBarX + topBarW - 16, topBarY + topBarH / 2);
    }

    // 2. Active Dramatic Elimination Banners
    if (particles.eliminationBanners && particles.eliminationBanners.length > 0) {
      for (let i = 0; i < particles.eliminationBanners.length; i++) {
        const eb = particles.eliminationBanners[i];
        const bannerY = topBarY + topBarH + 16 + i * 52;
        const bannerW = 380;
        const bannerH = 42;
        const bannerX = (width - bannerW) / 2;

        ctx.save();
        ctx.globalAlpha = eb.alpha;

        // Background Glass Panel
        ctx.fillStyle = 'rgba(26, 5, 16, 0.92)';
        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#FF3366';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
        ctx.fill();
        ctx.stroke();

        // Rank Badge (Left)
        ctx.fillStyle = '#FF3366';
        ctx.beginPath();
        ctx.roundRect(bannerX + 6, bannerY + 5, 76, bannerH - 10, 6);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`RANK #${eb.rank}`, bannerX + 44, bannerY + bannerH / 2);

        // Player Name & "ELIMINATED" Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${eb.playerName} ELIMINATED`, bannerX + 92, bannerY + bannerH / 2);

        // Player Color Indicator Dot
        ctx.fillStyle = eb.playerColor;
        ctx.shadowColor = eb.playerColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(bannerX + bannerW - 18, bannerY + bannerH / 2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // 3. Dramatic Sudden Death Alert Banner (Bottom of Screen)
    if (isSuddenDeath) {
      const bannerTime = Date.now() * 0.005;
      const flash = 0.7 + 0.3 * Math.sin(bannerTime * 4);

      ctx.save();
      ctx.fillStyle = `rgba(255, 51, 102, ${0.14 * flash})`;
      ctx.fillRect(0, height - 60, width, 40);

      ctx.strokeStyle = '#FF3366';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height - 60);
      ctx.lineTo(width, height - 60);
      ctx.moveTo(0, height - 20);
      ctx.lineTo(width, height - 20);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#FF3366';
      ctx.shadowBlur = 12;
      ctx.fillText('⚡ SUDDEN DEATH: PERIMETER DISSOLVING! STAY ON CORE HEXES! ⚡', width / 2, height - 40);
      ctx.restore();
    }

    ctx.restore();
  }
}
