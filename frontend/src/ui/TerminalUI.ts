import { VirtualFilesystem } from '../quest/VirtualFilesystem';
import { QuestManager } from '../quest/QuestManager';
import { GemmaClient } from '../ai/GemmaClient';

export class TerminalUI {
  private modal: HTMLElement;
  private screen: HTMLElement;
  private input: HTMLInputElement;
  private promptLabel: HTMLElement;
  private hintBtn: HTMLElement;
  private closeBtn: HTMLElement;
  private closeDot: HTMLElement;
  private tutorBox: HTMLElement;
  private tutorText: HTMLElement;

  private vfs: VirtualFilesystem;
  private questManager: QuestManager;

  private history: string[] = [];
  private historyIndex: number = -1;

  constructor(vfs: VirtualFilesystem, questManager: QuestManager) {
    this.vfs = vfs;
    this.questManager = questManager;

    this.modal = document.getElementById('terminal-modal')!;
    this.screen = document.getElementById('terminal-screen')!;
    this.input = document.getElementById('terminal-input') as HTMLInputElement;
    this.promptLabel = document.getElementById('terminal-prompt-label')!;
    this.hintBtn = document.getElementById('terminal-hint-btn')!;
    this.closeBtn = document.getElementById('terminal-close-btn')!;
    this.closeDot = document.getElementById('term-close-dot')!;
    this.tutorBox = document.getElementById('tutor-box')!;
    this.tutorText = document.getElementById('tutor-text')!;

    this.closeBtn.addEventListener('click', () => this.close());
    this.closeDot.addEventListener('click', () => this.close());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.hintBtn.addEventListener('click', () => this.requestHint());

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = this.input.value;
        this.input.value = '';
        this.handleCommand(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length > 0 && this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.input.value = this.history[this.history.length - 1 - this.historyIndex];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.input.value = this.history[this.history.length - 1 - this.historyIndex];
        } else if (this.historyIndex === 0) {
          this.historyIndex = -1;
          this.input.value = '';
        }
      }
    });

    // Listen for quest token discovery
    this.vfs.onTokenFound = (_token: string) => {
      this.handleTokenSuccess();
    };
  }

  public open(): void {
    this.modal.style.display = 'flex';
    this.updatePrompt();
    setTimeout(() => {
      this.input.focus();
    }, 50);
  }

  public close(): void {
    this.modal.style.display = 'none';
    this.input.blur();
  }

  public isOpen(): boolean {
    return this.modal.style.display === 'flex';
  }

  private updatePrompt(): void {
    this.promptLabel.textContent = `cadet@outpost:${this.vfs.getPromptPath()}$`;
  }

  private printLine(text: string, className: string = 'term-stdout'): void {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    this.screen.appendChild(p);
    this.screen.scrollTop = this.screen.scrollHeight;
  }

  private handleCommand(cmdStr: string): void {
    const trimmed = cmdStr.trim();
    if (!trimmed) {
      this.printLine(`cadet@outpost:${this.vfs.getPromptPath()}$`, 'term-prompt-line');
      return;
    }

    this.history.push(trimmed);
    this.historyIndex = -1;

    this.printLine(`cadet@outpost:${this.vfs.getPromptPath()}$ ${trimmed}`, 'term-prompt-line');

    if (trimmed.toLowerCase() === 'hint') {
      this.requestHint();
      return;
    }

    const res = this.vfs.execute(trimmed);
    if (res.isClear) {
      this.screen.innerHTML = '';
      return;
    }

    if (res.output) {
      this.printLine(res.output, res.isError ? 'term-error' : 'term-stdout');
    }

    this.updatePrompt();
  }

  private handleTokenSuccess(): void {
    const currentMission = this.questManager.getCurrentMission();
    if (currentMission.status === 'IN_PROGRESS' || currentMission.status === 'AVAILABLE') {
      this.printLine('------------------------------------------------------------', 'term-success');
      this.printLine(' ★ MISSION 001 CHALLENGE SOLVED! VERIFICATION TOKEN FOUND ★ ', 'term-success');
      this.printLine('   Token: LEARNXSK_BLOCKLANDS_QUEST001_VALIDATED', 'term-info');
      this.printLine('   Reward: +100 XP Awarded! Level 2 Unlocked!', 'term-success');
      this.printLine('------------------------------------------------------------', 'term-success');

      this.questManager.completeMission001();
    }
  }

  public async requestHint(): Promise<void> {
    this.tutorBox.classList.add('active');
    this.tutorText.textContent = 'Gemma is analyzing current mission context...';

    const mission = this.questManager.getCurrentMission();
    const resp = await GemmaClient.requestHint({
      mission: mission.title,
      topic: 'Linux navigation in backups folder'
    });

    this.tutorText.textContent = resp.hint;
    this.printLine(`[Gemma AI Tutor]: ${resp.hint}`, 'term-info');
  }
}
