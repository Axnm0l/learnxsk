# LearnXSK Windows Setup Guide

**Version:** 1.0 (Prompt 1 — Bootstrap)  
**Last Updated:** 2026-10-11  
**Owner:** Freebuff (Agent B)

## 1. Overview

This guide covers setting up LearnXSK on a Windows PC. It includes system requirements, installing dependencies, and verifying everything works.

## 2. System Requirements

### 2.1 Minimum Requirements

| Component | Minimum |
|-----------|---------|
| OS | Windows 10 (64-bit) or Windows 11 |
| CPU | 4 cores |
| RAM | 8 GB |
| Disk Space | 10 GB free |
| GPU | Any DirectX 11 compatible GPU |

### 2.2 Recommended Requirements

| Component | Recommended |
|-----------|-------------|
| OS | Windows 11 |
| CPU | 8+ cores (e.g., AMD Ryzen 9) |
| RAM | 16 GB |
| Disk Space | 20 GB free |
| GPU | 4 GB+ VRAM (for faster Gemma inference) |

### 2.3 Tested Configuration (Bootstrap)

This project was bootstrapped on:
- **OS:** Windows 11 Home Single Language (build 26200)
- **CPU:** AMD Ryzen 9 8945HX with Radeon Graphics (16 cores, 32 threads)
- **RAM:** 16 GB
- **GPU:** Radeon Graphics (4.5 GB VRAM)
- **Disk:** ~147 GB free on C:

## 3. Prerequisites

### 3.1 Git

**Verify:**
```bash
git --version
```

**Install if missing:**
1. Download from https://git-scm.com/download/win
2. Run installer with default settings
3. Restart terminal after installation

### 3.2 Unity (For Development)

**Verify:**
1. Open Unity Hub
2. Check installed Unity Editor versions

**Install if missing:**
1. Download Unity Hub from https://unity.com/download
2. Install Unity Hub
3. In Unity Hub, install Unity 6.3 LTS (or latest LTS compatible)
4. Note the installation path for project setup

**Note:** For players, the game will be distributed as a built executable — they don't need Unity installed.

### 3.3 Ollama (For Local Gemma)

See [LOCAL_GEMMA.md](LOCAL_GEMMA.md) for detailed Gemma setup.

**Quick check:**
```bash
where ollama
ollama --version
```

**Install if missing:**
1. Download from https://ollama.com
2. Run installer
3. Ollama starts automatically

## 4. Project Setup

### 4.1 Clone or Open Project

```bash
# If using Git
git clone <repository-url> LearnXSK
cd LearnXSK

# Or open existing project folder
cd path/to/LearnXSK
```

### 4.2 Open in Unity

1. Launch Unity Hub
2. Click "Add" or "Open"
3. Navigate to `LearnXSK/Game` folder
4. Unity will load the project

**Note:** First load may take a few minutes as Unity imports assets and compiles scripts.

### 4.3 Verify Project Loads

- Check for compilation errors in Console window
- Verify scenes are present in `Assets/Scenes/`
- Confirm package dependencies are resolved

## 5. Running the Game (Player Instructions)

### 5.1 Prerequisites for Players

Players need:
- **Ollama** installed and running (for AI features)
- **Gemma model** downloaded (gemma2:2b or compatible)

### 5.2 Starting the Game

1. Run the game executable (`LearnXSK.exe` or similar)
2. Game launches to welcome screen
3. If Ollama is not running, game should show a warning

### 5.3 Verifying Gemma Connection

The game should:
1. Check if Ollama is running on startup
2. Test connection to `http://127.0.0.1:11434`
3. Show status indicator (Gemma ready / Gemma unavailable)

## 6. Development Setup (For Contributors)

### 6.1 Editor Setup

1. Install Unity Hub and Unity Editor (see 3.2)
2. Open `LearnXSK/Game` in Unity
3. Install required Unity packages via Package Manager
4. Configure code editor (Visual Studio, VS Code, etc.)

### 6.2 Recommended Tools

| Tool | Purpose |
|------|---------|
| Unity Editor | Game development |
| Visual Studio / VS Code | C# editing |
| Git | Version control |
| Ollama | Local AI testing |

### 6.3 Project Structure

```
LearnXSK/
├── Game/                    # Unity project
│   ├── Assets/
│   │   ├── Scenes/         # Unity scenes
│   │   ├── LearnXSK/
│   │   │   ├── Scripts/   # C# code
│   │   │   ├── Art/       # Pixel art
│   │   │   ├── UI/        # UI assets
│   │   │   └── Data/      # Game data
│   │   └── Editor/        # Editor scripts
│   ├── Packages/          # Package manager files
│   └── ProjectSettings/   # Unity settings
├── docs/                   # Documentation
├── coordination/           # Agent coordination files
└── tools/                  # Utility scripts
```

## 7. Troubleshooting

### 7.1 Unity Project Won't Open

**Symptoms:** Unity shows errors, project fails to load

**Checks:**
1. Verify Unity version matches project requirements
2. Check Console for specific error messages
3. Verify all packages are installed
4. Try reimporting assets (Assets → Reimport All)

### 7.2 Gemma Not Working

**Symptoms:** Game shows Gemma unavailable

**Checks:**
1. Is Ollama running? (Check system tray)
2. Is Gemma model downloaded? (`ollama list`)
3. Can you reach the API? (`curl http://127.0.0.1:11434/api/tags`)
4. Is firewall blocking localhost connections?

### 7.3 Game Runs Slowly

**Symptoms:** Low frame rate, laggy interactions

**Checks:**
1. Is GPU acceleration working?
2. Are pixel-perfect settings correct?
3. Is the scene too complex for current hardware?
4. Close other applications to free resources

## 8. Quick Start Checklist

- [ ] Windows 10/11 installed
- [ ] Git installed (for developers)
- [ ] Unity Hub and Unity Editor installed (for developers)
- [ ] Ollama installed
- [ ] Gemma model downloaded (`ollama pull gemma2:2b`)
- [ ] Gemma smoke test passed (`ollama run gemma2:2b "Reply with exactly: GEMGA_LOCAL_OK"`)
- [ ] Unity project opens without errors
- [ ] Welcome screen displays correctly

## 9. Getting Help

If you encounter issues not covered here:

1. Check the project documentation in `docs/`
2. Review coordination files for known issues
3. Check Unity console for specific error messages
4. Verify Ollama is running and Gemma is available
5. Document the issue in the appropriate coordination file
