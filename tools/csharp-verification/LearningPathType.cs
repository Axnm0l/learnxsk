using System;

namespace LearnXSK.Core
{
    /// <summary>
    /// The five primary cybersecurity learning paths for LearnXSK.
    /// Preserves the core curriculum defined in TerminalQuest plan.
    /// </summary>
    public enum LearningPathType
    {
        LinuxBasics = 0,
        FilesystemExplorer = 1,
        ProcessDetective = 2,
        NetworkRecon = 3,
        ScriptingLab = 4
    }

    /// <summary>
    /// Metadata descriptor for each learning path.
    /// </summary>
    [System.Serializable]
    public class LearningPathInfo
    {
        public LearningPathType PathType;
        public string Title = string.Empty;
        public string ShortTagline = string.Empty;
        public string FullDescription = string.Empty;
        public string IconResourceName = string.Empty;
        public string AccentHexColor = "#ffffff";
        public int BaseDifficultyLevel = 1;

        public static LearningPathInfo GetDefault(LearningPathType pathType)
        {
            switch (pathType)
            {
                case LearningPathType.LinuxBasics:
                    return new LearningPathInfo
                    {
                        PathType = LearningPathType.LinuxBasics,
                        Title = "Linux Basics",
                        ShortTagline = "Navigate the terminal.",
                        FullDescription = "Master the core shell environment, standard streams, directory navigation, and basic terminal utilities.",
                        IconResourceName = "path_linux_basics",
                        AccentHexColor = "#22c55e",
                        BaseDifficultyLevel = 1
                    };

                case LearningPathType.FilesystemExplorer:
                    return new LearningPathInfo
                    {
                        PathType = LearningPathType.FilesystemExplorer,
                        Title = "Filesystem Explorer",
                        ShortTagline = "Investigate files and hidden clues.",
                        FullDescription = "Inspect Unix permission bits, search hidden directories, analyze file timestamps, and track suspicious filesystem artifacts.",
                        IconResourceName = "path_filesystem_explorer",
                        AccentHexColor = "#eab308",
                        BaseDifficultyLevel = 2
                    };

                case LearningPathType.ProcessDetective:
                    return new LearningPathInfo
                    {
                        PathType = LearningPathType.ProcessDetective,
                        Title = "Process Detective",
                        ShortTagline = "Understand processes and system activity.",
                        FullDescription = "Inspect running PID trees, monitor CPU/memory telemetry, investigate background daemons, and detect rogue processes.",
                        IconResourceName = "path_process_detective",
                        AccentHexColor = "#a855f7",
                        BaseDifficultyLevel = 3
                    };

                case LearningPathType.NetworkRecon:
                    return new LearningPathInfo
                    {
                        PathType = LearningPathType.NetworkRecon,
                        Title = "Network Recon",
                        ShortTagline = "Explore networking fundamentals in controlled labs.",
                        FullDescription = "Perform safe port discovery, inspect socket listeners, map network topologies, and understand TCP/UDP protocol fundamentals.",
                        IconResourceName = "path_network_recon",
                        AccentHexColor = "#0ea5e9",
                        BaseDifficultyLevel = 3
                    };

                case LearningPathType.ScriptingLab:
                    return new LearningPathInfo
                    {
                        PathType = LearningPathType.ScriptingLab,
                        Title = "Scripting Lab",
                        ShortTagline = "Learn commands and basic automation.",
                        FullDescription = "Construct Unix pipes, filter streams with grep/sed/awk, write defensive Bash one-liners, and automate reconnaissance tasks.",
                        IconResourceName = "path_scripting_lab",
                        AccentHexColor = "#ef4444",
                        BaseDifficultyLevel = 4
                    };

                default:
                    throw new ArgumentOutOfRangeException(nameof(pathType), pathType, null);
            }
        }
    }
}
