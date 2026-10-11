import * as THREE from 'three';
import { QuestManager } from '../quest/QuestManager';
import { GemmaClient } from '../ai/GemmaClient';

export interface NPCData {
  id: string;
  name: string;
  role: string;
  avatarIcon: string;
  position: THREE.Vector3;
  waypoints?: THREE.Vector3[];
  speed?: number;
  currentWaypointIdx?: number;
  dialogueLines: string[];
}

export class NPCManager {
  public scene: THREE.Scene;
  public npcs: { data: NPCData; group: THREE.Group; update: (delta: number, time: number) => void }[] = [];
  private onDialogueOpen?: (npc: NPCData, text: string) => void;

  constructor(scene: THREE.Scene, onDialogueOpen?: (npc: NPCData, text: string) => void) {
    this.scene = scene;
    this.onDialogueOpen = onDialogueOpen;
    this.spawnNPCs();
  }

  private spawnNPCs(): void {
    // 1. GEMMA AI TUTOR BOT (Floating Cyber Sphere with Orbital Rings at Academy Plaza)
    this.createGemmaBot(new THREE.Vector3(4, 1.6, -1));

    // 2. SENTINEL PATROL DROID (Patrols between Academy and Outpost)
    this.createPatrolDroid(
      'npc_sentinel',
      'Sentinel-09',
      'Academy Security Bot',
      '🛡️',
      new THREE.Vector3(2, 0.4, 3),
      [
        new THREE.Vector3(2, 0.4, 3),
        new THREE.Vector3(12, 0.4, 3),
        new THREE.Vector3(12, 0.4, -3),
        new THREE.Vector3(2, 0.4, -3)
      ],
      0x06b6d4, // Cyan
      [
        "Halt! Identification verified. Welcome to the Cyber Academy, Cadet.",
        "Alert: Perimeter router scans indicate anomalous activity on port 2222. Maintain operational vigilance!",
        "Security reminder: Never run uninspected scripts with administrative privileges in production environments."
      ]
    );

    // 3. CADET ALEX (Fellow Student Hacker wandering near Server Farm)
    this.createPatrolDroid(
      'npc_alex',
      'Cadet Alex',
      'Fellow Hacker Cadet',
      '💻',
      new THREE.Vector3(14, 0.4, -6),
      [
        new THREE.Vector3(14, 0.4, -6),
        new THREE.Vector3(20, 0.4, -6),
        new THREE.Vector3(20, 0.4, -2),
        new THREE.Vector3(14, 0.4, -2)
      ],
      0xa855f7, // Purple
      [
        "Hey! Are you working on the lost config token too? Check /var/backups using 'cat'!",
        "The network watchtower up north has a wicked view of the packet streams. You can run 'scan' from any terminal!",
        "Gemma's hints are super sharp today. Don't forget you can ask Gemma directly by running 'gemma <question>' in the shell!"
      ]
    );

    // 4. PROFESSOR CIPHER (Stationed at Cryptography Sanctum)
    this.createStationaryNPC(
      'npc_cipher',
      'Professor Cipher',
      'Master Cryptographer',
      '🔐',
      new THREE.Vector3(-20, 0.4, 0),
      0xf59e0b, // Amber Gold
      [
        "Welcome to the Cryptography Sanctum! Here we study the mathematics of secrets and entropy.",
        "Base64 is a 6-bit encoding representation, not an encryption lock! Passing '-d' to base64 decodes it back to raw bytes.",
        "When auditing cryptographic hashes like SHA-256, remember they are deterministic and irreversible one-way functions."
      ]
    );
  }

  private createGemmaBot(initialPos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(initialPos);

    // Core glowing sphere
    const coreGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Orbital ring 1
    const ring1Geo = new THREE.TorusGeometry(0.55, 0.03, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring1 = new THREE.Mesh(ring1Geo, ringMat);
    group.add(ring1);

    // Orbital ring 2
    const ring2Geo = new THREE.TorusGeometry(0.7, 0.02, 8, 24);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
    const ring2 = new THREE.Mesh(ring2Geo, ringMat2);
    ring2.rotation.x = Math.PI / 3;
    group.add(ring2);

    // Pulsing point light
    const light = new THREE.PointLight(0x00f0ff, 2.0, 6);
    group.add(light);

    this.scene.add(group);

    const npcData: NPCData = {
      id: 'npc_gemma',
      name: 'Gemma 4 AI Mentor',
      role: 'Intelligence Core',
      avatarIcon: '🤖',
      position: group.position,
      dialogueLines: [
        "Cadet! I am actively monitoring your progress through the Blocklands simulation.",
        "Every terminal command you master strengthens your real-world security instincts.",
        "Need tactical advice on your current mission? Press [M] to open your Mission Taskbar!"
      ]
    };

    this.npcs.push({
      data: npcData,
      group,
      update: (_delta, time) => {
        // Bobbing & orbit animations
        group.position.y = initialPos.y + Math.sin(time * 2.5) * 0.15;
        ring1.rotation.y = time * 2;
        ring1.rotation.x = time * 1.2;
        ring2.rotation.z = time * 1.5;
        ring2.rotation.y = time * -1.8;
      }
    });
  }

  private createPatrolDroid(
    id: string,
    name: string,
    role: string,
    avatarIcon: string,
    startPos: THREE.Vector3,
    waypoints: THREE.Vector3[],
    colorHex: number,
    dialogue: string[]
  ): void {
    const group = new THREE.Group();
    group.position.copy(startPos);

    // Torso box
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.35);
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.38, 0.35, 0.35);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.15;
    head.castShadow = true;
    group.add(head);

    // Visor glowing eye
    const visorGeo = new THREE.BoxGeometry(0.25, 0.08, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.15, 0.18);
    group.add(visor);

    // Left leg
    const legGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.15, 0.22, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    // Right leg
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.15, 0.22, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    this.scene.add(group);

    const npcData: NPCData = {
      id,
      name,
      role,
      avatarIcon,
      position: group.position,
      waypoints,
      speed: 1.8,
      currentWaypointIdx: 0,
      dialogueLines: dialogue
    };

    this.npcs.push({
      data: npcData,
      group,
      update: (delta, time) => {
        if (!waypoints || waypoints.length === 0) return;

        const targetWp = waypoints[npcData.currentWaypointIdx || 0];
        const dir = new THREE.Vector3().subVectors(targetWp, group.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist < 0.2) {
          // Advance to next waypoint
          npcData.currentWaypointIdx = ((npcData.currentWaypointIdx || 0) + 1) % waypoints.length;
        } else {
          dir.normalize();
          group.position.addScaledVector(dir, (npcData.speed || 1.8) * delta);
          group.rotation.y = Math.atan2(dir.x, dir.z);

          // Leg swing animation while walking
          const swing = Math.sin(time * 8) * 0.25;
          leftLeg.rotation.x = swing;
          rightLeg.rotation.x = -swing;
        }
      }
    });
  }

  private createStationaryNPC(
    id: string,
    name: string,
    role: string,
    avatarIcon: string,
    pos: THREE.Vector3,
    colorHex: number,
    dialogue: string[]
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Robe / Body
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.1, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    group.add(head);

    // Floating cryptographic halo
    const haloGeo = new THREE.RingGeometry(0.3, 0.36, 16);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.55;
    group.add(halo);

    this.scene.add(group);

    const npcData: NPCData = {
      id,
      name,
      role,
      avatarIcon,
      position: group.position,
      dialogueLines: dialogue
    };

    this.npcs.push({
      data: npcData,
      group,
      update: (_delta, time) => {
        halo.position.y = 1.55 + Math.sin(time * 2) * 0.06;
        halo.rotation.z = time * 0.8;
      }
    });
  }

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) {
      npc.update(delta, time);
    }
  }

  public getNearestNPC(playerPos: THREE.Vector3, radius: number = 2.8): NPCData | null {
    let closest: NPCData | null = null;
    let minDist = radius;

    for (const npc of this.npcs) {
      const dist = Math.hypot(playerPos.x - npc.data.position.x, playerPos.z - npc.data.position.z);
      if (dist < minDist) {
        minDist = dist;
        closest = npc.data;
      }
    }

    return closest;
  }

  public interactWith(npc: NPCData): string {
    const student = GemmaClient.getInstance().getProfile();
    const qm = QuestManager.getInstance();
    const curr = qm.getCurrentMission();

    // Select personalized line based on student's track and current mission
    if (npc.id === 'npc_gemma') {
      return `Welcome, ${student.handle}! For your active mission "${curr.title}", here is my customized guidance: ${curr.gemmaAdvice}`;
    }

    const randomLine = npc.dialogueLines[Math.floor(Math.random() * npc.dialogueLines.length)];
    if (this.onDialogueOpen) {
      this.onDialogueOpen(npc, randomLine);
    }
    return randomLine;
  }
}
