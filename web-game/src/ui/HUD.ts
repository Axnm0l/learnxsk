import { QuestManager } from '../quest/QuestManager';

export class HUD {
  private levelText: HTMLElement;
  private xpText: HTMLElement;
  private xpFill: HTMLElement;
  private missionId: HTMLElement;
  private missionTitle: HTMLElement;
  private missionDesc: HTMLElement;
  private posIndicator: HTMLElement;

  private interactPrompt: HTMLElement;
  private interactText: HTMLElement;

  constructor() {
    this.levelText = document.getElementById('hud-level-text')!;
    this.xpText = document.getElementById('hud-xp-text')!;
    this.xpFill = document.getElementById('hud-xp-fill')!;
    this.missionId = document.getElementById('hud-mission-id')!;
    this.missionTitle = document.getElementById('hud-mission-title')!;
    this.missionDesc = document.getElementById('hud-mission-desc')!;
    this.posIndicator = document.getElementById('world-pos-indicator')!;

    this.interactPrompt = document.getElementById('interact-prompt')!;
    this.interactText = document.getElementById('interact-text')!;
  }

  public render(qm: QuestManager): void {
    this.levelText.textContent = qm.levelTitle;
    this.xpText.textContent = `${qm.xp} / ${qm.maxXp} XP`;

    const pct = Math.min(100, Math.round((qm.xp / qm.maxXp) * 100));
    this.xpFill.style.width = `${pct}%`;

    const mission = qm.getCurrentMission();
    this.missionId.textContent = mission.number;
    this.missionTitle.textContent = mission.title;
    this.missionDesc.textContent = mission.objectiveText;
  }

  public updatePosition(x: number, z: number): void {
    const rx = Math.round(x);
    const rz = Math.round(z);
    this.posIndicator.textContent = `Blocklands Outpost [X: ${rx}, Z: ${rz}]`;
  }

  public showInteractPrompt(text: string): void {
    this.interactText.textContent = text;
    this.interactPrompt.style.display = 'flex';
  }

  public hideInteractPrompt(): void {
    this.interactPrompt.style.display = 'none';
  }
}
