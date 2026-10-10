using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using LearnXSK.Core;
using LearnXSK.AI;

namespace LearnXSK.UI
{
    /// <summary>
    /// Master coordinator for the LearnXSK Welcome Screen prototype.
    /// Manages learning path selection, Start Mission flow, Gemma local status, and UI transitions.
    /// </summary>
    public class WelcomeScreenController : MonoBehaviour
    {
        [Header("Header Elements")]
        [SerializeField] private Text gameTitleText;
        [SerializeField] private Text welcomeSubtitleText;
        [SerializeField] private Text journeyTaglineText;

        [Header("Learning Path Cards (5 Paths)")]
        [SerializeField] private List<LearningPathCard> pathCards = new List<LearningPathCard>();

        [Header("Start Mission Button")]
        [SerializeField] private Button startMissionButton;
        [SerializeField] private Text startMissionButtonText;
        [SerializeField] private Image startMissionButtonGlow;

        [Header("Selected Path Details Banner")]
        [SerializeField] private GameObject selectionDetailsPanel;
        [SerializeField] private Text selectedPathTitleText;
        [SerializeField] private Text selectedPathDescText;

        [Header("Mission Transition Modal")]
        [SerializeField] private GameObject missionTransitionModal;
        [SerializeField] private Text transitionMissionTitleText;
        [SerializeField] private Text transitionDescriptionText;
        [SerializeField] private Text transitionGemmaStatusText;
        [SerializeField] private Text transitionRoadmapText;
        [SerializeField] private Button closeTransitionButton;

        [Header("Local AI Tutor Integration")]
        [SerializeField] private LocalGemmaClient gemmaClient;
        [SerializeField] private Text gemmaStatusBadgeText;
        [SerializeField] private Image gemmaStatusIndicatorDot;

        private LearningPathType? currentSelectedPath = null;

        public LearningPathType? SelectedPath => currentSelectedPath;

        private void Awake()
        {
            SetupHeaderLabels();
            SetupCards();
            SetupButtons();
            SetupGemmaListener();
            UpdateStartButtonState();

            if (selectionDetailsPanel != null)
            {
                selectionDetailsPanel.SetActive(false);
            }

            if (missionTransitionModal != null)
            {
                missionTransitionModal.SetActive(false);
            }
        }

        private void SetupHeaderLabels()
        {
            if (gameTitleText != null)
                gameTitleText.text = "LEARNXSK";

            if (welcomeSubtitleText != null)
                welcomeSubtitleText.text = "Welcome, Adventurer!";

            if (journeyTaglineText != null)
                journeyTaglineText.text = "Your journey to mastering Linux and cybersecurity begins here.";
        }

        private void SetupCards()
        {
            for (int i = 0; i < pathCards.Count; i++)
            {
                if (pathCards[i] != null)
                {
                    LearningPathType type = (LearningPathType)i;
                    pathCards[i].Configure(type);
                    pathCards[i].OnCardClicked += HandleCardClicked;
                }
            }
        }

        private void SetupButtons()
        {
            if (startMissionButton != null)
            {
                startMissionButton.onClick.AddListener(OnStartMissionClicked);
            }

            if (closeTransitionButton != null)
            {
                closeTransitionButton.onClick.AddListener(OnCloseTransitionClicked);
            }
        }

        private void SetupGemmaListener()
        {
            if (gemmaClient != null)
            {
                gemmaClient.OnStatusChanged += UpdateGemmaStatusUI;
            }
        }

        private void Update()
        {
            // Keyboard shortcuts for convenience (1-5 to select paths, Enter to start, Esc to dismiss modal)
            HandleKeyboardInput();
        }

        private void HandleKeyboardInput()
        {
            if (missionTransitionModal != null && missionTransitionModal.activeSelf)
            {
                if (Input.GetKeyDown(KeyCode.Escape))
                {
                    OnCloseTransitionClicked();
                }
                return;
            }

            if (Input.GetKeyDown(KeyCode.Alpha1)) SelectPath(LearningPathType.LinuxBasics);
            else if (Input.GetKeyDown(KeyCode.Alpha2)) SelectPath(LearningPathType.FilesystemExplorer);
            else if (Input.GetKeyDown(KeyCode.Alpha3)) SelectPath(LearningPathType.ProcessDetective);
            else if (Input.GetKeyDown(KeyCode.Alpha4)) SelectPath(LearningPathType.NetworkRecon);
            else if (Input.GetKeyDown(KeyCode.Alpha5)) SelectPath(LearningPathType.ScriptingLab);

            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                if (currentSelectedPath.HasValue && startMissionButton != null && startMissionButton.interactable)
                {
                    OnStartMissionClicked();
                }
            }
        }

        private void HandleCardClicked(LearningPathCard card)
        {
            SelectPath(card.PathType);
        }

        public void SelectPath(LearningPathType pathType)
        {
            currentSelectedPath = pathType;

            foreach (var card in pathCards)
            {
                if (card != null)
                {
                    card.SetSelected(card.PathType == pathType);
                }
            }

            LearningPathInfo info = LearningPathInfo.GetDefault(pathType);

            if (selectionDetailsPanel != null)
            {
                selectionDetailsPanel.SetActive(true);
            }

            if (selectedPathTitleText != null)
            {
                selectedPathTitleText.text = $"Selected: {info.Title}";
                if (ColorUtility.TryParseHtmlString(info.AccentHexColor, out Color col))
                {
                    selectedPathTitleText.color = col;
                }
            }

            if (selectedPathDescText != null)
            {
                selectedPathDescText.text = info.FullDescription;
            }

            UpdateStartButtonState();
        }

        private void UpdateStartButtonState()
        {
            bool hasSelection = currentSelectedPath.HasValue;

            if (startMissionButton != null)
            {
                startMissionButton.interactable = hasSelection;
            }

            if (startMissionButtonText != null)
            {
                startMissionButtonText.text = hasSelection 
                    ? $"START MISSION: {LearningPathInfo.GetDefault(currentSelectedPath.Value).Title.ToUpper()}" 
                    : "SELECT A LEARNING PATH TO BEGIN";
            }

            if (startMissionButtonGlow != null)
            {
                startMissionButtonGlow.enabled = hasSelection;
            }
        }

        public void OnStartMissionClicked()
        {
            if (!currentSelectedPath.HasValue) return;

            LearningPathInfo info = LearningPathInfo.GetDefault(currentSelectedPath.Value);

            if (missionTransitionModal != null)
            {
                missionTransitionModal.SetActive(true);
            }

            if (transitionMissionTitleText != null)
            {
                transitionMissionTitleText.text = $"MISSION INITIALIZING: {info.Title.ToUpper()}";
            }

            if (transitionDescriptionText != null)
            {
                transitionDescriptionText.text = $"{info.FullDescription}\n\nObjective: Terminal intake profiling and isolated Docker container provisioning.";
            }

            if (transitionGemmaStatusText != null)
            {
                string gemmaInfo = gemmaClient != null ? gemmaClient.LastStatusMessage : "Local Gemma: Ready on 127.0.0.1:11434 (gemma2:2b)";
                transitionGemmaStatusText.text = $"[AI TUTOR] {gemmaInfo}";
            }

            if (transitionRoadmapText != null)
            {
                transitionRoadmapText.text = "NEXT IMPLEMENTATION STEP:\n- Prompt 2: Onboarding Terminal & Skill Vector Profiler\n- Prompt 3: Sandboxed Linux Container & Live Command Terminal\n- Local Gemma Challenge Generator & Anti-Vibe Layer";
            }
        }

        public void OnCloseTransitionClicked()
        {
            if (missionTransitionModal != null)
            {
                missionTransitionModal.SetActive(false);
            }
        }

        private void UpdateGemmaStatusUI(LocalGemmaClient.GemmaHealthStatus status, string message)
        {
            if (gemmaStatusBadgeText != null)
            {
                gemmaStatusBadgeText.text = $"Local Gemma: {status}";
            }

            if (gemmaStatusIndicatorDot != null)
            {
                switch (status)
                {
                    case LocalGemmaClient.GemmaHealthStatus.Online:
                        gemmaStatusIndicatorDot.color = Color.green;
                        break;
                    case LocalGemmaClient.GemmaHealthStatus.Checking:
                        gemmaStatusIndicatorDot.color = Color.yellow;
                        break;
                    case LocalGemmaClient.GemmaHealthStatus.Offline:
                        gemmaStatusIndicatorDot.color = Color.red;
                        break;
                    default:
                        gemmaStatusIndicatorDot.color = Color.gray;
                        break;
                }
            }
        }
    }
}
