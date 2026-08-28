import { HovercraftRacer, CircuitTrack, CheckpointData, BoostPadData, LaserBarrierData, CameraView, SuperchargeZone } from './types';
import { ParticleSystem } from './particles';

export class NeonRelayRenderer {
  private gridOffset: number = 0;
  private animTimer: number = 0;
  private screenShake: number = 0;

  public triggerScreenShake(intensity: number = 8): void {
    this.screenShake = Math.max(this.screenShake, intensity);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    track: CircuitTrack,
    racers: HovercraftRacer[],
    particles: ParticleSystem,
    camera: CameraView,
    focusedPlayerId?: string,
    dt: number = 0.016
  ): void {
    this.animTimer += dt;
    this.gridOffset = (this.gridOffset + dt * 25) % 80;

    // Decay screen shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0.05) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
      this.screenShake *= 0.88;
    }

    // Clear Canvas
    ctx.save();
    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, width, height);

    // Apply Camera Transform
    ctx.save();
    ctx.translate(width / 2 + shakeX, height / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Background Cyber Grid
    this.drawWorldGrid(ctx, track.width, track.height);

    // 2. Draw Track Surface & Boundaries
    this.drawTrack(ctx, track);

    // 2.5 Draw Supercharge Highway Zones
    this.drawSuperchargeZones(ctx, track.superchargeZones);

    // 3. Draw Boost Pads
    this.drawBoostPads(ctx, track.boostPads);

    // 4. Draw Checkpoints
    const activeRacer = racers.find((r) => r.id === focusedPlayerId) || racers[0];
    const activeCpIndex = activeRacer?.nextCheckpointIndex ?? 0;
    this.drawCheckpoints(ctx, track.checkpoints, activeCpIndex);

    // 5. Draw Laser Hazards
    this.drawLaserHazards(ctx, track.lasers);

    // 6. Draw Drafting Slipstream Ribbons
    this.drawSlipstreams(ctx, racers);

    // 7. Draw Hovercrafts
    this.drawHovercrafts(ctx, racers, focusedPlayerId);

    // 8. Draw Particle Systems (Exhaust, Sparks, Rings, Floating Text)
    particles.render(ctx);

    // Restore Camera
    ctx.restore();

    // 9. Draw Screen Overlay HUD (Minimap, Leaderboard, Nitro Gauge)
    this.drawOverlayHUD(ctx, width, height, track, racers, focusedPlayerId);

    ctx.restore();
  }

  // --- 1. Background Cyber Grid --- //
  private drawWorldGrid(ctx: CanvasRenderingContext2D, worldW: number, worldH: number): void {
    const gridSize = 80;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = -400; x <= worldW + 400; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -400);
      ctx.lineTo(x, worldH + 400);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = -400; y <= worldH + 400; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-400, y);
      ctx.lineTo(worldW + 400, y);
      ctx.stroke();
    }

    // Glowing coordinate crosshairs
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    for (let x = 0; x <= worldW; x += 400) {
      for (let y = 0; y <= worldH; y += 400) {
        ctx.fillRect(x - 3, y - 1, 6, 2);
        ctx.fillRect(x - 1, y - 3, 2, 6);
      }
    }

    ctx.restore();
  }

  // --- 2. Track Surface & Glowing Boundaries --- //
  private drawTrack(ctx: CanvasRenderingContext2D, track: CircuitTrack): void {
    ctx.save();

    // Fill track road interior (Dark graphite roadbed)
    ctx.beginPath();
    for (let i = 0; i < track.outerBoundaries.length; i++) {
      const seg = track.outerBoundaries[i];
      if (i === 0) ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
    }
    ctx.closePath();

    // Cut out inner island
    for (let i = 0; i < track.innerBoundaries.length; i++) {
      const seg = track.innerBoundaries[i];
      if (i === 0) ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
    }
    ctx.closePath();

    ctx.fillStyle = '#0B0F19';
    ctx.fill('evenodd');

    // Draw track centerline dashes
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 30]);
    ctx.beginPath();
    for (let i = 0; i < track.racingLineWaypoints.length; i++) {
      const wp = track.racingLineWaypoints[i];
      if (i === 0) ctx.moveTo(wp.x, wp.y);
      else ctx.lineTo(wp.x, wp.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Outer Walls (Neon Cyan Glow)
    this.drawWallGlow(ctx, track.outerBoundaries, '#00E5FF', 'rgba(0, 229, 255, 0.4)');

    // Draw Inner Walls (Neon Magenta Glow)
    this.drawWallGlow(ctx, track.innerBoundaries, '#FF3366', 'rgba(255, 51, 102, 0.4)');

    ctx.restore();
  }

  private drawWallGlow(
    ctx: CanvasRenderingContext2D,
    boundaries: { p1: { x: number; y: number }; p2: { x: number; y: number } }[],
    primaryColor: string,
    glowColor: string
  ): void {
    // Ambient wide glow pass
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const seg of boundaries) {
      ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
    }
    ctx.stroke();

    // Sharp bright neon core pass
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const seg of boundaries) {
      ctx.moveTo(seg.p1.x, seg.p1.y);
      ctx.lineTo(seg.p2.x, seg.p2.y);
    }
    ctx.stroke();
  }

  // --- 2.5 Supercharge Highway Zones --- //
  private drawSuperchargeZones(ctx: CanvasRenderingContext2D, zones?: SuperchargeZone[]): void {
    if (!zones || zones.length === 0) return;

    ctx.save();
    for (const zone of zones) {
      if (!zone.active) continue;

      ctx.save();
      ctx.translate(zone.x, zone.y);
      ctx.rotate(zone.angle);

      const halfW = zone.width / 2;
      const halfH = zone.height / 2;
      const pulse = Math.sin(this.animTimer * 6 + zone.pulsePhase) * 0.2 + 0.8;

      // 1. Radiant Glowing Highway Surface Plate
      const highwayGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
      highwayGrad.addColorStop(0, 'rgba(255, 230, 0, 0.05)');
      highwayGrad.addColorStop(0.5, `rgba(255, 230, 0, ${0.25 * pulse})`);
      highwayGrad.addColorStop(1, 'rgba(0, 229, 255, 0.2)');

      ctx.fillStyle = highwayGrad;
      ctx.fillRect(-halfW, -halfH, zone.width, zone.height);

      // 2. High-Voltage Highway Energy Borders (Layered stroke, 0 shadowBlur)
      ctx.strokeStyle = `rgba(255, 230, 0, ${0.3 * pulse})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(-halfW, -halfH, zone.width, zone.height);

      ctx.strokeStyle = `rgba(255, 230, 0, ${0.9 * pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(-halfW, -halfH, zone.width, zone.height);

      // 3. Fast Streaming Directional Supercharge Chevrons
      const chevronCount = 8;
      const spacing = zone.width / chevronCount;
      const scrollOffset = (this.animTimer * 280) % spacing;

      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = -2; i <= chevronCount + 1; i++) {
        const cx = -halfW + i * spacing + scrollOffset;
        if (cx < -halfW - 20 || cx > halfW + 20) continue;

        ctx.beginPath();
        ctx.moveTo(cx - 20, -halfH + 20);
        ctx.lineTo(cx + 12, 0);
        ctx.lineTo(cx - 20, halfH - 20);
        ctx.stroke();
      }

      // 4. Center Speed Ribbons
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 20]);
      ctx.beginPath();
      ctx.moveTo(-halfW, -halfH * 0.4);
      ctx.lineTo(halfW, -halfH * 0.4);
      ctx.moveTo(-halfW, halfH * 0.4);
      ctx.lineTo(halfW, halfH * 0.4);
      ctx.stroke();
      ctx.setLineDash([]);

      // 5. Floating Holographic Zone Label
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = '#FFE600';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const timeRemaining = Math.max(0, Math.ceil(zone.remainingTime));
      ctx.fillText(`⚡ 2X SUPERCHARGE HIGHWAY (${timeRemaining}s) ⚡`, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // --- 3. Directional Boost Pads --- //
  private drawBoostPads(ctx: CanvasRenderingContext2D, pads: BoostPadData[]): void {
    ctx.save();
    for (const pad of pads) {
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);

      // Pad Background Plate
      const halfW = pad.width / 2;
      const halfH = pad.height / 2;

      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.strokeRect(-halfW, -halfH, pad.width, pad.height);
      ctx.fillRect(-halfW, -halfH, pad.width, pad.height);

      // Animated Scrolling Neon Chevrons
      const chevronCount = 4;
      const spacing = pad.width / chevronCount;
      const scrollOffset = (this.animTimer * 120) % spacing;

      ctx.strokeStyle = '#FFB224';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = -1; i <= chevronCount; i++) {
        const cx = -halfW + i * spacing + scrollOffset;
        if (cx < -halfW - 10 || cx > halfW + 10) continue;

        ctx.beginPath();
        ctx.moveTo(cx - 12, -halfH + 12);
        ctx.lineTo(cx + 6, 0);
        ctx.lineTo(cx - 12, halfH - 12);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  // --- 4. Circuit Gates & Checkpoints --- //
  private drawCheckpoints(
    ctx: CanvasRenderingContext2D,
    checkpoints: CheckpointData[],
    activeCheckpointIndex: number
  ): void {
    ctx.save();
    const pulse = Math.sin(this.animTimer * 6) * 0.3 + 0.7;

    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const isCurrentActive = i === activeCheckpointIndex;
      ctx.save();
      ctx.translate(cp.x, cp.y);

      if (cp.isFinishLine) {
        // --- FINISH LINE ARCH & PYLONS --- //
        ctx.rotate(cp.angle);
        const halfGate = cp.width / 2;

        // Glowing Holographic Checkered Finish Line
        const checkCount = 8;
        const checkW = cp.width / checkCount;
        for (let c = 0; c < checkCount; c++) {
          const checkX = -halfGate + c * checkW;
          const isWhite = c % 2 === 0;
          ctx.fillStyle = isWhite ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 245, 160, 0.6)';
          ctx.fillRect(checkX, -10, checkW, 20);
        }

        // Finish Gate Pylons (Layered outer halo)
        ctx.fillStyle = 'rgba(0, 245, 160, 0.3)';
        ctx.beginPath();
        ctx.arc(-halfGate, 0, 20, 0, Math.PI * 2);
        ctx.arc(halfGate, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00F5A0';
        ctx.beginPath();
        ctx.arc(-halfGate, 0, 14, 0, Math.PI * 2);
        ctx.arc(halfGate, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Beam across finish line
        ctx.strokeStyle = 'rgba(0, 245, 160, 0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-halfGate, 0);
        ctx.lineTo(halfGate, 0);
        ctx.stroke();

        // Floating "FINISH / START" Hologram
        ctx.rotate(-cp.angle);
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = '#00F5A0';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ FINISH / LAP ⚡', 0, -35 + Math.sin(this.animTimer * 3) * 4);
      } else {
        // --- REGULAR CIRCUIT CHECKPOINT --- //
        const color = isCurrentActive ? '#00E5FF' : 'rgba(0, 229, 255, 0.25)';

        // Outer Rotating Dashed Ring
        ctx.save();
        ctx.rotate(this.animTimer * (isCurrentActive ? 1.5 : 0.5));
        ctx.strokeStyle = color;
        ctx.lineWidth = isCurrentActive ? 3 : 1.5;
        ctx.setLineDash(isCurrentActive ? [12, 16] : [6, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, cp.radius * (isCurrentActive ? 0.75 + pulse * 0.08 : 0.7), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Inner Radial Glow
        if (isCurrentActive) {
          ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
          ctx.beginPath();
          ctx.arc(0, 0, cp.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();

          // Pulsing Directional Arrow
          ctx.rotate(cp.angle);
          ctx.fillStyle = '#00E5FF';
          ctx.beginPath();
          ctx.moveTo(-15, -12);
          ctx.lineTo(15, 0);
          ctx.lineTo(-15, 12);
          ctx.closePath();
          ctx.fill();
          ctx.rotate(-cp.angle);
        }

        // Gate index tag
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`CP 0${cp.id}`, 0, 0);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  // --- 5. Laser Hazard Barriers --- //
  private drawLaserHazards(ctx: CanvasRenderingContext2D, lasers: LaserBarrierData[]): void {
    ctx.save();
    for (const laser of lasers) {
      const p1 = laser.currentP1;
      const p2 = laser.currentP2;

      // Emitter Pylons at both ends
      ctx.fillStyle = laser.isActive ? '#FF3366' : laser.isWarning ? '#FFB224' : '#4A5568';
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 8, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2);
      ctx.fill();

      if (laser.isActive) {
        // LETHAL ACTIVE LASER BEAM (3-pass crisp stroke, 0 shadowBlur)
        // 1. Wide plasma glow
        ctx.strokeStyle = 'rgba(255, 51, 102, 0.35)';
        ctx.lineWidth = 14 + Math.sin(this.animTimer * 30) * 3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // 2. Bright hot magenta beam
        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // 3. Ultra-hot white laser core
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // 4. Electric jagged arcs along the beam
        const segments = 6;
        ctx.strokeStyle = 'rgba(255, 200, 220, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          const px = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 12;
          const py = p1.y + (p2.y - p1.y) * t + (Math.random() - 0.5) * 12;
          ctx.lineTo(px, py);
        }
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (laser.isWarning) {
        // WARNING TELEGRAPH BEAM (Flickering dotted amber)
        ctx.strokeStyle = 'rgba(255, 178, 36, 0.65)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  // --- 6. Drafting Slipstream Ribbons --- //
  private drawSlipstreams(ctx: CanvasRenderingContext2D, racers: HovercraftRacer[]): void {
    ctx.save();
    for (const follower of racers) {
      if (!follower.isDrafting || !follower.draftTargetId) continue;
      const leader = racers.find((r) => r.id === follower.draftTargetId);
      if (!leader) continue;

      // Draw twin vortex streamline lines
      const perpX = -Math.sin(follower.angle) * 12;
      const perpY = Math.cos(follower.angle) * 12;

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 10]);

      // Left stream
      ctx.beginPath();
      ctx.moveTo(follower.x + perpX, follower.y + perpY);
      ctx.lineTo(leader.x + perpX * 0.8, leader.y + perpY * 0.8);
      ctx.stroke();

      // Right stream
      ctx.beginPath();
      ctx.moveTo(follower.x - perpX, follower.y - perpY);
      ctx.lineTo(leader.x - perpX * 0.8, leader.y - perpY * 0.8);
      ctx.stroke();

      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // --- 7. Hovercraft Rendering --- //
  private drawHovercrafts(
    ctx: CanvasRenderingContext2D,
    racers: HovercraftRacer[],
    focusedPlayerId?: string
  ): void {
    for (const racer of racers) {
      ctx.save();
      ctx.translate(racer.x, racer.y);

      // Hover elevation floating wobble + 3D Jump Elevation
      const jumpElevation = racer.jumpZ || 0;
      const hoverY = Math.sin(racer.hoverBobPhase) * 3 - jumpElevation;
      const isFocused = racer.id === focusedPlayerId;

      // 1. Underglow & Ground Shadow (stays on track ground while craft leaps into air)
      ctx.save();
      ctx.scale(1.0, 0.55);
      const shadowRadius = Math.max(12, 32 - jumpElevation * 0.25);
      const shadowAlpha = Math.max(0.15, 0.65 - jumpElevation * 0.008);
      const shadowGrad = ctx.createRadialGradient(0, 10, 5, 0, 10, shadowRadius);
      shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
      shadowGrad.addColorStop(0.5, racer.finished ? 'rgba(255, 215, 0, 0.4)' : racer.color + '44');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 10, shadowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Apply Heading Angle & Banking Tilt & Jump 3D Scale
      ctx.rotate(racer.angle);
      ctx.translate(0, hoverY);
      const jumpScale = 1.0 + (jumpElevation / 160);
      ctx.scale(jumpScale, jumpScale);

      // 2. Thruster Flame Jets
      if (racer.speed > 30 || racer.isBoosting) {
        const flameLen = racer.isBoosting ? 38 + Math.random() * 12 : 18 + (racer.speed / racer.maxSpeed) * 16;
        const flameColor = racer.isBoosting ? '#00E5FF' : '#FFB224';

        // Dual Exhaust Flames
        for (const offY of [-9, 9]) {
          ctx.fillStyle = flameColor;
          ctx.beginPath();
          ctx.moveTo(-16, offY - 4);
          ctx.lineTo(-16 - flameLen, offY);
          ctx.lineTo(-16, offY + 4);
          ctx.closePath();
          ctx.fill();

          // White Hot Core
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(-16, offY - 2);
          ctx.lineTo(-16 - flameLen * 0.45, offY);
          ctx.lineTo(-16, offY + 2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 3. Sleek Aerodynamic Fuselage
      // Hull Base & Impact Flash
      let hullColor = '#141A29';
      let strokeColor = racer.finished ? '#FFD700' : racer.color;

      if (racer.flashTimer > 0) {
        hullColor = '#FFFFFF';
        strokeColor = '#FF3366';
      } else if (racer.isStunned) {
        hullColor = Math.floor(this.animTimer * 20) % 2 === 0 ? '#FF3366' : '#FFFFFF';
        strokeColor = '#FF3366';
      }

      // Hull Outer Halo (for focused racer)
      if (isFocused) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(26, 0);
        ctx.lineTo(8, 14);
        ctx.lineTo(-16, 17);
        ctx.lineTo(-20, 11);
        ctx.lineTo(-17, 0);
        ctx.lineTo(-20, -11);
        ctx.lineTo(-16, -17);
        ctx.lineTo(8, -14);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.fillStyle = hullColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      // Aerodynamic pointed nose
      ctx.moveTo(26, 0);
      // Right wingtip
      ctx.lineTo(8, 14);
      ctx.lineTo(-16, 17);
      // Rear engine bay
      ctx.lineTo(-20, 11);
      ctx.lineTo(-17, 0);
      ctx.lineTo(-20, -11);
      // Left wingtip
      ctx.lineTo(-16, -17);
      ctx.lineTo(8, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing Accents & Energy Trim
      ctx.fillStyle = racer.finished ? '#FFD700' : racer.color;
      ctx.beginPath();
      ctx.moveTo(4, -10);
      ctx.lineTo(14, -6);
      ctx.lineTo(-8, -12);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(4, 10);
      ctx.lineTo(14, 6);
      ctx.lineTo(-8, 12);
      ctx.closePath();
      ctx.fill();

      // 4. Cockpit Canopy (Glowing Neon Visor)
      const visorGrad = ctx.createLinearGradient(-4, -6, 12, 6);
      visorGrad.addColorStop(0, '#FFFFFF');
      visorGrad.addColorStop(0.4, isFocused ? '#00E5FF' : racer.color);
      visorGrad.addColorStop(1, '#0B0F19');
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.ellipse(4, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Invulnerability Forcefield Shield Dome
      if (racer.invulnerableTimer > 0) {
        const shieldPulse = Math.sin(this.animTimer * 16) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(0, 229, 255, ${shieldPulse})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, 29, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Boost Pad Speed Flare Ring
      if (racer.boostPadTimer > 0) {
        ctx.strokeStyle = '#FFB224';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 28 + Math.sin(this.animTimer * 20) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Celebratory Golden Halo for Finishers
      if (racer.finished) {
        const winPulse = Math.sin(this.animTimer * 5) * 0.25 + 0.75;
        ctx.strokeStyle = `rgba(255, 215, 0, ${winPulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 33, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore(); // Restore craft transform

      // 5. Overhead Nameplate & Rank Badge
      ctx.save();
      ctx.translate(racer.x, racer.y - 38);

      // Name Tag
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = isFocused ? '#00E5FF' : '#E2E8F0';
      ctx.fillText(racer.player.name.slice(0, 12), 0, 0);

      // Nitro Energy Mini-Bar (if racing and not full)
      if (!racer.finished && racer.nitroEnergy < 95) {
        const barW = 28;
        const barH = 3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-barW / 2, 4, barW, barH);
        ctx.fillStyle = racer.isBoosting ? '#00E5FF' : '#FFB224';
        ctx.fillRect(-barW / 2, 4, barW * (racer.nitroEnergy / 100), barH);
      }

      // Stun / Finished Status Icon
      if (racer.finished) {
        const badge = racer.finishRank === 1 ? '🏆 1ST' : racer.finishRank === 2 ? '🥈 2ND' : racer.finishRank === 3 ? '🥉 3RD' : `P${racer.finishRank}`;
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillStyle = racer.finishRank === 1 ? '#FFD700' : '#00F5A0';
        ctx.fillText(`${badge} FINISHED`, 0, -14);
      } else if (racer.isStunned) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#FF3366';
        ctx.fillText('⚡ STUNNED ⚡', 0, -14);
      }

      ctx.restore();
    }
  }

  // --- 9. Overlay HUD & Mini-Map --- //
  private drawOverlayHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    track: CircuitTrack,
    racers: HovercraftRacer[],
    focusedPlayerId?: string
  ): void {
    ctx.save();

    // Sort racers deterministically for real-time leaderboard
    const sortedRacers = [...racers].sort((a, b) => {
      if (a.finished && b.finished) {
        if (a.finishRank !== null && b.finishRank !== null && a.finishRank !== b.finishRank) {
          return a.finishRank - b.finishRank;
        }
        if (a.finishTime !== null && b.finishTime !== null && a.finishTime !== b.finishTime) {
          return a.finishTime - b.finishTime;
        }
      }
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;
      if (a.lastCapturedCheckpointIndex !== b.lastCapturedCheckpointIndex) return b.lastCapturedCheckpointIndex - a.lastCapturedCheckpointIndex;
      return b.progressDistance - a.progressDistance;
    });

    const focusedRacer = racers.find((r) => r.id === focusedPlayerId) || sortedRacers[0];

    // --- Top Center HUD: Lap & Position Banner --- //
    if (focusedRacer) {
      const rankIdx = sortedRacers.findIndex((r) => r.id === focusedRacer.id) + 1;

      // Position Glass Pill
      ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, width / 2 - 145, 16, 290, 52, 10);
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillStyle = '#00E5FF';
      ctx.textAlign = 'left';
      ctx.fillText(`POS ${rankIdx}/${racers.length}`, width / 2 - 125, 48);

      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillStyle = focusedRacer.finished ? '#00F5A0' : focusedRacer.currentLap >= 3 ? '#FFB224' : '#FFFFFF';
      ctx.textAlign = 'right';
      const lapLabel = focusedRacer.finished ? `P${focusedRacer.finishRank} DONE` : `LAP ${Math.min(3, focusedRacer.currentLap)}/3`;
      ctx.fillText(lapLabel, width / 2 + 125, 47);
    }

    // --- Top Left: Live Standings Table --- //
    ctx.fillStyle = 'rgba(11, 15, 25, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, 16, 16, 215, Math.min(230, sortedRacers.length * 26 + 32), 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE STANDINGS', 28, 34);

    for (let i = 0; i < Math.min(6, sortedRacers.length); i++) {
      const r = sortedRacers[i];
      const y = 56 + i * 26;
      const isFocused = r.id === focusedPlayerId;

      ctx.fillStyle = isFocused ? '#00E5FF' : '#E2E8F0';
      ctx.font = isFocused ? 'bold 12px "Courier New", monospace' : '11px "Courier New", monospace';
      ctx.fillText(`${i + 1}.`, 28, y);

      // Color badge
      ctx.fillStyle = r.color;
      ctx.fillRect(48, y - 9, 8, 8);

      // Name
      ctx.fillStyle = isFocused ? '#00E5FF' : '#CBD5E1';
      ctx.fillText(r.player.name.slice(0, 10), 62, y);

      // Status
      ctx.textAlign = 'right';
      ctx.fillStyle = r.finished ? '#00F5A0' : '#94A3B8';
      ctx.fillText(r.finished ? `P${r.finishRank} 🏁` : `L${Math.min(3, r.currentLap)}`, 218, y);
      ctx.textAlign = 'left';
    }

    // --- Bottom Center: Nitro & Speedometer (for Focused Racer) --- //
    if (focusedRacer) {
      const hudW = 280;
      const hudH = 50;
      const hudX = width / 2 - hudW / 2;
      const hudY = height - 68;

      ctx.fillStyle = 'rgba(11, 15, 25, 0.9)';
      ctx.strokeStyle = focusedRacer.isBoosting ? '#00E5FF' : '#FFB224';
      ctx.lineWidth = 2;
      this.roundRect(ctx, hudX, hudY, hudW, hudH, 8);
      ctx.fill();
      ctx.stroke();

      // Speed Value
      const kph = Math.round(focusedRacer.speed * 0.8);
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(`${kph} KPH`, hudX + 16, hudY + 32);

      // Nitro Bar
      const barX = hudX + 115;
      const barY = hudY + 18;
      const barW = 145;
      const barH = 14;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX, barY, barW, barH);

      const nitroRatio = Math.max(0, Math.min(1, focusedRacer.nitroEnergy / 100));
      const nitroGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      nitroGrad.addColorStop(0, '#FFB224');
      nitroGrad.addColorStop(1, '#00E5FF');
      ctx.fillStyle = nitroGrad;
      ctx.fillRect(barX, barY, barW * nitroRatio, barH);

      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('NITRO BOOST', barX, barY - 4);
    }

    // --- Top Right: Radar Mini-Map --- //
    const mapSize = 160;
    const mapX = width - mapSize - 20;
    const mapY = 20;

    ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, mapX, mapY, mapSize, mapSize, 10);
    ctx.fill();
    ctx.stroke();

    // Map Scaling
    const scaleX = (mapSize - 24) / track.width;
    const scaleY = (mapSize - 24) / track.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = mapX + 12;
    const offsetY = mapY + 12;

    // Mini Track Line
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < track.racingLineWaypoints.length; i++) {
      const wp = track.racingLineWaypoints[i];
      const mx = offsetX + wp.x * scale;
      const my = offsetY + wp.y * scale;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Racer Blips
    for (const r of racers) {
      const rx = offsetX + r.x * scale;
      const ry = offsetY + r.y * scale;
      const isLeader = sortedRacers[0]?.id === r.id;

      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(rx, ry, isLeader ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Rounded rectangle helper
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
