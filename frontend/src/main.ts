import * as THREE from 'three';
import { IsometricWorld } from './world/IsometricWorld';
import { Player } from './player/Player';
import { FollowCamera } from './player/FollowCamera';
import { QuestManager } from './quest/QuestManager';
import { VirtualFilesystem } from './quest/VirtualFilesystem';
import { HUD } from './ui/HUD';
import { QuestBoardUI } from './ui/QuestBoardUI';
import { TerminalUI } from './ui/TerminalUI';

class GameApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private clock: THREE.Clock;

  private world: IsometricWorld;
  private player: Player;
  private followCam: FollowCamera;

  private questManager: QuestManager;
  private vfs: VirtualFilesystem;
  private hud: HUD;
  private questBoardUI: QuestBoardUI;
  private terminalUI: TerminalUI;

  constructor() {
    const container = document.getElementById('game-container')!;

    // Initialize Three.js scene & renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x182414); // Grassy dark ambient backdrop

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // World & Camera
    this.world = new IsometricWorld(this.scene);
    this.player = new Player(this.scene);
    this.followCam = new FollowCamera(container);

    // Systems & UI
    this.questManager = QuestManager.getInstance();
    this.vfs = new VirtualFilesystem();
    this.hud = new HUD();
    this.questBoardUI = new QuestBoardUI(this.questManager);
    this.terminalUI = new TerminalUI(this.vfs, this.questManager);

    // Initial HUD update
    this.hud.render(this.questManager);
    this.questManager.onStateChange = () => {
      this.hud.render(this.questManager);
    };

    this.initInteractionEvents();
    this.initResize(container);

    // Start loop
    this.animate();
  }

  private initInteractionEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        // If a modal is open, don't re-trigger unless closed
        if (this.questBoardUI.isOpen() || this.terminalUI.isOpen()) {
          return;
        }

        const nearby = this.world.getNearestInteractable(this.player.position);
        if (nearby) {
          if (nearby.type === 'quest_board') {
            this.questBoardUI.open();
          } else if (nearby.type === 'terminal') {
            this.terminalUI.open();
          }
        }
      } else if (e.code === 'Escape') {
        if (this.questBoardUI.isOpen()) this.questBoardUI.close();
        if (this.terminalUI.isOpen()) this.terminalUI.close();
      }
    });
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

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // Only update player movement when not actively using a modal window
    const isModalOpen = this.questBoardUI.isOpen() || this.terminalUI.isOpen();
    if (!isModalOpen) {
      this.player.update(delta);
    }

    // Camera always tracks smoothly
    this.followCam.update(this.player.position, delta);

    // World animation
    this.world.update(elapsedTime);

    // Interaction prompt check
    if (!isModalOpen) {
      const nearby = this.world.getNearestInteractable(this.player.position);
      if (nearby) {
        const actionLabel = nearby.type === 'quest_board'
          ? 'Inspect Quest Board'
          : 'Access Terminal Outpost';
        this.hud.showInteractPrompt(actionLabel);
      } else {
        this.hud.hideInteractPrompt();
      }
    } else {
      this.hud.hideInteractPrompt();
    }

    // Position indicator in HUD
    this.hud.updatePosition(this.player.position.x, this.player.position.z);

    // Render frame
    this.renderer.render(this.scene, this.followCam.camera);
  };
}

// Bootstrap game on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
