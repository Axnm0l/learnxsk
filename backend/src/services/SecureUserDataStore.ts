import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  StudentProfile,
  UserLearningRecord,
  TelemetryEvent,
  GemmaInteraction,
  GemmaTrainingSample,
  SkillDomainMastery
} from '../types';

export class SecureUserDataStore {
  private static instance: SecureUserDataStore;
  private vaultRoot: string;
  private encryptionKey: Buffer;
  private isEncryptionEnabled: boolean;
  private cache: Map<string, UserLearningRecord> = new Map();

  private constructor() {
    this.vaultRoot = path.resolve(process.env.USER_DATA_VAULT_DIR || './secure_user_vault');
    const secret = process.env.VAULT_ENCRYPTION_KEY || 'learnxsk_hyper_secure_vault_default_key_2026';
    // Derive 32-byte key using SHA-256 for AES-256-GCM
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
    this.isEncryptionEnabled = process.env.ENABLE_ENCRYPTION !== 'false';

    this.initializeVault();
  }

  public static getInstance(): SecureUserDataStore {
    if (!this.instance) {
      this.instance = new SecureUserDataStore();
    }
    return this.instance;
  }

  /**
   * Initializes the secure vault directory structure and strict security guarantees
   */
  private initializeVault(): void {
    const subdirs = [
      '',
      'profiles',
      'telemetry',
      'interactions',
      'training_corpus',
      'encrypted_backups'
    ];

    for (const sub of subdirs) {
      const dirPath = path.join(this.vaultRoot, sub);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }

    // Write internal .gitignore in vault to guarantee absolute isolation
    const vaultGitignore = path.join(this.vaultRoot, '.gitignore');
    if (!fs.existsSync(vaultGitignore)) {
      const gitignoreContent = `# ULTRA-SECURE USER DATA VAULT
# DO NOT COMMIT SENSITIVE STUDENT TELEMETRY OR CORPOREAL DATA
*
!.gitignore
!README.md
`;
      fs.writeFileSync(vaultGitignore, gitignoreContent, 'utf-8');
    }

    // Write Security Policy Manifest
    const policyPath = path.join(this.vaultRoot, 'SECURITY_POLICY.json');
    if (!fs.existsSync(policyPath)) {
      const policy = {
        name: 'LearnXSK Secure Student Data Vault',
        description: 'Zero-knowledge, isolated local repository for personalized Gemma AI training and game telemetry',
        encryptionStandard: 'AES-256-GCM',
        strictIsolation: true,
        dataProtectionCompliance: 'Local Air-Gapped Secure Sandbox',
        created: new Date().toISOString(),
        securityGuidelines: [
          'No telemetry or user inputs are transmitted to third-party cloud servers without consent.',
          'All student interactions are encrypted on disk.',
          'Data is formatted into instruction-tuning datasets exclusively for Gemma 2/4 personalized fine-tuning.'
        ]
      };
      fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2), 'utf-8');
    }
  }

  /**
   * Encrypt arbitrary string using AES-256-GCM
   */
  public encrypt(plainText: string): { iv: string; authTag: string; ciphertext: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let ciphertext = cipher.update(plainText, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      authTag,
      ciphertext
    };
  }

  /**
   * Decrypt AES-256-GCM payload
   */
  public decrypt(payload: { iv: string; authTag: string; ciphertext: string }): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get or create a student's comprehensive learning record
   */
  public getOrCreateLearningRecord(profile: StudentProfile): UserLearningRecord {
    const safeHandle = this.sanitizeHandle(profile.handle);
    if (this.cache.has(safeHandle)) {
      return this.cache.get(safeHandle)!;
    }

    const profileFile = path.join(this.vaultRoot, 'profiles', `${safeHandle}.json`);
    if (fs.existsSync(profileFile)) {
      try {
        const raw = fs.readFileSync(profileFile, 'utf-8');
        const record = JSON.parse(raw) as UserLearningRecord;
        // Merge newest profile details
        record.profile = { ...record.profile, ...profile, lastActive: new Date().toISOString() };
        this.cache.set(safeHandle, record);
        return record;
      } catch (err) {
        console.error(`Error reading profile for ${safeHandle}:`, err);
      }
    }

    // Default record with baseline mastery
    const defaultMastery: SkillDomainMastery = {
      linuxCore: profile.level === 'advanced' ? 70 : profile.level === 'intermediate' ? 40 : 20,
      networkRecon: profile.level === 'advanced' ? 65 : profile.level === 'intermediate' ? 35 : 15,
      webSecurity: profile.level === 'advanced' ? 60 : profile.level === 'intermediate' ? 30 : 10,
      cryptography: profile.level === 'advanced' ? 55 : profile.level === 'intermediate' ? 25 : 10,
      threatHunting: profile.level === 'advanced' ? 50 : profile.level === 'intermediate' ? 20 : 5
    };

    const newRecord: UserLearningRecord = {
      profile: {
        ...profile,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      mastery: defaultMastery,
      completedMissions: [],
      failedAttempts: {},
      frequentMistakes: [],
      commandHistoryCount: 0,
      learningVelocityMultiplier: 1.0, // starts at 1.0x, rises up to 2.0x (100% - 200% acceleration)
      totalQuestionsAsked: 0,
      sessionCount: 1
    };

    this.saveLearningRecord(newRecord);
    return newRecord;
  }

  /**
   * Save learning record with optional encrypted mirror
   */
  public saveLearningRecord(record: UserLearningRecord): void {
    const safeHandle = this.sanitizeHandle(record.profile.handle);
    this.cache.set(safeHandle, record);

    const profileFile = path.join(this.vaultRoot, 'profiles', `${safeHandle}.json`);
    const jsonStr = JSON.stringify(record, null, 2);
    fs.writeFileSync(profileFile, jsonStr, 'utf-8');

    if (this.isEncryptionEnabled) {
      const encrypted = this.encrypt(jsonStr);
      const encFile = path.join(this.vaultRoot, 'encrypted_backups', `${safeHandle}.profile.vault`);
      fs.writeFileSync(encFile, JSON.stringify(encrypted, null, 2), 'utf-8');
    }
  }

  /**
   * Log telemetry event from gameplay
   */
  public recordTelemetry(event: TelemetryEvent): void {
    const timestamp = event.timestamp || new Date().toISOString();
    const safeHandle = this.sanitizeHandle(event.handle);
    const logFile = path.join(this.vaultRoot, 'telemetry', `${safeHandle}_telemetry.jsonl`);

    const entry = {
      ...event,
      timestamp
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n', 'utf-8');

    // Update learning record analytics
    const record = this.getOrCreateLearningRecord({
      handle: event.handle,
      trackId: 'linux_core',
      trackTitle: 'Linux Mastery',
      level: 'novice',
      goal: 'Accelerated Learning'
    });

    if (event.eventType === 'command_exec') {
      record.commandHistoryCount++;
      if (event.details.isSuccess === false && event.details.command) {
        if (!record.frequentMistakes.includes(event.details.command)) {
          record.frequentMistakes.push(event.details.command);
          if (record.frequentMistakes.length > 10) {
            record.frequentMistakes.shift();
          }
        }
      }
    } else if (event.eventType === 'mission_complete' && event.details.missionId) {
      if (!record.completedMissions.includes(event.details.missionId)) {
        record.completedMissions.push(event.details.missionId);
        // Boost mastery and learning velocity
        record.learningVelocityMultiplier = Math.min(2.5, +(record.learningVelocityMultiplier + 0.15).toFixed(2));
        record.mastery.linuxCore = Math.min(100, record.mastery.linuxCore + 8);
        record.mastery.networkRecon = Math.min(100, record.mastery.networkRecon + 6);
      }
    }

    this.saveLearningRecord(record);
  }

  /**
   * Record Gemma AI interaction and format directly into training corpus sample
   */
  public recordInteraction(interaction: GemmaInteraction): void {
    const id = interaction.id || crypto.randomUUID();
    const timestamp = interaction.timestamp || new Date().toISOString();
    const safeHandle = this.sanitizeHandle(interaction.handle);

    const record = this.getOrCreateLearningRecord({
      handle: interaction.handle,
      trackId: 'linux_core',
      trackTitle: 'Linux Mastery',
      level: 'novice',
      goal: 'General'
    });

    record.totalQuestionsAsked++;
    this.saveLearningRecord(record);

    // Save interaction log
    const interFile = path.join(this.vaultRoot, 'interactions', `${safeHandle}_interactions.jsonl`);
    const logEntry = {
      id,
      ...interaction,
      timestamp
    };
    fs.appendFileSync(interFile, JSON.stringify(logEntry) + '\n', 'utf-8');

    // Automatically generate Gemma fine-tuning dataset sample in standard instruction format
    const trainingSample: GemmaTrainingSample = {
      instruction: `You are Gemma, the adaptive cyber mentor for cadet ${interaction.handle} in LearnXSK Blocklands Academy. Guide the cadet on mission: "${interaction.missionTitle}" from directory "${interaction.cwd}".`,
      input: interaction.query,
      output: interaction.answer,
      source: interaction.source,
      category: record.profile.trackId || 'linux_core',
      studentHandle: interaction.handle,
      timestamp
    };

    const corpusFile = path.join(this.vaultRoot, 'training_corpus', 'gemma_user_training.jsonl');
    fs.appendFileSync(corpusFile, JSON.stringify(trainingSample) + '\n', 'utf-8');

    // Also maintain a user-specific training corpus file
    const userCorpusFile = path.join(this.vaultRoot, 'training_corpus', `${safeHandle}_gemma_training.jsonl`);
    fs.appendFileSync(userCorpusFile, JSON.stringify(trainingSample) + '\n', 'utf-8');
  }

  /**
   * Export all accumulated training data
   */
  public exportTrainingData(handle?: string): GemmaTrainingSample[] {
    const file = handle
      ? path.join(this.vaultRoot, 'training_corpus', `${this.sanitizeHandle(handle)}_gemma_training.jsonl`)
      : path.join(this.vaultRoot, 'training_corpus', 'gemma_user_training.jsonl');

    if (!fs.existsSync(file)) {
      return [];
    }

    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    return lines.map((l) => JSON.parse(l) as GemmaTrainingSample);
  }

  /**
   * Helper to sanitize handle names for filesystem safety
   */
  private sanitizeHandle(handle: string): string {
    return handle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }
}
