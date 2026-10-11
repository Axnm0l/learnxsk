import * as THREE from 'three';
import { ProceduralTextures } from './ProceduralTextures';

export interface InteractableEntity {
  name: string;
  type: 'quest_board' | 'terminal' | 'station';
  subType?: 'outpost' | 'watchtower' | 'crypto' | 'web';
  position: THREE.Vector3;
  radius: number;
  label: string;
}

export class IsometricWorld {
  public scene: THREE.Scene;
  public interactables: InteractableEntity[] = [];

  // Animated elements list
  private animatedElements: { mesh: THREE.Object3D; update: (time: number) => void }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildLighting();
    this.buildTerrain();
    this.buildPlazaLandmarks();
    this.buildTerminalOutpost();
    this.buildNetworkWatchtower();
    this.buildCryptoSanctum();
    this.buildWebBastion();
    this.buildVegetation();
  }

  private buildLighting(): void {
    // Soft high-tech cyber ambient lighting
    const ambientLight = new THREE.AmbientLight(0xe0f2fe, 1.3);
    this.scene.add(ambientLight);

    // Directional sunlight casting crisp isometric shadows
    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 180;

    const d = 45;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Accent Point Lights for each of the 4 district terminals
    // 1. Outpost Light (Cyan/Emerald)
    const outpostLight = new THREE.PointLight(0x10b981, 2.0, 16);
    outpostLight.position.set(16, 3, 0);
    this.scene.add(outpostLight);

    // 2. Watchtower Light (Sky Blue)
    const watchtowerLight = new THREE.PointLight(0x38bdf8, 2.0, 16);
    watchtowerLight.position.set(0, 4, -22);
    this.scene.add(watchtowerLight);

    // 3. Crypto Sanctum Light (Golden Amber)
    const cryptoLight = new THREE.PointLight(0xf59e0b, 2.0, 16);
    cryptoLight.position.set(-22, 3, 0);
    this.scene.add(cryptoLight);

    // 4. Web Bastion Light (Purple Neon)
    const webLight = new THREE.PointLight(0xa855f7, 2.0, 16);
    webLight.position.set(0, 3, 22);
    this.scene.add(webLight);

    // Center Plaza Fountain Light
    const centerLight = new THREE.PointLight(0xfbbf24, 1.8, 12);
    centerLight.position.set(0, 2.5, 0);
    this.scene.add(centerLight);
  }

  private buildTerrain(): void {
    const GRID_SIZE = 64; // Large expansive map
    const HALF_GRID = GRID_SIZE / 2;

    const boxGeo = new THREE.BoxGeometry(1, 0.5, 1);

    // Textures
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

    const maxTiles = GRID_SIZE * GRID_SIZE;
    const grassMesh = new THREE.InstancedMesh(boxGeo, grassMaterials, maxTiles);
    grassMesh.receiveShadow = true;
    grassMesh.castShadow = true;

    const cobbleMesh = new THREE.InstancedMesh(boxGeo, cobbleMat, 1200);
    cobbleMesh.receiveShadow = true;

    const woodMesh = new THREE.InstancedMesh(boxGeo, woodMat, 600);
    woodMesh.receiveShadow = true;

    const waterMesh = new THREE.InstancedMesh(boxGeo, waterMat, 800);

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

        // Eastern River Channel (x=8 to 10)
        if (x >= 8 && x <= 10) {
          if (Math.abs(z) <= 2) {
            isBridge = true; // Eastern Bridge to Outpost
            y = 0.12;
          } else {
            isWater = true;
            y = -0.3;
          }
        }
        // Western River Channel (x=-10 to -8)
        else if (x >= -10 && x <= -8) {
          if (Math.abs(z) <= 2) {
            isBridge = true; // Western Bridge to Crypto Sanctum
            y = 0.12;
          } else {
            isWater = true;
            y = -0.3;
          }
        }
        // Main Boulevard Paths connecting all 4 districts
        // 1. Central Plaza Circle & Crosswalks
        else if (
          (Math.abs(x) <= 3 && Math.abs(z) <= 3) || // Central Plaza square
          (Math.abs(z) <= 1 && x >= -24 && x <= 24) || // East-West Highway
          (Math.abs(x) <= 1 && z >= -24 && z <= 24) || // North-South Highway
          (Math.hypot(x - 16, z) <= 3) || // Outpost Plaza
          (Math.hypot(x, z + 22) <= 3) || // Watchtower Plaza
          (Math.hypot(x + 22, z) <= 3) || // Crypto Plaza
          (Math.hypot(x, z - 22) <= 3)    // Web Bastion Plaza
        ) {
          isPath = true;
          y = 0.04;
        }

        matrix.setPosition(x, y, z);

        if (isBridge) {
          woodMesh.setMatrixAt(woodIdx++, matrix);
        } else if (isWater) {
          waterMesh.setMatrixAt(waterIdx++, matrix);
        } else if (isPath) {
          cobbleMesh.setMatrixAt(cobbleIdx++, matrix);
        } else {
          // Elevated hills in the perimeter corners
          if (Math.abs(x) > 24 || Math.abs(z) > 24) {
            y = 0.5 + Math.sin(x * 0.3) * 0.2;
          }
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

  private buildPlazaLandmarks(): void {
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const cobbleMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getCobblestone() });

    // 1. CENTRAL FOUNTAIN / CYBER CORE at (0, 0)
    const fountainGroup = new THREE.Group();
    fountainGroup.position.set(0, 0.25, 0);

    const basinGeo = new THREE.CylinderGeometry(2.2, 2.5, 0.4, 16);
    const basin = new THREE.Mesh(basinGeo, cobbleMat);
    basin.position.y = 0.2;
    fountainGroup.add(basin);

    // Glowing energy core inside fountain
    const coreGeo = new THREE.OctahedronGeometry(0.7, 0);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.3;
    fountainGroup.add(core);

    this.animatedElements.push({
      mesh: core,
      update: (time) => {
        core.rotation.y = time * 1.2;
        core.rotation.x = time * 0.7;
        core.position.y = 1.3 + Math.sin(time * 3) * 0.1;
      }
    });

    this.scene.add(fountainGroup);

    // 2. QUEST BOARD at (2, 0, -2)
    const questBoardGroup = new THREE.Group();
    questBoardGroup.position.set(2, 0.25, -2);

    const postGeo = new THREE.BoxGeometry(0.2, 1.8, 0.2);
    const post = new THREE.Mesh(postGeo, woodMat);
    post.position.y = 0.9;
    post.castShadow = true;
    questBoardGroup.add(post);

    const boardGeo = new THREE.BoxGeometry(1.4, 1.0, 0.15);
    const questBoardMat = [
      woodMat, woodMat, woodMat, woodMat,
      new THREE.MeshLambertMaterial({ map: ProceduralTextures.getQuestBoardTexture() }),
      woodMat
    ];
    const board = new THREE.Mesh(boardGeo, questBoardMat);
    board.position.set(0, 1.4, 0);
    board.castShadow = true;
    questBoardGroup.add(board);

    // Animated floating golden exclamation mark
    const exclamationGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    const exclamationMesh = new THREE.Mesh(exclamationGeo, goldMat);
    exclamationMesh.rotation.x = Math.PI;
    exclamationMesh.position.set(0, 2.4, 0);
    questBoardGroup.add(exclamationMesh);

    const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const dotMesh = new THREE.Mesh(dotGeo, goldMat);
    dotMesh.position.set(0, 2.05, 0);
    questBoardGroup.add(dotMesh);

    this.animatedElements.push({
      mesh: exclamationMesh,
      update: (time) => {
        exclamationMesh.position.y = 2.4 + Math.sin(time * 3) * 0.12;
        exclamationMesh.rotation.y = time * 2;
        dotMesh.position.y = 2.05 + Math.sin(time * 3) * 0.12;
      }
    });

    this.scene.add(questBoardGroup);

    this.interactables.push({
      name: 'Academy Quest Board',
      type: 'quest_board',
      position: new THREE.Vector3(2, 0, -2),
      radius: 2.5,
      label: 'Inspect Quest Board [E]'
    });
  }

  private buildTerminalOutpost(): void {
    // DISTRICT 1: TERMINAL OUTPOST (East, x=16, z=0)
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const cobbleMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getCobblestone() });

    const terminalGroup = new THREE.Group();
    terminalGroup.position.set(16, 0.25, 0);

    const baseGeo = new THREE.BoxGeometry(3.2, 0.3, 3.2);
    const stationBase = new THREE.Mesh(baseGeo, cobbleMat);
    stationBase.position.y = 0.15;
    terminalGroup.add(stationBase);

    // Pillars & Roof
    const pillarGeo = new THREE.BoxGeometry(0.25, 2.4, 0.25);
    [[-1.4, 1.2, -1.4], [1.4, 1.2, -1.4], [-1.4, 1.2, 1.4], [1.4, 1.2, 1.4]].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(pillarGeo, woodMat);
      p.position.set(px, py, pz);
      terminalGroup.add(p);
    });

    const roofGeo = new THREE.BoxGeometry(3.6, 0.25, 3.6);
    const roof = new THREE.Mesh(roofGeo, woodMat);
    roof.position.set(0, 2.5, 0);
    terminalGroup.add(roof);

    // Server rack next to desk
    const serverGeo = new THREE.BoxGeometry(0.8, 1.8, 0.6);
    const serverMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const serverRack = new THREE.Mesh(serverGeo, serverMat);
    serverRack.position.set(-1.0, 1.0, -0.8);
    terminalGroup.add(serverRack);

    // Desk & Monitor
    const deskGeo = new THREE.BoxGeometry(1.6, 0.8, 0.8);
    const desk = new THREE.Mesh(deskGeo, woodMat);
    desk.position.set(0.2, 0.6, 0);
    terminalGroup.add(desk);

    const monitorGeo = new THREE.BoxGeometry(0.9, 0.65, 0.3);
    const termMaterials = [
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b }),
      new THREE.MeshBasicMaterial({ map: ProceduralTextures.getTerminalScreenTexture() }),
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    ];
    const monitor = new THREE.Mesh(monitorGeo, termMaterials);
    monitor.position.set(0.2, 1.25, -0.1);
    terminalGroup.add(monitor);

    // Holographic green beacon
    const beaconGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 3.0, 0);
    terminalGroup.add(beacon);

    this.animatedElements.push({
      mesh: beacon,
      update: (time) => {
        beacon.rotation.y = time * 2;
        beacon.position.y = 3.0 + Math.sin(time * 2.5) * 0.12;
      }
    });

    this.scene.add(terminalGroup);

    this.interactables.push({
      name: 'Linux Terminal Outpost (East)',
      type: 'terminal',
      subType: 'outpost',
      position: new THREE.Vector3(16, 0, 0),
      radius: 2.8,
      label: 'Access Terminal Outpost [E]'
    });
  }

  private buildNetworkWatchtower(): void {
    // DISTRICT 2: NETWORK WATCHTOWER (North, x=0, z=-22)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(0, 0.25, -22);

    const cobbleMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getCobblestone() });

    // Tower base platform
    const baseGeo = new THREE.CylinderGeometry(2.5, 3.0, 1.5, 12);
    const base = new THREE.Mesh(baseGeo, cobbleMat);
    base.position.y = 0.75;
    towerGroup.add(base);

    // Antenna Mast
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.15, 3.5, 8);
    const mastMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 3.0, 0);
    towerGroup.add(mast);

    // Radar Dish
    const dishGeo = new THREE.CylinderGeometry(0.7, 0.2, 0.2, 12);
    const dishMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.rotation.x = Math.PI / 4;
    dish.position.set(0, 4.2, 0);
    towerGroup.add(dish);

    // Network Terminal Console
    const consoleGeo = new THREE.BoxGeometry(1.2, 0.9, 0.6);
    const consoleMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
    const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat);
    consoleMesh.position.set(0, 1.8, 1.0);
    towerGroup.add(consoleMesh);

    this.animatedElements.push({
      mesh: dish,
      update: (time) => {
        dish.rotation.y = time * 1.5;
      }
    });

    this.scene.add(towerGroup);

    this.interactables.push({
      name: 'Network Watchtower Terminal (North)',
      type: 'terminal',
      subType: 'watchtower',
      position: new THREE.Vector3(0, 0, -22),
      radius: 3.0,
      label: 'Access Network Recon Terminal [E]'
    });
  }

  private buildCryptoSanctum(): void {
    // DISTRICT 3: CRYPTOGRAPHY SANCTUM (West, x=-22, z=0)
    const cryptoGroup = new THREE.Group();
    cryptoGroup.position.set(-22, 0.25, 0);

    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x334155 });

    // 4 Monolith pillars in a circle
    const monolithGeo = new THREE.BoxGeometry(0.5, 3.0, 0.5);
    const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    angles.forEach(a => {
      const mono = new THREE.Mesh(monolithGeo, stoneMat);
      mono.position.set(Math.cos(a) * 2.2, 1.5, Math.sin(a) * 2.2);
      cryptoGroup.add(mono);
    });

    // Golden Cryptographic Altar Terminal in center
    const altarGeo = new THREE.BoxGeometry(1.4, 1.1, 1.4);
    const altarMat = new THREE.MeshLambertMaterial({ color: 0xb45309 });
    const altar = new THREE.Mesh(altarGeo, altarMat);
    altar.position.y = 0.55;
    cryptoGroup.add(altar);

    // Floating Golden Cipher Crystal
    const crystalGeo = new THREE.DodecahedronGeometry(0.5);
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 2.0;
    cryptoGroup.add(crystal);

    this.animatedElements.push({
      mesh: crystal,
      update: (time) => {
        crystal.rotation.y = time * 1.8;
        crystal.rotation.x = time * 1.0;
        crystal.position.y = 2.0 + Math.sin(time * 2.2) * 0.15;
      }
    });

    this.scene.add(cryptoGroup);

    this.interactables.push({
      name: 'Cryptography Sanctum Terminal (West)',
      type: 'terminal',
      subType: 'crypto',
      position: new THREE.Vector3(-22, 0, 0),
      radius: 3.0,
      label: 'Access Cryptography Sanctum [E]'
    });
  }

  private buildWebBastion(): void {
    // DISTRICT 4: WEB BASTION & DEFENSE (South, x=0, z=22)
    const bastionGroup = new THREE.Group();
    bastionGroup.position.set(0, 0.25, 22);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0x475569 });

    // Defense Archway Gate
    const archPillarGeo = new THREE.BoxGeometry(0.7, 3.2, 0.7);
    const leftPillar = new THREE.Mesh(archPillarGeo, wallMat);
    leftPillar.position.set(-1.8, 1.6, 0);
    bastionGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(archPillarGeo, wallMat);
    rightPillar.position.set(1.8, 1.6, 0);
    bastionGroup.add(rightPillar);

    const topBeamGeo = new THREE.BoxGeometry(4.3, 0.6, 0.8);
    const topBeam = new THREE.Mesh(topBeamGeo, wallMat);
    topBeam.position.set(0, 3.4, 0);
    bastionGroup.add(topBeam);

    // Glowing purple firewall energy field inside arch
    const shieldGeo = new THREE.PlaneGeometry(3.0, 2.8);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 1.6, 0);
    bastionGroup.add(shield);

    // Bastion Security Console
    const consoleGeo = new THREE.BoxGeometry(1.2, 0.9, 0.7);
    const consoleMat = new THREE.MeshLambertMaterial({ color: 0x6b21a8 });
    const consoleMesh = new THREE.Mesh(consoleGeo, consoleMat);
    consoleMesh.position.set(0, 0.6, -1.2);
    bastionGroup.add(consoleMesh);

    this.animatedElements.push({
      mesh: shield,
      update: (time) => {
        shieldMat.opacity = 0.35 + Math.sin(time * 3) * 0.15;
      }
    });

    this.scene.add(bastionGroup);

    this.interactables.push({
      name: 'Web Bastion Security Node (South)',
      type: 'terminal',
      subType: 'web',
      position: new THREE.Vector3(0, 0, 22),
      radius: 3.0,
      label: 'Access Web Bastion Node [E]'
    });
  }

  private buildVegetation(): void {
    const woodMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getWoodPlank() });
    const leavesMat = new THREE.MeshLambertMaterial({ map: ProceduralTextures.getLeaves() });

    const treePositions: [number, number][] = [
      [-5, -6], [-7, -10], [6, -8], [8, -12],
      [-6, 6], [-8, 12], [6, 8], [8, 14],
      [14, -8], [18, -10], [18, 8], [14, 10],
      [-14, -8], [-18, -10], [-18, 8], [-14, 10],
      [-12, -18], [12, -18], [-12, 18], [12, 18]
    ];

    treePositions.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0.25, tz);

      // Trunk
      const trunkGeo = new THREE.BoxGeometry(0.5, 2.6, 0.5);
      const trunk = new THREE.Mesh(trunkGeo, woodMat);
      trunk.position.y = 1.3;
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage layers
      const leafBottomGeo = new THREE.BoxGeometry(2.4, 1.1, 2.4);
      const leafBottom = new THREE.Mesh(leafBottomGeo, leavesMat);
      leafBottom.position.y = 2.9;
      leafBottom.castShadow = true;
      tree.add(leafBottom);

      const leafTopGeo = new THREE.BoxGeometry(1.6, 1.0, 1.6);
      const leafTop = new THREE.Mesh(leafTopGeo, leavesMat);
      leafTop.position.y = 3.8;
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
