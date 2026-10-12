import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import aiRoutes from './routes/aiRoutes';
import { SecureUserDataStore } from './services/SecureUserDataStore';
import { getEmbeddedAsset } from './embeddedAssets';

// Load environment variables from .env
dotenv.config();

// Parse CLI port arguments like --port 3001
const args = process.argv.slice(2);
let customPort: number | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    customPort = parseInt(args[i + 1], 10);
  }
}

const app = express();
const PORT = customPort || parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Initialize Secure User Data Vault
const vault = SecureUserDataStore.getInstance();

// Middleware
app.use(cors({
  origin: [CORS_ORIGIN, `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'LearnXSK Cyber AI Backend',
    vaultStatus: 'SECURE_VAULT_ACTIVE',
    ollamaModel: process.env.OLLAMA_MODEL || 'gemma2:2b',
    timestamp: new Date().toISOString()
  });
});

// Static assets: Check disk first, fall back to embedded assets
const diskDist = path.resolve(__dirname, '../../frontend/dist');
const hasDiskDist = fs.existsSync(diskDist);

if (hasDiskDist) {
  app.use(express.static(diskDist));
}

// Embedded assets handler for standalone .exe execution
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  // Attempt to serve from embedded bundle
  const asset = getEmbeddedAsset(req.path);
  if (asset) {
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(asset.buffer);
  }

  // Fall back to index.html for SPA routes
  const rootHtml = getEmbeddedAsset('/');
  if (rootHtml) {
    res.setHeader('Content-Type', rootHtml.contentType);
    return res.send(rootHtml.buffer);
  }

  if (hasDiskDist) {
    return res.sendFile(path.join(diskDist, 'index.html'));
  }

  next();
});

// Start listening
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║    🛡️ LEARNXSK: THE CYBER BLOCKLANDS (ALL-IN-ONE) 🎮     ║`);
  console.log(`║  Powered by Google Gemma AI // Voxel Cyber Academy       ║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
  console.log(`🚀 Game running at: ${url}`);
  console.log(`🔒 Secure User Data Vault: ACTIVE & ENCRYPTED (AES-256-GCM)`);
  console.log(`🧠 Hyper-Personalization Engine: PRIMED for Gemma 2 / 4`);
  console.log(`🌐 Launching in default web browser... (Press Ctrl+C to quit)\n`);

  // Auto-launch web browser on Windows/macOS/Linux
  if (process.env.NO_AUTO_OPEN !== 'true') {
    const startCmd = process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

    setTimeout(() => {
      exec(startCmd, (err) => {
        if (err) {
          console.log(`💡 Note: Open ${url} manually in your browser.`);
        }
      });
    }, 1200);
  }
});
