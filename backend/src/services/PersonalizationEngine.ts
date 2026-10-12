import { SecureUserDataStore } from './SecureUserDataStore';
import { StudentProfile, UserLearningRecord } from '../types';

export interface PersonalizedPromptContext {
  systemPrompt: string;
  augmentedUserPrompt: string;
  learningVelocityMultiplier: number;
  targetedSkill: string;
  reinforcementNote?: string;
}

export class PersonalizationEngine {
  private static instance: PersonalizationEngine;
  private vault: SecureUserDataStore;

  private constructor() {
    this.vault = SecureUserDataStore.getInstance();
  }

  public static getInstance(): PersonalizationEngine {
    if (!this.instance) {
      this.instance = new PersonalizationEngine();
    }
    return this.instance;
  }

  /**
   * Generates a hyper-personalized prompt context designed to accelerate learning by 100%-200%
   */
  public buildPersonalizedContext(
    profile: StudentProfile,
    query: string,
    activeMissionTitle: string,
    currentPath: string
  ): PersonalizedPromptContext {
    const record = this.vault.getOrCreateLearningRecord(profile);

    // Identify weak and strong domains
    const mastery = record.mastery;
    const weakestDomain = this.getWeakestDomain(mastery);
    const strongestDomain = this.getStrongestDomain(mastery);

    // Learning velocity multiplier (1.0x baseline up to 2.5x accelerated)
    const velocityFactor = record.learningVelocityMultiplier;
    const boostPercent = Math.round((velocityFactor - 1.0) * 100);

    // Analyze frequent mistakes or struggle points
    const pastMistakesSummary = record.frequentMistakes.length > 0
      ? record.frequentMistakes.slice(-3).join(', ')
      : 'None detected yet';

    // Tailored pedagogical directive
    let pedagogicalStyle = '';
    if (profile.level === 'novice') {
      pedagogicalStyle = 'Explain with crystal-clear intuition and relatable terminal analogies. Do not dump raw syntax without breaking down flags.';
    } else if (profile.level === 'intermediate') {
      pedagogicalStyle = 'Give concise tactical guidance, pointing out potential edge cases and security best practices.';
    } else {
      pedagogicalStyle = 'Provide advanced architectural insight, kernel/network layer implications, and deep exploitation defenses.';
    }

    const systemPrompt = `[ROLE: GEMMA 4 HYPER-PERSONALIZED CYBER MENTOR]
You are Gemma, the embedded AI instructor inside LearnXSK 3D Blocklands Cyber Academy.
You are tutoring cadet "${profile.handle}".
Student Persona:
- Track: ${profile.trackTitle} (${profile.level.toUpperCase()})
- Goal: "${profile.goal}"
- Skill Mastery Vector: Linux Core: ${mastery.linuxCore}%, Net Recon: ${mastery.networkRecon}%, Web Sec: ${mastery.webSecurity}%, Crypto: ${mastery.cryptography}%, Threat Hunt: ${mastery.threatHunting}%
- Strongest Subject: ${strongestDomain} | Priority Growth Area: ${weakestDomain}
- Recent Struggle Points / Mistakes: [${pastMistakesSummary}]
- Acceleration Factor: ${velocityFactor}x (+${boostPercent}% cognitive learning rate boost)

INSTRUCTIONAL MANDATES:
1. Address "${profile.handle}" naturally and with encouraging high-tech cyber mentorship.
2. Tailor every hint specifically to their mission "${activeMissionTitle}" and directory "${currentPath}".
3. ${pedagogicalStyle}
4. Apply Socratic active-recall: give them the mental key to execute the solution themselves rather than simply giving away the flag.
5. Keep answers punchy, educational, and inspiring (max 2-3 concise sentences).`;

    const augmentedUserPrompt = `[Cadet Context]
Mission: ${activeMissionTitle}
Directory: ${currentPath}
Questions asked so far: ${record.totalQuestionsAsked}
Recent mistakes: ${pastMistakesSummary}

Cadet Query:
"${query}"`;

    let reinforcementNote: string | undefined;
    if (record.frequentMistakes.length > 0) {
      reinforcementNote = `Tip for ${profile.handle}: Pay extra attention to command flags and file paths.`;
    }

    return {
      systemPrompt,
      augmentedUserPrompt,
      learningVelocityMultiplier: velocityFactor,
      targetedSkill: weakestDomain,
      reinforcementNote
    };
  }

  /**
   * Diagnostic assessment question tailored to track & difficulty
   */
  public getDiagnosticAssessment(profile: StudentProfile): {
    greeting: string;
    diagnosticQuestion: string;
    options: string[];
    correctIdx: number;
    explanation: string;
  } {
    const record = this.vault.getOrCreateLearningRecord(profile);

    const questions: Record<string, { question: string; options: string[]; correctIdx: number; explanation: string }> = {
      linux_core: {
        question: `Cadet ${profile.handle}, in Linux terminal navigation, which command displays hidden configuration dotfiles (such as .env and .bashrc) alongside permissions?`,
        options: ['ls -la', 'dir /a:h', 'cat .hidden', 'show-files --all'],
        correctIdx: 0,
        explanation: '`ls -la` lists all entries including dotfiles (-a) in long format with permissions (-l).'
      },
      net_recon: {
        question: `Cadet ${profile.handle}, what core protocol does the 'ping' command use to verify network host reachability?`,
        options: ['ICMP (Internet Control Message Protocol)', 'BGP (Border Gateway Protocol)', 'SNMP (Simple Network Management Protocol)', 'IGMP (Internet Group Management Protocol)'],
        correctIdx: 0,
        explanation: '`ping` sends ICMP Echo Request packets and listens for ICMP Echo Reply packets.'
      },
      web_sec: {
        question: `Cadet ${profile.handle}, in SQL Injection vulnerability assessments, what is the primary cause of authentication bypass?`,
        options: ['Unsanitized string concatenation in SQL queries', 'Using HTTPS instead of HTTP', 'Lack of CSS minification', 'Storing passwords in salted hashes'],
        correctIdx: 0,
        explanation: 'SQL injection occurs when untrusted user input is directly concatenated into SQL query strings.'
      },
      crypto: {
        question: `Cadet ${profile.handle}, what is the fundamental distinction between Base64 and AES encryption?`,
        options: ['Base64 is reversible encoding without keys; AES requires secret cryptographic keys', 'Base64 is quantum-proof; AES is not', 'AES is one-way hashing; Base64 is two-way', 'Base64 encrypts binaries; AES only encrypts plain text'],
        correctIdx: 0,
        explanation: 'Base64 is an encoding scheme for ASCII representation, whereas AES is a symmetric cipher requiring a key.'
      },
      threat_hunt: {
        question: `Cadet ${profile.handle}, when investigating compromised Linux server logs, which command pattern searches for malicious webshell execution?`,
        options: ['grep -rn "eval($_POST" /var/www/', 'find / -name "*.txt"', 'ps aux | grep chrome', 'netstat -tuln | grep 80'],
        correctIdx: 0,
        explanation: 'Searching for `eval($_POST` detects obfuscated PHP webshell backdoors on compromised hosts.'
      }
    };

    const target = questions[profile.trackId] || questions['linux_core'];
    const greeting = `Greetings, Cadet ${profile.handle}. I am Gemma, your personalized AI mentor. I have loaded your ${profile.level.toUpperCase()} training parameters for "${profile.trackTitle}". Accelerating your cognitive mastery baseline by up to 200%!`;

    return {
      greeting,
      diagnosticQuestion: target.question,
      options: target.options,
      correctIdx: target.correctIdx,
      explanation: target.explanation
    };
  }

  private getWeakestDomain(m: UserLearningRecord['mastery']): string {
    const entries = [
      { domain: 'Linux Core', val: m.linuxCore },
      { domain: 'Network Recon', val: m.networkRecon },
      { domain: 'Web Security', val: m.webSecurity },
      { domain: 'Cryptography', val: m.cryptography },
      { domain: 'Threat Hunting', val: m.threatHunting }
    ];
    entries.sort((a, b) => a.val - b.val);
    return entries[0].domain;
  }

  private getStrongestDomain(m: UserLearningRecord['mastery']): string {
    const entries = [
      { domain: 'Linux Core', val: m.linuxCore },
      { domain: 'Network Recon', val: m.networkRecon },
      { domain: 'Web Security', val: m.webSecurity },
      { domain: 'Cryptography', val: m.cryptography },
      { domain: 'Threat Hunting', val: m.threatHunting }
    ];
    entries.sort((a, b) => b.val - a.val);
    return entries[0].domain;
  }
}
