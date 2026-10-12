import http from 'http';
import { SecureUserDataStore } from './SecureUserDataStore';
import { PersonalizationEngine } from './PersonalizationEngine';
import { StudentProfile, GemmaInteraction } from '../types';

export interface AskGemmaRequest {
  profile: StudentProfile;
  query: string;
  activeMissionTitle: string;
  currentPath: string;
}

export interface AskGemmaResponse {
  answer: string;
  source: 'ollama' | 'local-intelligence';
  suggestedAction?: string;
  accelerationFactor: number;
  targetedSkill: string;
  timestamp: string;
}

export class GemmaService {
  private static instance: GemmaService;
  private vault: SecureUserDataStore;
  private personalization: PersonalizationEngine;
  private ollamaUrl: string;
  private modelName: string;
  private timeoutMs: number;

  private constructor() {
    this.vault = SecureUserDataStore.getInstance();
    this.personalization = PersonalizationEngine.getInstance();
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.modelName = process.env.OLLAMA_MODEL || 'gemma2:2b';
    this.timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '10000', 10);
  }

  public static getInstance(): GemmaService {
    if (!this.instance) {
      this.instance = new GemmaService();
    }
    return this.instance;
  }

  /**
   * Main entry point to ask Gemma with 100%-200% hyper-personalization
   */
  public async askGemma(req: AskGemmaRequest): Promise<AskGemmaResponse> {
    const startTime = Date.now();
    const { profile, query, activeMissionTitle, currentPath } = req;

    // Build personalized context
    const context = this.personalization.buildPersonalizedContext(
      profile,
      query,
      activeMissionTitle,
      currentPath
    );

    let answer = '';
    let source: 'ollama' | 'local-intelligence' = 'local-intelligence';
    let suggestedAction: string | undefined;

    // 1. Try querying Ollama with combined system + student prompt
    try {
      const ollamaRes = await this.queryOllama(context.systemPrompt, context.augmentedUserPrompt);
      if (ollamaRes && ollamaRes.trim().length > 0) {
        answer = ollamaRes.trim();
        source = 'ollama';
      }
    } catch {
      // Ollama not running or timed out: fall back seamlessly to local intelligence
    }

    // 2. If Ollama was offline or gave empty response, use intelligent personalized cyber engine
    if (!answer) {
      const fallbackResult = this.generatePersonalizedFallback(
        profile,
        query,
        activeMissionTitle,
        currentPath,
        context.targetedSkill
      );
      answer = fallbackResult.answer;
      suggestedAction = fallbackResult.suggestedAction;
      source = 'local-intelligence';
    }

    const latencyMs = Date.now() - startTime;

    // 3. SECURE VAULT LOGGING:
    // Every single user interaction is permanently stored in the secure user vault and added to the Gemma fine-tuning corpus!
    const interaction: GemmaInteraction = {
      handle: profile.handle,
      query,
      answer,
      missionTitle: activeMissionTitle,
      cwd: currentPath,
      source,
      latencyMs,
      suggestedAction,
      contextSnapshot: {
        masteryLevel: profile.level,
        pastMistakes: [],
        accelerationFactor: context.learningVelocityMultiplier
      }
    };

    this.vault.recordInteraction(interaction);

    return {
      answer,
      source,
      suggestedAction,
      accelerationFactor: context.learningVelocityMultiplier,
      targetedSkill: context.targetedSkill,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Query Ollama HTTP API with timeout
   */
  private queryOllama(systemPrompt: string, userPrompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.ollamaUrl}/api/generate`);
      const payload = JSON.stringify({
        model: this.modelName,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false
      });

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 11434,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: this.timeoutMs
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.response || '');
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error(`Ollama returned status ${res.statusCode}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Generate pedagogical fallback tailored to student & context
   */
  private generatePersonalizedFallback(
    profile: StudentProfile,
    query: string,
    mission: string,
    cwd: string,
    targetSkill: string
  ): { answer: string; suggestedAction?: string } {
    const q = query.toLowerCase();
    const handle = profile.handle;

    if (q.includes('where') || q.includes('token') || q.includes('find') || q.includes('flag') || q.includes('locate')) {
      return {
        answer: `Cadet ${handle}, for "${mission}", check the file system hierarchy. Run 'ls -la' to see hidden dotfiles, or investigate '/var/backups/token.env' where system tokens are safeguarded!`,
        suggestedAction: 'cat /var/backups/token.env'
      };
    }

    if (q.includes('scan') || q.includes('port') || q.includes('nmap') || q.includes('network')) {
      return {
        answer: `${handle}, to survey network services for "${mission}", run 'scan' or 'netstat' in the terminal. That will reveal all active listening ports and perimeter gateways.`,
        suggestedAction: 'scan'
      };
    }

    if (q.includes('web') || q.includes('sql') || q.includes('injection') || q.includes('curl')) {
      return {
        answer: `Great tactical question, ${handle}! For web inspection, execute 'curl http://internal/api/auth' or check '/srv/web/login.php'. Test for unescaped query parameters.`,
        suggestedAction: 'curl http://internal/api/auth'
      };
    }

    if (q.includes('crypto') || q.includes('decode') || q.includes('base64') || q.includes('secret')) {
      return {
        answer: `${handle}, inspect the intercepted cipher with 'cat /etc/crypto/intercept.b64', then invoke 'base64 -d /etc/crypto/intercept.b64' to decode the secret key.`,
        suggestedAction: 'base64 -d /etc/crypto/intercept.b64'
      };
    }

    if (q.includes('log') || q.includes('shell') || q.includes('hunt') || q.includes('grep')) {
      return {
        answer: `In threat hunting mode, ${handle}: analyze web logs via 'grep "eval" /var/log/access.log' or inspect '/var/www/uploads/.stealth.php' for remote command execution strings.`,
        suggestedAction: 'grep "eval" /var/log/access.log'
      };
    }

    if (q.includes('help') || q.includes('command') || q.includes('how')) {
      return {
        answer: `Current station: ${cwd}, Cadet ${handle}. Core terminal commands at your disposal: 'ls' (list files), 'cd <path>' (traverse directories), 'cat <file>' (read contents), and 'scan' (network recon).`,
        suggestedAction: 'ls -la'
      };
    }

    return {
      answer: `Standing by with you, Cadet ${handle}! For your current objective "${mission}", check your tasks in Mission Control [M] or step up to the cyber terminals across the Academy.`
    };
  }
}
