import { QuestManager } from '../quest/QuestManager';
import { GemmaClient } from '../ai/GemmaClient';
import { Mission } from '../quest/QuestData';

export class SidebarUI {
  private sidebarEl: HTMLElement;
  private taskbarEl: HTMLElement;
  private tutorModalEl: HTMLElement;
  private qm: QuestManager;

  private isSidebarOpen: boolean = false;
  private isTutorOpen: boolean = false;
  private activeTab: 'instructions' | 'tasks' | 'cheatsheet' = 'instructions';

  public onOpenTerminal?: () => void;
  public onTeleport?: (x: number, z: number) => void;

  constructor(qm: QuestManager) {
    this.qm = qm;

    this.sidebarEl = document.createElement('div');
    this.sidebarEl.id = 'cyber-sidebar';
    this.sidebarEl.className = 'cyber-sidebar-drawer';
    document.body.appendChild(this.sidebarEl);

    this.taskbarEl = document.createElement('div');
    this.taskbarEl.id = 'cyber-taskbar';
    // Taskbar dock widget disabled per user request
    // document.body.appendChild(this.taskbarEl);

    this.tutorModalEl = document.createElement('div');
    this.tutorModalEl.id = 'gemma-tutor-modal';
    this.tutorModalEl.className = 'modal-overlay';
    document.body.appendChild(this.tutorModalEl);

    this.renderTaskbar();
    this.renderSidebar();
    this.renderTutorModal();

    // Keyboard shortcut listeners
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.toggleSidebar();
      } else if (e.code === 'KeyG') {
        this.toggleTutor();
      } else if (e.code === 'KeyT') {
        if (this.onOpenTerminal) this.onOpenTerminal();
      }
    });
  }

  /** Called externally from main.ts onStateChange to refresh sidebar content */
  public refreshSidebar(): void {
    this.renderSidebar();
    this.renderTaskbar();
  }

  public toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (this.isSidebarOpen) {
      this.sidebarEl.classList.add('open');
      this.renderSidebar();
    } else {
      this.sidebarEl.classList.remove('open');
    }
  }

  public openSidebar(): void {
    this.isSidebarOpen = true;
    this.sidebarEl.classList.add('open');
    this.renderSidebar();
  }

  public closeSidebar(): void {
    this.isSidebarOpen = false;
    this.sidebarEl.classList.remove('open');
  }

  public toggleTutor(): void {
    this.isTutorOpen = !this.isTutorOpen;
    if (this.isTutorOpen) {
      this.tutorModalEl.classList.add('open');
      const input = this.tutorModalEl.querySelector('#tutor-query-input') as HTMLInputElement;
      if (input) input.focus();
    } else {
      this.tutorModalEl.classList.remove('open');
    }
  }

  private renderTaskbar(): void {
    const completedCount = this.qm.missions.filter(m => m.status === 'COMPLETED').length;

    this.taskbarEl.innerHTML = `
      <div class="dock-container">
        <button class="dock-btn" id="dock-btn-tasks" title="Toggle Mission Control & Instructions [M]">
          <span class="dock-icon">📋</span>
          <span class="dock-label">Tasks</span>
          <span class="dock-badge">${completedCount}/5</span>
        </button>

        <button class="dock-btn active-pulse" id="dock-btn-terminal" title="Toggle Linux Terminal [T]">
          <span class="dock-icon">🖥️</span>
          <span class="dock-label">Terminal</span>
        </button>

        <button class="dock-btn" id="dock-btn-gemma" title="Consult Gemma 4 AI Tutor [G]">
          <span class="dock-icon">🤖</span>
          <span class="dock-label">Gemma AI</span>
        </button>

        <div class="dock-divider"></div>

        <button class="dock-btn" id="dock-btn-map" title="Teleport & Quick Map">
          <span class="dock-icon">🗺️</span>
          <span class="dock-label">Waypoints</span>
        </button>

        <button class="dock-btn" id="dock-btn-cheatsheet" title="Linux & Security Cheat Sheet">
          <span class="dock-icon">📖</span>
          <span class="dock-label">Docs</span>
        </button>
      </div>
    `;

    this.taskbarEl.querySelector('#dock-btn-tasks')?.addEventListener('click', () => {
      this.activeTab = 'tasks';
      this.toggleSidebar();
    });

    this.taskbarEl.querySelector('#dock-btn-terminal')?.addEventListener('click', () => {
      if (this.onOpenTerminal) this.onOpenTerminal();
    });

    this.taskbarEl.querySelector('#dock-btn-gemma')?.addEventListener('click', () => {
      this.toggleTutor();
    });

    this.taskbarEl.querySelector('#dock-btn-map')?.addEventListener('click', () => {
      this.activeTab = 'tasks';
      this.openSidebar();
    });

    this.taskbarEl.querySelector('#dock-btn-cheatsheet')?.addEventListener('click', () => {
      this.activeTab = 'cheatsheet';
      this.openSidebar();
    });
  }

  private renderSidebar(): void {
    const student = GemmaClient.getInstance().getProfile();
    const curr = this.qm.getCurrentMission();

    this.sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-user-row">
          <div class="user-avatar-badge">${student.trackId === 'linux_core' ? '🐧' : student.trackId === 'net_recon' ? '📡' : student.trackId === 'web_sec' ? '🌐' : student.trackId === 'crypto' ? '🔐' : '🛡️'}</div>
          <div>
            <div class="user-callsign">${student.handle}</div>
            <div class="user-rank-title">${this.qm.levelTitle} &bull; Level ${this.qm.level}</div>
          </div>
          <button class="sidebar-close-btn" id="sidebar-close-btn">&times;</button>
        </div>

        <div class="sidebar-tabs">
          <button class="sidebar-tab ${this.activeTab === 'instructions' ? 'active' : ''}" data-tab="instructions">Instructions</button>
          <button class="sidebar-tab ${this.activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">Tasks (5)</button>
          <button class="sidebar-tab ${this.activeTab === 'cheatsheet' ? 'active' : ''}" data-tab="cheatsheet">Cheatsheet</button>
        </div>
      </div>

      <div class="sidebar-content">
        ${this.renderActiveTabContent(curr)}
      </div>
    `;

    this.sidebarEl.querySelector('#sidebar-close-btn')?.addEventListener('click', () => {
      this.closeSidebar();
    });

    this.sidebarEl.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.activeTab = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;
        this.renderSidebar();
      });
    });

    // Wire teleport buttons in tasks tab
    this.sidebarEl.querySelectorAll('.btn-teleport').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const x = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-x') || '0');
        const z = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-z') || '0');
        if (this.onTeleport) this.onTeleport(x, z);
        this.closeSidebar();
      });
    });
  }

  private renderActiveTabContent(curr: Mission): string {
    if (this.activeTab === 'instructions') {
      return `
        <div class="mission-brief-card">
          <div class="mission-tag-row">
            <span class="badge-number">${curr.number}</span>
            <span class="badge-status status-${curr.status.toLowerCase()}">${curr.status}</span>
          </div>
          <h2 class="mission-heading">${curr.title}</h2>
          <p class="mission-desc-text">${curr.description}</p>

          <div class="mission-station-pill">
            <span>📍 Location: <strong>${curr.stationName}</strong> [${curr.stationLocation.join(', ')}]</span>
          </div>

          <div class="checklist-section">
            <div class="section-title">OBJECTIVES CHECKLIST:</div>
            ${curr.steps.map(s => `
              <div class="checklist-item ${s.completed ? 'completed' : ''}">
                <div class="check-box">${s.completed ? '✓' : '○'}</div>
                <div class="check-text">${s.text}</div>
              </div>
            `).join('')}
          </div>

          <div class="instructions-steps-box">
            <div class="section-title">DETAILED INSTRUCTIONS:</div>
            <ol class="instructions-list">
              ${curr.instructions.map(inst => `<li>${inst}</li>`).join('')}
            </ol>
          </div>

          <div class="recommended-cmds-box">
            <div class="section-title">RECOMMENDED COMMANDS:</div>
            <div class="cmd-tags-row">
              ${curr.recommendedCommands.map(cmd => `<code class="cmd-pill">${cmd}</code>`).join('')}
            </div>
          </div>

          <div class="gemma-advice-card">
            <div class="gemma-advice-header">
              <span>🤖 GEMMA 4 TACTICAL ADVICE:</span>
            </div>
            <p class="gemma-advice-text">${curr.gemmaAdvice}</p>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'tasks') {
      return `
        <div class="tasks-list-container">
          <div class="tasks-overview-bar">
            <span>Progress: <strong>${this.qm.completedCount} of 5 Missions Completed</strong></span>
            <span>XP: <strong>${this.qm.xp} / ${this.qm.maxXp}</strong></span>
          </div>

          ${this.qm.missions.map(m => `
            <div class="task-card-item ${m.status.toLowerCase()} ${m.id === curr.id ? 'current-active' : ''}">
              <div class="task-item-top">
                <div class="task-num">${m.number} &bull; ${m.badgeIcon} ${m.badgeName}</div>
                <span class="badge-status status-${m.status.toLowerCase()}">${m.status}</span>
              </div>
              <div class="task-title-text">${m.title}</div>
              <div class="task-location-text">📍 ${m.stationName}</div>
              <div class="task-xp-pill">+${m.rewardXP} XP</div>

              <div class="task-card-actions">
                ${m.status === 'AVAILABLE' || m.status === 'IN_PROGRESS' ? `
                  <button class="btn-action-sm btn-teleport" data-x="${m.stationLocation[0]}" data-z="${m.stationLocation[1]}">
                    Navigate / Teleport
                  </button>
                ` : m.status === 'COMPLETED' ? `
                  <span style="color: #10b981; font-size: 0.8rem; font-weight: 700;">✓ Completed (+${m.rewardXP} XP)</span>
                ` : `
                  <span style="color: #64748b; font-size: 0.8rem;">🔒 Complete previous mission</span>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Cheatsheet Tab
    return `
      <div class="cheatsheet-container">
        <h3 style="color: #38bdf8; font-size: 0.95rem; margin-bottom: 0.75rem;">LINUX & SECURITY REFERENCE CHEATSHEET</h3>

        <div class="cheat-group">
          <div class="cheat-header">1. Directory & File Navigation</div>
          <div class="cheat-row"><code>pwd</code> <span>Print current working directory</span></div>
          <div class="cheat-row"><code>ls -la</code> <span>List all files including hidden dotfiles</span></div>
          <div class="cheat-row"><code>cd /path</code> <span>Change directory</span></div>
          <div class="cheat-row"><code>cat file</code> <span>Print full content of file</span></div>
        </div>

        <div class="cheat-group">
          <div class="cheat-header">2. Text Filtering & Log Analysis</div>
          <div class="cheat-row"><code>grep "pat" file</code> <span>Search lines matching pattern</span></div>
          <div class="cheat-row"><code>rm file</code> <span>Quarantine / remove file</span></div>
        </div>

        <div class="cheat-group">
          <div class="cheat-header">3. Network & Port Reconnaissance</div>
          <div class="cheat-row"><code>scan</code> <span>Enumerate open network ports & banners</span></div>
          <div class="cheat-row"><code>ping &lt;host&gt;</code> <span>Test ICMP connectivity to host</span></div>
          <div class="cheat-row"><code>netstat</code> <span>Print active listening sockets</span></div>
        </div>

        <div class="cheat-group">
          <div class="cheat-header">4. Web Security & APIs</div>
          <div class="cheat-row"><code>curl &lt;url&gt;</code> <span>Send HTTP request to API / endpoint</span></div>
        </div>

        <div class="cheat-group">
          <div class="cheat-header">5. Cryptography & Encoding</div>
          <div class="cheat-row"><code>base64 -d file</code> <span>Decode base64 encoded stream</span></div>
          <div class="cheat-row"><code>sha256sum file</code> <span>Calculate cryptographic SHA-256 hash</span></div>
        </div>

        <div class="cheat-group">
          <div class="cheat-header">6. Gemma AI Assistant</div>
          <div class="cheat-row"><code>gemma &lt;q&gt;</code> <span>Ask Gemma AI tutor directly in terminal</span></div>
        </div>
      </div>
    `;
  }

  private renderTutorModal(): void {
    const student = GemmaClient.getInstance().getProfile();
    const curr = this.qm.getCurrentMission();

    this.tutorModalEl.innerHTML = `
      <div class="tutor-dialog-card">
        <div class="tutor-dialog-header">
          <div class="tutor-bot-badge">
            <span style="font-size: 1.4rem;">🤖</span>
            <div>
              <div style="font-weight: 700; color: #fbbf24;">GEMMA 4 AI TUTOR</div>
              <div style="font-size: 0.75rem; color: #94a3b8;">Personalized for ${student.handle} &bull; ${student.trackTitle}</div>
            </div>
          </div>
          <button class="modal-close-btn" id="tutor-modal-close">&times;</button>
        </div>

        <div class="tutor-chat-screen" id="tutor-chat-screen">
          <div class="chat-msg bot">
            <strong>Gemma 4:</strong>
            <p>Hello, ${student.handle}! I am your personal cyber tutor. Ask me anything about Linux commands, network reconnaissance, cryptography, or how to accomplish "${curr.title}".</p>
          </div>
        </div>

        <div class="tutor-quick-prompts">
          <button class="quick-prompt-btn" data-query="How do I solve the current mission?">How do I solve this?</button>
          <button class="quick-prompt-btn" data-query="What command should I run?">What command next?</button>
          <button class="quick-prompt-btn" data-query="Where is the station located on the map?">Where is the station?</button>
        </div>

        <div class="tutor-dialog-input-row">
          <input type="text" id="tutor-query-input" class="cyber-input" placeholder="Ask Gemma anything about the task or commands..." />
          <button class="btn-cyber-primary" id="tutor-send-btn">Send &rarr;</button>
        </div>
      </div>
    `;

    this.tutorModalEl.querySelector('#tutor-modal-close')?.addEventListener('click', () => {
      this.toggleTutor();
    });

    const sendBtn = this.tutorModalEl.querySelector('#tutor-send-btn') as HTMLButtonElement;
    const input = this.tutorModalEl.querySelector('#tutor-query-input') as HTMLInputElement;

    const doSend = async (queryText: string) => {
      if (!queryText.trim()) return;

      const screen = this.tutorModalEl.querySelector('#tutor-chat-screen') as HTMLElement;
      screen.innerHTML += `
        <div class="chat-msg user">
          <strong>${student.handle}:</strong>
          <p>${escapeHtml(queryText)}</p>
        </div>
        <div class="chat-msg bot loading">
          <em>Gemma 4 is formulating personalized response...</em>
        </div>
      `;
      screen.scrollTop = screen.scrollHeight;
      input.value = '';

      const res = await GemmaClient.getInstance().askTutor(queryText, this.qm.getCurrentMission().title, '/home/cadet');

      const loadingMsg = screen.querySelector('.chat-msg.bot.loading');
      if (loadingMsg) loadingMsg.remove();

      screen.innerHTML += `
        <div class="chat-msg bot">
          <strong>Gemma 4:</strong>
          <p>${escapeHtml(res.answer)}</p>
          ${res.suggestedAction ? `<div class="suggested-cmd-banner">Suggested Command: <code>${res.suggestedAction}</code></div>` : ''}
        </div>
      `;
      screen.scrollTop = screen.scrollHeight;
    };

    sendBtn.addEventListener('click', () => doSend(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend(input.value);
    });

    this.tutorModalEl.querySelectorAll('.quick-prompt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const query = (e.currentTarget as HTMLElement).getAttribute('data-query') || '';
        doSend(query);
      });
    });
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
