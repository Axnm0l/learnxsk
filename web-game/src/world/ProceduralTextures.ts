import * as THREE from 'three';

/**
 * Procedural texture generator for LearnXSK 2D-Isometric voxel aesthetics.
 * Uses 2D HTML Canvas to generate authentic pixel-art textures without external assets.
 */
export class ProceduralTextures {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  private static createPixelCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  private static toTexture(canvas: HTMLCanvasElement, key: string): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Top grass face texture (32x32)
   */
  public static getGrassTop(): THREE.CanvasTexture {
    if (this.cache.has('grass_top')) return this.cache.get('grass_top')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    // Base lush green
    ctx.fillStyle = '#558b2f';
    ctx.fillRect(0, 0, 32, 32);

    // Pixel noise variations
    const shades = ['#689f38', '#4b7d27', '#7cb342', '#3e6b1f'];
    for (let x = 0; x < 32; x += 2) {
      for (let y = 0; y < 32; y += 2) {
        const rand = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const index = Math.floor(Math.abs(rand) % shades.length);
        ctx.fillStyle = shades[index];
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Occasional tiny flower dots
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(6, 8, 2, 2);
    ctx.fillRect(20, 22, 2, 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(24, 6, 2, 2);
    ctx.fillRect(10, 24, 2, 2);

    return this.toTexture(canvas, 'grass_top');
  }

  /**
   * Grass block side face (32x32): dirt with grass fringe overhang
   */
  public static getGrassSide(): THREE.CanvasTexture {
    if (this.cache.has('grass_side')) return this.cache.get('grass_side')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    // Loam dirt base
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(0, 0, 32, 32);

    // Dirt pebble noise
    const dirtShades = ['#4a3328', '#6b4d3d', '#533a2e', '#775644'];
    for (let x = 0; x < 32; x += 2) {
      for (let y = 8; y < 32; y += 2) {
        const rand = Math.sin(x * 37.11 + y * 53.7) * 23421.1;
        const index = Math.floor(Math.abs(rand) % dirtShades.length);
        ctx.fillStyle = dirtShades[index];
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Top grass overhang
    ctx.fillStyle = '#558b2f';
    ctx.fillRect(0, 0, 32, 6);
    // Irregular fringe dripping downwards
    const fringePattern = [2, 4, 3, 5, 2, 4, 6, 3, 2, 4, 5, 3, 2, 4, 3, 2];
    for (let i = 0; i < 16; i++) {
      const dropHeight = fringePattern[i];
      ctx.fillRect(i * 2, 6, 2, dropHeight);
    }

    return this.toTexture(canvas, 'grass_side');
  }

  /**
   * Dirt bottom / solid dirt (32x32)
   */
  public static getDirt(): THREE.CanvasTexture {
    if (this.cache.has('dirt')) return this.cache.get('dirt')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(0, 0, 32, 32);

    const dirtShades = ['#4a3328', '#6b4d3d', '#533a2e', '#775644'];
    for (let x = 0; x < 32; x += 2) {
      for (let y = 0; y < 32; y += 2) {
        const rand = Math.sin(x * 19.3 + y * 41.7) * 54321.1;
        const index = Math.floor(Math.abs(rand) % dirtShades.length);
        ctx.fillStyle = dirtShades[index];
        ctx.fillRect(x, y, 2, 2);
      }
    }

    return this.toTexture(canvas, 'dirt');
  }

  /**
   * Cobblestone / path tile (32x32)
   */
  public static getCobblestone(): THREE.CanvasTexture {
    if (this.cache.has('cobble')) return this.cache.get('cobble')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(0, 0, 32, 32);

    // Stone borders & mortar
    ctx.fillStyle = '#44403c';
    // Draw brick mortar lines
    ctx.fillRect(0, 8, 32, 2);
    ctx.fillRect(0, 16, 32, 2);
    ctx.fillRect(0, 24, 32, 2);
    ctx.fillRect(16, 0, 2, 8);
    ctx.fillRect(8, 8, 2, 8);
    ctx.fillRect(24, 8, 2, 8);
    ctx.fillRect(16, 16, 2, 8);
    ctx.fillRect(8, 24, 2, 8);
    ctx.fillRect(24, 24, 2, 8);

    // Highlighting
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(2, 2, 6, 2);
    ctx.fillRect(18, 2, 6, 2);
    ctx.fillRect(10, 10, 6, 2);
    ctx.fillRect(2, 18, 6, 2);
    ctx.fillRect(18, 18, 6, 2);

    return this.toTexture(canvas, 'cobble');
  }

  /**
   * Wood planks (32x32)
   */
  public static getWoodPlank(): THREE.CanvasTexture {
    if (this.cache.has('wood_plank')) return this.cache.get('wood_plank')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(0, 0, 32, 32);

    // Planks seams
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 7, 32, 2);
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(0, 23, 32, 2);
    ctx.fillRect(0, 31, 32, 2);

    // Woodgrain highlights
    ctx.fillStyle = '#a16207';
    ctx.fillRect(4, 2, 12, 1);
    ctx.fillRect(8, 10, 14, 1);
    ctx.fillRect(2, 18, 18, 1);
    ctx.fillRect(12, 26, 12, 1);

    return this.toTexture(canvas, 'wood_plank');
  }

  /**
   * Tree leaves foliage (32x32)
   */
  public static getLeaves(): THREE.CanvasTexture {
    if (this.cache.has('leaves')) return this.cache.get('leaves')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, 32, 32);

    const shades = ['#15803d', '#14532d', '#22c55e', '#166534'];
    for (let x = 0; x < 32; x += 4) {
      for (let y = 0; y < 32; y += 4) {
        const idx = Math.floor(Math.random() * shades.length);
        ctx.fillStyle = shades[idx];
        ctx.fillRect(x, y, 4, 4);
      }
    }

    return this.toTexture(canvas, 'leaves');
  }

  /**
   * Water block (32x32)
   */
  public static getWater(): THREE.CanvasTexture {
    if (this.cache.has('water')) return this.cache.get('water')!;

    const { canvas, ctx } = this.createPixelCanvas(32, 32);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 32, 32);

    // Ripple accents
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(4, 6, 8, 2);
    ctx.fillRect(18, 14, 10, 2);
    ctx.fillRect(8, 22, 12, 2);
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(6, 6, 3, 1);
    ctx.fillRect(20, 14, 4, 1);

    return this.toTexture(canvas, 'water');
  }

  /**
   * Quest board notice parchment texture
   */
  public static getQuestBoardTexture(): THREE.CanvasTexture {
    if (this.cache.has('quest_board')) return this.cache.get('quest_board')!;

    const { canvas, ctx } = this.createPixelCanvas(64, 64);
    // Dark oak board frame
    ctx.fillStyle = '#3f210d';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(4, 4, 56, 56);

    // Parchment pinned paper
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(10, 10, 44, 44);

    // Pin
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(30, 8, 4, 4);

    // Red exclamation mark "!"
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(28, 16, 8, 18);
    ctx.fillRect(28, 38, 8, 8);

    return this.toTexture(canvas, 'quest_board');
  }

  /**
   * Terminal screen face texture
   */
  public static getTerminalScreenTexture(): THREE.CanvasTexture {
    if (this.cache.has('terminal_screen')) return this.cache.get('terminal_screen')!;

    const { canvas, ctx } = this.createPixelCanvas(64, 64);
    // Black CRT bezel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 64, 64);

    // Glowing green CRT monitor
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(6, 6, 52, 52);

    // Terminal scanlines
    ctx.fillStyle = '#047857';
    for (let y = 8; y < 56; y += 4) {
      ctx.fillRect(6, y, 52, 1);
    }

    // Terminal text prompt
    ctx.fillStyle = '#34d399';
    ctx.fillRect(10, 14, 16, 3);
    ctx.fillRect(10, 22, 28, 3);
    ctx.fillRect(10, 30, 20, 3);
    // Blinking cursor
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(34, 30, 4, 4);

    return this.toTexture(canvas, 'terminal_screen');
  }
}
