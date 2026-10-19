/**
 * FloorTextureManager
 * Manages the dynamic canvas-backed floor texture, procedural hardwood/tile/rug,
 * real-time vacuum sweep rasterization, and territory score tracking.
 */
import * as THREE from 'three';

export interface SweepPoint {
  x: number;
  z: number;
  radius: number;
  playerId: string;
  color: string;
}

export class FloorTextureManager {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;

  // Discrete grid for calculating exact scores and percentages
  public readonly gridResolution = 96;
  public grid: Uint8Array; // 0 = dirty, 1 = p1, 2 = p2, 3 = bot1, 4 = bot2
  public readonly arenaSize: number; // e.g. 30 (representing -15 to +15)

  // Player ID to numeric index mapping
  private idToNumber: Record<string, number> = {};
  private numberToId: Record<number, string> = {};

  // Procedural base pattern canvas cached
  private baseCanvas: HTMLCanvasElement;

  constructor(arenaSize: number = 30) {
    this.arenaSize = arenaSize;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create 2D canvas context');
    this.ctx = context;

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = 1024;
    this.baseCanvas.height = 1024;

    this.grid = new Uint8Array(this.gridResolution * this.gridResolution);

    this.initBaseFloor();
    this.resetDust();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  public registerPlayer(id: string, index: number) {
    this.idToNumber[id] = index;
    this.numberToId[index] = id;
  }

  /**
   * Render the designer penthouse floor:
   * - Living room hardwood planks with grain
   * - Kitchen tile grid (upper right quadrant)
   * - Wool woven area rug (lower center)
   * - Polished sheen
   */
  private initBaseFloor() {
    const ctx = this.baseCanvas.getContext('2d')!;
    const w = this.baseCanvas.width;
    const h = this.baseCanvas.height;

    // 1. Natural warm oak hardwood base for living area
    ctx.fillStyle = '#b88a58';
    ctx.fillRect(0, 0, w, h);

    // Plank lines & grain
    const plankHeight = 32;
    ctx.lineWidth = 1.5;
    for (let y = 0; y < h; y += plankHeight) {
      // Wood tone variation
      const shade = 175 + Math.floor(Math.sin(y * 0.05) * 18);
      ctx.fillStyle = `rgb(${shade + 8}, ${shade - 30}, ${shade - 75})`;
      ctx.fillRect(0, y, w, plankHeight);

      // Plank horizontal seam
      ctx.strokeStyle = 'rgba(70, 40, 15, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Random vertical butt joints
      const plankLength = 120 + ((y * 37) % 80);
      for (let x = (y * 23) % plankLength; x < w; x += plankLength) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankHeight);
        ctx.stroke();
      }
    }

    // 2. Kitchen Zone (Modern Terrazzo / Slate Tiles in top-right: x: 50% to 100%, y: 0% to 50%)
    const kitchenX = w * 0.48;
    const kitchenY = 0;
    const kitchenW = w * 0.52;
    const kitchenH = h * 0.48;

    ctx.fillStyle = '#cfc9be';
    ctx.fillRect(kitchenX, kitchenY, kitchenW, kitchenH);

    // Large ceramic tiles with subtle grout
    const tileSize = 64;
    ctx.strokeStyle = 'rgba(100, 95, 90, 0.35)';
    ctx.lineWidth = 2;
    for (let x = kitchenX; x <= w; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, kitchenY);
      ctx.lineTo(x, kitchenH);
      ctx.stroke();
    }
    for (let y = kitchenY; y <= kitchenH; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(kitchenX, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Divider threshold between kitchen and living room
    ctx.strokeStyle = '#5a3d28';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kitchenX, 0);
    ctx.lineTo(kitchenX, kitchenH);
    ctx.lineTo(w, kitchenH);
    ctx.stroke();

    // 3. Luxury Area Rug (Center-Left Lounge: x: 14% to 48%, y: 48% to 84%)
    const rugX = w * 0.12;
    const rugY = h * 0.46;
    const rugW = w * 0.40;
    const rugH = h * 0.42;

    // Rug base (deep stylish indigo with woven fringe)
    ctx.fillStyle = '#26344d';
    ctx.fillRect(rugX, rugY, rugW, rugH);

    // Rug geometric border
    ctx.strokeStyle = '#dfc495';
    ctx.lineWidth = 4;
    ctx.strokeRect(rugX + 8, rugY + 8, rugW - 16, rugH - 16);
    ctx.strokeRect(rugX + 16, rugY + 16, rugW - 32, rugH - 32);

    // Subtle texture noise across entire floor
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Reset the dust layer and score tracking grid
   */
  public resetDust() {
    this.grid.fill(0); // All dirty
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Draw base floor first
    this.ctx.drawImage(this.baseCanvas, 0, 0);

    // Draw dusty grime haze over the floor
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(110, 100, 90, 0.62)';
    this.ctx.fillRect(0, 0, w, h);

    // Add thousands of dust speckles and crumbs
    this.ctx.fillStyle = 'rgba(75, 65, 55, 0.45)';
    for (let i = 0; i < 4000; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      const rad = 1 + Math.random() * 2.5;
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Add white/gray hair fluff and breadcrumbs
    this.ctx.fillStyle = 'rgba(235, 225, 205, 0.55)';
    for (let i = 0; i < 800; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      const rad = 1 + Math.random() * 3.0;
      this.ctx.beginPath();
      this.ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();

    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  /**
   * Convert arena world position ([-arenaSize/2, arenaSize/2]) to canvas coordinates ([0, canvasSize])
   */
  public worldToCanvas(x: number, z: number): { cx: number; cy: number } {
    const half = this.arenaSize / 2;
    const u = (x + half) / this.arenaSize;
    const v = (z + half) / this.arenaSize;
    return {
      cx: Math.max(0, Math.min(this.canvas.width, u * this.canvas.width)),
      cy: Math.max(0, Math.min(this.canvas.height, v * this.canvas.height)),
    };
  }

  /**
   * Convert world position to grid cell (0 to gridResolution - 1)
   */
  public worldToGrid(x: number, z: number): { gx: number; gz: number } {
    const half = this.arenaSize / 2;
    const u = (x + half) / this.arenaSize;
    const v = (z + half) / this.arenaSize;
    return {
      gx: Math.floor(Math.max(0, Math.min(this.gridResolution - 1, u * this.gridResolution))),
      gz: Math.floor(Math.max(0, Math.min(this.gridResolution - 1, v * this.gridResolution))),
    };
  }

  /**
   * Apply a vacuum clean stamp at the given robot coordinates
   */
  public sweep(sweep: SweepPoint) {
    const { cx, cy } = this.worldToCanvas(sweep.x, sweep.z);
    const radiusPx = (sweep.radius / this.arenaSize) * this.canvas.width * 1.05;

    // 1. Copy clean base floor from baseCanvas to active canvas inside the circle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    this.ctx.clip();

    // Draw the sparkling clean wood/tile/rug
    this.ctx.drawImage(this.baseCanvas, 0, 0);

    // Overlay player's clean signature wax tint with soft radial falloff
    const grad = this.ctx.createRadialGradient(cx, cy, radiusPx * 0.2, cx, cy, radiusPx);
    grad.addColorStop(0, `${sweep.color}35`); // subtle luminous center
    grad.addColorStop(0.7, `${sweep.color}20`);
    grad.addColorStop(1, `${sweep.color}55`); // crisp outer brush ring edge

    this.ctx.fillStyle = grad;
    this.ctx.fill();

    this.ctx.restore();

    // 2. Update discrete score grid
    const playerNum = this.idToNumber[sweep.playerId] || 1;
    const { gx, gz } = this.worldToGrid(sweep.x, sweep.z);
    const gridRadius = Math.ceil((sweep.radius / this.arenaSize) * this.gridResolution);

    for (let dy = -gridRadius; dy <= gridRadius; dy++) {
      const ny = gz + dy;
      if (ny < 0 || ny >= this.gridResolution) continue;
      for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        const nx = gx + dx;
        if (nx < 0 || nx >= this.gridResolution) continue;
        if (dx * dx + dy * dy <= gridRadius * gridRadius) {
          const index = ny * this.gridResolution + nx;
          this.grid[index] = playerNum;
        }
      }
    }

    this.texture.needsUpdate = true;
  }

  /**
   * Compute the percentage of floor cleaned by each player and remaining dirt
   */
  public calculateCoverage(): {
    playerPercents: Record<string, number>;
    dirtRemainingPercent: number;
    totalCleanedPercent: number;
  } {
    const totalCells = this.grid.length;
    const counts: Record<number, number> = {};

    for (let i = 0; i < totalCells; i++) {
      const val = this.grid[i];
      counts[val] = (counts[val] || 0) + 1;
    }

    const dirtyCells = counts[0] || 0;
    const dirtRemainingPercent = Math.round((dirtyCells / totalCells) * 100);
    const totalCleanedPercent = 100 - dirtRemainingPercent;

    const playerPercents: Record<string, number> = {};
    for (const [id, num] of Object.entries(this.idToNumber)) {
      const cellCount = counts[num] || 0;
      playerPercents[id] = Number(((cellCount / totalCells) * 100).toFixed(1));
    }

    return {
      playerPercents,
      dirtRemainingPercent,
      totalCleanedPercent,
    };
  }

  public dispose() {
    this.texture.dispose();
  }
}
