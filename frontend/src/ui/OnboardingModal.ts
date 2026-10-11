import * as THREE from 'three';
import { GemmaClient, StudentProfile } from '../ai/GemmaClient';
import { QuestManager } from '../quest/QuestManager';

export class OnboardingModal {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private uiWrapper: HTMLElement;
  private onComplete: (profile: StudentProfile) => void;

  // Three.js 3D Voxel Scene members
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animFrameId: number = 0;
  private startTime: number = 0;
  private clouds: THREE.Mesh[] = [];
  private waterMesh: THREE.Mesh | null = null;
  private seed: number = 77;

  constructor(onComplete: (profile: StudentProfile) => void) {
    this.onComplete = onComplete;
    this.container = document.createElement('div');
    this.container.id = 'onboarding-overlay';
    this.container.className = 'onboarding-backdrop';

    // 3D Canvas layer behind the UI
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'onboarding-3d-canvas';
    this.canvas.className = 'onboarding-3d-canvas';
    this.container.appendChild(this.canvas);

    // UI Content wrapper layer
    this.uiWrapper = document.createElement('div');
    this.uiWrapper.className = 'onboarding-ui-wrapper';
    this.container.appendChild(this.uiWrapper);

    document.body.appendChild(this.container);

    // Initialize 3D Voxel scene
    this.initThreeScene();

    // Render Step 1
    this.renderStep1();
  }

  /* =========================================================================
     THREE.JS PROCEDURAL VOXEL SCENE (MATCHING MINECRAFT LOADING STYLE)
     ========================================================================= */

  private rand(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }

  private heightAt(x: number, z: number): number {
    let h = 0;
    h += Math.sin(x * 0.15 + 1.3) * Math.cos(z * 0.12 + 0.7) * 3;
    h += Math.sin(x * 0.07 + 3.1) * Math.cos(z * 0.09 - 1.2) * 5;
    h += Math.cos(x * 0.22 - 0.5) * Math.sin(z * 0.18 + 2.1) * 1.5;
    const mDist = Math.sqrt((x - 12) ** 2 + (z + 18) ** 2);
    if (mDist < 18) h += (18 - mDist) * 0.55;
    return h;
  }

  private initThreeScene(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 500);
    this.camera.position.set(28, 20, 42);
    this.camera.lookAt(0, 4, 0);

    // Sky gradient sphere
    const skyGeo = new THREE.SphereGeometry(200, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x3867d6) },
        bottomColor: { value: new THREE.Color(0x81ecec) },
        sunColor: { value: new THREE.Color(0xfdcb6e) },
        sunDir: { value: new THREE.Vector3(0.4, 0.35, -0.5).normalize() }
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
          float sunDot = max(dot(dir, sunDir), 0.0);
          sky += sunColor * pow(sunDot, 32.0) * 0.6;
          sky += sunColor * pow(sunDot, 4.0) * 0.15;
          gl_FragColor = vec4(sky, 1.0);
        }
      `
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Lights
    const ambient = new THREE.AmbientLight(0x74b9ff, 0.75);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff3bf, 1.4);
    sun.position.set(35, 45, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    // Voxel Landscape
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildMountains();
    this.buildClouds();

    this.startTime = performance.now();
    window.addEventListener('resize', this.handleResize);

    // Start 3D animation loop
    this.animate();
  }

  private buildTerrain(): void {
    const blockSize = 1;
    const grassColor = new THREE.Color(0x5a8f29);
    const dirtColor = new THREE.Color(0x8b5e3c);
    const stoneColor = new THREE.Color(0x7f8c8d);

    const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);

    interface BlockInfo { x: number; y: number; z: number; color: THREE.Color; }
    const blocks: BlockInfo[] = [];

    const range = 26;
    for (let x = -range; x <= range; x += 1) {
      for (let z = -range; z <= range; z += 1) {
        const h = this.heightAt(x, z);
        const topY = Math.round(h);
        blocks.push({ x, y: topY, z, color: grassColor.clone() });
        const depth = Math.max(2, Math.floor(this.rand() * 2) + 2);
        for (let d = 1; d <= depth; d++) {
          blocks.push({ x, y: topY - d, z, color: d <= 2 ? dirtColor.clone() : stoneColor.clone() });
        }
      }
    }

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
    const waterGeo = new THREE.PlaneGeometry(90, 90);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x2e7d9e,
      transparent: true,
      opacity: 0.7,
      shininess: 90,
      specular: new THREE.Color(0xaaddff)
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -2;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  private buildTrees(): void {
    this.seed = 222;
    const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
    const leafMats = [
      new THREE.MeshLambertMaterial({ color: 0x2d7a2d }),
      new THREE.MeshLambertMaterial({ color: 0x3c9a3c }),
      new THREE.MeshLambertMaterial({ color: 0x1e6b1e })
    ];

    for (let i = 0; i < 42; i++) {
      const tx = (this.rand() - 0.5) * 46;
      const tz = (this.rand() - 0.5) * 46;
      const h = this.heightAt(tx, tz);
      if (h < -1) continue;

      const group = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(0, 2, 0);
      trunk.castShadow = true;
      group.add(trunk);

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
    const stoneGeo = new THREE.BoxGeometry(3, 3, 3);
    const stoneMats = [
      new THREE.MeshLambertMaterial({ color: 0x777777 }),
      new THREE.MeshLambertMaterial({ color: 0x666666 }),
      new THREE.MeshLambertMaterial({ color: 0x888888 })
    ];
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

    this.seed = 888;
    const centers = [
      { x: -22, z: -22 },
      { x: 18, z: -26 },
      { x: 30, z: -18 }
    ];

    for (const c of centers) {
      const peakH = 11 + this.rand() * 9;
      for (let r = 0; r < 7; r++) {
        const layerH = peakH - r * 1.8;
        if (layerH < 2) break;
        const spread = r * 2.4;
        const numBlocks = Math.floor(4 + r * 3);
        for (let b = 0; b < numBlocks; b++) {
          const bx = c.x + (this.rand() - 0.5) * spread;
          const bz = c.z + (this.rand() - 0.5) * spread;
          const by = layerH - this.rand() * 2;
          const block = new THREE.Mesh(stoneGeo, by > peakH - 3.5 ? snowMat : stoneMats[Math.floor(this.rand() * stoneMats.length)]);
          block.position.set(bx, by, bz);
          block.castShadow = true;
          this.scene.add(block);
        }
      }
    }
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.seed = 444;

    for (let i = 0; i < 10; i++) {
      const group = new THREE.Group();
      const numBlocks = 3 + Math.floor(this.rand() * 4);
      for (let b = 0; b < numBlocks; b++) {
        const w = 2 + this.rand() * 4;
        const h = 1 + this.rand() * 1.5;
        const d = 2 + this.rand() * 3;
        const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cloudMat);
        block.position.set((this.rand() - 0.5) * 8, (this.rand() - 0.5) * 1.5, (this.rand() - 0.5) * 6);
        group.add(block);
      }

      group.position.set(
        (this.rand() - 0.5) * 100,
        24 + this.rand() * 12,
        (this.rand() - 0.5) * 70
      );
      this.scene.add(group);
      this.clouds.push(group as unknown as THREE.Mesh);
    }
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const t = (performance.now() - this.startTime) / 1000;

    // Smooth subtle camera sway
    this.camera.position.x = 28 + Math.sin(t * 0.12) * 2.8;
    this.camera.position.y = 20 + Math.sin(t * 0.09) * 1.4;
    this.camera.lookAt(0, 4, 0);

    // Drifting clouds
    for (const cloud of this.clouds) {
      cloud.position.x += 0.018;
      if (cloud.position.x > 65) cloud.position.x = -65;
    }

    // Water wave oscillation
    if (this.waterMesh) {
      this.waterMesh.position.y = -2 + Math.sin(t * 0.6) * 0.12;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /* =========================================================================
     UI RENDERERS — MINECRAFT / RETRO BLOCKLANDS AESTHETICS
     ========================================================================= */

  private renderStep1(): void {
    this.uiWrapper.innerHTML = `
      <div class="onboarding-card pixel-retro-card">
        <!-- HEADER -->
        <div class="onboarding-header">
          <div class="pixel-badge-amber">
            <span class="pixel-star">★</span> GEMMA 4 // NEURAL ONBOARDING <span class="pixel-star">★</span>
          </div>
          <h1 class="onboarding-title pixel-title">LEARNXSK: THE CYBER BLOCKLANDS</h1>
          <p class="onboarding-subtitle terminal-text">Calibrate your personalized cybersecurity learning simulation.</p>
        </div>

        <!-- FORM BODY -->
        <div class="onboarding-body">
          <!-- CALLSIGN -->
          <div class="input-group">
            <label class="pixel-label">CADET CALLSIGN / NAME:</label>
            <div class="pixel-input-box">
              <span class="input-prefix">&gt;</span>
              <input type="text" id="ob-handle" class="pixel-text-input terminal-text" value="Cadet_Cipher" placeholder="Enter hacker handle..." />
            </div>
          </div>

          <!-- LEVEL SELECTION -->
          <div class="input-group">
            <label class="pixel-label">CURRENT EXPERIENCE LEVEL:</label>
            <div class="level-options pixel-level-grid">
              <label class="pixel-level-btn active" data-lvl="novice">
                <input type="radio" name="ob-level" value="novice" checked />
                <span class="lvl-dot green"></span> Novice
              </label>
              <label class="pixel-level-btn" data-lvl="intermediate">
                <input type="radio" name="ob-level" value="intermediate" />
                <span class="lvl-dot yellow"></span> Intermediate
              </label>
              <label class="pixel-level-btn" data-lvl="advanced">
                <input type="radio" name="ob-level" value="advanced" />
                <span class="lvl-dot red"></span> Advanced
              </label>
            </div>
          </div>

          <!-- TRACK GRID -->
          <div class="input-group">
            <label class="pixel-label">WHAT DO YOU WANT TO LEARN? (SELECT YOUR FOCUS):</label>
            <div class="track-grid pixel-track-grid">
              <div class="track-card pixel-track-card active" data-track="linux_core" data-title="Linux & Terminal Mastery">
                <div class="track-icon">🐧</div>
                <div class="track-name pixel-card-title">1. Linux Fundamentals</div>
                <div class="track-desc terminal-text">File hierarchies, permissions, pipe filter mastery, and bash fluency.</div>
              </div>

              <div class="track-card pixel-track-card" data-track="net_recon" data-title="Network Recon & Port Scanning">
                <div class="track-icon">📡</div>
                <div class="track-name pixel-card-title">2. Network Reconnaissance</div>
                <div class="track-desc terminal-text">Port audits, ICMP ping sweeps, service probes, and rogue port hunting.</div>
              </div>

              <div class="track-card pixel-track-card" data-track="web_sec" data-title="Web Security & Exploit Defense">
                <div class="track-icon">🌐</div>
                <div class="track-name pixel-card-title">3. Web App Defense</div>
                <div class="track-desc terminal-text">API audits, SQLi bypass inspection, auth headers, and session sanitizing.</div>
              </div>

              <div class="track-card pixel-track-card" data-track="crypto" data-title="Cryptography & Secret Keys">
                <div class="track-icon">🔐</div>
                <div class="track-name pixel-card-title">4. Cryptography & Ciphers</div>
                <div class="track-desc terminal-text">Base64 decoding, SHA-256 integrity checksums, and password salt entropy.</div>
              </div>

              <div class="track-card pixel-track-card" data-track="threat_hunt" data-title="Threat Hunting & Incident Response">
                <div class="track-icon">🛡️</div>
                <div class="track-name pixel-card-title">5. Threat Hunting</div>
                <div class="track-desc terminal-text">Webshell log forensics with grep, persistence isolation, and quarantine.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER BUTTONS -->
        <div class="onboarding-footer pixel-footer-row">
          <button class="pixel-btn-stone" id="btn-skip-onboarding" type="button">
            SKIP TO GAME &rarr;
          </button>
          <button class="pixel-btn-emerald" id="btn-start-calibration" type="button">
            CONTINUE TO GEMMA 4 DIAGNOSTIC &rarr;
          </button>
        </div>
      </div>
    `;

    // Track card selection
    const cards = this.uiWrapper.querySelectorAll('.pixel-track-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Level buttons
    const pills = this.uiWrapper.querySelectorAll('.pixel-level-btn');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const radio = pill.querySelector('input[type="radio"]') as HTMLInputElement;
        if (radio) radio.checked = true;
      });
    });

    // Skip button
    const skipBtn = this.uiWrapper.querySelector('#btn-skip-onboarding') as HTMLButtonElement;
    skipBtn?.addEventListener('click', () => {
      const defaultProfile: StudentProfile = {
        handle: 'Cadet_Cipher',
        level: 'novice',
        trackId: 'linux_core',
        trackTitle: 'Linux & Terminal Mastery',
        goal: 'Master Linux & Terminal Mastery'
      };
      this.close();
      this.onComplete(defaultProfile);
    });

    // Continue button
    const btn = this.uiWrapper.querySelector('#btn-start-calibration') as HTMLButtonElement;
    btn.addEventListener('click', () => {
      const handleInput = (this.uiWrapper.querySelector('#ob-handle') as HTMLInputElement).value.trim() || 'Cadet_Cipher';
      const levelRadio = this.uiWrapper.querySelector('input[name="ob-level"]:checked') as HTMLInputElement;
      const level = levelRadio ? levelRadio.value : 'novice';
      const activeCard = this.uiWrapper.querySelector('.pixel-track-card.active') as HTMLElement;
      const trackId = activeCard?.getAttribute('data-track') || 'linux_core';
      const trackTitle = activeCard?.getAttribute('data-title') || 'Linux & Terminal Mastery';

      const profile: StudentProfile = {
        handle: handleInput,
        level,
        trackId,
        trackTitle,
        goal: `Master ${trackTitle}`
      };

      this.renderStep2Diagnostic(profile);
    });
  }

  private async renderStep2Diagnostic(profile: StudentProfile): Promise<void> {
    this.uiWrapper.innerHTML = `
      <div class="onboarding-card pixel-retro-card">
        <div class="onboarding-header">
          <div class="pixel-badge-amber">
            <span class="pixel-star">★</span> GEMMA 4 // NEURAL DIAGNOSTIC <span class="pixel-star">★</span>
          </div>
          <h1 class="onboarding-title pixel-title">CALIBRATING NEURAL TUTOR...</h1>
          <p class="onboarding-subtitle terminal-text">Gemma 4 is analyzing profile: <span style="color: #fbbf24;">${profile.handle}</span> [${profile.trackTitle}]</p>
        </div>

        <div class="onboarding-body" id="ob-diag-body">
          <div class="scanning-indicator pixel-loading-box">
            <div class="pixel-spinner"></div>
            <p class="terminal-text" style="margin-top: 1.2rem; color: #fbbf24;">Synthesizing customized readiness check...</p>
          </div>
        </div>
      </div>
    `;

    const gemma = GemmaClient.getInstance();
    const result = await gemma.generateOnboardingAnalysis(profile);

    const diagBody = this.uiWrapper.querySelector('#ob-diag-body');
    if (!diagBody) return;

    diagBody.innerHTML = `
      <!-- GEMMA SPEECH BOX -->
      <div class="gemma-speech-box pixel-speech-box">
        <div class="gemma-avatar pixel-avatar">🤖 GEMMA 4:</div>
        <p class="gemma-text terminal-text">${result.greeting}</p>
      </div>

      <!-- DIAGNOSTIC QUESTION -->
      <div class="diagnostic-question-card pixel-question-box">
        <div class="diag-title pixel-label">READINESS CHALLENGE:</div>
        <p class="diag-prompt terminal-text">${result.diagnosticQuestion}</p>

        <div class="diag-options pixel-options-list">
          ${result.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            return `
              <button class="diag-opt-btn pixel-opt-btn" data-idx="${i}">
                <span class="opt-key">[${letter}]</span>
                <span class="opt-label terminal-text">${opt}</span>
              </button>
            `;
          }).join('')}
        </div>
        <div id="diag-feedback" class="diag-feedback-text terminal-text"></div>
      </div>

      <!-- FOOTER -->
      <div class="onboarding-footer pixel-footer-row" style="margin-top: 1rem;">
        <span class="terminal-text" style="color: #94a3b8; font-size: 0.75rem;">Blocklands Ready &bull; 64x64 Citadel Map</span>
        <button class="pixel-btn-emerald" id="btn-enter-game" disabled>
          ENTER THE BLOCKLANDS &rarr;
        </button>
      </div>
    `;

    const optButtons = this.uiWrapper.querySelectorAll('.pixel-opt-btn');
    const feedback = this.uiWrapper.querySelector('#diag-feedback') as HTMLElement;
    const enterBtn = this.uiWrapper.querySelector('#btn-enter-game') as HTMLButtonElement;

    optButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-idx') || '0', 10);
        optButtons.forEach(b => (b as HTMLButtonElement).disabled = true);

        if (idx === result.correctIdx) {
          (btn as HTMLElement).classList.add('correct');
          feedback.innerHTML = `<span style="color: #4ade80;">✓ Excellent, ${profile.handle}! Accurate response. Initial telemetry verified (+25 bonus XP awarded).</span>`;
          QuestManager.getInstance().xp += 25;
        } else {
          (btn as HTMLElement).classList.add('wrong');
          const correctBtn = optButtons[result.correctIdx] as HTMLElement;
          if (correctBtn) correctBtn.classList.add('correct');
          feedback.innerHTML = `<span style="color: #fbbf24;">Note: The calibrated answer is "${result.options[result.correctIdx]}". No worries, you will master this in the field!</span>`;
        }

        enterBtn.disabled = false;
        enterBtn.classList.add('pulse-glow');
      });
    });

    enterBtn.addEventListener('click', () => {
      QuestManager.getInstance().setPreferredTrack(profile.trackId);
      this.close();
      this.onComplete(profile);
    });
  }

  public close(): void {
    // Stop 3D scene & free WebGL resources
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);

    try {
      this.renderer.dispose();
    } catch (_e) {
      // ignore
    }

    this.container.classList.add('fade-out');
    setTimeout(() => {
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 450);
  }
}
