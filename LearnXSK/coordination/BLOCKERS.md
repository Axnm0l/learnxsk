# LearnXSK Blockers

**Last Updated:** 2026-10-11  
**Phase:** Prompt 1 — Bootstrap

## Active Blockers

### BLK-01: Unity Hub & Unity Editor Installation Requires Manual / Admin Approval

- **Owner:** User Action Required
- **Blocked Task:** INF-06, INF-07 (Launching scene inside native Unity Editor GUI)
- **Description:** Unity Hub and Unity 6 / 2022 LTS Editor are not currently installed on the host system. Automated CLI installation via `winget install Unity.UnityHub` requires Windows User Account Control (UAC) administrator consent and interactive Unity account licensing login.
- **Impact:** Unity project files, scenes, C# code, package manifests, and assets have been fully initialized and verified via .NET C# build and playable prototype, but opening the project in the native Unity Editor GUI requires Unity to be installed first.
- **Action Required by User:**
  1. Open PowerShell as Administrator or download from [https://unity.com/download](https://unity.com/download)
  2. Run `winget install Unity.UnityHub` (or run installer executable)
  3. Open Unity Hub, sign in, and install **Unity 6 LTS (6000.x)** or **Unity 2022.3 LTS**
  4. In Unity Hub, click **Add** -> select `C:\Users\anmol\OneDrive\Desktop\LearnXSK\Game`
- **Status:** PENDING USER ACTION

---

## Resolved Blockers

None.
