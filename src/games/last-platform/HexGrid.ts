import { PlatformTileData, TileState, Point2D, HexCoord, LastPlatformConfig } from './types';

export class HexGrid {
  public tiles: Map<number, PlatformTileData> = new Map();
  public tilesList: PlatformTileData[] = [];
  public config: LastPlatformConfig;
  public arenaRadius: number; // Max arena radius in px
  public currentDangerRadius: number; // Shrinking storm radius
  public suddenDeath: boolean = false;
  
  // Moving orbit platforms
  public movingTiles: PlatformTileData[] = [];

  constructor(config: LastPlatformConfig) {
    this.config = config;
    this.arenaRadius = (config.gridRadius + 0.8) * Math.sqrt(3) * config.tileSize;
    this.currentDangerRadius = this.arenaRadius;
    this.generateGrid();
  }

  /**
   * Generates a concentric hexagonal tile matrix with axial coordinates.
   */
  public generateGrid(): void {
    this.tiles.clear();
    this.tilesList = [];
    this.movingTiles = [];
    let idCounter = 1;

    const R = this.config.gridRadius;
    const size = this.config.tileSize;

    // Generate concentric rings from center (ring 0) to outer ring R
    for (let q = -R; q <= R; q++) {
      const r1 = Math.max(-R, -q - R);
      const r2 = Math.min(R, -q + R);
      for (let r = r1; r <= r2; r++) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));

        // Pointy-topped hex to world pixel conversion
        const worldX = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
        const worldY = size * ((3 / 2) * r);

        const tile: PlatformTileData = {
          id: idCounter++,
          q,
          r,
          s,
          ring,
          worldX,
          worldY,
          baseX: worldX,
          baseY: worldY,
          size,
          height: this.config.tileHeight,
          state: 'stable',
          stateTimer: 0,
          warningDuration: this.config.warningDuration,
          crumblingDuration: this.config.crumblingDuration,
          fallProgress: 0,
          fallVelocityZ: 0,
          fallRotation: 0,
          fallRotationSpeed: (Math.random() - 0.5) * 4,
          isSteppedOn: false,
          stepCooldown: 0,
          shakeIntensity: 0,
          crackSeed: Math.random() * 1000,
          glowPulsePhase: Math.random() * Math.PI * 2,
        };

        this.tiles.set(tile.id, tile);
        this.tilesList.push(tile);
      }
    }

    // Add moving satellite platforms in the outer orbit
    const movingCount = this.config.movingPlatformsCount || 3;
    for (let i = 0; i < movingCount; i++) {
      const angle = (i * 2 * Math.PI) / movingCount;
      const orbitRadius = this.arenaRadius * 0.88;
      const x = Math.cos(angle) * orbitRadius;
      const y = Math.sin(angle) * orbitRadius;

      const movingTile: PlatformTileData = {
        id: idCounter++,
        q: 99 + i,
        r: 99 + i,
        s: -198 - 2 * i,
        ring: R + 1,
        worldX: x,
        worldY: y,
        baseX: x,
        baseY: y,
        size: size * 0.95,
        height: this.config.tileHeight * 1.2,
        state: 'stable',
        stateTimer: 0,
        warningDuration: this.config.warningDuration * 1.5,
        crumblingDuration: this.config.crumblingDuration * 1.5,
        fallProgress: 0,
        fallVelocityZ: 0,
        fallRotation: 0,
        fallRotationSpeed: 0,
        isSteppedOn: false,
        stepCooldown: 0,
        shakeIntensity: 0,
        crackSeed: Math.random() * 1000,
        glowPulsePhase: Math.random() * Math.PI * 2,
        isMoving: true,
        moveAngle: angle,
        moveRadius: orbitRadius,
        moveSpeed: 0.45 * (i % 2 === 0 ? 1 : -1),
        moveCenter: { x: 0, y: 0 },
      };

      this.tiles.set(movingTile.id, movingTile);
      this.tilesList.push(movingTile);
      this.movingTiles.push(movingTile);
    }
  }

  /**
   * Updates tile states, shrinking danger zone, moving platforms, and falling animations.
   */
  public update(dt: number, matchProgress: number, isSuddenDeath: boolean): void {
    this.suddenDeath = isSuddenDeath;

    // Shrinking danger perimeter: contracts from outer edge to center
    // In sudden death, shrinks rapidly to inner core ring
    const targetDangerRatio = isSuddenDeath 
      ? 0.18 
      : Math.max(0.35, 1.0 - matchProgress * 0.75);
    
    const shrinkRate = isSuddenDeath ? 1.0 : 0.6;
    this.currentDangerRadius += (this.arenaRadius * targetDangerRatio - this.currentDangerRadius) * (dt * shrinkRate);

    // Update moving satellite platforms
    for (const mt of this.movingTiles) {
      if (mt.isMoving && mt.moveAngle !== undefined && mt.moveRadius !== undefined && mt.moveSpeed !== undefined) {
        mt.moveAngle += mt.moveSpeed * dt;
        mt.worldX = Math.cos(mt.moveAngle) * mt.moveRadius;
        mt.worldY = Math.sin(mt.moveAngle) * mt.moveRadius;
        mt.baseX = mt.worldX;
        mt.baseY = mt.worldY;
      }
    }

    // Process all tiles state machine: stable -> warning -> crumbling -> collapsed
    for (const tile of this.tilesList) {
      tile.glowPulsePhase += dt * (isSuddenDeath ? 5.0 : 3.0);
      if (tile.stepCooldown > 0) {
        tile.stepCooldown -= dt;
      }

      // Center hex tile (ring 0) is guaranteed to NEVER collapse before match timer expires
      if (tile.ring === 0) {
        tile.state = 'stable';
        tile.shakeIntensity = 0;
        tile.fallProgress = 0;
        tile.stateTimer = 0;
        continue;
      }

      // Check danger perimeter breach
      const distFromCenter = Math.hypot(tile.baseX, tile.baseY);
      const isBeyondDangerRadius = distFromCenter > this.currentDangerRadius;

      // In Sudden Death, tiles beyond core rings collapse aggressively with intensified rates
      if (isSuddenDeath && tile.ring >= 2 && tile.state === 'stable') {
        tile.state = 'warning';
        tile.stateTimer = 0;
        tile.warningDuration = 0.8 + Math.random() * 0.8;
        tile.crumblingDuration = 0.6 + Math.random() * 0.6;
      } else if (isBeyondDangerRadius && tile.state === 'stable') {
        tile.state = 'warning';
        tile.stateTimer = 0;
        tile.warningDuration = isSuddenDeath ? (0.6 + Math.random() * 0.6) : (1.2 + Math.random() * 1.8);
        tile.crumblingDuration = isSuddenDeath ? (0.6 + Math.random() * 0.4) : this.config.crumblingDuration;
      }

      // State transitions: stable -> warning -> crumbling -> collapsed
      switch (tile.state) {
        case 'stable':
          tile.shakeIntensity = 0;
          tile.fallProgress = 0;
          break;

        case 'warning': {
          const rateMultiplier = isSuddenDeath ? 1.6 : 1.0;
          tile.stateTimer += dt * rateMultiplier;
          const warnProgress = Math.min(1.0, tile.stateTimer / tile.warningDuration);
          tile.shakeIntensity = warnProgress * (isSuddenDeath ? 4.0 : 2.5);

          if (tile.stateTimer >= tile.warningDuration) {
            tile.state = 'crumbling';
            tile.stateTimer = 0;
          }
          break;
        }

        case 'crumbling': {
          const rateMultiplier = isSuddenDeath ? 1.6 : 1.0;
          tile.stateTimer += dt * rateMultiplier;
          tile.shakeIntensity = (isSuddenDeath ? 6.0 : 4.0) + Math.random() * 3.5;

          if (tile.stateTimer >= tile.crumblingDuration) {
            tile.state = 'collapsed';
            tile.stateTimer = 0;
            tile.fallVelocityZ = 90; // Initial downward drop burst
          }
          break;
        }

        case 'collapsed': {
          // Falling into void physics
          tile.stateTimer += dt;
          tile.fallVelocityZ += 500 * dt; // Gravity in void
          tile.fallProgress = Math.min(1.0, tile.fallProgress + dt * 1.4);
          tile.fallRotation += tile.fallRotationSpeed * dt;
          tile.shakeIntensity = 0;

          // Respawn cycle: tiles inside safe perimeter regenerate after staying collapsed
          const isEligibleToRespawn = (!isSuddenDeath || tile.ring < 2) && (!isBeyondDangerRadius || tile.isMoving);
          if (isEligibleToRespawn && tile.stateTimer >= 6.0 && tile.fallProgress >= 1.0) {
            tile.state = 'respawning';
            tile.stateTimer = 0;
            tile.fallProgress = 1.0;
            tile.fallVelocityZ = 0;
          }
          break;
        }

        case 'respawning': {
          // Ascending matrix reconstruction physics
          const respawnDuration = 1.8;
          tile.stateTimer += dt;
          tile.fallProgress = Math.max(0, 1.0 - tile.stateTimer / respawnDuration);
          tile.fallRotation = tile.fallProgress * (tile.fallRotationSpeed || 1.0);
          tile.shakeIntensity = tile.fallProgress * 1.5;

          if (tile.stateTimer >= respawnDuration) {
            tile.state = 'stable';
            tile.stateTimer = 0;
            tile.fallProgress = 0;
            tile.fallRotation = 0;
            tile.fallVelocityZ = 0;
            tile.shakeIntensity = 0;
          }
          break;
        }
      }
    }
  }

  /**
   * Called when a player steps on a tile. Can trigger destabilization.
   */
  public stepOnTile(tileId: number): void {
    const tile = this.tiles.get(tileId);
    if (!tile || tile.state === 'collapsed' || tile.state === 'respawning') return;

    tile.isSteppedOn = true;

    // Center hex tile (ring 0) is permanently stable and immune to stepping destabilization
    if (tile.ring === 0) return;

    // Any platform tile stepped on by a player or bot enters the decay sequence
    if (tile.state === 'stable') {
      tile.state = 'warning';
      tile.stateTimer = 0;
      // Faster break times: 1.5s warning → 1.0s crumbling (was 3.2s / 2.2s)
      tile.warningDuration = this.suddenDeath ? 0.5 : 1.5;
      tile.crumblingDuration = this.suddenDeath ? 0.4 : 1.0;
      tile.shakeIntensity = 2.5;
    } else if (tile.state === 'warning') {
      // Significantly expedite crumble if continuously stood on — speed up by 0.15s per frame
      tile.stateTimer += 0.15;
    } else if (tile.state === 'crumbling') {
      // Expedite collapse if continuously stood on
      tile.stateTimer += 0.12;
    }
  }

  /**
   * Precision Point-In-Hexagon test.
   * Returns the tile at given world (x,y) only if valid and NOT collapsed / respawning.
   */
  public getTileAt(x: number, y: number): PlatformTileData | null {
    let closestTile: PlatformTileData | null = null;
    let closestDistSq = Infinity;

    for (const tile of this.tilesList) {
      // Collapsed or respawning tiles are abyss - players cannot stand on them!
      if (tile.state === 'collapsed' || tile.state === 'respawning') continue;

      const dx = x - tile.worldX;
      const dy = y - tile.worldY;
      const distSq = dx * dx + dy * dy;

      // Hex radius bounding check
      const boundRadius = tile.size * 1.05;
      if (distSq <= boundRadius * boundRadius) {
        if (this.isPointInsideHex(dx, dy, tile.size)) {
          return tile;
        }
      }

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestTile = tile;
      }
    }

    // Fallback: If very close to center of a non-collapsed, non-respawning tile
    if (closestTile && closestTile.state !== 'collapsed' && closestTile.state !== 'respawning' && closestDistSq <= (closestTile.size * 0.9) ** 2) {
      return closestTile;
    }

    return null;
  }

  /**
   * Fast geometric point-in-hexagon test (pointy-topped hexagon centered at 0,0).
   */
  private isPointInsideHex(px: number, py: number, size: number): boolean {
    const q2x = Math.abs(px);
    const q2y = Math.abs(py);
    const vertRadius = size;
    const horizRadius = (Math.sqrt(3) / 2) * size;

    if (q2x > horizRadius || q2y > vertRadius) return false;
    return vertRadius * 2 * horizRadius - vertRadius * q2x - horizRadius * q2y >= 0;
  }

  /**
   * Returns 6 corner vertices of a pointy-topped hexagon.
   */
  public static getHexCorners(cx: number, cy: number, size: number): Point2D[] {
    const corners: Point2D[] = [];
    for (let i = 0; i < 6; i++) {
      // Pointy-topped: angles at 30, 90, 150, 210, 270, 330 deg (PI/6 + i*PI/3)
      const angle = (Math.PI / 6) + (i * Math.PI) / 3;
      corners.push({
        x: cx + size * Math.cos(angle),
        y: cy + size * Math.sin(angle),
      });
    }
    return corners;
  }

  /**
   * Finds the nearest stable or warning tile for Bot pathfinding / recovery leap.
   */
  public getClosestSafeTile(x: number, y: number): PlatformTileData | null {
    let bestTile: PlatformTileData | null = null;
    let minScore = Infinity;

    for (const tile of this.tilesList) {
      if (tile.state === 'collapsed' || tile.state === 'respawning') continue;

      const dist = Math.hypot(x - tile.worldX, y - tile.worldY);
      const centerDist = Math.hypot(tile.worldX, tile.worldY);
      const isOutsideDanger = centerDist > this.currentDangerRadius && !tile.isMoving;
      
      // Safety weighting: stable is best, warning is okay, crumbling is hazardous
      let safetyPenalty = 0;
      if (tile.state === 'warning') safetyPenalty = 150;
      if (tile.state === 'crumbling') safetyPenalty = 450;
      if (isOutsideDanger) safetyPenalty += 600;
      
      // Distance from center penalty (prefer central safe zones)
      const score = dist + safetyPenalty + centerDist * 0.4;

      if (score < minScore) {
        minScore = score;
        bestTile = tile;
      }
    }

    return bestTile;
  }

  /**
   * Returns all tiles within a given radial distance from a blast origin.
   */
  public getTilesInRadius(x: number, y: number, radius: number): PlatformTileData[] {
    const rSq = radius * radius;
    return this.tilesList.filter((tile) => {
      const dx = tile.worldX - x;
      const dy = tile.worldY - y;
      return dx * dx + dy * dy <= rSq;
    });
  }

  /**
   * Triggers sudden collapse of random outer tiles or cluster strike.
   */
  public triggerHazardStrike(x: number, y: number, radius: number = 80): void {
    const impacted = this.getTilesInRadius(x, y, radius);
    for (const tile of impacted) {
      if (tile.ring === 0) continue; // Center tile is permanently stable
      if (tile.state === 'stable') {
        tile.state = 'warning';
        tile.stateTimer = 0;
        tile.warningDuration = 0.8 + Math.random() * 0.6;
      } else if (tile.state === 'warning') {
        tile.state = 'crumbling';
        tile.stateTimer = 0;
      }
    }
  }
}
