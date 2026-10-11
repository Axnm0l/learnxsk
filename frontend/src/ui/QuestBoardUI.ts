import { QuestManager } from '../quest/QuestManager';

export class QuestBoardUI {
  private modalEl: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private acceptBtnEl: HTMLButtonElement;
  private closeBtnEl: HTMLElement;
  private qm: QuestManager;

  constructor(qm: QuestManager) {
    this.qm = qm;
    this.modalEl = document.getElementById('quest-modal')!;
    this.titleEl = document.getElementById('quest-modal-title')!;
    this.bodyEl = document.getElementById('quest-modal-body')!;
    this.acceptBtnEl = document.getElementById('quest-accept-btn') as HTMLButtonElement;
    this.closeBtnEl = document.getElementById('quest-close-btn')!;

    this.initEvents();
  }

  private initEvents(): void {
    this.closeBtnEl?.addEventListener('click', () => this.close());

    this.acceptBtnEl?.addEventListener('click', () => {
      const curr = this.qm.getCurrentMission();
      this.qm.startMission(curr.id);
      this.close();
    });
  }

  public open(): void {
    const curr = this.qm.getCurrentMission();

    if (this.titleEl) {
      this.titleEl.innerText = `${curr.number}: ${curr.title.toUpperCase()}`;
    }

    if (this.bodyEl) {
      this.bodyEl.innerHTML = `
        <div style="margin-bottom: 0.85rem; color: #cbd5e1; font-size: 0.65rem; line-height: 1.7;">
          ${curr.description}
        </div>

        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #334155; border-radius: 4px; padding: 0.75rem; margin-bottom: 0.85rem;">
          <div style="font-weight: 700; color: #fbbf24; font-size: 0.62rem; margin-bottom: 0.4rem;">STATION ASSIGNMENT:</div>
          <div style="font-size: 0.64rem; color: #f8fafc;">📍 <strong>${curr.stationName}</strong></div>
          <div style="font-size: 0.58rem; color: #94a3b8; margin-top: 0.35rem;">TARGET COORDINATES: [X: ${curr.stationLocation[0]}, Z: ${curr.stationLocation[1]}]</div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #22c55e; border-radius: 4px; padding: 0.75rem;">
          <div style="color: #22c55e; font-weight: 700; font-size: 0.62rem;">REWARDS ON COMPLETION:</div>
          <div style="color: #f8fafc; font-size: 0.62rem; margin-top: 0.3rem;">+${curr.rewardXP} XP &bull; BADGE: ${curr.badgeIcon} <strong>${curr.badgeName}</strong></div>
        </div>
      `;
    }

    if (this.acceptBtnEl) {
      this.acceptBtnEl.innerText = curr.status === 'COMPLETED' ? 'MISSION COMPLETED ✓' : 'START / TRACK MISSION';
      this.acceptBtnEl.disabled = curr.status === 'COMPLETED';
    }

    this.modalEl.classList.add('open');
  }

  public close(): void {
    this.modalEl.classList.remove('open');
  }

  public isOpen(): boolean {
    return this.modalEl.classList.contains('open');
  }
}
