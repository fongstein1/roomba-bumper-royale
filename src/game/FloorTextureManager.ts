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

    // 1. Natural warm oak hardwood base with detailed procedural grain
    ctx.fillStyle = '#b3824f';
    ctx.fillRect(0, 0, w, h);

    // Plank lines & grain
    const plankHeight = 32;
    for (let y = 0; y < h; y += plankHeight) {
      // Wood tone variation per plank
      const shade = 170 + Math.floor(Math.sin(y * 0.08) * 16 + Math.cos(y * 0.03) * 12);
      ctx.fillStyle = `rgb(${shade + 12}, ${shade - 28}, ${shade - 72})`;
      ctx.fillRect(0, y, w, plankHeight);

      // Fine grain streaks within plank
      ctx.strokeStyle = `rgba(${shade - 40}, ${shade - 65}, ${shade - 100}, 0.22)`;
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        const gy = y + 5 + g * 7;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(w * 0.3, gy + Math.sin(y) * 4, w * 0.7, gy - Math.sin(y) * 4, w, gy);
        ctx.stroke();
      }

      // Plank horizontal seam
      ctx.strokeStyle = 'rgba(60, 35, 12, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // Random vertical butt joints with bevel shading
      const plankLength = 110 + ((y * 43) % 90);
      for (let x = (y * 29) % plankLength; x < w; x += plankLength) {
        ctx.strokeStyle = 'rgba(50, 30, 10, 0.5)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankHeight);
        ctx.stroke();
      }
    }

    // 2. Kitchen Zone (Modern Terrazzo / Carrara Marble in top-right: x: 48% to 100%, y: 0% to 48%)
    const kitchenX = w * 0.48;
    const kitchenY = 0;
    const kitchenW = w * 0.52;
    const kitchenH = h * 0.48;

    ctx.fillStyle = '#eae5dc';
    ctx.fillRect(kitchenX, kitchenY, kitchenW, kitchenH);

    // Marble veins
    ctx.strokeStyle = 'rgba(160, 150, 140, 0.35)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const startX = kitchenX + i * 90;
      ctx.moveTo(startX, 0);
      ctx.bezierCurveTo(startX + 40, kitchenH * 0.3, startX - 30, kitchenH * 0.7, startX + 50, kitchenH);
      ctx.stroke();
    }

    // Large ceramic tiles with recessed grout
    const tileSize = 64;
    ctx.strokeStyle = 'rgba(115, 108, 100, 0.4)';
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

    // Brass transition threshold between kitchen and living room
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kitchenX, 0);
    ctx.lineTo(kitchenX, kitchenH);
    ctx.lineTo(w, kitchenH);
    ctx.stroke();

    // 3. Luxury Area Rug (Center-Left Lounge: x: 12% to 52%, y: 46% to 88%)
    const rugX = w * 0.12;
    const rugY = h * 0.46;
    const rugW = w * 0.40;
    const rugH = h * 0.42;

    // Rug base (deep stylish indigo with woven cross-hatch texture)
    ctx.fillStyle = '#223048';
    ctx.fillRect(rugX, rugY, rugW, rugH);

    // Cross-weave pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let rx = rugX; rx < rugX + rugW; rx += 6) {
      ctx.beginPath();
      ctx.moveTo(rx, rugY);
      ctx.lineTo(rx, rugY + rugH);
      ctx.stroke();
    }
    for (let ry = rugY; ry < rugY + rugH; ry += 6) {
      ctx.beginPath();
      ctx.moveTo(rugX, ry);
      ctx.lineTo(rugX + rugW, ry);
      ctx.stroke();
    }

    // Rug golden borders
    ctx.strokeStyle = '#dfc495';
    ctx.lineWidth = 4;
    ctx.strokeRect(rugX + 8, rugY + 8, rugW - 16, rugH - 16);
    ctx.strokeRect(rugX + 16, rugY + 16, rugW - 32, rugH - 32);

    // 4. OFFICIAL SPONSORSHIP FLOOR DECAL: "JOYRIDE" (Micromobility Fleet OS)
    // Painted center-court in the foyer/living space (x: 520, y: 310)
    const sponsorX = w * 0.28;
    const sponsorY = h * 0.24;
    const sponsorW = 320;
    const sponsorH = 100;

    ctx.save();
    // Rounded racetrack backdrop
    ctx.fillStyle = 'rgba(0, 82, 255, 0.88)'; // Joyride Royal Electric Blue
    ctx.beginPath();
    ctx.roundRect(sponsorX - sponsorW / 2, sponsorY - sponsorH / 2, sponsorW, sponsorH, 20);
    ctx.fill();

    // Neon cyan rim
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner subtle glow border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sponsorX - sponsorW / 2 + 5, sponsorY - sponsorH / 2 + 5, sponsorW - 10, sponsorH - 10);

    // Scooter icon (procedural canvas lines)
    ctx.fillStyle = '#00f2fe';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2.5;
    const scX = sponsorX - 105;
    const scY = sponsorY - 2;
    // Wheels
    ctx.beginPath();
    ctx.arc(scX - 18, scY + 14, 6, 0, Math.PI * 2);
    ctx.arc(scX + 18, scY + 14, 6, 0, Math.PI * 2);
    ctx.stroke();
    // Deck & Stem
    ctx.beginPath();
    ctx.moveTo(scX - 18, scY + 14);
    ctx.lineTo(scX + 18, scY + 14);
    ctx.lineTo(scX + 14, scY - 14);
    ctx.lineTo(scX + 6, scY - 14); // handlebar
    ctx.stroke();

    // "JOYRIDE" brand text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('JOYRIDE', sponsorX - 65, sponsorY - 10);

    // Subtitle: "MICROMOBILITY FLEET PLATFORM"
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.letterSpacing = '1px';
    ctx.fillText('SHARED SCOOTER & BIKE FLEETS', sponsorX - 65, sponsorY + 18);
    ctx.restore();

    // 5. OFFICIAL SPONSORSHIP FLOOR GRAPHIC #2: JOYRIDE FLEET MOBILITY HUB / DOCKING STATION
    // Located along the lower-right threshold (x: 65% to 95%, y: 72% to 92%)
    const hubX = w * 0.72;
    const hubY = h * 0.76;
    const hubW = 260;
    const hubH = 140;

    ctx.save();
    // Industrial tech bay plate
    ctx.fillStyle = 'rgba(11, 19, 43, 0.85)';
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(hubX - hubW / 2, hubY - hubH / 2, hubW, hubH, 12);
    ctx.fill();
    ctx.stroke();

    // Diagonal cyan hazard stripes along top and bottom
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
    ctx.lineWidth = 2;
    for (let sx = hubX - hubW / 2 + 10; sx < hubX + hubW / 2; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, hubY - hubH / 2 + 3);
      ctx.lineTo(sx + 10, hubY - hubH / 2 + 16);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sx, hubY + hubH / 2 - 16);
      ctx.lineTo(sx + 10, hubY + hubH / 2 - 3);
      ctx.stroke();
    }

    // Hub Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JOYRIDE FLEET HUB', hubX, hubY - 26);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('DEDICATED E-SCOOTER PARKING', hubX, hubY - 8);

    // 3 Mini Parking Bays for scooters
    for (let i = -1; i <= 1; i++) {
      const bx = hubX + i * 72;
      const by = hubY + 28;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - 26, by - 18, 52, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`BAY 0${i + 2}`, bx, by + 4);
    }
    ctx.restore();

    // 6. Subtle micro-grain noise across entire floor
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
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
