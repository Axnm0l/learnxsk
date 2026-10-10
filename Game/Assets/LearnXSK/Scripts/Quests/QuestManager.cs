using System;
using System.Collections.Generic;
using UnityEngine;

namespace LearnXSK.Quests
{
    public class QuestManager : MonoBehaviour
    {
        public static QuestManager Instance { get; private set; }

        public event Action<QuestData> OnQuestAssigned;
        public event Action<QuestData> OnQuestCompleted;
        public event Action<int, int> OnXPChanged; // currentXp, level

        public QuestData CurrentQuest { get; private set; }
        public List<QuestData> CompletedQuests { get; private set; } = new List<QuestData>();

        public int TotalXP { get; private set; } = 0;
        public int CurrentLevel => (TotalXP / 100) + 1;

        private List<QuestData> _questCatalog = new List<QuestData>();
        private int _currentCatalogIndex = 0;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeQuestCatalog();
        }

        private void Start()
        {
            // Initial quest available
            if (_questCatalog.Count > 0)
            {
                CurrentQuest = _questCatalog[0];
            }
        }

        private void InitializeQuestCatalog()
        {
            _questCatalog = new List<QuestData>
            {
                new QuestData(
                    "MISSION-001",
                    "The Lost System File",
                    "Linux Basics & Filesystem Investigation",
                    "The outpost terminal recorded an unauthorized file modification. An incident report is logged in '/var/log/sys_audit.log'. Navigate there, inspect the file, and locate the breach token flag.",
                    "Investigate '/var/log/sys_audit.log' and retrieve the security flag.",
                    "/var/log/sys_audit.log",
                    "FLAG{learnxsk_filesystem_mastered}",
                    100
                ),
                new QuestData(
                    "MISSION-002",
                    "Process Detective",
                    "Process Analysis & System Signals",
                    "A suspicious daemon process is listening on an internal socket. Identify running processes and correlate anomalous PID activity.",
                    "Locate anomalous PID and inspect socket bindings.",
                    "/proc/sys_net",
                    "FLAG{learnxsk_process_isolated}",
                    150
                )
            };
        }

        public void AssignQuest(QuestData quest)
        {
            CurrentQuest = quest;
            Debug.Log($"[QuestManager] Assigned Mission: {quest.title}");
            OnQuestAssigned?.Invoke(quest);
        }

        public void CompleteCurrentQuest()
        {
            if (CurrentQuest == null || CurrentQuest.isCompleted) return;

            CurrentQuest.isCompleted = true;
            CompletedQuests.Add(CurrentQuest);
            TotalXP += CurrentQuest.xpReward;

            Debug.Log($"[QuestManager] Completed: {CurrentQuest.title}! +{CurrentQuest.xpReward} XP. Total XP: {TotalXP}");

            OnQuestCompleted?.Invoke(CurrentQuest);
            OnXPChanged?.Invoke(TotalXP, CurrentLevel);

            // Advance to next mission
            _currentCatalogIndex++;
            if (_currentCatalogIndex < _questCatalog.Count)
            {
                CurrentQuest = _questCatalog[_currentCatalogIndex];
                OnQuestAssigned?.Invoke(CurrentQuest);
            }
            else
            {
                CurrentQuest = null;
            }
        }
    }
}
