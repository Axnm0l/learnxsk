import * as THREE from 'three';

/**
 * CombatSystem — Enemy Mob Spawner & Combat Manager
 * 
 * If the player stays idle for 10+ seconds, a hostile mob spawns at a distance
 * and charges toward them. Each hit from the mob takes half a heart (0.5 HP).
 * The player can escape by moving away.
 */

export interface CombatCallbacks {
  onPlayerHit: (currentHP: number, maxHP: number) => void;
  onEnemySpawn: () => void;
  onEnemyDespawn: () => void;
  onPlayerDeath: () => void;
}

interface EnemyMob {
  group: THREE.Group;
  position: THREE.Vector3;
  speed: number;
  attackCooldown: number;
  attackTimer: number;
  isAttacking: boolean;
  walkTimer: number;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  head: THREE.Mesh;
  hp: number;
}

export class CombatSystem {
  private scene: THREE.Scene;
  private callbacks: CombatCallbacks;

  // Player health
  public playerHP: number = 5;        // 5 full hearts = 10 half-hearts
  public maxPlayerHP: number = 5;
  private isDead: boolean = false;

  // Idle detection
  private lastPlayerPos: THREE.Vector3 = new THREE.Vector3();
  private idleTime: number = 0;
  private idleThreshold: number = 10; // seconds before enemy spawns

  // Enemy mob
  private enemy: EnemyMob | null = null;
  private enemyActive: boolean = false;
  private spawnDistance: number = 18;
  private attackRange: number = 1.8;
  private hitDamage: number = 0.5; // half a heart per hit

  // Warning UI
  private warningEl: HTMLDivElement | null = null;
  private damageFlashEl: HTMLDivElement | null = null;

  constructor(scene: THREE.Scene, callbacks: CombatCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.createWarningUI();
    this.createDamageFlash();
  }

  private createWarningUI(): void {
    this.warningEl = document.createElement('div');
    this.warningEl.id = 'combat-warning';
    this.warningEl.innerHTML = `
      <div class="combat-warning-inner">
        <span class="combat-warning-icon">⚠</span>
        <span class="combat-warning-text">HOSTILE DETECTED — MOVE OR FIGHT!</span>
      </div>
    `;
    document.body.appendChild(this.warningEl);
  }

  private createDamageFlash(): void {
    this.damageFlashEl = document.createElement('div');
    this.damageFlashEl.id = 'damage-flash';
    document.body.appendChild(this.damageFlashEl);
  }

  private showWarning(): void {
    this.warningEl?.classList.add('visible');
  }

  private hideWarning(): void {
    this.warningEl?.classList.remove('visible');
  }

  private flashDamage(): void {
    if (!this.damageFlashEl) return;
    this.damageFlashEl.classList.add('active');
    setTimeout(() => {
      this.damageFlashEl?.classList.remove('active');
    }, 200);
  }

  /**
   * Create a hostile enemy mob mesh (red/black blocky zombie-style character)
   */
  private spawnEnemy(playerPos: THREE.Vector3): void {
    if (this.enemyActive || this.isDead) return;

    const group = new THREE.Group();

    // Random spawn angle
    const angle = Math.random() * Math.PI * 2;
    const spawnX = playerPos.x + Math.cos(angle) * this.spawnDistance;
    const spawnZ = playerPos.z + Math.sin(angle) * this.spawnDistance;

    // Clamp to world bounds
    const cx = Math.max(-28, Math.min(28, spawnX));
    const cz = Math.max(-28, Math.min(28, spawnZ));
    group.position.set(cx, 0.25, cz);

    // Materials — dark menacing colors
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8b0000 }); // Dark red
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x2d1a1a }); // Dark skin
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });     // Glowing red eyes
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1a0a0a });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.7, 0.35);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.42;
    head.castShadow = true;
    group.add(head);

    // Glowing red eyes
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.44, 0.24);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.44, 0.24);
    group.add(rightEye);

    // Eye glow light
    const eyeLight = new THREE.PointLight(0xff0000, 1.5, 4);
    eyeLight.position.set(0, 1.44, 0.3);
    group.add(eyeLight);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.22);
    armGeo.translate(0, -0.3, 0);

    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.4, 1.15, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.4, 1.15, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.55, 0.24);
    legGeo.translate(0, -0.25, 0);

    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.15, 0.55, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.15, 0.55, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    this.scene.add(group);

    this.enemy = {
      group,
      position: group.position,
      speed: 3.5,
      attackCooldown: 1.5,    // seconds between hits
      attackTimer: 0,
      isAttacking: false,
      walkTimer: 0,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      head,
      hp: 3
    };

    this.enemyActive = true;
    this.showWarning();
    this.callbacks.onEnemySpawn();
  }

  private despawnEnemy(): void {
    if (!this.enemy) return;
    this.scene.remove(this.enemy.group);
    // Dispose geometries/materials
    this.enemy.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
    this.enemy = null;
    this.enemyActive = false;
    this.hideWarning();
    this.callbacks.onEnemyDespawn();
  }

  /**
   * Main update loop — called every frame from GameApp.animate()
   */
  public update(delta: number, playerPos: THREE.Vector3, isModalOpen: boolean): void {
    if (this.isDead || isModalOpen) return;

    // ---- IDLE DETECTION ----
    const moved = this.lastPlayerPos.distanceTo(playerPos) > 0.05;
    if (moved) {
      this.idleTime = 0;
      this.lastPlayerPos.copy(playerPos);

      // If player moves far from enemy, despawn it
      if (this.enemy) {
        const distToEnemy = Math.hypot(
          playerPos.x - this.enemy.position.x,
          playerPos.z - this.enemy.position.z
        );
        if (distToEnemy > 25) {
          this.despawnEnemy();
        }
      }
    } else {
      this.idleTime += delta;
    }

    // Spawn enemy after idle threshold
    if (this.idleTime >= this.idleThreshold && !this.enemyActive) {
      this.spawnEnemy(playerPos);
    }

    // ---- ENEMY AI ----
    if (this.enemy && this.enemyActive) {
      const dir = new THREE.Vector3().subVectors(playerPos, this.enemy.position);
      dir.y = 0;
      const dist = dir.length();

      // Chase player
      if (dist > this.attackRange) {
        dir.normalize();
        this.enemy.position.addScaledVector(dir, this.enemy.speed * delta);
        this.enemy.group.rotation.y = Math.atan2(dir.x, dir.z);

        // Walk animation
        this.enemy.walkTimer += delta * 14;
        const swing = Math.sin(this.enemy.walkTimer) * 0.7;
        this.enemy.leftArm.rotation.x = swing;
        this.enemy.rightArm.rotation.x = -swing;
        this.enemy.leftLeg.rotation.x = -swing;
        this.enemy.rightLeg.rotation.x = swing;
        this.enemy.isAttacking = false;
      } else {
        // In attack range — attack!
        this.enemy.attackTimer += delta;
        this.enemy.isAttacking = true;

        // Face player
        if (dist > 0.01) {
          dir.normalize();
          this.enemy.group.rotation.y = Math.atan2(dir.x, dir.z);
        }

        // Attack swing animation
        const attackSwing = Math.sin(this.enemy.attackTimer * 8) * 1.2;
        this.enemy.rightArm.rotation.x = -attackSwing;
        this.enemy.leftArm.rotation.x = 0;
        this.enemy.leftLeg.rotation.x = 0;
        this.enemy.rightLeg.rotation.x = 0;

        // Deal damage on cooldown
        if (this.enemy.attackTimer >= this.enemy.attackCooldown) {
          this.enemy.attackTimer = 0;
          this.hitPlayer();
        }
      }

      // Head bobbing
      this.enemy.head.position.y = 1.42 + Math.sin(this.enemy.walkTimer * 1.5) * 0.03;
    }
  }

  private hitPlayer(): void {
    this.playerHP = Math.max(0, this.playerHP - this.hitDamage);
    this.flashDamage();
    this.callbacks.onPlayerHit(this.playerHP, this.maxPlayerHP);

    if (this.playerHP <= 0) {
      this.isDead = true;
      this.despawnEnemy();
      this.callbacks.onPlayerDeath();
      this.showDeathScreen();
    }
  }

  private showDeathScreen(): void {
    const deathEl = document.createElement('div');
    deathEl.id = 'death-screen';
    deathEl.innerHTML = `
      <div class="death-screen-content">
        <h1 class="death-title">YOU DIED</h1>
        <p class="death-subtitle">A hostile breached your perimeter.</p>
        <p class="death-tip">Stay mobile to avoid enemy attacks!</p>
        <button class="death-respawn-btn" id="respawn-btn">RESPAWN</button>
      </div>
    `;
    document.body.appendChild(deathEl);

    deathEl.querySelector('#respawn-btn')?.addEventListener('click', () => {
      this.playerHP = this.maxPlayerHP;
      this.isDead = false;
      this.idleTime = 0;
      deathEl.remove();
      this.callbacks.onPlayerHit(this.playerHP, this.maxPlayerHP);
    });
  }

  /** Reset idle timer (e.g. when interacting with UI) */
  public resetIdle(): void {
    this.idleTime = 0;
  }

  /** Get current player HP for HUD rendering */
  public getHP(): number {
    return this.playerHP;
  }

  /** Check if player is dead */
  public isPlayerDead(): boolean {
    return this.isDead;
  }
}
