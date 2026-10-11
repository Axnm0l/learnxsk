import { VirtualFilesystem } from '../quest/VirtualFilesystem';
import { QuestManager } from '../quest/QuestManager';
import { GemmaClient } from '../ai/GemmaClient';

export class TerminalUI {
  private modalEl: HTMLElement;
  private screenEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private promptLabelEl: HTMLElement;
  private tutorTextEl: HTMLElement;
  private hintBtnEl: HTMLButtonElement;
  private closeBtnEl: HTMLElement;
  private closeDotEl: HTMLElement;

  private vfs: VirtualFilesystem;
  private qm: QuestManager;

  private commandHistory: string[] = [];
  private historyIndex: number = -1;

  constructor(vfs: VirtualFilesystem, qm: QuestManager) {
    this.vfs = vfs;
    this.qm = qm;

    this.modalEl = document.getElementById('terminal-modal')!;
    this.screenEl = document.getElementById('terminal-screen')!;
    this.inputEl = document.getElementById('terminal-input') as HTMLInputElement;
    this.promptLabelEl = document.getElementById('terminal-prompt-label')!;
    this.tutorTextEl = document.getElementById('tutor-text')!;
    this.hintBtnEl = document.getElementById('terminal-hint-btn') as HTMLButtonElement;
    this.closeBtnEl = document.getElementById('terminal-close-btn')!;
    this.closeDotEl = document.getElementById('term-close-dot')!;

    this.initEvents();
  }

  private initEvents(): void {
    // Close events
    this.closeBtnEl?.addEventListener('click', () => this.close());
    this.closeDotEl?.addEventListener('click', () => this.close());

    // Enter command & history navigation
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = this.inputEl.value;
        this.inputEl.value = '';
        if (raw.trim()) {
          this.commandHistory.push(raw);
          this.historyIndex = this.commandHistory.length;
          this.handleCommand(raw);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.inputEl.value = this.commandHistory[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputEl.value = this.commandHistory[this.historyIndex] || '';
        } else {
          this.historyIndex = this.commandHistory.length;
          this.inputEl.value = '';
        }
      }
    });

    // Ask Gemma Tutor button
    this.hintBtnEl?.addEventListener('click', async () => {
      this.tutorTextEl.innerText = 'Gemma 4 is synthesizing hint...';
      const curr = this.qm.getCurrentMission();
      const res = await GemmaClient.getInstance().askTutor(
        `What command should I use next in mission "${curr.title}"?`,
        curr.title,
        this.vfs.getCurrentPath()
      );
      this.tutorTextEl.innerText = res.answer;
      if (res.suggestedAction) {
        this.inputEl.value = res.suggestedAction;
        this.inputEl.focus();
      }
    });

    // VFS async callback for Gemma AI output in shell
    this.vfs.onCommandExecuted = (_cmd, output) => {
      if (output.includes('[GEMMA AI TUTOR RESPONSE]')) {
        const p = document.createElement('p');
        p.className = 'term-tutor-output';
        p.innerText = output;
        this.screenEl.appendChild(p);
        this.scrollToBottom();
      }
    };
  }

  public open(): void {
    this.modalEl.classList.add('open');
    this.updatePrompt();
    this.inputEl.focus();

    // Mission 1 step trigger for opening terminal
    this.qm.completeStep('task_001', 't1_open');

    // Update tutor greeting
    const curr = this.qm.getCurrentMission();
    this.tutorTextEl.innerText = `Active: ${curr.title}. Use commands or click "Ask Gemma Tutor" for help.`;
  }

  public close(): void {
    this.modalEl.classList.remove('open');
  }

  public isOpen(): boolean {
    return this.modalEl.classList.contains('open');
  }

  private updatePrompt(): void {
    const promptPath = this.vfs.getPromptPath();
    this.promptLabelEl.innerText = `cadet@blocklands:${promptPath}$`;
  }

  private handleCommand(raw: string): void {
    // Print input line
    const promptPath = this.vfs.getPromptPath();
    const cmdLine = document.createElement('p');
    cmdLine.className = 'term-cmd-echo';
    cmdLine.innerHTML = `<span class="term-prompt">cadet@blocklands:${promptPath}$</span> ${escapeHtml(raw)}`;
    this.screenEl.appendChild(cmdLine);

    // Execute through virtual filesystem
    const result = this.vfs.execute(raw);

    if (result.isClear) {
      this.screenEl.innerHTML = `
        <p class="term-info">========================================================</p>
        <p class="term-info">  LEARNXSK VIRTUAL LINUX SYSTEM — TERMINAL SHELL v2.0   </p>
        <p class="term-info">========================================================</p>
      `;
    } else if (result.output) {
      const outP = document.createElement('pre');
      outP.className = result.isError ? 'term-stderr' : 'term-stdout';
      outP.innerText = result.output;
      this.screenEl.appendChild(outP);
    }

    this.updatePrompt();
    this.scrollToBottom();

    // Dynamically update tutor bar
    const curr = this.qm.getCurrentMission();
    const incompleteStep = curr.steps.find(s => !s.completed);
    if (!incompleteStep) {
      this.tutorTextEl.innerText = `🎉 Mission accomplished! Reward XP awarded. Check Mission Control [M] for the next task!`;
    }
  }

  private scrollToBottom(): void {
    this.screenEl.scrollTop = this.screenEl.scrollHeight;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
