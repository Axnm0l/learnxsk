using System;
using System.Collections.Generic;
using System.Text;

namespace LearnXSK.Quests
{
    /// <summary>
    /// Safe in-memory simulated Linux filesystem.
    /// Does NOT execute arbitrary host OS commands.
    /// </summary>
    public class VirtualFilesystem
    {
        private class FsNode
        {
            public string Name;
            public bool IsDirectory;
            public string Content;
            public Dictionary<string, FsNode> Children = new Dictionary<string, FsNode>();
            public FsNode Parent;

            public FsNode(string name, bool isDirectory, string content = "")
            {
                Name = name;
                IsDirectory = isDirectory;
                Content = content;
            }
        }

        private FsNode _root;
        private FsNode _currentDir;
        public string CurrentPath { get; private set; }

        public VirtualFilesystem()
        {
            InitializeDefaultTree();
        }

        private void InitializeDefaultTree()
        {
            _root = new FsNode("", true);
            _root.Parent = _root;

            var home = AddDir(_root, "home");
            var adventurer = AddDir(home, "adventurer");
            AddFile(adventurer, "readme.txt", 
                "LEARNXSK CYBERSECURITY FIELD LAB\n" +
                "==================================\n" +
                "Welcome, Adventurer! You are operating a secure outpost terminal.\n" +
                "Useful commands:\n" +
                "  ls          - List files in current directory\n" +
                "  cd <dir>    - Change directory (e.g. 'cd /var/log')\n" +
                "  cat <file>  - Read file contents (e.g. 'cat sys_audit.log')\n" +
                "  pwd         - Print working directory\n" +
                "  grep <term> <file> - Search for text\n" +
                "  hint        - Ask local Gemma tutor for a clue\n" +
                "  help        - Show available commands\n" +
                "\n" +
                "MISSION DIRECTIVE: Investigate unauthorized changes in '/var/log'.\n");

            var varDir = AddDir(_root, "var");
            var logDir = AddDir(varDir, "log");
            AddFile(logDir, "sys_audit.log",
                "[SECURITY AUDIT LOG — INCIDENT #4092]\n" +
                "=====================================\n" +
                "Timestamp: 2026-10-11 04:12:00 UTC\n" +
                "Severity: HIGH\n" +
                "Event: Unauthorized root permission modification detected in /etc/sudoers.d/\n" +
                "Origin: External node 10.0.4.15\n" +
                "Incident Flag: FLAG{learnxsk_filesystem_mastered}\n" +
                "Mitigation: Flag confirmed by terminal operator.\n");

            AddFile(logDir, "auth.log",
                "Oct 11 04:02:11 blocklands-outpost sshd[102]: Accepted publickey for adventurer\n" +
                "Oct 11 04:05:33 blocklands-outpost sudo: adventurer : TTY=pts/0 ; PWD=/home/adventurer ; USER=root ; COMMAND=/bin/ls\n");

            var etcDir = AddDir(_root, "etc");
            AddFile(etcDir, "passwd",
                "root:x:0:0:root:/root:/bin/bash\n" +
                "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
                "adventurer:x:1000:1000:Adventurer:/home/adventurer:/bin/bash\n");

            var binDir = AddDir(_root, "bin");
            AddFile(binDir, "ls", "[binary: ls]");
            AddFile(binDir, "cat", "[binary: cat]");
            AddFile(binDir, "cd", "[builtin: cd]");

            _currentDir = adventurer;
            CurrentPath = "/home/adventurer";
        }

        private FsNode AddDir(FsNode parent, string name)
        {
            var node = new FsNode(name, true) { Parent = parent };
            parent.Children[name] = node;
            return node;
        }

        private void AddFile(FsNode parent, string name, string content)
        {
            var node = new FsNode(name, false, content) { Parent = parent };
            parent.Children[name] = node;
        }

        public string ExecuteCommand(string input, out bool foundFlag)
        {
            foundFlag = false;
            if (string.IsNullOrWhiteSpace(input)) return "";

            string[] parts = input.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            string cmd = parts[0].ToLowerInvariant();
            string arg1 = parts.Length > 1 ? parts[1] : "";
            string arg2 = parts.Length > 2 ? parts[2] : "";

            switch (cmd)
            {
                case "pwd":
                    return CurrentPath;

                case "ls":
                    return ListDirectory(arg1);

                case "cd":
                    return ChangeDirectory(arg1);

                case "cat":
                    return ReadFile(arg1, out foundFlag);

                case "grep":
                    return GrepSearch(arg1, arg2, out foundFlag);

                case "help":
                    return "Available commands: pwd, ls, cd <dir>, cat <file>, grep <pattern> <file>, hint, clear, help";

                case "clear":
                    return "__CLEAR__";

                default:
                    return $"bash: {cmd}: command not found. Type 'help' for available commands.";
            }
        }

        private string ListDirectory(string target)
        {
            FsNode node = ResolveNode(target, true);
            if (node == null) return $"ls: cannot access '{target}': No such file or directory";
            if (!node.IsDirectory) return node.Name;

            var sb = new StringBuilder();
            foreach (var child in node.Children.Values)
            {
                if (child.IsDirectory) sb.Append($"<DIR> {child.Name}/   ");
                else sb.Append($"{child.Name}   ");
            }
            return sb.ToString().TrimEnd();
        }

        private string ChangeDirectory(string target)
        {
            if (string.IsNullOrEmpty(target) || target == "~")
            {
                return ChangeDirectory("/home/adventurer");
            }

            FsNode node = ResolveNode(target, true);
            if (node == null) return $"cd: {target}: No such file or directory";
            if (!node.IsDirectory) return $"cd: {target}: Not a directory";

            _currentDir = node;
            CurrentPath = GetAbsolutePath(node);
            return "";
        }

        private string ReadFile(string target, out bool containsFlag)
        {
            containsFlag = false;
            if (string.IsNullOrEmpty(target)) return "cat: missing file operand";

            FsNode node = ResolveNode(target, false);
            if (node == null) return $"cat: {target}: No such file or directory";
            if (node.IsDirectory) return $"cat: {target}: Is a directory";

            if (node.Content.Contains("FLAG{learnxsk_filesystem_mastered}"))
            {
                containsFlag = true;
            }
            return node.Content;
        }

        private string GrepSearch(string pattern, string target, out bool containsFlag)
        {
            containsFlag = false;
            if (string.IsNullOrEmpty(pattern) || string.IsNullOrEmpty(target))
                return "usage: grep <pattern> <file>";

            string fileContent = ReadFile(target, out bool fileHasFlag);
            if (fileContent.StartsWith("cat:")) return fileContent.Replace("cat:", "grep:");

            var lines = fileContent.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            var sb = new StringBuilder();
            foreach (var line in lines)
            {
                if (line.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    sb.AppendLine(line);
                    if (line.Contains("FLAG{learnxsk_filesystem_mastered}")) containsFlag = true;
                }
            }
            return sb.Length > 0 ? sb.ToString().TrimEnd() : "No matches found.";
        }

        private FsNode ResolveNode(string path, bool allowDirectory)
        {
            if (string.IsNullOrEmpty(path)) return _currentDir;
            if (path == "/") return _root;

            string[] tokens = path.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            FsNode current = path.StartsWith("/") ? _root : _currentDir;

            foreach (var token in tokens)
            {
                if (token == ".") continue;
                if (token == "..")
                {
                    current = current.Parent;
                    continue;
                }
                if (current.Children.TryGetValue(token, out var next))
                {
                    current = next;
                }
                else
                {
                    return null;
                }
            }
            return current;
        }

        private string GetAbsolutePath(FsNode node)
        {
            if (node == _root) return "/";
            var parts = new List<string>();
            var curr = node;
            while (curr != _root)
            {
                parts.Insert(0, curr.Name);
                curr = curr.Parent;
            }
            return "/" + string.Join("/", parts);
        }
    }
}
