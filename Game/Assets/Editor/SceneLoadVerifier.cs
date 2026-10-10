using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

public static class SceneLoadVerifier
{
    public static void VerifyLoadWelcomeScene()
    {
        Debug.Log("[SceneLoadVerifier] Attempting to load scene: Assets/Scenes/WelcomeScreen.unity");
        try
        {
            Scene scene = EditorSceneManager.OpenScene("Assets/Scenes/WelcomeScreen.unity", OpenSceneMode.Single);
            if (!scene.IsValid())
            {
                Debug.LogError("[SceneLoadVerifier] Scene is not valid!");
                EditorApplication.Exit(1);
                return;
            }

            Debug.Log($"[SceneLoadVerifier] SUCCESS: Scene '{scene.name}' loaded successfully. Root GameObject count: {scene.rootCount}");
            GameObject[] roots = scene.GetRootGameObjects();
            foreach (var go in roots)
            {
                Debug.Log($"[SceneLoadVerifier] Root Object: {go.name}");
            }

            EditorApplication.Exit(0);
        }
        catch (Exception ex)
        {
            Debug.LogError($"[SceneLoadVerifier] Exception loading scene: {ex.Message}\n{ex.StackTrace}");
            EditorApplication.Exit(2);
        }
    }
}
