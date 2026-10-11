import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';

export interface InteractableEntity {
  name: string;
  type: 'quest_board' | 'terminal';
  position: THREE.Vector3;
  radius: number;
}

export class IsometricWorld {
  public scene: THREE.Scene;
  public interactables: InteractableEntity[] = [];

  // Animated elements
  private animatedElements: { mesh: THREE.Object3D; update: (time: number) => void }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildLighting();
    this.buildTerrain();
    this.buildLandmarks();
    this.buildVegetation();
  }

  private buildLighting(): void {
    // Soft ambient sunlight
    const ambientLight = new THREE.AmbientLight(0xfffaed, 1.2);
    this.scene.add(ambientLight);

    // Isometric directional sun with crisp shadows
    const dirLight = new THREE.DirectionalLight(0xfff7e6, 1.8);
    dirLight.position.set(25, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;

    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Warm accent light near the Terminal Outpost
    const outpostLight = new THREE.PointLight(0x34d399, 1.5, 12);
    outpostLight.position.set(14, 2.5, 0);
    this.scene.add(outpostLight);

    // Warm golden lantern light near Quest Board
    const questLight = new THREE.PointLight(0xfbbf24, 1.5, 10);
    questLight.position.set(2, 2.2, -2);
    this.scene.add(questLight);
  }

  private buildTerrain(): void {
    const GRID_SIZE = 36;
    const HALF_GRID = GRID_SIZE / 2;

    const boxGeo = new THREE.BoxGeometry(1, 0.5, 1);

    // Grass block materials [px, nx, py, ny, pz, nz]
    const grassTopMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getGrassTop() });
    const grassSideMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getGrassSide() });
    const dirtMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getDirt() });
    const grassMaterials = [grassSideMat, grassSideMat, grassTopMat, dirtMat, grassSideMat, grassSideMat];

    const cobbleMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getCobblestone() });
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const waterMat = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getWater(),
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85
    });

    // Create instanced meshes for performance
    const grassMesh = new THREE.InstancedMesh(boxGeo, grassMaterials, GRID_SIZE * GRID_SIZE);
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = true;

    const cobbleMesh = new THREE.InstancedMesh(boxGeo, cobbleMat, 400);
    cobbleMesh.receiveShadow = true;

    const woodMesh = new THREE.InstancedMesh(boxGeo, woodMat, 300);
    woodMesh.receiveShadow = true;
    woodMesh.castShadow = true;

    const waterMesh = new THREE.InstancedMesh(boxGeo, waterMat, 200);

    const matrix = new THREE.Matrix4();
    let grassIdx = 0;
    let cobbleIdx = 0;
    let woodIdx = 0;
    let waterIdx = 0;

    for (let x = -HALF_GRID; x < HALF_GRID; x++) {
      for (let z = -HALF_GRID; z < HALF_GRID; z++) {
        let y = 0;
        let isWater = false;
        let isPath = false;
        let isBridge = false;

        // River channel running across Z from x=7 to x=9
        if (x >= 7 && x <= 9) {
          if (z >= -2 && z <= 2) {
            // Bridge over water
            isBridge = true;
            y = 0.1;
          } else {
            isWater = true;
            y = -0.3;
          }
        }
        // Cobblestone path connecting Spawn (0,0) -> Bridge (7,0) -> Outpost (14,0)
        else if (
          (Math.abs(z) <= 1 && x >= -2 && x <= 6) || // Main village walkway
          (Math.abs(z) <= 1 && x >= 10 && x <= 16) || // Outpost walkway
          (x === 2 && z >= -3 && z <= 0) // Path to quest board
        ) {
          isPath = true;
          y = 0.02; // Slightly raised cobblestone
        }

        matrix.setPosition(x, y, z);

        if (isBridge) {
          woodMesh.setMatrixAt(woodIdx++, matrix);
        } else if (isWater) {
          waterMesh.setMatrixAt(waterIdx++, matrix);
        } else if (isPath) {
          cobbleMesh.setMatrixAt(cobbleIdx++, matrix);
        } else {
          // Elevated hills in the far corners
          if (x < -10 && z < -10) y = 0.5;
          if (x > 12 && z > 8) y = 0.5;
          matrix.setPosition(x, y, z);
          grassMesh.setMatrixAt(grassIdx++, matrix);
        }
      }
    }

    grassMesh.count = grassIdx;
    cobbleMesh.count = cobbleIdx;
    woodMesh.count = woodIdx;
    waterMesh.count = waterIdx;

    this.scene.add(grassMesh);
    this.scene.add(cobbleMesh);
    this.scene.add(woodMesh);
    this.scene.add(waterMesh);
  }

  private buildLandmarks(): void {
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const cobbleMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getCobblestone() });

    // 1. QUEST BOARD at (2, 0, -2)
    const questBoardGroup = new THREE.Group();
    questBoardGroup.position.set(2, 0.25, -2);

    // Wooden post
    const postGeo = new THREE.BoxGeometry(0.2, 1.6, 0.2);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 0.8;
    post.castShadow = true;
    questBoardGroup.add(post);

    // Board plate
    const boardGeo = new THREE.BoxGeometry(1.2, 0.9, 0.15);
    const questBoardMat = [
      woodMat, woodMat, woodMat, woodMat,
      new THREE.MeshLambertMaterial({ map: ProceduralTextures.getQuestBoardTexture() }),
      woodMat
    ];
    const board = new THREE.Mesh(boardGeo, questBoardMat);
    board.position.set(0, 1.25, 0);
    board.castShadow = true;
    questBoardGroup.add(board);

    // Animated floating golden exclamation mark
    const exclamationGeo = new THREE.ConeGeometry(0.18, 0.5, 4);
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const exclamationMesh = new THREE.Mesh(exclamationGeo, goldMat);
    exclamationMesh.rotation.x = Math.PI; // Pointing downwards
    exclamationMesh.position.set(0, 2.2, 0);
    questBoardGroup.add(exclamationMesh);

    const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const dotMesh = new THREE.Mesh(dotGeo, goldMat);
    dotMesh.position.set(0, 1.85, 0);
    questBoardGroup.add(dotMesh);

    this.animatedElements.push({
      mesh: exclamationMesh,
      update: (time) => {
        exclamationMesh.position.y = 2.2 + Math.sin(time * 3) * 0.12;
        exclamationMesh.rotation.y = time * 2;
        dotMesh.position.y = 1.85 + Math.sin(time * 3) * 0.12;
      }
    });

    this.scene.add(questBoardGroup);

    this.interactables.push({
      name: 'Quest Board',
      type: 'quest_board',
      position: new THREE.Vector3(2, 0, -2),
      radius: 2.2
    });

    // 2. TERMINAL OUTPOST STATION at (14, 0, 0)
    const terminalGroup = new THREE.Group();
    terminalGroup.position.set(14, 0.25, 0);

    // Stone base foundation
    const stationBaseGeo = new THREE.BoxGeometry(2.4, 0.3, 2.4);
    const stationBase = new THREE.Mesh(stationBaseGeo, cobbleMat);
    stationBase.position.y = 0.15;
    stationBase.receiveShadow = true;
    terminalGroup.add(stationBase);

    // Four corner wooden pillars
    const pillarGeo = new THREE.BoxGeometry(0.25, 2.2, 0.25);
    const pillarPositions = [
      [-1, 1.1, -1], [1, 1.1, -1], [-1, 1.1, 1], [1, 1.1, 1]
    ];
    pillarPositions.forEach(([px, py, pz]) => {
      const pillar = new THREE.Mesh(pillarGeo, woodMat);
      pillar.position.set(px, py, pz);
      pillar.castShadow = true;
      terminalGroup.add(pillar);
    });

    // Outpost roof canopy
    const roofGeo = new THREE.BoxGeometry(2.6, 0.2, 2.6);
    const roof = new THREE.Mesh(roofGeo, woodMat);
    roof.position.set(0, 2.3, 0);
    roof.castShadow = true;
    terminalGroup.add(roof);

    // Desk console
    const deskGeo = new THREE.BoxGeometry(1.4, 0.8, 0.7);
    const desk = new THREE.Mesh(deskGeo, woodMat);
    desk.position.set(0, 0.7, 0);
    desk.castShadow = true;
    terminalGroup.add(desk);

    // Terminal Monitor
    const monitorGeo = new THREE.BoxGeometry(0.8, 0.6, 0.3);
    const terminalMaterials = [
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshBasicMaterial({ map: ProceduralTextures.getTerminalScreenTexture() }), // Front
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    ];
    const monitor = new THREE.Mesh(monitorGeo, terminalMaterials);
    monitor.position.set(0, 1.3, -0.1);
    monitor.castShadow = true;
    terminalGroup.add(monitor);

    // Animated pulsing green holographic cube beacon above terminal
    const beaconGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 2.8, 0);
    terminalGroup.add(beacon);

    this.animatedElements.push({
      mesh: beacon,
      update: (time) => {
        beacon.rotation.y = time * 1.5;
        beacon.rotation.x = time * 0.8;
        beacon.position.y = 2.8 + Math.sin(time * 2.5) * 0.1;
      }
    });

    this.scene.add(terminalGroup);

    this.interactables.push({
      name: 'Terminal Outpost Station',
      type: 'terminal',
      position: new THREE.Vector3(14, 0, 0),
      radius: 2.5
    });
  }

  private buildVegetation(): void {
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const leavesMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getLeaves() });

    const treePositions = [
      [-6, -5], [-4, -8], [-8, 4], [-5, 7],
      [-2, 8], [3, 6], [5, 9], [12, -7],
      [16, -5], [15, 6], [18, 4], [-10, -2]
    ];

    treePositions.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0.25, tz);

      // Trunk
      const trunkGeo = new THREE.BoxGeometry(0.5, 2.5, 0.5);
      const trunk = new THREE.Mesh(trunkGeo, woodMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage layers
      const leafBottomGeo = new THREE.BoxGeometry(2.2, 1.0, 2.2);
      const leafBottom = new THREE.Mesh(leafBottomGeo, leavesMat);
      leafBottom.position.y = 2.8;
      leafBottom.castShadow = true;
      tree.add(leafBottom);

      const leafTopGeo = new THREE.BoxGeometry(1.4, 0.9, 1.4);
      const leafTop = new THREE.Mesh(leafTopGeo, leavesMat);
      leafTop.position.y = 3.6;
      leafTop.castShadow = true;
      tree.add(leafTop);

      this.scene.add(tree);
    });
  }

  public update(time: number): void {
    for (const elem of this.animatedElements) {
      elem.update(time);
    }
  }

  public getNearestInteractable(playerPos: THREE.Vector3): InteractableEntity | null {
    let closest: InteractableEntity | null = null;
    let minDist = Infinity;

    for (const entity of this.interactables) {
      const dist = Math.hypot(playerPos.x - entity.position.x, playerPos.z - entity.position.z);
      if (dist <= entity.radius && dist < minDist) {
        minDist = dist;
        closest = entity;
      }
    }

    return closest;
  }
}
