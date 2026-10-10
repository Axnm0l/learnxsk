using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

/// <summary>
/// Jury Build Pipeline for LearnXSK: The Blocklands.
/// Invoked via Unity batchmode: -executeMethod JuryBuildPipeline.Build
/// Produces a standalone Windows x64 build to Build/StandaloneWin64/
/// </summary>
public static class JuryBuildPipeline
{
    private const string BuildOutputDir   = "Build/StandaloneWin64";
    private const string ExeName          = "LearnXSK_Blocklands.exe";

    [MenuItem("LearnXSK/Build Standalone Windows (Jury)")]
    public static void Build()
    {
        Debug.Log("[JuryBuildPipeline] === JURY BUILD STARTED ===");
        Debug.Log($"[JuryBuildPipeline] Unity version: {Application.unityVersion}");
        Debug.Log($"[JuryBuildPipeline] Platform target: StandaloneWindows64");
        Debug.Log($"[JuryBuildPipeline] Output: {Path.GetFullPath(BuildOutputDir)}");

        // Ensure output directory exists
        if (!Directory.Exists(BuildOutputDir))
        {
            Directory.CreateDirectory(BuildOutputDir);
            Debug.Log($"[JuryBuildPipeline] Created output directory: {BuildOutputDir}");
        }

        // Configure build scenes — BlocklandsIsometric is Scene 0 (entrypoint)
        string[] scenes = new string[]
        {
            "Assets/Scenes/BlocklandsIsometric.unity"
        };

        foreach (var s in scenes)
        {
            Debug.Log($"[JuryBuildPipeline] Including scene: {s}");
        }

        var buildOptions = new BuildPlayerOptions
        {
            scenes             = scenes,
            locationPathName   = Path.Combine(BuildOutputDir, ExeName),
            target             = BuildTarget.StandaloneWindows64,
            options            = BuildOptions.None
        };

        // Run the build
        Debug.Log("[JuryBuildPipeline] Invoking BuildPipeline.BuildPlayer...");
        BuildReport report = BuildPipeline.BuildPlayer(buildOptions);
        BuildSummary summary = report.summary;

        Debug.Log($"[JuryBuildPipeline] Build Result: {summary.result}");
        Debug.Log($"[JuryBuildPipeline] Total Errors: {summary.totalErrors}");
        Debug.Log($"[JuryBuildPipeline] Total Warnings: {summary.totalWarnings}");
        Debug.Log($"[JuryBuildPipeline] Total Time: {summary.totalTime.TotalSeconds:F1}s");
        Debug.Log($"[JuryBuildPipeline] Build Size: {summary.totalSize / 1024 / 1024} MB");
        Debug.Log($"[JuryBuildPipeline] Output path: {summary.outputPath}");

        if (summary.result == BuildResult.Succeeded)
        {
            Debug.Log("[JuryBuildPipeline] === BUILD SUCCEEDED ===");
            Debug.Log($"[JuryBuildPipeline] Standalone executable: {summary.outputPath}");
            Debug.Log("[JuryBuildPipeline] JURY_BUILD_OK");
            EditorApplication.Exit(0);
        }
        else
        {
            Debug.LogError("[JuryBuildPipeline] === BUILD FAILED ===");
            // Print each individual error
            foreach (var step in report.steps)
            {
                foreach (var msg in step.messages)
                {
                    if (msg.type == LogType.Error || msg.type == LogType.Exception)
                    {
                        Debug.LogError($"[JuryBuildPipeline] BUILD ERROR in step '{step.name}': {msg.content}");
                    }
                }
            }
            EditorApplication.Exit(1);
        }
    }
}
