import * as THREE from 'three';

export class FollowCamera {
  public camera: THREE.OrthographicCamera;
  private aspect: number;
  private frustumSize: number = 14; // Controls isometric zoom level
  private targetOffset: THREE.Vector3 = new THREE.Vector3(18, 20, 18);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * this.aspect) / 2,
      (this.frustumSize * this.aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      1000
    );

    // Initial position
    this.camera.position.copy(this.targetOffset);
    this.camera.lookAt(0, 0.8, 0);

    window.addEventListener('resize', () => {
      this.handleResize(container.clientWidth, container.clientHeight);
    });
  }

  public handleResize(width: number, height: number): void {
    this.aspect = width / height;
    this.camera.left = (-this.frustumSize * this.aspect) / 2;
    this.camera.right = (this.frustumSize * this.aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  public update(playerPos: THREE.Vector3, delta: number): void {
    // Target camera position maintaining fixed isometric offset
    const targetPos = new THREE.Vector3(
      playerPos.x + this.targetOffset.x,
      playerPos.y + this.targetOffset.y,
      playerPos.z + this.targetOffset.z
    );

    // Smooth lerp camera position
    const lerpSpeed = 4.5 * delta;
    this.camera.position.lerp(targetPos, lerpSpeed);

    // Smooth lerp focus target
    const targetLookAt = new THREE.Vector3(playerPos.x, playerPos.y + 0.8, playerPos.z);
    this.currentLookAt.lerp(targetLookAt, lerpSpeed);
    this.camera.lookAt(this.currentLookAt);
  }
}
