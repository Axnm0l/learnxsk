import { Mission, INITIAL_MISSIONS } from './QuestData';

export class QuestManager {
  private static instance: QuestManager;

  public xp: number = 0;
  public maxXp: number = 1000;
  public level: number = 1;
  public levelTitle: string = 'Novice Explorer';
  public missions: Mission[] = [];
  public completedCount: number = 0;
  public unlockedBadges: { name: string; icon: string }[] = [];

  public onStateChange?: () => void;
  public onMissionCompleted?: (mission: Mission) => void;
  public onLevelUp?: (newLevel: number, title: string) => void;

  constructor() {
    this.missions = JSON.parse(JSON.stringify(INITIAL_MISSIONS));
  }

  public static getInstance(): QuestManager {
    if (!this.instance) {
      this.instance = new QuestManager();
    }
    return this.instance;
  }

  public setPreferredTrack(trackId: string): void {
    // If student chooses a track on loading screen, promote that mission or set it as primary
    const trackMap: Record<string, string> = {
      linux_core: 'task_001',
      net_recon: 'task_002',
      web_sec: 'task_003',
      crypto: 'task_004',
      threat_hunt: 'task_005'
    };

    const targetId = trackMap[trackId];
    if (targetId) {
      const target = this.missions.find(m => m.id === targetId);
      if (target && target.status === 'LOCKED') {
        target.status = 'AVAILABLE';
      }
    }
    this.notifyState();
  }

  public getCurrentMission(): Mission {
    return this.missions.find(m => m.status === 'IN_PROGRESS') ||
           this.missions.find(m => m.status === 'AVAILABLE') ||
           this.missions[0];
  }

  public getMission(id: string): Mission | undefined {
    return this.missions.find(m => m.id === id);
  }

  public startMission(id: string): void {
    const m = this.missions.find(x => x.id === id);
    if (m && (m.status === 'AVAILABLE' || m.status === 'LOCKED')) {
      m.status = 'IN_PROGRESS';
      this.notifyState();
    }
  }

  public completeStep(missionId: string, stepId: string): void {
    const m = this.missions.find(x => x.id === missionId);
    if (!m) return;

    if (m.status === 'AVAILABLE') {
      m.status = 'IN_PROGRESS';
    }

    const step = m.steps.find(s => s.id === stepId);
    if (step && !step.completed) {
      step.completed = true;

      // Check if all steps in this mission are complete
      const allDone = m.steps.every(s => s.completed);
      if (allDone) {
        this.completeMission(missionId);
      } else {
        this.notifyState();
      }
    }
  }

  public completeMission(id: string): void {
    const m = this.missions.find(x => x.id === id);
    if (!m || m.status === 'COMPLETED') return;

    m.status = 'COMPLETED';
    m.steps.forEach(s => { s.completed = true; });
    this.completedCount++;
    this.xp += m.rewardXP;

    // Add badge
    if (!this.unlockedBadges.some(b => b.name === m.badgeName)) {
      this.unlockedBadges.push({ name: m.badgeName, icon: m.badgeIcon });
    }

    // Update level
    this.calculateLevel();

    // Unlock next mission in line
    const currentIndex = this.missions.findIndex(x => x.id === id);
    if (currentIndex >= 0 && currentIndex + 1 < this.missions.length) {
      const nextMission = this.missions[currentIndex + 1];
      if (nextMission.status === 'LOCKED') {
        nextMission.status = 'AVAILABLE';
      }
    }

    if (this.onMissionCompleted) {
      this.onMissionCompleted(m);
    }

    this.notifyState();
  }

  private calculateLevel(): void {
    const oldLevel = this.level;
    if (this.xp >= 900) {
      this.level = 5;
      this.levelTitle = 'Cyber Master';
    } else if (this.xp >= 600) {
      this.level = 4;
      this.levelTitle = 'Security Sentinel';
    } else if (this.xp >= 350) {
      this.level = 3;
      this.levelTitle = 'Defense Specialist';
    } else if (this.xp >= 100) {
      this.level = 2;
      this.levelTitle = 'Linux Scout';
    } else {
      this.level = 1;
      this.levelTitle = 'Novice Explorer';
    }

    if (this.level > oldLevel && this.onLevelUp) {
      this.onLevelUp(this.level, this.levelTitle);
    }
  }

  private notifyState(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
