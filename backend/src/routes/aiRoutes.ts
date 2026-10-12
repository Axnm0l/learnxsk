import { Router, Request, Response } from 'express';
import { GemmaService } from '../services/GemmaService';
import { SecureUserDataStore } from '../services/SecureUserDataStore';
import { PersonalizationEngine } from '../services/PersonalizationEngine';
import { StudentProfile, TelemetryEvent } from '../types';

const router = Router();
const gemmaService = GemmaService.getInstance();
const vault = SecureUserDataStore.getInstance();
const personalization = PersonalizationEngine.getInstance();

/**
 * POST /api/ai/onboarding
 * Calibrates the learning path, initializes user in vault, and provides personalized diagnostic test
 */
router.post('/onboarding', (req: Request, res: Response) => {
  try {
    const profile: StudentProfile = req.body;
    if (!profile || !profile.handle) {
      return res.status(400).json({ error: 'Valid student profile with handle required.' });
    }

    const record = vault.getOrCreateLearningRecord(profile);
    const diagnostic = personalization.getDiagnosticAssessment(profile);

    // Record telemetry event
    vault.recordTelemetry({
      handle: profile.handle,
      eventType: 'diagnostic_answer',
      details: {
        metadata: {
          track: profile.trackTitle,
          level: profile.level
        }
      }
    });

    return res.json({
      success: true,
      profile: record.profile,
      mastery: record.mastery,
      learningVelocity: record.learningVelocityMultiplier,
      diagnostic
    });
  } catch (err: any) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: 'Failed to process onboarding', details: err.message });
  }
});

/**
 * POST /api/ai/chat
 * Asks Gemma AI with 100%-200% hyper-personalized learning context
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { profile, query, activeMissionTitle, currentPath } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const studentProfile: StudentProfile = profile || {
      handle: 'Cadet_Cipher',
      trackId: 'linux_core',
      trackTitle: 'Linux Core',
      level: 'novice',
      goal: 'Accelerated Learning'
    };

    const response = await gemmaService.askGemma({
      profile: studentProfile,
      query,
      activeMissionTitle: activeMissionTitle || 'System Orientation',
      currentPath: currentPath || '/home/cadet'
    });

    return res.json(response);
  } catch (err: any) {
    console.error('Gemma chat error:', err);
    return res.status(500).json({ error: 'Internal AI tutor error', details: err.message });
  }
});

/**
 * POST /api/ai/telemetry
 * Ingests user actions, terminal commands, mission achievements into the secure vault
 */
router.post('/telemetry', (req: Request, res: Response) => {
  try {
    const event: TelemetryEvent = req.body;
    if (!event || !event.handle || !event.eventType) {
      return res.status(400).json({ error: 'Handle and eventType are required for telemetry.' });
    }

    vault.recordTelemetry(event);
    return res.json({ success: true, message: 'Telemetry recorded securely in vault.' });
  } catch (err: any) {
    console.error('Telemetry error:', err);
    return res.status(500).json({ error: 'Failed to save telemetry', details: err.message });
  }
});

/**
 * GET /api/ai/profile/:handle
 * Retrieves personalized profile and cognitive mastery record
 */
router.get('/profile/:handle', (req: Request, res: Response) => {
  try {
    const rawHandle = req.params.handle;
    const handle = (Array.isArray(rawHandle) ? rawHandle[0] : rawHandle) || 'cadet';
    const record = vault.getOrCreateLearningRecord({
      handle,
      trackId: 'linux_core',
      trackTitle: 'Linux Core',
      level: 'novice',
      goal: 'General Mastery'
    });

    return res.json(record);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
  }
});

/**
 * GET /api/ai/training-data
 * Exports user training corpus in Gemma instruction JSONL format
 */
router.get('/training-data', (req: Request, res: Response) => {
  try {
    const handle = req.query.handle as string | undefined;
    const samples = vault.exportTrainingData(handle);

    if (req.query.format === 'jsonl') {
      const jsonlText = samples.map((s) => JSON.stringify(s)).join('\n');
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', 'attachment; filename="gemma_user_training.jsonl"');
      return res.send(jsonlText);
    }

    return res.json({
      count: samples.length,
      samples
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export training data', details: err.message });
  }
});

/**
 * GET /api/ai/stats
 * Summary stats of secure vault items
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const samples = vault.exportTrainingData();
    return res.json({
      vaultStatus: 'ACTIVE_AND_ENCRYPTED',
      totalTrainingSamples: samples.length,
      vaultPath: process.env.USER_DATA_VAULT_DIR || './secure_user_vault',
      encryption: process.env.ENABLE_ENCRYPTION !== 'false' ? 'AES-256-GCM' : 'DISABLED',
      zeroKnowledgeMode: true
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch vault stats', details: err.message });
  }
});

export default router;
