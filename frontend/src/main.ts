import * as THREE from 'three';
import { IsometricWorld } from './world/IsometricWorld';
import { Player } from './player/Player';
import { FollowCamera } from './player/FollowCamera';
import { NPCManager, NPCData } from './world/NPCManager';
import { QuestManager } from './quest/QuestManager';
import { VirtualFilesystem } from './quest/VirtualFilesystem';
import { HUD } from './ui/HUD';
import { QuestBoardUI } from './ui/QuestBoardUI';
import { TerminalUI } from './ui/TerminalUI';
import { SidebarUI } from './ui/SidebarUI';
import { OnboardingModal } from './ui/OnboardingModal';
import { LoadingScreen } from './ui/LoadingScreen';
import { CombatSystem } from './world/CombatSystem';

class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private clock: THREE.Clock;

  private world: IsometricWorld;
  private player: Player;
  private followCam: FollowCamera;
  private npcManager: NPCManager;

  private questManager: QuestManager;
  private vfs: VirtualFilesystem;
  private hud: HUD;
  private questBoardUI: QuestBoardUI;
  private terminalUI: TerminalUI;
  private sidebarUI: SidebarUI;
  private combatSystem: CombatSystem;

  // Active dialogue overlay for NPCs
  private npcDialogueEl: HTMLElement | null = null;

  // Pause system
  private isPaused: boolean = false;
  private pauseModalEl: HTMLElement | null = null;

  // Mouse aim & cursor raycasting
  private containerEl: HTMLElement;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
  private mouseVec: THREE.Vector2 = new THREE.Vector2();
  private planeIntersect: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    const container = document.getElementById('game-container')!;
    this.containerEl = container;
    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;

    // Three.js scene & renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a101d); // Cyber dark obsidian skybox
    this.scene.fog = new THREE.FogExp2(0x0a101d, 0.012);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // World & Characters
    this.world = new IsometricWorld(this.scene);
    this.player = new Player(this.scene);
    this.followCam = new FollowCamera(container);

    // Systems & UI
    this.questManager = QuestManager.getInstance();
    this.vfs = new VirtualFilesystem();
    this.hud = new HUD();
    this.questBoardUI = new QuestBoardUI(this.questManager);
    this.terminalUI = new TerminalUI(this.vfs, this.questManager);
    this.sidebarUI = new SidebarUI(this.questManager);

    // Combat System
    this.combatSystem = new CombatSystem(this.scene, {
      onPlayerHit: (hp, maxHP) => {
        this.hud.renderHealth(hp, maxHP);
      },
      onEnemySpawn: () => {
        // Reset combat idle when enemy spawns
      },
      onEnemyDespawn: () => {
        // Enemy left the area
      },
      onPlayerDeath: () => {
        // Death screen is handled by CombatSystem internally
      }
    });

    // Wire NPC Manager with dialogue popup callback
    this.npcManager = new NPCManager(this.scene, (npc, text) => {
      this.showNPCDialogue(npc, text);
    });

    // Wire Sidebar UI navigation
    this.sidebarUI.onOpenTerminal = () => {
      this.terminalUI.open();
    };
    this.sidebarUI.onTeleport = (x, z) => {
      this.player.teleportTo(x, z);
    };

    // Level-up celebration
    this.questManager.onLevelUp = (lvl, title) => {
      this.hud.showCelebration(`Promoted to <strong>${title}</strong> (Level ${lvl})! New cybersecurity clearance granted.`);
    };

    // State changes — use addOnStateChange to avoid overwriting
    this.questManager.onStateChange = () => {
      this.hud.render(this.questManager, this.combatSystem.getHP());
      this.sidebarUI.refreshSidebar();
    };
    this.hud.render(this.questManager, this.combatSystem.getHP());

    this.initInteractionEvents();
    this.initMouseAim();
    this.initResize(container);

    // Onboarding Modal with Gemma 4 Diagnostic
    new OnboardingModal((_profile) => {
      this.hud.render(this.questManager, this.combatSystem.getHP());
      this.sidebarUI.openSidebar(); // Start by showing their custom curriculum!
      this.updateCursorState();
    });

    // Initial cursor check
    this.updateCursorState();

    // Main animation loop
    this.animate();
  }

  private isAnyModalOpen(): boolean {
    return (
      this.isPaused ||
      this.questBoardUI.isOpen() ||
      this.terminalUI.isOpen() ||
      !!this.npcDialogueEl ||
      !!this.pauseModalEl ||
      !!document.getElementById('onboarding-overlay') ||
      !!document.getElementById('death-screen')
    );
  }

  /** Hide operating system mouse cursor during 3D gameplay, show for UI */
  private updateCursorState(): void {
    if (this.isAnyModalOpen()) {
      this.containerEl.classList.remove('cursor-hidden');
      document.body.classList.remove('cursor-hidden');
    } else {
      this.containerEl.classList.add('cursor-hidden');
      document.body.classList.add('cursor-hidden');
    }
  }

  /** Raycast mouse position onto ground plane so player smoothly turns left and right */
  private initMouseAim(): void {
    window.addEventListener('mousemove', (e) => {
      if (this.isAnyModalOpen()) return;

      this.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseVec, this.followCam.camera);
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.planeIntersect);
      if (hit) {
        this.player.setAimTarget(this.planeIntersect);
      }
    });
  }

  private initInteractionEvents(): void {
    window.addEventListener('keydown', (e) => {
      // Pause shortcut (P key)
      if (e.code === 'KeyP') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          this.togglePause();
          return;
        }
      }

      if (e.code === 'KeyE') {
        // If a modal or dialogue is active, close dialogue or skip
        if (this.npcDialogueEl) {
          this.closeNPCDialogue();
          return;
        }

        if (this.questBoardUI.isOpen() || this.terminalUI.isOpen() || this.isPaused) {
          return;
        }

        // 1. Check nearby NPCs first
        const nearbyNPC = this.npcManager.getNearestNPC(this.player.position, 3.0);
        if (nearbyNPC) {
          const line = this.npcManager.interactWith(nearbyNPC);
          this.showNPCDialogue(nearbyNPC, line);
          return;
        }

        // 2. Check nearby interactables (Quest Board or District Terminals)
        const nearby = this.world.getNearestInteractable(this.player.position);
        if (nearby) {
          if (nearby.type === 'quest_board') {
            this.questBoardUI.open();
            this.updateCursorState();
          } else if (nearby.type === 'terminal') {
            this.terminalUI.open();
            this.updateCursorState();
          }
        }
      } else if (e.code === 'Escape') {
        if (this.isPaused) {
          this.togglePause();
          return;
        }
        if (this.npcDialogueEl) this.closeNPCDialogue();
        else if (this.questBoardUI.isOpen()) {
          this.questBoardUI.close();
          this.updateCursorState();
        } else if (this.terminalUI.isOpen()) {
          this.terminalUI.close();
          this.updateCursorState();
        } else {
          this.togglePause();
        }
      }
    });
  }

  public togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.showPauseMenu();
    } else {
      this.hidePauseMenu();
    }
    this.updateCursorState();
  }

  private showPauseMenu(): void {
    if (this.pauseModalEl) this.pauseModalEl.remove();

    this.pauseModalEl = document.createElement('div');
    this.pauseModalEl.className = 'pause-overlay';
    this.pauseModalEl.innerHTML = `
      <div class="pause-card pixel-retro-card">
        <div class="pixel-badge-amber">
          <span class="pixel-star">★</span> SIMULATION PAUSED <span class="pixel-star">★</span>
        </div>
        <h1 class="pixel-title" style="margin-bottom: 0.5rem; font-size: 1.15rem;">GAME PAUSED</h1>
        <p class="terminal-text" style="color: #cbd5e1; font-size: 0.8rem; margin-bottom: 1.3rem;">
          Cadet status preserved &bull; Sector telemetry on standby.
        </p>

        <div class="pause-btn-stack">
          <button class="pixel-btn-emerald" id="pause-btn-resume">RESUME SIMULATION [P]</button>
          <button class="pixel-btn-stone" id="pause-btn-tasks">OPEN MISSION TASKBAR [M]</button>
          <button class="pixel-btn-stone" id="pause-btn-term">OPEN BASH TERMINAL [T]</button>
          <button class="pixel-btn-stone" id="pause-btn-spawn">RESPAWN AT CITADEL PLAZA</button>
        </div>

        <div class="pause-hints terminal-text">
          <span>[WASD] Move &bull; [Mouse] Aim / Turn Left & Right &bull; [P] Pause</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.pauseModalEl);

    this.pauseModalEl.querySelector('#pause-btn-resume')?.addEventListener('click', () => {
      this.togglePause();
    });
    this.pauseModalEl.querySelector('#pause-btn-tasks')?.addEventListener('click', () => {
      this.togglePause();
      this.sidebarUI.openSidebar();
    });
    this.pauseModalEl.querySelector('#pause-btn-term')?.addEventListener('click', () => {
      this.togglePause();
      this.terminalUI.open();
    });
    this.pauseModalEl.querySelector('#pause-btn-spawn')?.addEventListener('click', () => {
      this.player.teleportTo(0, 0);
      this.togglePause();
    });
  }

  private hidePauseMenu(): void {
    if (this.pauseModalEl) {
      this.pauseModalEl.remove();
      this.pauseModalEl = null;
    }
  }

  private showNPCDialogue(npc: NPCData, text: string): void {
    if (this.npcDialogueEl) this.npcDialogueEl.remove();

    this.npcDialogueEl = document.createElement('div');
    this.npcDialogueEl.className = 'npc-dialogue-card';
    this.npcDialogueEl.innerHTML = `
      <div class="npc-dialogue-header">
        <span class="npc-icon">${npc.avatarIcon}</span>
        <div>
          <div class="npc-name">${npc.name}</div>
          <div class="npc-role">${npc.role}</div>
        </div>
        <button class="modal-close-btn" id="npc-dlg-close">&times;</button>
      </div>
      <div class="npc-dialogue-body">${text}</div>
      <div class="npc-dialogue-footer">
        <span style="color: #64748b; font-size: 0.8rem;">Press [E] or [ESC] to continue</span>
        <button class="btn-action-sm" id="btn-ask-gemma-more">Ask Gemma More &rarr;</button>
      </div>
    `;

    document.body.appendChild(this.npcDialogueEl);
    this.updateCursorState();

    this.npcDialogueEl.querySelector('#npc-dlg-close')?.addEventListener('click', () => {
      this.closeNPCDialogue();
    });

    this.npcDialogueEl.querySelector('#btn-ask-gemma-more')?.addEventListener('click', () => {
      this.closeNPCDialogue();
      this.sidebarUI.toggleTutor();
    });

    // Reset combat idle when interacting
    this.combatSystem.resetIdle();
  }

  private closeNPCDialogue(): void {
    if (this.npcDialogueEl) {
      this.npcDialogueEl.remove();
      this.npcDialogueEl = null;
      this.updateCursorState();
    }
  }

  private initResize(container: HTMLElement): void {
    window.addEventListener('resize', () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.renderer.setSize(width, height);
      this.followCam.handleResize(width, height);
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // If game is paused, render static frame and freeze physics/combat
    if (this.isPaused) {
      this.renderer.render(this.scene, this.followCam.camera);
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    const isModalOpen = this.isAnyModalOpen();

    // Continuously update mouse aim target so holding W keeps tracking cursor as camera moves
    if (!isModalOpen && (this.mouseVec.x !== 0 || this.mouseVec.y !== 0)) {
      this.raycaster.setFromCamera(this.mouseVec, this.followCam.camera);
      if (this.raycaster.ray.intersectPlane(this.groundPlane, this.planeIntersect)) {
        this.player.setAimTarget(this.planeIntersect);
      }
    }

    // Move player with mouse-oriented W/A/S/D
    if (!isModalOpen && !this.combatSystem.isPlayerDead()) {
      this.player.update(delta);
    }

    // Combat system update
    this.combatSystem.update(delta, this.player.position, isModalOpen);

    // Camera follows smoothly
    this.followCam.update(this.player.position, delta);

    // World & NPCs updates
    this.world.update(elapsedTime);
    this.npcManager.update(delta, elapsedTime);

    // Dynamic prompt detection
    if (!isModalOpen) {
      const nearbyNPC = this.npcManager.getNearestNPC(this.player.position, 3.0);
      if (nearbyNPC) {
        this.hud.showInteractPrompt(`Talk to ${nearbyNPC.name} [E]`);
      } else {
        const nearby = this.world.getNearestInteractable(this.player.position);
        if (nearby) {
          this.hud.showInteractPrompt(nearby.label || `Access ${nearby.name} [E]`);
        } else {
          this.hud.hideInteractPrompt();
        }
      }
    } else {
      this.hud.hideInteractPrompt();
    }

    // Update coordinates and district indicator in HUD
    this.hud.updatePosition(this.player.position.x, this.player.position.z);

    // Render frame
    this.renderer.render(this.scene, this.followCam.camera);
  };
}

// Bootstrap game on DOM load — loading screen first, then game
window.addEventListener('DOMContentLoaded', () => {
  let appStarted = false;

  const launchGame = () => {
    if (appStarted) return;
    appStarted = true;
    try {
      console.log('🎮 Initializing LearnXSK GameApp...');
      new GameApp();
      console.log('✅ LearnXSK GameApp mounted successfully!');
    } catch (err) {
      console.error('❌ Failed to mount GameApp:', err);
    }
  };

  const loadingScreen = new LoadingScreen();
  loadingScreen.start(() => {
    requestAnimationFrame(() => {
      launchGame();
    });
  });

  // Failsafe timer: if loading screen takes longer than 4.5s or gets stuck, mount game automatically
  setTimeout(() => {
    if (!appStarted) {
      console.warn('⚠️ Loading screen failsafe triggered; mounting GameApp.');
      loadingScreen.destroy();
      launchGame();
    }
  }, 4500);
});
