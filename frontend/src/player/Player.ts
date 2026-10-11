import * as THREE from 'three';

export class Player {
  public mesh: THREE.Group;
  public position: THREE.Vector3;

  // Character limbs for animation
  private head: THREE.Mesh;
  private torso: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;

  // Movement physics
  private walkSpeed: number = 4.8;
  private runSpeed: number = 8.5;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private walkTimer: number = 0;
  public isMoving: boolean = false;
  private isRunning: boolean = false;

  // Key tracking
  private keys: { [key: string]: boolean } = {};

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.set(0, 0.25, 0); // Spawn at central plaza

    // Character materials
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const jacketMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.3);
    this.torso = new THREE.Mesh(torsoGeo, jacketMat);
    this.torso.position.y = 0.85;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.4;
    this.head.castShadow = true;
    this.mesh.add(this.head);

    // Visor / Cyber cap
    const capGeo = new THREE.BoxGeometry(0.44, 0.16, 0.44);
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.position.y = 0.2;
    this.head.add(cap);

    // Retro visor
    const visorGeo = new THREE.BoxGeometry(0.3, 0.08, 0.05);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, -0.02, 0.22);
    this.head.add(visor);

    // Left Arm
    const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
    armGeo.translate(0, -0.25, 0);
    this.leftArm = new THREE.Mesh(armGeo, jacketMat);
    this.leftArm.position.set(-0.36, 1.1, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    // Right Arm
    this.rightArm = new THREE.Mesh(armGeo, jacketMat);
    this.rightArm.position.set(0.36, 1.1, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Left Leg
    const legGeo = new THREE.BoxGeometry(0.2, 0.55, 0.22);
    legGeo.translate(0, -0.25, 0);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.14, 0.55, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.14, 0.55, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    scene.add(this.mesh);

    this.initKeyboard();
  }

  private initKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      const activeElem = document.activeElement;
      if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
        return;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  // Mouse cursor aim tracking
  public targetRotationY: number = -Math.PI * 0.75;
  public hasMouseAim: boolean = false;

  public teleportTo(x: number, z: number): void {
    this.position.set(x, 0.25, z);
    this.velocity.set(0, 0, 0);
  }

  /** Set 3D world target for player to face/turn towards */
  public setAimTarget(worldPos: THREE.Vector3): void {
    const dx = worldPos.x - this.position.x;
    const dz = worldPos.z - this.position.z;
    if (dx * dx + dz * dz > 0.04) {
      this.targetRotationY = Math.atan2(dx, dz);
      this.hasMouseAim = true;
    }
  }

  public update(delta: number): void {
    this.isRunning = !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'];
    const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;

    // Movement direction vectors relative to where the mouse is pointing
    const forwardX = Math.sin(this.targetRotationY);
    const forwardZ = Math.cos(this.targetRotationY);
    const rightX = Math.cos(this.targetRotationY);
    const rightZ = -Math.sin(this.targetRotationY);

    let moveX = 0;
    let moveZ = 0;

    // W = move forward directly toward mouse pointer
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    // S = move backward away from mouse pointer
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    // A = strafe left relative to mouse pointer
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    // D = strafe right relative to mouse pointer
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveX += rightX;
      moveZ += rightZ;
    }

    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 0.001) {
      this.isMoving = true;
      const normX = moveX / moveLen;
      const normZ = moveZ / moveLen;
      this.velocity.x = normX * currentSpeed;
      this.velocity.z = normZ * currentSpeed;

      this.walkTimer += delta * (this.isRunning ? 16 : 10);
      const swing = Math.sin(this.walkTimer) * 0.65;
      this.leftArm.rotation.x = swing;
      this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing;
      this.rightLeg.rotation.x = swing;
      this.head.position.y = 1.4 + Math.abs(Math.sin(this.walkTimer * 2)) * 0.04;
    } else {
      this.isMoving = false;
      this.velocity.set(0, 0, 0);

      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.2);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 0.2);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.2);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.2);
      this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, 1.4, 0.2);
    }

    // Smoothly turn character left and right to face aim direction
    let diff = (this.targetRotationY - this.mesh.rotation.y) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(1, delta * 15);

    const newX = this.position.x + this.velocity.x * delta;
    const newZ = this.position.z + this.velocity.z * delta;

    // Expanded bounds across the 64x64 citadel [-29, 29]
    this.position.x = Math.max(-29, Math.min(29, newX));
    this.position.z = Math.max(-29, Math.min(29, newZ));
  }
}
