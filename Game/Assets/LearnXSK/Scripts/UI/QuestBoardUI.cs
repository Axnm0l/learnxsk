using UnityEngine;
using UnityEngine.UI;
using LearnXSK.Quests;

namespace LearnXSK.UI
{
    public class QuestBoardUI : MonoBehaviour
    {
        [Header("UI Panels")]
        public GameObject questBoardPanel;
        public Text titleText;
        public Text categoryText;
        public Text descriptionText;
        public Text objectiveText;
        public Text rewardText;
        public Button acceptButton;
        public Button closeButton;

        private void Awake()
        {
            if (acceptButton != null) acceptButton.onClick.AddListener(OnAcceptClicked);
            if (closeButton != null) closeButton.onClick.AddListener(CloseBoard);
        }

        private void Update()
        {
            if (questBoardPanel != null && questBoardPanel.activeSelf)
            {
                if (Input.GetKeyDown(KeyCode.Escape))
                {
                    CloseBoard();
                }
            }
        }

        public void OpenBoard()
        {
            if (questBoardPanel == null) return;

            var current = QuestManager.Instance != null ? QuestManager.Instance.CurrentQuest : null;
            if (current != null)
            {
                if (titleText != null) titleText.text = current.title;
                if (categoryText != null) categoryText.text = $"[{current.category}]";
                if (descriptionText != null) descriptionText.text = current.description;
                if (objectiveText != null) objectiveText.text = $"Objective: {current.objective}";
                if (rewardText != null) rewardText.text = $"Reward: +{current.xpReward} XP";
            }
            else
            {
                if (titleText != null) titleText.text = "All Missions Completed!";
                if (categoryText != null) categoryText.text = "[Field Mastery]";
                if (descriptionText != null) descriptionText.text = "You have investigated all security incidents in the outpost.";
                if (objectiveText != null) objectiveText.text = "Return to exploring the blocklands.";
                if (rewardText != null) rewardText.text = "";
            }

            questBoardPanel.SetActive(true);
        }

        public void CloseBoard()
        {
            if (questBoardPanel != null)
            {
                questBoardPanel.SetActive(false);
            }
        }

        private void OnAcceptClicked()
        {
            CloseBoard();
        }
    }
}
