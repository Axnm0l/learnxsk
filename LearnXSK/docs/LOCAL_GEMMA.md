# LearnXSK Local Gemma Setup

**Version:** 1.0 (Prompt 1 — Bootstrap)  
**Last Updated:** 2026-10-11  
**Owner:** Freebuff (Agent B)

## 1. Overview

LearnXSK uses local Gemma AI inference via Ollama. All AI processing happens on the player's machine — no cloud API calls, no data leaves the computer.

## 2. Requirements

### 2.1 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10/11 | Windows 11 |
| RAM | 8 GB | 16 GB |
| Disk Space | 5 GB free | 10 GB free |
| GPU | Not required | 4 GB+ VRAM (optional, speeds up inference) |

### 2.2 Model Requirements

| Model | Size | RAM Usage | Notes |
|-------|------|-----------|-------|
| gemma2:2b | ~1.6 GB | ~2 GB | Fast, lightweight, tested working |
| gemma4:e2b | TBD | TBD | Target model if available and supported |

## 3. Installation

### 3.1 Install Ollama

**Option A: Download from Website**

1. Visit https://ollama.com
2. Download Windows installer
3. Run installer
4. Ollama will start automatically

**Option B: Command Line (if already have curl/wget)**

```powershell
# Run in PowerShell (may require administrator approval)
powershell -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri https://ollama.com/install -OutFile ollama-installer.exe; Start-Process ollama-installer.exe -Wait"
```

### 3.2 Verify Installation

```powershell
# Check Ollama is in PATH
where ollama

# Check Ollama version
ollama --version

# Check Ollama is running
curl http://127.0.0.1:11434/api/tags
```

Expected output: JSON with models array (may be empty if no models downloaded yet).

### 3.3 Download Gemma Model

```powershell
# Pull the model (this downloads ~1.6 GB for gemma2:2b)
ollama pull gemma2:2b

# Or for the target model if available
ollama pull gemma4:e2b
```

**Note:** Model weights are downloaded to Ollama's data directory (typically `C:\Users\<username>\.ollama\models`). These are NOT stored in the LearnXSK project directory and should NOT be committed to Git.

### 3.4 Verify Model Works

```powershell
# Run a simple test
ollama run gemma2:2b "Reply with exactly: GEMMA_LOCAL_OK"
```

Expected output: `GEMMA_LOCAL_OK`

## 4. Smoke Test Results (LearnXSK Bootstrap)

**Test Date:** 2026-10-11  
**Test Performed By:** Freebuff (Agent B)

### 4.1 System State at Test Time

| Component | Value |
|-----------|-------|
| OS | Windows 11 Home Single Language (10.0.26200) |
| CPU | AMD Ryzen 9 8945HX (16 cores, 32 threads) |
| RAM | 16 GB (16,425,455,616 bytes) |
| GPU | Radeon Graphics (4.5 GB VRAM) |
| Disk Space (C:) | ~147 GB free |

### 4.2 Ollama Status

| Check | Result |
|-------|--------|
| Ollama installed | ✅ Yes — `C:\Users\anmol\AppData\Local\Programs\Ollama\ollama.exe` |
| Ollama running | ✅ Yes — API responding at `http://127.0.0.1:11434` |
| Models available | ✅ Yes — `gemma2:2b` (1.6 GB, Q4_0, 2.6B params) |

### 4.3 Smoke Test Execution

**Command:**
```bash
cd /c/Users/anmol/AppData/Local/Programs/Ollama
./ollama run gemma2:2b "Reply with exactly: GEMGA_LOCAL_OK"
```

**Result:** ✅ PASSED  
**Output:** `GEMGA_LOCAL_OK`  
**Exit Code:** 0

### 4.4 Model Selection Note

The prompt specified `gemma4:e2b` as the initial candidate model. This model was not available in the local Ollama library at test time. The available smaller Gemma alternative, `gemma2:2b`, was used instead.

If `gemma4:e2b` becomes available:
1. Check system resources can handle it
2. Pull the model: `ollama pull gemma4:e2b`
3. Run smoke test with new model
4. Update this document with new model details

## 5. Using Gemma in the Game

### 5.1 API Endpoint

```
http://127.0.0.1:11434
```

### 5.2 C# Integration Pattern

```csharp
// Example: Send prompt to Ollama
string ollamaUrl = "http://127.0.0.1:11434/api/generate";
string model = "gemma2:2b";
string prompt = "Your prompt here";

// POST request with JSON body
// {
//   "model": "gemma2:2b",
//   "prompt": "Your prompt here",
//   "stream": false
// }
```

### 5.3 Recommended API Calls

| Endpoint | Purpose |
|----------|---------|
| `/api/generate` | Generate a single response (non-streaming) |
| `/api/chat` | Chat-style conversation |
| `/api/tags` | List available models |

### 5.4 Error Handling

- Check if Ollama is running before making requests
- Handle timeout (model may be loading)
- Handle model not found (prompt user to download)
- Parse JSON responses carefully
- Implement retry logic for transient failures

### 5.5 Important Constraints

- **NO cloud AI services** — Gemma must run locally
- **NO sending gameplay data to external APIs**
- Model weights stay outside the Git repository
- Player must have Ollama installed and running for AI features to work

## 6. Troubleshooting

### 6.1 Ollama Not Running

**Symptom:** Connection refused to `http://127.0.0.1:11434`

**Fix:**
1. Check if Ollama is running in system tray
2. Start Ollama from Start Menu
3. Restart Ollama service if needed

### 6.2 Model Not Found

**Symptom:** API returns error about missing model

**Fix:**
```bash
ollama pull gemma2:2b
```

### 6.3 Slow Inference

**Symptom:** Responses take a long time

**Causes:**
- CPU-only inference (no GPU acceleration)
- Large model relative to hardware
- System under heavy load

**Mitigation:**
- Use smaller model (gemma2:2b is already small)
- Close other applications
- Wait — first generation loads model into memory

### 6.4 Out of Memory

**Symptom:** Ollama crashes or refuses to load model

**Fix:**
- Use smaller model variant
- Close memory-intensive applications
- Add more RAM if consistently hitting limits

## 7. Security Notes

- Gemma runs entirely locally — no data transmitted over network
- Ollama binds to localhost by default (not exposed to network)
- Game should verify Ollama is responding before relying on AI features
- If Ollama is not available, game should provide non-AI fallback or clear error message

## 8. Future Considerations

- Model upgrade path (gemma4:e2b or larger models if hardware supports)
- Model caching strategies
- Batch processing for multiple prompts
- Streaming responses for better UX
