export type QuestStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

export interface Mission {
  id: string;
  number: string;
  title: string;
  description: string;
  objectiveText: string;
  status: QuestStatus;
  rewardXP: number;
}

export class QuestManager {
  private static instance: QuestManager;

  public xp: number = 0;
  public maxXp: number = 100;
  public level: number = 1;
  public levelTitle: string = 'Level 1: Novice Explorer';

  public missions: Mission[] = [
    {
      id: 'mission_001',
      number: 'MISSION 001',
      title: 'First Foothold: The Lost Config',
      description: 'The outpost computer system rebooted and mislaid its core configuration files. Locate the secret verification token inside `/var/backups/token.env`.',
      objectiveText: 'Approach the Quest Board and press [E] to accept assignment.',
      status: 'AVAILABLE',
      rewardXP: 100
    },
    {
      id: 'mission_002',
      number: 'MISSION 002',
      title: 'Network Reconnaissance',
      description: 'Scout the network topology across the blocklands perimeter router nodes.',
      objectiveText: 'Unlocked! Check back with the commander for field deployment.',
      status: 'LOCKED',
      rewardXP: 150
    }
  ];

  public onStateChange?: () => void;

  public static getInstance(): QuestManager {
    if (!this.instance) {
      this.instance = new QuestManager();
    }
    return this.instance;
  }

  public getCurrentMission(): Mission {
    return this.missions.find(m => m.status === 'IN_PROGRESS') ||
           this.missions.find(m => m.status === 'AVAILABLE') ||
           this.missions[0];
  }

  public acceptMission001(): void {
    const m1 = this.missions[0];
    if (m1.status === 'AVAILABLE') {
      m1.status = 'IN_PROGRESS';
      m1.objectiveText = 'Cross the wooden bridge to Terminal Outpost (press [E]). Locate secret in `/var/backups/token.env`.';
      if (this.onStateChange) this.onStateChange();
    }
  }

  public completeMission001(): void {
    const m1 = this.missions[0];
    if (m1.status === 'IN_PROGRESS') {
      m1.status = 'COMPLETED';
      m1.objectiveText = 'Mission 001 Complete! Token verified. +100 XP awarded.';

      // Add XP & Level Up
      this.xp += m1.rewardXP;
      if (this.xp >= this.maxXp) {
        this.level = 2;
        this.levelTitle = 'Level 2: Linux Scout';
      }

      // Unlock Mission 002
      this.missions[1].status = 'AVAILABLE';
      this.missions[1].objectiveText = 'Mission 002 Available! Ready for network reconnaissance.';

      if (this.onStateChange) this.onStateChange();
    }
  }
}
