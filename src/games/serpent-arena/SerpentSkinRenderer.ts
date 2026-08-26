import { BodyJoint, SerpentPlayerEntity, SnakeSkinId, SkinConfig } from './types';

export const SNAKE_SKIN_CONFIGS: Record<SnakeSkinId, SkinConfig> = {
  synth: {
    id: 'synth',
    name: 'Synthwave Viper',
    tagline: 'Neon-infused retrowave predator',
    headPrimary: '#00F5A0',
    headSecondary: '#00B4D8',
    bodyGradient: ['#00F5A0', '#00B4D8', '#9D4EDD'],
    glowColor: 'rgba(0, 245, 160, 0.65)',
    eyeColor: '#FFB224',
    pupilColor: '#050811',
    spineColor: '#00E5FF',
    particleColor: '#00F5A0',
    accentHex: '#00F5A0',
  },
  mecha: {
    id: 'mecha',
    name: 'Mecha Dreadnought',
    tagline: 'Titanium-plated combat cyber-serpent',
    headPrimary: '#1E293B',
    headSecondary: '#00E5FF',
    bodyGradient: ['#334155', '#00E5FF', '#1E293B'],
    glowColor: 'rgba(0, 229, 255, 0.6)',
    eyeColor: '#FF3366',
    pupilColor: '#FF0033',
    spineColor: '#00E5FF',
    particleColor: '#00E5FF',
    accentHex: '#00E5FF',
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Drake',
    tagline: 'Nebula-born dragon of starlight',
    headPrimary: '#9D4EDD',
    headSecondary: '#FF007F',
    bodyGradient: ['#9D4EDD', '#FF007F', '#240046'],
    glowColor: 'rgba(255, 0, 127, 0.65)',
    eyeColor: '#00F5A0',
    pupilColor: '#FFFFFF',
    spineColor: '#E0AAFF',
    particleColor: '#C77DFF',
    accentHex: '#9D4EDD',
  },
  glitch: {
    id: 'glitch',
    name: 'Corrupted Glitch',
    tagline: 'RGB-split fragmented digital anomaly',
    headPrimary: '#FF3366',
    headSecondary: '#00FFCC',
    bodyGradient: ['#FF3366', '#00FFCC', '#FFB224'],
    glowColor: 'rgba(255, 51, 102, 0.7)',
    eyeColor: '#FFFFFF',
    pupilColor: '#00FFCC',
    spineColor: '#FFB224',
    particleColor: '#FF3366',
    accentHex: '#FF3366',
  },
  molten: {
    id: 'molten',
    name: 'Solar Phoenix',
    tagline: 'Molten magma serpent of solar fury',
    headPrimary: '#FF3300',
    headSecondary: '#FF7700',
    bodyGradient: ['#FF3300', '#FF7700', '#FFE600'],
    glowColor: 'rgba(255, 119, 0, 0.75)',
    eyeColor: '#FFE600',
    pupilColor: '#660000',
    spineColor: '#FFFFFF',
    particleColor: '#FF7700',
    accentHex: '#FF7700',
  },
};

export class SerpentSkinRenderer {
  /**
   * Main entry point to render a complete snake entity:
   * 1. Boost exhaust trails
   * 2. Body segments (tail-to-head order for proper z-layering)
   * 3. Spine connector conduits
   * 4. Head and sensory crests
   * 5. Expressive animated eyes & blinking
   * 6. Nametag, Crown, and Invulnerability shield
   */
  public static renderSnake(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    isLeader: boolean = false,
    gameTime: number = 0
  ): void {
    if (snake.body.length === 0) return;

    // Check dead snake corpse disintegration (1.2s visual satisfaction)
    let corpseAlpha = 1.0;
    if (snake.isDead) {
      if (snake.deathTime && gameTime - snake.deathTime < 1.2) {
        corpseAlpha = Math.max(0, 1.0 - (gameTime - snake.deathTime) / 1.2);
      } else {
        return; // After 1.2s corpse completely disintegrates
      }
    }

    const skinConfig = SNAKE_SKIN_CONFIGS[snake.skin] || SNAKE_SKIN_CONFIGS.synth;
    const body = snake.body;
    const head = body[0];
    const totalSegments = body.length;

    ctx.save();
    if (corpseAlpha < 1.0) {
      ctx.globalAlpha = corpseAlpha;
    } else if (snake.ghostHuntTimer > 0) {
      // Ethereal translucent ghost
      ctx.globalAlpha = 0.65;
    }

    // Ghost Hunt Spectral Phantom Aura
    if (snake.ghostHuntTimer > 0 && !snake.isDead) {
      ctx.save();
      ctx.shadowBlur = 28;
      ctx.shadowColor = '#C77DFF';
      ctx.strokeStyle = 'rgba(199, 125, 255, 0.7)';
      ctx.lineWidth = snake.headRadius * 2.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(body[0].x, body[0].y);
      for (let i = 1; i < body.length; i++) {
        ctx.lineTo(body[i].x, body[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Winner Golden Aura
    if (snake.isWinner) {
      ctx.save();
      ctx.shadowBlur = 35;
      ctx.shadowColor = '#FFD700';
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = snake.headRadius * 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(body[0].x, body[0].y);
      for (let i = 1; i < body.length; i++) {
        ctx.lineTo(body[i].x, body[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 1. RENDER BODY SEGMENTS (Render from tail to head)
    this.renderBodySegments(ctx, snake, skinConfig, totalSegments, gameTime);

    // 2. RENDER HEAD
    this.renderHead(ctx, snake, head, skinConfig, gameTime);

    // 3. RENDER EXPRESSIVE EYES
    if (!snake.isDead) {
      this.renderEyes(ctx, snake, head, skinConfig);
    }

    // 4. RENDER INVULNERABILITY SHIELD
    if (!snake.isDead && snake.invulnerableTimer > 0) {
      this.renderInvulnerabilityShield(ctx, head, snake.invulnerableTimer, gameTime);
    }

    // 5. RENDER LEADER / WINNER CROWN
    if (snake.isWinner) {
      this.renderWinnerCrown(ctx, head, snake.headRadius, gameTime);
    } else if (isLeader && !snake.isDead) {
      this.renderLeaderCrown(ctx, head, snake.headRadius, gameTime);
    }

    // 6. RENDER PLAYER NAME & STATS OVERHEAD
    this.renderNameplate(ctx, snake, head);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // BODY SEGMENTS RENDERER
  // -------------------------------------------------------------
  private static renderBodySegments(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    skin: SkinConfig,
    totalSegments: number,
    gameTime: number
  ): void {
    const body = snake.body;

    // Outer glow for boost, overheat or normal snakes
    if (snake.isOverheating) {
      const pulse = Math.sin(gameTime * 15) * 0.3 + 0.7;
      ctx.shadowBlur = 24 * pulse;
      ctx.shadowColor = '#FF0055';
    } else if (snake.isBoosting) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = skin.glowColor;
    } else {
      ctx.shadowBlur = 8;
      ctx.shadowColor = skin.glowColor;
    }

    // Render segments from tail (index totalSegments - 1) down to 1
    for (let i = totalSegments - 1; i >= 1; i--) {
      const seg = body[i];
      const prevSeg = body[i - 1] || seg;
      const progress = i / totalSegments; // 0 (near head) to 1 (tail tip)
      const radius = seg.radius;

      ctx.save();
      ctx.translate(seg.x, seg.y);
      ctx.rotate(seg.angle);

      switch (skin.id) {
        case 'synth':
          this.renderSynthSegment(ctx, i, radius, progress, skin, snake.pulseTime);
          break;
        case 'mecha':
          this.renderMechaSegment(ctx, i, radius, progress, skin);
          break;
        case 'cosmic':
          this.renderCosmicSegment(ctx, i, radius, progress, skin, gameTime);
          break;
        case 'glitch':
          this.renderGlitchSegment(ctx, i, radius, progress, skin, gameTime);
          break;
        case 'molten':
          this.renderMoltenSegment(ctx, i, radius, progress, skin, gameTime);
          break;
        default:
          this.renderSynthSegment(ctx, i, radius, progress, skin, snake.pulseTime);
      }

      ctx.restore();
    }

    ctx.shadowBlur = 0;

    // RENDER SPINAL CONDUIT / NEON RIDGE LINE
    this.renderSpinalRidge(ctx, snake, skin);
  }

  // 1. SYNTHWAVE VIPER SEGMENT
  private static renderSynthSegment(
    ctx: CanvasRenderingContext2D,
    index: number,
    radius: number,
    progress: number,
    skin: SkinConfig,
    pulseTime: number
  ): void {
    const isOdd = index % 2 === 1;
    const baseColor = isOdd ? skin.headPrimary : skin.headSecondary;

    // Base segment disc
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Dark core ring
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#060D18';
    ctx.fill();

    // Neon glowing dot
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = isOdd ? skin.headSecondary : skin.headPrimary;
    ctx.fill();

    // Retrowave cross hashes on every 4th segment
    if (index % 4 === 0) {
      ctx.strokeStyle = skin.spineColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.8, 0);
      ctx.lineTo(radius * 0.8, 0);
      ctx.stroke();
    }
  }

  // 2. MECHA DREADNOUGHT SEGMENT
  private static renderMechaSegment(
    ctx: CanvasRenderingContext2D,
    index: number,
    radius: number,
    progress: number,
    skin: SkinConfig
  ): void {
    // Angular cyber armor plate (rounded octagonal plate)
    const w = radius * 1.8;
    const h = radius * 1.5;

    ctx.fillStyle = '#1A2332';
    ctx.strokeStyle = skin.headSecondary;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, [radius * 0.4]);
    ctx.fill();
    ctx.stroke();

    // Hazard stripes on every 3rd segment
    if (index % 3 === 0) {
      ctx.fillStyle = '#FFB224';
      ctx.fillRect(-w * 0.3, -h * 0.35, w * 0.6, h * 0.2);
    }

    // Cyan glowing micro-core
    ctx.fillStyle = skin.headSecondary;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Bolt accents
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(-w * 0.35, -h * 0.3, 1.5, 0, Math.PI * 2);
    ctx.arc(w * 0.35, -h * 0.3, 1.5, 0, Math.PI * 2);
    ctx.arc(-w * 0.35, h * 0.3, 1.5, 0, Math.PI * 2);
    ctx.arc(w * 0.35, h * 0.3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. COSMIC DRAKE SEGMENT
  private static renderCosmicSegment(
    ctx: CanvasRenderingContext2D,
    index: number,
    radius: number,
    progress: number,
    skin: SkinConfig,
    gameTime: number
  ): void {
    // Ethereal outer nebula aura
    const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.25);
    grad.addColorStop(0, skin.headSecondary);
    grad.addColorStop(0.6, skin.headPrimary);
    grad.addColorStop(1, 'rgba(36, 0, 70, 0.2)');

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Translucent cosmic ring
    ctx.strokeStyle = 'rgba(224, 170, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Embedded sparkling star
    const starPhase = Math.sin(gameTime * 4 + index * 0.6);
    if (starPhase > 0.2) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.25 * (0.6 + starPhase * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. CORRUPTED GLITCH SEGMENT
  private static renderGlitchSegment(
    ctx: CanvasRenderingContext2D,
    index: number,
    radius: number,
    progress: number,
    skin: SkinConfig,
    gameTime: number
  ): void {
    // Random digital offset jitter
    const jitterX = Math.sin(gameTime * 20 + index * 13) * 1.5;
    const jitterY = Math.cos(gameTime * 20 + index * 17) * 1.5;
    ctx.translate(jitterX, jitterY);

    const size = radius * 1.7;

    // RGB split effect (Red channel offset)
    ctx.fillStyle = 'rgba(255, 51, 102, 0.6)';
    ctx.fillRect(-size / 2 - 1.5, -size / 2, size, size);

    // Cyan channel offset
    ctx.fillStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.fillRect(-size / 2 + 1.5, -size / 2, size, size);

    // Main dark core block
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-size / 2 + 0.5, -size / 2 + 0.5, size - 1, size - 1);

    // Center pixel / data dot
    ctx.fillStyle = (index + Math.floor(gameTime * 10)) % 2 === 0 ? skin.headPrimary : skin.headSecondary;
    ctx.fillRect(-size * 0.2, -size * 0.2, size * 0.4, size * 0.4);
  }

  // 5. SOLAR PHOENIX (MOLTEN) SEGMENT
  private static renderMoltenSegment(
    ctx: CanvasRenderingContext2D,
    index: number,
    radius: number,
    progress: number,
    skin: SkinConfig,
    gameTime: number
  ): void {
    const pulse = Math.sin(gameTime * 5 + index * 0.4) * 0.2 + 0.8;

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, '#FFE600');
    grad.addColorStop(0.4, skin.headSecondary);
    grad.addColorStop(0.85, skin.headPrimary);
    grad.addColorStop(1, '#330800');

    ctx.beginPath();
    ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Fiery obsidian magma crust
    ctx.strokeStyle = '#260400';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Molten magma fissure crack
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, 0);
    ctx.lineTo(0, -radius * 0.2);
    ctx.lineTo(radius * 0.5, 0);
    ctx.stroke();
  }

  // -------------------------------------------------------------
  // SPINAL RIDGE CONNECTOR LINE
  // -------------------------------------------------------------
  private static renderSpinalRidge(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    skin: SkinConfig
  ): void {
    const body = snake.body;
    if (body.length < 3) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(body[0].x, body[0].y);

    for (let i = 1; i < body.length - 1; i++) {
      const p1 = body[i];
      const p2 = body[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }

    ctx.strokeStyle = skin.spineColor;
    ctx.lineWidth = Math.max(1.5, snake.headRadius * 0.18);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // -------------------------------------------------------------
  // HEAD RENDERER
  // -------------------------------------------------------------
  private static renderHead(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    head: BodyJoint,
    skin: SkinConfig,
    gameTime: number
  ): void {
    const r = snake.headRadius;

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(snake.angle);

    // Glowing head shadow
    ctx.shadowBlur = snake.isBoosting ? 26 : 14;
    ctx.shadowColor = skin.glowColor;

    switch (snake.skin) {
      case 'synth': {
        // Aerodynamic Cobra Hood
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0); // Snout tip
        ctx.bezierCurveTo(r * 0.9, -r * 0.9, -r * 0.6, -r * 1.1, -r * 0.9, -r * 0.4);
        ctx.lineTo(-r * 0.9, r * 0.4);
        ctx.bezierCurveTo(-r * 0.6, r * 1.1, r * 0.9, r * 0.9, r * 1.3, 0);
        ctx.closePath();

        const grad = ctx.createLinearGradient(-r, 0, r * 1.3, 0);
        grad.addColorStop(0, skin.headSecondary);
        grad.addColorStop(1, skin.headPrimary);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }

      case 'mecha': {
        // Armored Mecha Chassis
        ctx.beginPath();
        ctx.moveTo(r * 1.4, 0);
        ctx.lineTo(r * 0.6, -r * 0.9);
        ctx.lineTo(-r * 0.8, -r * 0.8);
        ctx.lineTo(-r * 1.0, 0);
        ctx.lineTo(-r * 0.8, r * 0.8);
        ctx.lineTo(r * 0.6, r * 0.9);
        ctx.closePath();

        ctx.fillStyle = '#0F172A';
        ctx.fill();
        ctx.strokeStyle = skin.headSecondary;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Laser Visor Plate
        ctx.fillStyle = skin.eyeColor;
        ctx.fillRect(r * 0.2, -r * 0.6, r * 0.4, r * 1.2);
        break;
      }

      case 'cosmic': {
        // Celestial Dragon Head with Crystal Crest
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.3, skin.headSecondary);
        grad.addColorStop(0.8, skin.headPrimary);
        grad.addColorStop(1, '#240046');
        ctx.fillStyle = grad;
        ctx.fill();

        // Starlight Horns
        ctx.fillStyle = skin.headSecondary;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.7);
        ctx.lineTo(-r * 1.3, -r * 1.2);
        ctx.lineTo(-r * 0.6, -r * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.7);
        ctx.lineTo(-r * 1.3, r * 1.2);
        ctx.lineTo(-r * 0.6, r * 0.3);
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'glitch': {
        // Digital Voxel Head
        const size = r * 1.9;
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-size / 2, -size / 2, size, size);

        ctx.strokeStyle = skin.headPrimary;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-size / 2, -size / 2, size, size);

        // Binary glyph accents
        ctx.fillStyle = '#00FFCC';
        ctx.font = `bold ${Math.floor(r * 0.6)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('01', 0, 0);
        break;
      }

      case 'molten': {
        // Blazing Molten Skull
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(r * 0.3, 0, 0, 0, 0, r * 1.2);
        grad.addColorStop(0, '#FFE600');
        grad.addColorStop(0.5, skin.headSecondary);
        grad.addColorStop(1, '#590D00');
        ctx.fillStyle = grad;
        ctx.fill();

        // Flame crest spikes
        ctx.fillStyle = '#FFE600';
        ctx.beginPath();
        ctx.moveTo(r * 1.4, 0);
        ctx.lineTo(r * 0.7, -r * 0.6);
        ctx.lineTo(r * 0.9, 0);
        ctx.lineTo(r * 0.7, r * 0.6);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // EXPRESSIVE EYES RENDERER
  // -------------------------------------------------------------
  private static renderEyes(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    head: BodyJoint,
    skin: SkinConfig
  ): void {
    const r = snake.headRadius;
    const eyeOffsetX = r * 0.35;
    const eyeOffsetY = r * 0.55;
    const eyeRadius = r * 0.32;

    // Blinking scale (1 = wide open, 0 = closed)
    const blinkScale = 1 - Math.max(0, Math.min(1, snake.eyeBlinkState));

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(snake.angle);

    // Left Eye & Right Eye positions
    const eyes = [
      { x: eyeOffsetX, y: -eyeOffsetY },
      { x: eyeOffsetX, y: eyeOffsetY },
    ];

    for (const eye of eyes) {
      ctx.save();
      ctx.translate(eye.x, eye.y);
      ctx.scale(1, Math.max(0.1, blinkScale));

      // Sclera / Eye Socket
      ctx.beginPath();
      ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#060B14';
      ctx.fill();
      ctx.strokeStyle = skin.eyeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Iris
      ctx.beginPath();
      ctx.arc(0, 0, eyeRadius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = skin.eyeColor;
      ctx.fill();

      // Expressive Pupil tracking look-offset angle
      const lookOffset = Math.sin(snake.lookAtOffsetAngle) * (eyeRadius * 0.3);
      ctx.beginPath();
      ctx.arc(eyeRadius * 0.25, lookOffset, eyeRadius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = skin.pupilColor;
      ctx.fill();

      // Specular Reflection Highlight
      ctx.beginPath();
      ctx.arc(eyeRadius * 0.35, -eyeRadius * 0.25, eyeRadius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // INVULNERABILITY SHIELD
  // -------------------------------------------------------------
  private static renderInvulnerabilityShield(
    ctx: CanvasRenderingContext2D,
    head: BodyJoint,
    timer: number,
    gameTime: number
  ): void {
    const shieldRadius = 38 + Math.sin(gameTime * 10) * 3;
    const alpha = Math.min(1, timer * 1.5);

    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 245, 160, ${alpha * 0.8})`;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = `rgba(0, 245, 160, ${alpha * 0.15})`;
    ctx.fill();
    ctx.stroke();

    // Pulsing shield rings
    ctx.beginPath();
    ctx.arc(0, 0, shieldRadius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // LEADER CROWN OVERHEAD
  // -------------------------------------------------------------
  private static renderLeaderCrown(
    ctx: CanvasRenderingContext2D,
    head: BodyJoint,
    headRadius: number,
    gameTime: number
  ): void {
    const floatY = -headRadius - 22 + Math.sin(gameTime * 4) * 4;

    ctx.save();
    ctx.translate(head.x, head.y + floatY);

    // Crown Glow
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FFD700';

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-6, -2);
    ctx.lineTo(0, -12);
    ctx.lineTo(6, -2);
    ctx.lineTo(14, -8);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();

    // Crown Jewels
    ctx.fillStyle = '#FF3366';
    ctx.beginPath();
    ctx.arc(0, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // WINNER CHAMPION CROWN OVERHEAD
  // -------------------------------------------------------------
  private static renderWinnerCrown(
    ctx: CanvasRenderingContext2D,
    head: BodyJoint,
    headRadius: number,
    gameTime: number
  ): void {
    const floatY = -headRadius - 28 + Math.sin(gameTime * 5) * 5;

    ctx.save();
    ctx.translate(head.x, head.y + floatY);

    // Radiant Sunburst Rays
    ctx.save();
    ctx.rotate(gameTime * 0.8);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      ctx.stroke();
    }
    ctx.restore();

    // Crown Intense Glow
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#FFD700';

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-8, -3);
    ctx.lineTo(0, -18);
    ctx.lineTo(8, -3);
    ctx.lineTo(18, -12);
    ctx.lineTo(16, 8);
    ctx.closePath();
    ctx.fill();

    // Inner Gold Highlights
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crown Jewels (Ruby & Emeralds)
    ctx.fillStyle = '#FF0055';
    ctx.beginPath();
    ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00F5A0';
    ctx.beginPath();
    ctx.arc(-9, 1, 2.2, 0, Math.PI * 2);
    ctx.arc(9, 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // NAMEPLATE & STATS
  // -------------------------------------------------------------
  private static renderNameplate(
    ctx: CanvasRenderingContext2D,
    snake: SerpentPlayerEntity,
    head: BodyJoint
  ): void {
    const labelY = head.y + snake.headRadius + 18;

    ctx.save();
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tag = `${snake.name} (${Math.floor(snake.length)})`;

    // Background pill badge
    const metrics = ctx.measureText(tag);
    const badgeW = metrics.width + 12;
    const badgeH = 16;

    ctx.fillStyle = 'rgba(11, 13, 18, 0.75)';
    ctx.beginPath();
    ctx.roundRect(head.x - badgeW / 2, labelY - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();

    ctx.strokeStyle = snake.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text label
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(tag, head.x, labelY);

    ctx.restore();
  }
}
