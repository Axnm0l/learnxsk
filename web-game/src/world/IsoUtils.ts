import * as THREE from 'three';

export interface GridCoord {
  x: number;
  z: number;
}

export class IsoUtils {
  public static readonly TILE_SIZE = 1.0;
  public static readonly TILE_HEIGHT = 0.5;

  /**
   * Convert grid index (gx, gz, gy) to 3D world position
   */
  public static gridToWorld(gx: number, gz: number, gy: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      gx * this.TILE_SIZE,
      gy * this.TILE_HEIGHT,
      gz * this.TILE_SIZE
    );
  }

  /**
   * Calculate 2D Euclidean distance on the X-Z ground plane
   */
  public static distance2D(a: THREE.Vector3, b: THREE.Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Clamp a value between min and max
   */
  public static clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }
}
