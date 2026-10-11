import * as THREE from 'three';

/**
 * LoadingScreen — Minecraft-style loading overlay with a Three.js
 * procedural voxel landscape background.
 *
 * Shows:
 *  - 3D blocky terrain (grass, dirt, water, trees, mountains, clouds)
 *  - "LEARNXSK" title in pixelated style
 *  - "The Cyber Blocklands" subtitle
 *  - Animated green progress bar with percentage
 *  - Rotating tips with a grass-block icon
 */

const TIPS: string[] = [
  "Practice makes progress.\nKeep going, you're doing great!",
  "Never share your passwords.\nUse a password manager instead.",
  "Always check URLs before clicking.\nPhishing attacks are sneaky!",
  "Update your software regularly.\nPatches fix security vulnerabilities.",
  "Use two-factor authentication.\nIt adds an extra layer of security.",
  "Think before you click.\nSocial engineering relies on trust.",
  "Back up your data regularly.\nRansomware can strike at any time.",
  "Check file permissions carefully.\nLeast privilege is your friend.",
  "Encrypt sensitive data.\nProtect it at rest and in transit.",
  "Inspect network traffic.\nAnomalies can reveal intrusions.",
];

export class LoadingScreen {
  private overlay: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private progressFill: HTMLDivElement;
  private progressText: HTMLDivElement;
  private tipText: HTMLSpanElement;
  private animFrameId: number = 0;
  private progress: number = 0;
  private targetProgress: number = 0;
  private tipIndex: number = 0;
  private tipInterval: number = 0;
  private startTime: number = 0;
  private onComplete: (() => void) | null = null;
  private clouds: THREE.Mesh[] = [];
  private waterMesh: THREE.Mesh | null = null;

  constructor() {
    // Build DOM
    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-screen';
    this.overlay.innerHTML = this.buildHTML();
    document.body.appendChild(this.overlay);

    // Grab refs
    this.canvas = this.overlay.querySelector('#loading-3d-canvas') as HTMLCanvasElement;
    this.progressFill = this.overlay.querySelector('#loading-progress-fill') as HTMLDivElement;
    this.progressText = this.overlay.querySelector('#loading-progress-text') as HTMLDivElement;
    this.tipText = this.overlay.querySelector('#loading-tip-text') as HTMLSpanElement;

    // Three.js setup
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(30, 22, 45);
    this.camera.lookAt(0, 4, 0);

    this.buildScene();
    this.startTime = performance.now();

    // Rotate tips
    this.tipIndex = Math.floor(Math.random() * TIPS.length);
    this.tipText.textContent = TIPS[this.tipIndex];
    this.tipInterval = window.setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % TIPS.length;
      this.tipText.style.opacity = '0';
      setTimeout(() => {
        this.tipText.textContent = TIPS[this.tipIndex];
        this.tipText.style.opacity = '1';
      }, 300);
    }, 4000);

    // Handle resize
    window.addEventListener('resize', this.handleResize);

    // Start render loop
    this.animate();
  }

  private buildHTML(): string {
    return `
      <canvas id="loading-3d-canvas"></canvas>
      <div class="loading-ui-layer">
        <!-- TITLE -->
        <div class="loading-title-block">
          <h1 class="loading-title">LEARNXSK</h1>
          <p class="loading-subtitle">The Cyber Blocklands</p>
        </div>

        <!-- LOADING TEXT -->
        <p class="loading-status-text">Loading your personalized cybersecurity<br>learning simulation...</p>

        <!-- PROGRESS BAR -->
        <div class="loading-progress-bar-container">
          <div class="loading-progress-bar-track">
            <div class="loading-progress-bar-fill" id="loading-progress-fill"></div>
          </div>
          <div class="loading-progress-percent" id="loading-progress-text">0%</div>
        </div>

        <!-- TIP BOX -->
        <div class="loading-tip-box">
          <div class="loading-tip-icon">
            <!-- Pixel grass block SVG -->
            <svg viewBox="0 0 16 16" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="16" height="6" fill="#5a8f29"/>
              <rect x="0" y="2" width="4" height="2" fill="#7bc142"/>
              <rect x="6" y="0" width="4" height="2" fill="#7bc142"/>
              <rect x="12" y="3" width="4" height="2" fill="#7bc142"/>
              <rect x="0" y="6" width="16" height="10" fill="#8b5e3c"/>
              <rect x="2" y="8" width="3" height="3" fill="#6d4930"/>
              <rect x="8" y="10" width="4" height="3" fill="#6d4930"/>
              <rect x="12" y="7" width="2" height="2" fill="#6d4930"/>
            </svg>
          </div>
          <span class="loading-tip-label">Tip:</span>
          <span class="loading-tip-text" id="loading-tip-text"></span>
        </div>

        <!-- SKIP HINT -->
        <button class="loading-skip-btn" id="loading-skip-btn" type="button">CLICK TO SKIP / ENTER NOW [SPACE]</button>
      </div>
    `;
  }

  /* =================== THREE.JS SCENE =================== */

  private buildScene(): void {
    // Sky gradient background
    const skyGeo = new THREE.SphereGeometry(200, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x5b9bd5) },
        bottomColor: { value: new THREE.Color(0xd4e6f1) },
        sunColor: { value: new THREE.Color(0xffcc77) },
        sunDir: { value: new THREE.Vector3(0.4, 0.3, -0.5).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y * 0.5 + 0.5;
          vec3 sky = mix(bottomColor, topColor, pow(h, 0.6));
          // sun glow
          float sunDot = max(dot(dir, sunDir), 0.0);
          sky += sunColor * pow(sunDot, 32.0) * 0.6;
          sky += sunColor * pow(sunDot, 4.0) * 0.15;
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Lights
    const ambient = new THREE.AmbientLight(0x8899bb, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffeecc, 1.4);
    sun.position.set(30, 40, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-20, 15, 20);
    this.scene.add(fill);

    // Build terrain
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildMountains();
    this.buildClouds();
  }

  // Simple seeded pseudo-random for deterministic terrain
  private seed = 42;
  private rand(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }

  private heightAt(x: number, z: number): number {
    // Layered sine for rolling hills
    let h = 0;
    h += Math.sin(x * 0.15 + 1.3) * Math.cos(z * 0.12 + 0.7) * 3;
    h += Math.sin(x * 0.07 + 3.1) * Math.cos(z * 0.09 - 1.2) * 5;
    h += Math.cos(x * 0.22 - 0.5) * Math.sin(z * 0.18 + 2.1) * 1.5;
    // Mountain ridge on the back-right
    const mDist = Math.sqrt((x - 15) ** 2 + (z + 20) ** 2);
    if (mDist < 20) h += (20 - mDist) * 0.6;
    return h;
  }

  private buildTerrain(): void {
    // Use instanced meshes for voxel blocks
    const blockSize = 1;
    const grassColor = new THREE.Color(0x5a8f29);
    const dirtColor = new THREE.Color(0x8b5e3c);
    const stoneColor = new THREE.Color(0x888888);

    const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

    // Collect blocks
    interface BlockInfo { x: number; y: number; z: number; color: THREE.Color; }
    const blocks: BlockInfo[] = [];

    const range = 28;
    for (let x = -range; x <= range; x += 1) {
      for (let z = -range; z <= range; z += 1) {
        const h = this.heightAt(x, z);
        const topY = Math.round(h);
        // Top block = grass
        blocks.push({ x, y: topY, z, color: grassColor.clone() });
        // Dirt layers
        const depth = Math.max(2, Math.floor(this.rand() * 3) + 2);
        for (let d = 1; d <= depth; d++) {
          blocks.push({ x, y: topY - d, z, color: d <= 2 ? dirtColor.clone() : stoneColor.clone() });
        }
      }
    }

    // Create instanced mesh for each color group
    const groups: Map<string, { color: THREE.Color; matrices: THREE.Matrix4[] }> = new Map();
    for (const b of blocks) {
      const key = b.color.getHexString();
      if (!groups.has(key)) groups.set(key, { color: b.color, matrices: [] });
      const mat = new THREE.Matrix4();
      mat.setPosition(b.x, b.y, b.z);
      groups.get(key)!.matrices.push(mat);
    }

    for (const [, group] of groups) {
      const mesh = new THREE.InstancedMesh(blockGeo, new THREE.MeshLambertMaterial({ color: group.color }), group.matrices.length);
      group.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
    }
  }

  private buildWater(): void {
    const waterGeo = new THREE.PlaneGeometry(100, 100);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x2e7d9e,
      transparent: true,
      opacity: 0.65,
      shininess: 100,
      specular: new THREE.Color(0xaaddff),
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -2;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  private buildTrees(): void {
    this.seed = 123;
    const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
    const leafMats = [
      new THREE.MeshLambertMaterial({ color: 0x2d7a2d }),
      new THREE.MeshLambertMaterial({ color: 0x3c9a3c }),
      new THREE.MeshLambertMaterial({ color: 0x1e6b1e }),
    ];

    for (let i = 0; i < 50; i++) {
      const tx = (this.rand() - 0.5) * 50;
      const tz = (this.rand() - 0.5) * 50;
      const h = this.heightAt(tx, tz);
      if (h < -1) continue; // Skip water areas

      const group = new THREE.Group();

      // Trunk
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, 2, 0);
      trunk.castShadow = true;
      group.add(trunk);

      // Foliage (stacked blocky layers)
      const treeHeight = 2 + Math.floor(this.rand() * 3);
      for (let ly = 0; ly < treeHeight; ly++) {
        const size = 3 - ly * 0.5;
        if (size < 1) break;
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(size, 2, size),
          leafMats[Math.floor(this.rand() * leafMats.length)]
        );
        leaf.position.set(0, 4 + ly * 1.8, 0);
        leaf.castShadow = true;
        group.add(leaf);
      }

      group.position.set(tx, Math.round(h), tz);
      this.scene.add(group);
    }
  }

  private buildMountains(): void {
    // Large blocky mountains in the background
    const stoneGeo = new THREE.BoxGeometry(3, 3, 3);
    const stoneMats = [
      new THREE.MeshLambertMaterial({ color: 0x777777 }),
      new THREE.MeshLambertMaterial({ color: 0x666666 }),
      new THREE.MeshLambertMaterial({ color: 0x888888 }),
    ];
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });

    this.seed = 999;
    // Two mountain clusters behind the camera view
    const centers = [
      { x: -25, z: -25 },
      { x: 15, z: -30 },
      { x: 35, z: -20 },
    ];

    for (const c of centers) {
      const peakH = 12 + this.rand() * 10;
      for (let r = 0; r < 8; r++) {
        const layerH = peakH - r * 1.8;
        if (layerH < 2) break;
        const spread = r * 2.5;
        const numBlocks = Math.floor(4 + r * 3);
        for (let b = 0; b < numBlocks; b++) {
          const bx = c.x + (this.rand() - 0.5) * spread;
          const bz = c.z + (this.rand() - 0.5) * spread;
          const by = layerH - this.rand() * 2;
          const block = new THREE.Mesh(stoneGeo, by > peakH - 4 ? snowMat : stoneMats[Math.floor(this.rand() * stoneMats.length)]);
          block.position.set(bx, by, bz);
          block.castShadow = true;
          this.scene.add(block);
        }
      }
    }
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.seed = 555;

    for (let i = 0; i < 12; i++) {
      const group = new THREE.Group();
      const numBlocks = 3 + Math.floor(this.rand() * 5);
      for (let b = 0; b < numBlocks; b++) {
        const w = 2 + this.rand() * 4;
        const h = 1 + this.rand() * 1.5;
        const d = 2 + this.rand() * 3;
        const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cloudMat);
        block.position.set((this.rand() - 0.5) * 8, (this.rand() - 0.5) * 1.5, (this.rand() - 0.5) * 6);
        group.add(block);
      }

      group.position.set(
        (this.rand() - 0.5) * 120,
        25 + this.rand() * 15,
        (this.rand() - 0.5) * 80
      );
      this.scene.add(group);
      this.clouds.push(group as unknown as THREE.Mesh);
    }
  }

  /* =================== ANIMATION =================== */

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const t = (performance.now() - this.startTime) / 1000;

    // Gentle camera sway
    this.camera.position.x = 30 + Math.sin(t * 0.15) * 3;
    this.camera.position.y = 22 + Math.sin(t * 0.1) * 1;
    this.camera.lookAt(0, 4, 0);

    // Animate clouds drifting
    for (const cloud of this.clouds) {
      cloud.position.x += 0.015;
      if (cloud.position.x > 70) cloud.position.x = -70;
    }

    // Water subtle animation
    if (this.waterMesh) {
      this.waterMesh.position.y = -2 + Math.sin(t * 0.5) * 0.15;
    }

    // Smooth progress interpolation
    this.progress += (this.targetProgress - this.progress) * 0.05;
    const displayProgress = Math.min(Math.round(this.progress), 100);
    this.progressFill.style.width = `${displayProgress}%`;
    this.progressText.textContent = `${displayProgress}%`;

    this.renderer.render(this.scene, this.camera);

    // Check for completion
    if (displayProgress >= 100 && this.onComplete) {
      const cb = this.onComplete;
      this.onComplete = null; // Prevent multiple calls
      setTimeout(() => {
        this.fadeOut(() => {
          if (cb) cb();
        });
      }, 300);
    }
  };

  /* =================== PUBLIC API =================== */

  /** Set target progress (0-100). */
  setProgress(value: number): void {
    this.targetProgress = Math.min(100, Math.max(0, value));
  }

  /** Start the loading with a callback when done. */
  start(onComplete: () => void): void {
    this.onComplete = onComplete;
    this.simulateLoading();

    // Allow user to click anywhere or press Space/Enter to skip loading
    const skipHandler = (e: Event) => {
      e.stopPropagation();
      this.targetProgress = 100;
      this.progress = 100;
      window.removeEventListener('keydown', keyHandler);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        skipHandler(e);
      }
    };
    this.overlay.addEventListener('click', skipHandler, { once: true });
    window.addEventListener('keydown', keyHandler, { once: true });
  }

  /** Simulate a fake loading sequence for demo/init */
  private simulateLoading(): void {
    const steps = [
      { delay: 150, progress: 15 },
      { delay: 400, progress: 35 },
      { delay: 800, progress: 60 },
      { delay: 1300, progress: 85 },
      { delay: 1800, progress: 95 },
      { delay: 2200, progress: 100 },
    ];
    for (const s of steps) {
      setTimeout(() => this.setProgress(s.progress), s.delay);
    }
  }

  private fadeOut(onDone?: () => void): void {
    this.overlay.style.transition = 'opacity 0.6s ease';
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.destroy();
      if (onDone) onDone();
    }, 650);
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    clearInterval(this.tipInterval);
    window.removeEventListener('resize', this.handleResize);
    try {
      this.renderer.dispose();
    } catch (_e) {
      // ignore already disposed
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.remove();
    }
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
