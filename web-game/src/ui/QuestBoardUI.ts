import { QuestManager } from '../quest/QuestManager';

export class QuestBoardUI {
  private modal: HTMLElement;
  private closeBtn: HTMLElement;
  private acceptBtn: HTMLElement;
  private titleElem: HTMLElement;
  private bodyElem: HTMLElement;
  private questManager: QuestManager;

  constructor(questManager: QuestManager) {
    this.questManager = questManager;
    this.modal = document.getElementById('quest-modal')!;
    this.closeBtn = document.getElementById('quest-close-btn')!;
    this.acceptBtn = document.getElementById('quest-accept-btn')!;
    this.titleElem = document.getElementById('quest-modal-title')!;
    this.bodyElem = document.getElementById('quest-modal-body')!;

    this.closeBtn.addEventListener('click', () => this.close());
    this.acceptBtn.addEventListener('click', () => {
      this.questManager.acceptMission001();
      this.close();
    });

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  public open(): void {
    const mission = this.questManager.missions[0];
    if (mission.status === 'COMPLETED') {
      this.titleElem.textContent = 'ALL QUESTS COMPLETED!';
      this.bodyElem.innerHTML = 'Outstanding work, Cadet! You have recovered the outpost configuration files and earned your field stripes.<br><br>Ready for Mission 002: Network Reconnaissance.';
      this.acceptBtn.style.display = 'none';
    } else if (mission.status === 'IN_PROGRESS') {
      this.titleElem.textContent = mission.number + ': IN PROGRESS';
      this.bodyElem.innerHTML = 'Head east across the wooden bridge to the <strong>Terminal Outpost Station</strong>.<br><br>Interact with the terminal screen and use `cd /var/backups` and `cat token.env` to complete the mission.';
      this.acceptBtn.textContent = 'CONTINUE MISSION';
      this.acceptBtn.style.display = 'inline-block';
    } else {
      this.titleElem.textContent = mission.number + ': ' + mission.title.toUpperCase();
      this.bodyElem.innerHTML = mission.description + '<br><br>Accept this mission to begin your Linux explorer training!';
      this.acceptBtn.textContent = 'ACCEPT MISSION';
      this.acceptBtn.style.display = 'inline-block';
    }

    this.modal.style.display = 'flex';
  }

  public close(): void {
    this.modal.style.display = 'none';
  }

  public isOpen(): boolean {
    return this.modal.style.display === 'flex';
  }
}
