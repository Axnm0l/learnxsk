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
  private walkSpeed: number = 3.6;
  private runSpeed: number = 6.2;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private walkTimer: number = 0;
  public isMoving: boolean = false;
  private isRunning: boolean = false;

  // Key tracking
  private keys: { [key: string]: boolean } = {};

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.set(0, 0.25, 0); // Spawn at center village

    // Build character voxel hierarchy
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
    const jacketMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 }); // Cadet blue jacket
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Dark pants

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

    // Cap / hair top
    const capGeo = new THREE.BoxGeometry(0.44, 0.16, 0.44);
    const cap = new THREE.Mesh(capGeo, hairMat);
    cap.position.y = 0.2;
    this.head.add(cap);

    // Left Arm (pivot at shoulder)
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

    // Left Leg (pivot at hip)
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
      // Don't capture movement keys if typing inside terminal
      const activeElem = document.activeElement;
      if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA')) {
        return;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  public update(delta: number): void {
    // Determine screen-aligned isometric vector
    // Screen Up (-X, -Z), Screen Down (+X, +Z), Screen Left (-X, +Z), Screen Right (+X, -Z)
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveX -= 1;
      moveZ -= 1;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveX += 1;
      moveZ += 1;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveX -= 1;
      moveZ += 1;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveX += 1;
      moveZ -= 1;
    }

    this.isRunning = !!this.keys['ShiftLeft'] || !!this.keys['ShiftRight'];
    const currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;

    const inputVec = new THREE.Vector2(moveX, moveZ);
    if (inputVec.lengthSq() > 0) {
      inputVec.normalize();
      this.isMoving = true;

      this.velocity.x = inputVec.x * currentSpeed;
      this.velocity.z = inputVec.y * currentSpeed;

      // Rotate player smoothly toward movement heading
      const targetAngle = Math.atan2(inputVec.x, inputVec.y);
      this.mesh.rotation.y = targetAngle;

      // Walk cycle animation
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

      // Reset limbs to resting position
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.2);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 0.2);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.2);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.2);
      this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, 1.4, 0.2);
    }

    // Apply movement with world boundaries
    const newX = this.position.x + this.velocity.x * delta;
    const newZ = this.position.z + this.velocity.z * delta;

    // Constrain within map bounds [-17, 17]
    this.position.x = Math.max(-17, Math.min(17, newX));
    this.position.z = Math.max(-17, Math.min(17, newZ));
  }
}
