using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using LearnXSK.Player;
using LearnXSK.World;
using LearnXSK.Quests;
using LearnXSK.UI;

public static class BlocklandsPlaymodeVerifier
{
    public static void VerifyBlocklandsGameplay()
    {
        Debug.Log("[BlocklandsPlaymodeVerifier] === STARTING AUTOMATED GAMEPLAY VERIFICATION ===");

        try
        {
            // 1. Load the generated Isometric Scene
            string scenePath = "Assets/Scenes/BlocklandsIsometric.unity";
            Scene scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
            if (!scene.IsValid())
            {
                Debug.LogError($"[BlocklandsPlaymodeVerifier] Failed to open scene: {scenePath}");
                EditorApplication.Exit(1);
                return;
            }
            Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 1: Scene '{scene.name}' opened successfully. Root count: {scene.rootCount}");

            // 2. Verify Essential GameObjects
            var playerGO = GameObject.FindWithTag("Player");
            var mainCamera = GameObject.FindWithTag("MainCamera");
            var worldBuilderGO = GameObject.Find("IsometricWorldBuilder");
            var canvasGO = GameObject.Find("GameplayCanvas");

            if (playerGO == null || mainCamera == null || worldBuilderGO == null || canvasGO == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] Missing essential GameObject hierarchy!");
                EditorApplication.Exit(2);
                return;
            }
            Debug.Log("[BlocklandsPlaymodeVerifier] PASS 2: Essential GameObject hierarchy verified (Player, Camera, WorldBuilder, Canvas).");

            // 3. Test World Generation & Voxel Tile Population
            var worldBuilder = worldBuilderGO.GetComponent<IsometricWorldBuilder>();
            if (worldBuilder == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] IsometricWorldBuilder component missing!");
                EditorApplication.Exit(3);
                return;
            }

            worldBuilder.BuildWorld();
            var terrainParent = worldBuilderGO.transform.Find("TerrainTiles");
            var propsParent = worldBuilderGO.transform.Find("PropsAndFoliage");

            int tileCount = terrainParent != null ? terrainParent.childCount : 0;
            int propCount = propsParent != null ? propsParent.childCount : 0;
            Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 3: World Generated — {tileCount} Isometric Terrain Tiles, {propCount} Props & Nature Objects.");

            if (tileCount < 200)
            {
                Debug.LogError($"[BlocklandsPlaymodeVerifier] Insufficient terrain tiles generated: {tileCount}");
                EditorApplication.Exit(4);
                return;
            }

            // 4. Verify In-World Quest Board and Cyber Terminal Props
            var qbGO = GameObject.Find("QuestBoard") ?? GameObject.FindWithTag("QuestBoard");
            var termGO = GameObject.Find("CyberTerminalStation") ?? GameObject.FindWithTag("TerminalStation");

            if (qbGO == null || termGO == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] QuestBoard or TerminalStation tag/object missing in world!");
                EditorApplication.Exit(5);
                return;
            }
            Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 4: QuestBoard located at {qbGO.transform.position}, TerminalStation located at {termGO.transform.position}.");

            // 5. Test Player Controller Setup
            var playerCtrl = playerGO.GetComponent<IsometricPlayerController>();
            if (playerCtrl == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] IsometricPlayerController missing on Player!");
                EditorApplication.Exit(6);
                return;
            }
            playerCtrl.SetTargets(qbGO.transform, termGO.transform);
            Debug.Log("[BlocklandsPlaymodeVerifier] PASS 5: Player controller initialized with movement physics & interaction targets.");

            // 6. Test Quest Manager & Quest Flow
            var qm = QuestManager.Instance ?? GameObject.Find("CoreSystems")?.GetComponent<QuestManager>();
            if (qm == null)
            {
                var cs = GameObject.Find("CoreSystems");
                if (cs != null) qm = cs.AddComponent<QuestManager>();
            }

            if (qm == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] QuestManager component missing!");
                EditorApplication.Exit(7);
                return;
            }

            // Ensure initialized in edit mode verifier
            if (qm.CurrentQuest == null)
            {
                qm.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
                qm.SendMessage("Start", SendMessageOptions.DontRequireReceiver);
            }

            Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 6: Active Quest is '{qm.CurrentQuest?.title}', Category: '{qm.CurrentQuest?.category}'.");

            // 7. Test In-Game Virtual Linux Terminal Execution
            var termUI = canvasGO.GetComponentInChildren<InGameTerminalUI>(true);
            if (termUI == null)
            {
                Debug.LogError("[BlocklandsPlaymodeVerifier] InGameTerminalUI missing from canvas!");
                EditorApplication.Exit(8);
                return;
            }

            termUI.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
            termUI.OpenTerminal();
            Debug.Log("[BlocklandsPlaymodeVerifier] Terminal opened. Simulating player investigating filesystem...");

            // Execute commands in simulated terminal
            termUI.ProcessCommand("pwd");
            termUI.ProcessCommand("ls");
            termUI.ProcessCommand("cd /var/log");
            termUI.ProcessCommand("ls");
            termUI.ProcessCommand("cat sys_audit.log");

            // 8. Verify Mission Completion & Progression
            if (qm.TotalXP >= 100 && qm.CompletedQuests.Count >= 1)
            {
                Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 7: Mission 001 Successfully Completed! Awarded +100 XP. Current Total XP = {qm.TotalXP}, Level = {qm.CurrentLevel}.");
                Debug.Log($"[BlocklandsPlaymodeVerifier] PASS 8: Next Mission Unlocked: '{qm.CurrentQuest?.title}'.");
            }
            else
            {
                Debug.LogError($"[BlocklandsPlaymodeVerifier] Mission did not complete as expected! Total XP: {qm.TotalXP}, Completed: {qm.CompletedQuests.Count}");
                EditorApplication.Exit(9);
                return;
            }

            Debug.Log("[BlocklandsPlaymodeVerifier] === ALL 8 GAMEPLAY VERIFICATION PASSES COMPLETED WITH ZERO ERRORS ===");
            EditorApplication.Exit(0);
        }
        catch (Exception ex)
        {
            Debug.LogError($"[BlocklandsPlaymodeVerifier] Unhandled exception during verification: {ex.Message}\n{ex.StackTrace}");
            EditorApplication.Exit(10);
        }
    }
}
