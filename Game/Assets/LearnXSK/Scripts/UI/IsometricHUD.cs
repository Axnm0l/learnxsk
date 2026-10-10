using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using LearnXSK.Player;
using LearnXSK.Quests;

namespace LearnXSK.UI
{
    public class IsometricHUD : MonoBehaviour
    {
        [Header("HUD Elements")]
        public Text playerStatusText;
        public Text missionObjectiveText;
        public Text interactionPromptText;

        [Header("Celebration Banner")]
        public GameObject celebrationBanner;
        public Text celebrationTitleText;
        public Text celebrationRewardText;

        [Header("Sub-Systems")]
        public QuestBoardUI questBoardUI;
        public InGameTerminalUI terminalUI;
        public IsometricPlayerController playerController;

        private void Start()
        {
            if (celebrationBanner != null) celebrationBanner.SetActive(false);

            if (playerController == null)
            {
                playerController = FindAnyObjectByType<IsometricPlayerController>();
            }

            if (playerController != null)
            {
                playerController.OnInteractQuestBoard += () =>
                {
                    if (questBoardUI != null) questBoardUI.OpenBoard();
                };
                playerController.OnInteractTerminal += () =>
                {
                    if (terminalUI != null) terminalUI.OpenTerminal();
                };
            }

            if (QuestManager.Instance != null)
            {
                QuestManager.Instance.OnQuestAssigned += UpdateObjective;
                QuestManager.Instance.OnQuestCompleted += ShowCelebration;
                QuestManager.Instance.OnXPChanged += UpdatePlayerStatus;

                UpdatePlayerStatus(QuestManager.Instance.TotalXP, QuestManager.Instance.CurrentLevel);
                if (QuestManager.Instance.CurrentQuest != null)
                {
                    UpdateObjective(QuestManager.Instance.CurrentQuest);
                }
            }
        }

        private void Update()
        {
            if (interactionPromptText != null && playerController != null)
            {
                string prompt = playerController.NearbyInteractablePrompt;
                interactionPromptText.text = prompt;
                interactionPromptText.gameObject.SetActive(!string.IsNullOrEmpty(prompt));
            }
        }

        private void UpdatePlayerStatus(int xp, int level)
        {
            if (playerStatusText != null)
            {
                playerStatusText.text = $"Lv. {level} Adventurer  |  {xp} XP";
            }
        }

        private void UpdateObjective(QuestData quest)
        {
            if (missionObjectiveText != null)
            {
                if (quest != null)
                {
                    missionObjectiveText.text = $"Mission: {quest.title}\nObjective: {quest.objective}";
                }
                else
                {
                    missionObjectiveText.text = "All Outpost Missions Completed!";
                }
            }
        }

        private void ShowCelebration(QuestData quest)
        {
            StartCoroutine(CelebrationRoutine(quest));
        }

        private IEnumerator CelebrationRoutine(QuestData quest)
        {
            if (celebrationBanner != null)
            {
                if (celebrationTitleText != null) celebrationTitleText.text = "MISSION ACCOMPLISHED!";
                if (celebrationRewardText != null) celebrationRewardText.text = $"{quest.title}\n+{quest.xpReward} XP GAINED";
                celebrationBanner.SetActive(true);
            }

            yield return new WaitForSeconds(4f);

            if (celebrationBanner != null)
            {
                celebrationBanner.SetActive(false);
            }
        }
    }
}
