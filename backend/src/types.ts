/**
 * Type definitions for LearnXSK AI Backend & Personalization Engine
 */

export interface StudentProfile {
  handle: string;
  trackId: string;
  trackTitle: string;
  level: 'novice' | 'intermediate' | 'advanced';
  goal: string;
  createdAt?: string;
  lastActive?: string;
}

export interface SkillDomainMastery {
  linuxCore: number;      // 0 - 100%
  networkRecon: number;   // 0 - 100%
  webSecurity: number;    // 0 - 100%
  cryptography: number;   // 0 - 100%
  threatHunting: number;  // 0 - 100%
}

export interface UserLearningRecord {
  profile: StudentProfile;
  mastery: SkillDomainMastery;
  completedMissions: string[];
  failedAttempts: Record<string, number>;
  frequentMistakes: string[];
  commandHistoryCount: number;
  learningVelocityMultiplier: number; // e.g. 1.0 -> 2.0x acceleration
  totalQuestionsAsked: number;
  sessionCount: number;
}

export interface TelemetryEvent {
  handle: string;
  eventType: 'command_exec' | 'mission_start' | 'mission_complete' | 'diagnostic_answer' | 'npc_interact' | 'help_requested';
  details: {
    command?: string;
    output?: string;
    isSuccess?: boolean;
    missionId?: string;
    missionTitle?: string;
    diagnosticScore?: number;
    errorType?: string;
    cwd?: string;
    metadata?: Record<string, any>;
  };
  timestamp?: string;
}

export interface GemmaInteraction {
  id?: string;
  handle: string;
  timestamp?: string;
  query: string;
  answer: string;
  missionTitle: string;
  cwd: string;
  source: 'ollama' | 'local-intelligence';
  latencyMs?: number;
  confidence?: number;
  suggestedAction?: string;
  contextSnapshot?: {
    masteryLevel: string;
    pastMistakes: string[];
    accelerationFactor: number;
  };
}

export interface GemmaTrainingSample {
  instruction: string;
  input: string;
  output: string;
  source: string;
  category: string;
  studentHandle: string;
  timestamp: string;
}
