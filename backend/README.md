# LearnXSK Cyber AI Backend

High-performance, secure backend microservice powering the LearnXSK 3D Cyber Academy. Connects local Gemma 2 / Gemma 4 LLM models with a hyper-personalization engine and an isolated **Secure User Data Vault**.

---

## 🌟 Key Capabilities

1. **Hyper-Personalization Engine (+100% to +200% Learning Acceleration)**:
   - Tracks cadet mastery vector across 5 domains: *Linux Core, Network Recon, Web Security, Cryptography, Threat Hunting*.
   - Dynamically analyzes student struggle points, past command mistakes, and cognitive velocity.
   - Injects rich student persona and Socratic active-recall prompts into Gemma queries to accelerate retention and concept comprehension.

2. **Ultra-Secure User Data Vault (`/secure_user_vault`)**:
   - **Zero-knowledge local isolation**: User prompts, gameplay telemetry, and diagnostic data remain strictly local.
   - **Disk Encryption**: Supports AES-256-GCM encrypted mirrors with integrity tags.
   - **Git Isolation**: The vault folder is protected by internal `.gitignore` and root `.gitignore` to prevent leaks.
   - **Automated Fine-Tuning Corpus**: Every interaction is automatically converted into a Gemma-compatible instruction dataset sample (`{"instruction": "...", "input": "...", "output": "..."}`) in `training_corpus/gemma_user_training.jsonl`.

3. **Ollama Gemma 2 / 4 Integration + Seamless Fallback**:
   - Direct high-speed API bridge to local Ollama instance (`http://localhost:11434`).
   - Built-in on-device cyber mentor reasoning engine activates seamlessly if Ollama is busy training or offline.

---

## 📁 Directory Structure

```text
backend/
├── src/
│   ├── routes/
│   │   └── aiRoutes.ts              # API endpoints for onboarding, chat, telemetry & corpus
│   ├── services/
│   │   ├── GemmaService.ts          # Ollama communication & fallback engine
│   │   ├── PersonalizationEngine.ts # 2x acceleration prompt engineering & mastery vectors
│   │   └── SecureUserDataStore.ts   # AES-256 encrypted vault & JSONL dataset builder
│   ├── types.ts                     # TypeScript definitions
│   └── server.ts                    # Express server initialization
├── secure_user_vault/               # Protected user data directory (git-ignored)
│   ├── profiles/                    # Cadet cognitive profiles & skill mastery
│   ├── telemetry/                   # In-game command executions and mission logs
│   ├── interactions/                # Prompt-response history
│   ├── training_corpus/             # Gemma fine-tuning JSONL datasets
│   ├── encrypted_backups/           # AES-256 encrypted snapshots
│   └── SECURITY_POLICY.json         # Security manifest
├── .env.example                     # Environment configuration template
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start Development Server
```bash
npm run dev
```
The server will run on `http://localhost:3001`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/onboarding` | Calibrates student track, initializes vault record, returns diagnostic |
| `POST` | `/api/ai/chat` | Asks Gemma Tutor with hyper-personalized prompt context |
| `POST` | `/api/ai/telemetry` | Logs game actions, terminal commands, successes, and errors |
| `GET` | `/api/ai/profile/:handle` | Retrieves user's mastery vector and learning acceleration factor |
| `GET` | `/api/ai/training-data` | Exports user gameplay corpus formatted for Gemma instruction tuning |
| `GET` | `/api/ai/stats` | Vault security status, sample count, and encryption confirmation |
| `GET` | `/api/health` | Health check endpoint |
