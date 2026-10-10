using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;
using LearnXSK.Player;
using LearnXSK.World;
using LearnXSK.Quests;
using LearnXSK.UI;
using LearnXSK.AI;

public static class BlocklandsSceneGenerator
{
    [MenuItem("LearnXSK/Generate Blocklands Isometric Scene")]
    public static void GenerateScene()
    {
        Debug.Log("[BlocklandsSceneGenerator] Generating 2D Isometric Blocklands Scene...");

        // Create new empty scene
        Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // 1. Camera Setup
        var cameraGO = new GameObject("Main Camera");
        cameraGO.tag = "MainCamera";
        var cam = cameraGO.AddComponent<Camera>();
        cam.orthographic = true;
        cam.orthographicSize = 4.2f;
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.52f, 0.74f, 0.88f); // Daylight sky blue
        cam.nearClipPlane = 0.3f;
        cam.farClipPlane = 100f;
        cameraGO.transform.position = new Vector3(0f, 0f, -10f);
        cameraGO.AddComponent<AudioListener>();

        var followCam = cameraGO.AddComponent<IsometricFollowCamera>();

        // 2. Directional Light (2D/3D ambient daylight)
        var lightGO = new GameObject("Directional Light");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.color = new Color(1.0f, 0.96f, 0.88f);
        light.intensity = 1.1f;
        lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

        // 3. Core Systems (QuestManager & LocalGemmaClient)
        var coreSystemsGO = new GameObject("CoreSystems");
        coreSystemsGO.AddComponent<QuestManager>();
        var gemmaClient = coreSystemsGO.AddComponent<LocalGemmaClient>();

        // 4. Player Setup
        var playerGO = new GameObject("Player");
        playerGO.tag = "Player";
        playerGO.transform.position = new Vector3(0.5f, 2.25f, 0f); // Will be placed by builder
        var playerCtrl = playerGO.AddComponent<IsometricPlayerController>();
        followCam.target = playerGO.transform;

        // 5. World Builder Setup
        var worldGO = new GameObject("IsometricWorldBuilder");
        var worldBuilder = worldGO.AddComponent<IsometricWorldBuilder>();
        worldBuilder.playerTransform = playerGO.transform;

        // 6. UI Canvas
        var canvasGO = new GameObject("GameplayCanvas");
        var canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasGO.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;
        canvasGO.AddComponent<GraphicRaycaster>();

        // EventSystem
        var esGO = new GameObject("EventSystem");
        esGO.AddComponent<UnityEngine.EventSystems.EventSystem>();
        esGO.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();

        // --- HUD Hierarchy ---
        // A. Top-Left Status Panel
        var statusPanelGO = CreateUIPanel(canvasGO.transform, "StatusPanel", new Vector2(0, 1), new Vector2(0, 1), new Vector2(15, -15), new Vector2(420, 120), new Color(0.12f, 0.14f, 0.18f, 0.88f));
        var playerStatusText = CreateUIText(statusPanelGO.transform, "PlayerStatus", "Lv. 1 Adventurer  |  0 XP", 18, FontStyle.Bold, Color.yellow, new Vector2(15, -12), new Vector2(390, 30));
        var missionObjectiveText = CreateUIText(statusPanelGO.transform, "MissionObjective", "Active Mission: The Lost System File\nObjective: Approach the Quest Board or Outpost Terminal", 14, FontStyle.Normal, Color.white, new Vector2(15, -45), new Vector2(390, 65));

        // B. Interaction Prompt (Center Bottom)
        var promptText = CreateUIText(canvasGO.transform, "InteractionPrompt", "Press [E] to Interact", 22, FontStyle.Bold, new Color(1f, 0.92f, 0.25f), new Vector2(0, 90), new Vector2(600, 45));
        promptText.alignment = TextAnchor.MiddleCenter;
        var promptRect = promptText.GetComponent<RectTransform>();
        promptRect.anchorMin = new Vector2(0.5f, 0f);
        promptRect.anchorMax = new Vector2(0.5f, 0f);
        promptRect.pivot = new Vector2(0.5f, 0f);
        promptText.gameObject.SetActive(false);

        // C. Celebration Banner (Top Center)
        var celebBannerGO = CreateUIPanel(canvasGO.transform, "CelebrationBanner", new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, -60f), new Vector2(650, 120), new Color(0.15f, 0.35f, 0.18f, 0.95f));
        var celebRect = celebBannerGO.GetComponent<RectTransform>();
        celebRect.pivot = new Vector2(0.5f, 1f);
        var celebTitle = CreateUIText(celebBannerGO.transform, "CelebTitle", "MISSION ACCOMPLISHED!", 24, FontStyle.Bold, new Color(1f, 0.85f, 0.2f), new Vector2(0, -15), new Vector2(600, 35));
        celebTitle.alignment = TextAnchor.MiddleCenter;
        var celebReward = CreateUIText(celebBannerGO.transform, "CelebReward", "The Lost System File\n+100 XP GAINED", 16, FontStyle.Normal, Color.white, new Vector2(0, -55), new Vector2(600, 50));
        celebReward.alignment = TextAnchor.MiddleCenter;
        celebBannerGO.SetActive(false);

        // D. Quest Board Dialog Window
        var qbDialogGO = CreateUIPanel(canvasGO.transform, "QuestBoardDialog", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(650, 480), new Color(0.24f, 0.18f, 0.12f, 0.96f));
        var qbRect = qbDialogGO.GetComponent<RectTransform>();
        qbRect.pivot = new Vector2(0.5f, 0.5f);

        // Parchment inner container
        var qbParchment = CreateUIPanel(qbDialogGO.transform, "Parchment", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(610, 440), new Color(0.92f, 0.88f, 0.78f, 1.0f));
        var qbTitle = CreateUIText(qbParchment.transform, "QB_Title", "Mission 001 — The Lost System File", 22, FontStyle.Bold, new Color(0.22f, 0.15f, 0.08f), new Vector2(20, -20), new Vector2(570, 40));
        var qbCategory = CreateUIText(qbParchment.transform, "QB_Cat", "[Linux Basics & Filesystem Investigation]", 14, FontStyle.Italic, new Color(0.45f, 0.32f, 0.18f), new Vector2(20, -60), new Vector2(570, 25));
        var qbDesc = CreateUIText(qbParchment.transform, "QB_Desc", "The outpost terminal detected an unauthorized filesystem modification. An auditor left an incident log at /var/log/sys_audit.log.\n\nInvestigate the outpost terminal to locate the incident report and extract the flag.", 15, FontStyle.Normal, new Color(0.18f, 0.14f, 0.10f), new Vector2(20, -95), new Vector2(570, 140));
        var qbObj = CreateUIText(qbParchment.transform, "QB_Obj", "Objective: Investigate /var/log/sys_audit.log and report the flag.", 15, FontStyle.Bold, new Color(0.10f, 0.30f, 0.12f), new Vector2(20, -245), new Vector2(570, 35));
        var qbReward = CreateUIText(qbParchment.transform, "QB_Reward", "Reward: +100 XP & Outpost Clearance", 15, FontStyle.Bold, new Color(0.60f, 0.40f, 0.05f), new Vector2(20, -280), new Vector2(570, 30));

        var qbAcceptBtn = CreateUIButton(qbParchment.transform, "AcceptBtn", "Accept Mission & Proceed", new Vector2(20, -360), new Vector2(260, 45), new Color(0.25f, 0.55f, 0.25f));
        var qbCloseBtn = CreateUIButton(qbParchment.transform, "CloseBtn", "Close [Esc]", new Vector2(330, -360), new Vector2(240, 45), new Color(0.55f, 0.25f, 0.25f));

        var qbUI = qbDialogGO.AddComponent<QuestBoardUI>();
        qbUI.questBoardPanel = qbDialogGO;
        qbUI.titleText = qbTitle;
        qbUI.categoryText = qbCategory;
        qbUI.descriptionText = qbDesc;
        qbUI.objectiveText = qbObj;
        qbUI.rewardText = qbReward;
        qbUI.acceptButton = qbAcceptBtn;
        qbUI.closeButton = qbCloseBtn;
        qbDialogGO.SetActive(false);

        // E. In-Game Cyber Terminal Window
        var termDialogGO = CreateUIPanel(canvasGO.transform, "CyberTerminalDialog", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(850, 560), new Color(0.12f, 0.14f, 0.16f, 0.98f));
        var termRect = termDialogGO.GetComponent<RectTransform>();
        termRect.pivot = new Vector2(0.5f, 0.5f);

        // Terminal Title Bar
        var termTitle = CreateUIText(termDialogGO.transform, "TermTitle", "LEARNXSK CYBER TERMINAL — FIELD WORKSTATION", 16, FontStyle.Bold, Color.cyan, new Vector2(20, -15), new Vector2(600, 25));

        // CRT Screen Area
        var crtScreen = CreateUIPanel(termDialogGO.transform, "CRTScreen", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 15), new Vector2(810, 420), new Color(0.06f, 0.12f, 0.08f, 1.0f));
        var termOutputText = CreateUIText(crtScreen.transform, "TermOutput", "Loading virtual terminal...", 14, FontStyle.Normal, new Color(0.35f, 0.95f, 0.45f), new Vector2(15, -15), new Vector2(780, 390));
        termOutputText.alignment = TextAnchor.UpperLeft;

        // Command Input Field
        var inputFieldGO = new GameObject("CommandInput");
        inputFieldGO.transform.SetParent(termDialogGO.transform);
        var inputRect = inputFieldGO.AddComponent<RectTransform>();
        inputRect.anchorMin = new Vector2(0, 0);
        inputRect.anchorMax = new Vector2(0, 0);
        inputRect.pivot = new Vector2(0, 0);
        inputRect.anchoredPosition = new Vector2(20, 20);
        inputRect.sizeDelta = new Vector2(540, 40);
        var inputImg = inputFieldGO.AddComponent<Image>();
        inputImg.color = new Color(0.08f, 0.16f, 0.10f);

        var inputText = CreateUIText(inputFieldGO.transform, "Text", "", 15, FontStyle.Normal, Color.white, new Vector2(10, 0), new Vector2(520, 40));
        var placeholder = CreateUIText(inputFieldGO.transform, "Placeholder", "Type Linux command (e.g. ls, cd /var/log, cat sys_audit.log, hint)...", 14, FontStyle.Italic, Color.gray, new Vector2(10, 0), new Vector2(520, 40));
        
        var inputField = inputFieldGO.AddComponent<InputField>();
        inputField.textComponent = inputText;
        inputField.placeholder = placeholder;

        // Terminal Buttons
        var gemmaBtn = CreateUIButton(termDialogGO.transform, "GemmaBtn", "Ask Gemma Tutor", new Vector2(580, 20), new Vector2(150, 40), new Color(0.18f, 0.45f, 0.65f));
        var termCloseBtn = CreateUIButton(termDialogGO.transform, "CloseBtn", "Close [Esc]", new Vector2(740, 20), new Vector2(90, 40), new Color(0.55f, 0.20f, 0.20f));

        var termUI = termDialogGO.AddComponent<InGameTerminalUI>();
        termUI.terminalPanel = termDialogGO;
        termUI.terminalOutputText = termOutputText;
        termUI.commandInputField = inputField;
        termUI.closeButton = termCloseBtn;
        termUI.askGemmaButton = gemmaBtn;
        termDialogGO.SetActive(false);

        // F. HUD Controller Component
        var hud = canvasGO.AddComponent<IsometricHUD>();
        hud.playerStatusText = playerStatusText;
        hud.missionObjectiveText = missionObjectiveText;
        hud.interactionPromptText = promptText;
        hud.celebrationBanner = celebBannerGO;
        hud.celebrationTitleText = celebTitle;
        hud.celebrationRewardText = celebReward;
        hud.questBoardUI = qbUI;
        hud.terminalUI = termUI;
        hud.playerController = playerCtrl;

        // Save the Scene
        string scenePath = "Assets/Scenes/BlocklandsIsometric.unity";
        EditorSceneManager.SaveScene(scene, scenePath);
        Debug.Log($"[BlocklandsSceneGenerator] Scene saved successfully to: {scenePath}");

        // Add to EditorBuildSettings
        var scenes = new EditorBuildSettingsScene[]
        {
            new EditorBuildSettingsScene(scenePath, true),
            new EditorBuildSettingsScene("Assets/Scenes/WelcomeScreen.unity", true)
        };
        EditorBuildSettings.scenes = scenes;
        Debug.Log("[BlocklandsSceneGenerator] EditorBuildSettings configured with BlocklandsIsometric as Scene 0.");

        EditorApplication.Exit(0);
    }

    private static GameObject CreateUIPanel(Transform parent, string name, Vector2 anchorMin, Vector2 anchorMax, Vector2 pos, Vector2 size, Color color)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.pivot = anchorMin;
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        var img = go.AddComponent<Image>();
        img.color = color;
        return go;
    }

    private static Text CreateUIText(Transform parent, string name, string content, int fontSize, FontStyle style, Color color, Vector2 pos, Vector2 size)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = new Vector2(0, 1);
        rt.anchorMax = new Vector2(0, 1);
        rt.pivot = new Vector2(0, 1);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;

        var text = go.AddComponent<Text>();
        text.text = content;
        text.fontSize = fontSize;
        text.fontStyle = style;
        text.color = color;
        text.alignment = TextAnchor.UpperLeft;
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf") ?? Resources.GetBuiltinResource<Font>("Arial.ttf");
        return text;
    }

    private static Button CreateUIButton(Transform parent, string name, string label, Vector2 pos, Vector2 size, Color btnColor)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = new Vector2(0, 0);
        rt.anchorMax = new Vector2(0, 0);
        rt.pivot = new Vector2(0, 0);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;

        var img = go.AddComponent<Image>();
        img.color = btnColor;
        var btn = go.AddComponent<Button>();

        var textGO = new GameObject("Text");
        textGO.transform.SetParent(go.transform, false);
        var textRT = textGO.AddComponent<RectTransform>();
        textRT.anchorMin = Vector2.zero;
        textRT.anchorMax = Vector2.one;
        textRT.sizeDelta = Vector2.zero;

        var t = textGO.AddComponent<Text>();
        t.text = label;
        t.fontSize = 14;
        t.fontStyle = FontStyle.Bold;
        t.color = Color.white;
        t.alignment = TextAnchor.MiddleCenter;
        t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf") ?? Resources.GetBuiltinResource<Font>("Arial.ttf");

        return btn;
    }
}
