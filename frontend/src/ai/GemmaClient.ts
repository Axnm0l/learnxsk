/**
 * LearnXSK Gemma AI Client
 * Connects to LearnXSK AI Backend (http://localhost:3001) with fallback to local Ollama and on-device cyber intelligence.
 * Provides hyper-personalized answers, telemetry ingestion, and training corpus logging.
 */

export interface StudentProfile {
  handle: string;
  trackId: string;
  trackTitle: string;
  level: string; // 'novice' | 'intermediate' | 'advanced'
  goal: string;
}

export interface TutorResponse {
  answer: string;
  source: 'ollama' | 'local-intelligence' | 'backend-vault';
  confidence?: number;
  suggestedAction?: string;
  accelerationFactor?: number;
}

export class GemmaClient {
  private static instance: GemmaClient;
  private backendUrl: string = typeof window !== 'undefined' && window.location.port !== '5173'
    ? `${window.location.origin}/api/ai`
    : 'http://localhost:3001/api/ai';
  private ollamaUrl: string = 'http://localhost:11434/api/generate';
  private modelName: string = 'gemma2:2b';
  private studentProfile: StudentProfile = {
    handle: 'Cadet_Cipher',
    trackId: 'linux_core',
    trackTitle: 'Linux & Terminal Mastery',
    level: 'novice',
    goal: 'Master terminal security and command line navigation'
  };

  public static getInstance(): GemmaClient {
    if (!this.instance) {
      this.instance = new GemmaClient();
    }
    return this.instance;
  }

  public setProfile(profile: StudentProfile): void {
    this.studentProfile = { ...profile };
    // Asynchronously notify backend to initialize user in secure vault
    this.syncProfileToBackend(profile).catch(() => {});
  }

  public getProfile(): StudentProfile {
    return this.studentProfile;
  }

  /**
   * Syncs profile to backend secure vault
   */
  private async syncProfileToBackend(profile: StudentProfile): Promise<void> {
    try {
      await fetch(`${this.backendUrl}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch {
      // Backend offline, quiet fallback
    }
  }

  /**
   * Sends telemetry to backend secure vault
   */
  public async logTelemetry(eventType: string, details: Record<string, any>): Promise<void> {
    try {
      await fetch(`${this.backendUrl}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: this.studentProfile.handle,
          eventType,
          details
        })
      });
    } catch {
      // Offline fallback
    }
  }

  /**
   * Generates a personalized onboarding greeting and diagnostic question
   */
  public async generateOnboardingAnalysis(profile: StudentProfile): Promise<{ greeting: string; diagnosticQuestion: string; options: string[]; correctIdx: number }> {
    this.setProfile(profile);

    // Try backend onboarding diagnostic first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${this.backendUrl}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.diagnostic) {
          return {
            greeting: data.diagnostic.greeting,
            diagnosticQuestion: data.diagnostic.diagnosticQuestion,
            options: data.diagnostic.options,
            correctIdx: data.diagnostic.correctIdx
          };
        }
      }
    } catch {
      // Backend offline: use built-in diagnostics
    }

    const diagnosticsByTrack: Record<string, { question: string; options: string[]; correctIdx: number }> = {
      linux_core: {
        question: `Welcome ${profile.handle}! Quick diagnostic check: Which command displays hidden dotfiles (.bashrc, .env) in long listing format?`,
        options: ['ls -la', 'dir /all', 'cat .files', 'show -hidden'],
        correctIdx: 0
      },
      net_recon: {
        question: `Welcome ${profile.handle}! Quick network check: What utility sends ICMP Echo Request packets to test remote host reachability?`,
        options: ['ping', 'curl', 'route', 'traceroute'],
        correctIdx: 0
      },
      web_sec: {
        question: `Welcome ${profile.handle}! Quick web check: In SQL Injection testing, what input payload sequence is commonly used to bypass boolean authentication checks?`,
        options: ["' OR '1'='1", '<script>alert(1)</script>', '../../etc/passwd', 'DROP DATABASE *'],
        correctIdx: 0
      },
      crypto: {
        question: `Welcome ${profile.handle}! Quick crypto check: Base64 encoding transforms binary data into ASCII characters. Is Base64 an encryption algorithm or an encoding scheme?`,
        options: ['Encoding scheme (reversible without key)', 'Military-grade asymmetric cipher', 'One-way cryptographic hash', 'Digital signature algorithm'],
        correctIdx: 0
      },
      threat_hunt: {
        question: `Welcome ${profile.handle}! Quick forensics check: When hunting suspicious PHP webshells inside web logs, which pattern indicates remote code execution?`,
        options: ['eval($_POST[...])', 'echo "Hello World"', 'session_start()', 'header("Location: ...")'],
        correctIdx: 0
      }
    };

    const diag = diagnosticsByTrack[profile.trackId] || diagnosticsByTrack['linux_core'];
    const greeting = `Greetings, ${profile.handle}. I am Gemma, your personal AI mentor inside the Blocklands Cyber Academy. I have analyzed your ${profile.level.toUpperCase()} profile and calibrated our virtual simulation for: "${profile.trackTitle}". Let's begin your field training!`;

    return {
      greeting,
      diagnosticQuestion: diag.question,
      options: diag.options,
      correctIdx: diag.correctIdx
    };
  }

  /**
   * Ask Gemma a personalized question or request hints for the active task
   */
  public async askTutor(query: string, activeMissionTitle: string, currentPath: string): Promise<TutorResponse> {
    // 1. Try Backend API first (provides 100%-200% hyper-personalization + secure vault logging)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.backendUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: this.studentProfile,
          query,
          activeMissionTitle,
          currentPath
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          return {
            answer: data.answer,
            source: data.source === 'ollama' ? 'ollama' : 'backend-vault',
            suggestedAction: data.suggestedAction,
            accelerationFactor: data.accelerationFactor
          };
        }
      }
    } catch {
      // Backend not running, proceed to direct Ollama fallback
    }

    // 2. Direct Ollama fallback if backend is offline
    const prompt = `Student: ${this.studentProfile.handle} (${this.studentProfile.level} in ${this.studentProfile.trackTitle}).
Active Mission: ${activeMissionTitle}
Current Working Directory: ${currentPath}
Student Question: ${query}
Please give a friendly, concise, educational answer (2-3 sentences max) tailored specifically to this student.`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600);

      const res = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          return {
            answer: data.response.trim(),
            source: 'ollama'
          };
        }
      }
    } catch {
      // Ollama offline / training in background: seamlessly use intelligent fallback engine
    }

    // 3. Built-in intelligent cyber intelligence fallback
    return this.getIntelligentFallback(query, activeMissionTitle, currentPath);
  }

  private getIntelligentFallback(query: string, mission: string, currentPath: string): TutorResponse {
    const q = query.toLowerCase();
    const handle = this.studentProfile.handle;

    if (q.includes('where') || q.includes('token') || q.includes('find') || q.includes('locate') || q.includes('flag')) {
      return {
        answer: `Hey ${handle}! For "${mission}", inspect the filesystem structure. Start by using 'ls' to see what is here, or 'cat /var/backups/token.env' where system keys are backed up!`,
        source: 'local-intelligence',
        suggestedAction: 'cat /var/backups/token.env'
      };
    }

    if (q.includes('scan') || q.includes('port') || q.includes('network') || q.includes('nmap')) {
      return {
        answer: `${handle}, you can run 'scan' or 'netstat' in the terminal to inspect active network ports on the local network router and find open services!`,
        source: 'local-intelligence',
        suggestedAction: 'scan'
      };
    }

    if (q.includes('web') || q.includes('sql') || q.includes('injection') || q.includes('curl')) {
      return {
        answer: `Great question, ${handle}! Use 'curl http://internal/api/auth' to test the authentication gateway, and inspect '/srv/web/login.php' to identify input parameters.`,
        source: 'local-intelligence',
        suggestedAction: 'curl http://internal/api/auth'
      };
    }

    if (q.includes('crypto') || q.includes('decode') || q.includes('base64') || q.includes('hash')) {
      return {
        answer: `In cryptography mode, inspect the intercepted secret with 'cat /etc/crypto/intercept.b64', then run 'base64 -d /etc/crypto/intercept.b64' to reveal the plaintext flag!`,
        source: 'local-intelligence',
        suggestedAction: 'base64 -d /etc/crypto/intercept.b64'
      };
    }

    if (q.includes('log') || q.includes('shell') || q.includes('incident') || q.includes('grep')) {
      return {
        answer: `${handle}, use 'grep "eval" /var/log/access.log' or inspect '/var/www/uploads/.stealth.php' to locate the hidden backdoor payload!`,
        source: 'local-intelligence',
        suggestedAction: 'grep "eval" /var/log/access.log'
      };
    }

    if (q.includes('help') || q.includes('command') || q.includes('how')) {
      return {
        answer: `You're currently in ${currentPath}, ${handle}. Essential commands: 'ls' (list files), 'cd <dir>' (change directory), 'cat <file>' (read file), 'grep <str> <file>' (search text), and 'scan' (network recon).`,
        source: 'local-intelligence'
      };
    }

    return {
      answer: `Keep going, ${handle}! For your objective in "${mission}", check your active tasks in the Mission Control sidebar [M], use the terminal commands, or walk over to the interactable stations.`,
      source: 'local-intelligence'
    };
  }
}
