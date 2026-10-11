import { QuestManager } from '../quest/QuestManager';
import { GemmaClient } from '../ai/GemmaClient';

export class HUD {
  private levelTextEl: HTMLElement | null;
  private xpTextEl: HTMLElement | null;
  private healthHeartsEl: HTMLElement | null;
  private xpHeartsEl: HTMLElement | null;
  private interactPromptEl: HTMLElement | null;
  private interactTextEl: HTMLElement | null;

  constructor() {
    this.levelTextEl = document.getElementById('hud-level-text');
    this.xpTextEl = document.getElementById('hud-xp-text');
    this.healthHeartsEl = document.getElementById('hud-health-hearts');
    this.xpHeartsEl = document.getElementById('hud-xp-hearts');
    this.interactPromptEl = document.getElementById('interact-prompt');
    this.interactTextEl = document.getElementById('interact-text');
  }

  /**
   * Generates a 10x9 16-bit retro pixel heart SVG
   */
  private generatePixelHeart(state: 'full' | 'half' | 'empty', color: string): string {
    const borderColor = '#090d16';
    const emptyFill = '#1e293b';

    if (state === 'full') {
      return `
        <svg class="pixel-heart full" viewBox="0 0 10 9" width="18" height="16" shape-rendering="crispEdges">
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h4v1h-4z M5 1h4v1h-4z M0 2h10v3h-10z M1 5h8v1h-8z M2 6h6v1h-6z M3 7h4v1h-4z M4 8h2v1h-2z" fill="${color}"/>
          <path d="M2 2h1v1h-1z M3 2h1v1h-1z" fill="#ffffff" fill-opacity="0.75"/>
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h1v1h-1z M4 1h2v1h-2z M8 1h1v1h-1z M0 2h1v3h-1z M9 2h1v3h-1z M1 5h1v1h-1z M8 5h1v1h-1z M2 6h1v1h-1z M7 6h1v1h-1z M3 7h1v1h-1z M6 7h1v1h-1z M4 8h2v1h-2z" fill="${borderColor}"/>
        </svg>
      `;
    } else if (state === 'half') {
      return `
        <svg class="pixel-heart half" viewBox="0 0 10 9" width="18" height="16" shape-rendering="crispEdges">
          <!-- Background dark fill -->
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h4v1h-4z M5 1h4v1h-4z M0 2h10v3h-10z M1 5h8v1h-8z M2 6h6v1h-6z M3 7h4v1h-4z M4 8h2v1h-2z" fill="${emptyFill}"/>
          <!-- Left half colored -->
          <path d="M2 0h2v1h-2z M1 1h4v1h-4z M0 2h5v3h-5z M1 5h4v1h-4z M2 6h3v1h-3z M3 7h2v1h-2z M4 8h1v1h-1z" fill="${color}"/>
          <path d="M2 2h1v1h-1z" fill="#ffffff" fill-opacity="0.75"/>
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h1v1h-1z M4 1h2v1h-2z M8 1h1v1h-1z M0 2h1v3h-1z M9 2h1v3h-1z M1 5h1v1h-1z M8 5h1v1h-1z M2 6h1v1h-1z M7 6h1v1h-1z M3 7h1v1h-1z M6 7h1v1h-1z M4 8h2v1h-2z" fill="${borderColor}"/>
        </svg>
      `;
    } else {
      return `
        <svg class="pixel-heart empty" viewBox="0 0 10 9" width="18" height="16" shape-rendering="crispEdges">
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h4v1h-4z M5 1h4v1h-4z M0 2h10v3h-10z M1 5h8v1h-8z M2 6h6v1h-6z M3 7h4v1h-4z M4 8h2v1h-2z" fill="${emptyFill}"/>
          <path d="M2 0h2v1h-2z M6 0h2v1h-2z M1 1h1v1h-1z M4 1h2v1h-2z M8 1h1v1h-1z M0 2h1v3h-1z M9 2h1v3h-1z M1 5h1v1h-1z M8 5h1v1h-1z M2 6h1v1h-1z M7 6h1v1h-1z M3 7h1v1h-1z M6 7h1v1h-1z M4 8h2v1h-2z" fill="${borderColor}"/>
        </svg>
      `;
    }
  }

  private renderHeartsHTML(totalHearts: number, currentVal: number, maxVal: number, color: string): string {
    const valPerHeart = maxVal / totalHearts;
    let html = '';

    for (let i = 1; i <= totalHearts; i++) {
      const fullThreshold = i * valPerHeart;
      const halfThreshold = (i - 0.5) * valPerHeart;

      if (currentVal >= fullThreshold) {
        html += this.generatePixelHeart('full', color);
      } else if (currentVal >= halfThreshold) {
        html += this.generatePixelHeart('half', color);
      } else {
        html += this.generatePixelHeart('empty', color);
      }
    }

    return html;
  }

  /**
   * Full HUD render with dynamic player HP from combat system
   */
  public render(qm: QuestManager, playerHP: number = 5): void {
    const student = GemmaClient.getInstance().getProfile();

    if (this.levelTextEl) {
      this.levelTextEl.innerText = `LVL ${qm.level} // ${student.handle.toUpperCase()}`;
    }

    if (this.xpTextEl) {
      this.xpTextEl.innerText = `${qm.xp}/${qm.maxXp} XP`;
    }

    // Health: 5 pixel hearts — now dynamic based on combat HP
    if (this.healthHeartsEl) {
      this.healthHeartsEl.innerHTML = this.renderHeartsHTML(5, playerHP, 5, '#ef4444');
    }

    // XP: 5 pixel hearts based on XP progression (0 to 1000)
    if (this.xpHeartsEl) {
      this.xpHeartsEl.innerHTML = this.renderHeartsHTML(5, qm.xp, qm.maxXp, '#f59e0b');
    }
  }

  /**
   * Update only health hearts (called from combat system on each hit)
   */
  public renderHealth(currentHP: number, maxHP: number): void {
    if (this.healthHeartsEl) {
      this.healthHeartsEl.innerHTML = this.renderHeartsHTML(5, currentHP, maxHP, '#ef4444');
    }
  }

  public updatePosition(_x: number, _z: number): void {
    // Location indicator removed per user request
  }

  public showInteractPrompt(actionLabel: string): void {
    if (this.interactPromptEl && this.interactTextEl) {
      this.interactTextEl.innerText = actionLabel;
      this.interactPromptEl.classList.add('visible');
    }
  }

  public hideInteractPrompt(): void {
    if (this.interactPromptEl) {
      this.interactPromptEl.classList.remove('visible');
    }
  }

  public showCelebration(msg: string): void {
    const banner = document.createElement('div');
    banner.className = 'celebration-banner';
    banner.innerHTML = `
      <div class="celebration-title">🎉 LEVEL ADVANCEMENT!</div>
      <div class="celebration-body">${msg}</div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.classList.add('fade-out');
      setTimeout(() => banner.remove(), 500);
    }, 3500);
  }
}
