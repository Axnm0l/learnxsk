using System;

namespace LearnXSK.Quests
{
    [Serializable]
    public class QuestData
    {
        public string id;
        public string title;
        public string category;
        public string description;
        public string objective;
        public string targetFilePath;
        public string targetFlag;
        public int xpReward;
        public bool isCompleted;

        public QuestData(string id, string title, string category, string description, string objective, string targetFilePath, string targetFlag, int xpReward)
        {
            this.id = id;
            this.title = title;
            this.category = category;
            this.description = description;
            this.objective = objective;
            this.targetFilePath = targetFilePath;
            this.targetFlag = targetFlag;
            this.xpReward = xpReward;
            this.isCompleted = false;
        }
    }
}
