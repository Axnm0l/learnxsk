using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using LearnXSK.Quests;
using LearnXSK.AI;

namespace LearnXSK.UI
{
    public class InGameTerminalUI : MonoBehaviour
    {
        [Header("UI Panels")]
        public GameObject terminalPanel;
        public Text terminalOutputText;
        public InputField commandInputField;
        public Text statusText;
        public Button closeButton;
        public Button askGemmaButton;

        private VirtualFilesystem _vfs;
        private StringBuilder _historyBuffer = new StringBuilder();
        private LocalGemmaClient _gemmaClient;
        private bool _isQueryingGemma = false;

        private void Awake()
        {
            _vfs = new VirtualFilesystem();
            _gemmaClient = FindAnyObjectByType<LocalGemmaClient>();

            if (closeButton != null) closeButton.onClick.AddListener(CloseTerminal);
            if (askGemmaButton != null) askGemmaButton.onClick.AddListener(OnAskGemmaClicked);
            if (commandInputField != null) commandInputField.onEndEdit.AddListener(OnInputSubmit);

            AppendOutput("LEARNXSK SECURE TERMINAL v1.0.4 [BUILD-6000]\n" +
                         "Type 'help' for available commands, or 'hint' to consult Gemma.\n" +
                         "-----------------------------------------------------------\n" +
                         "adventurer@blocklands-outpost:~$ ");
        }

        private void Update()
        {
            if (terminalPanel != null && terminalPanel.activeSelf)
            {
                if (Input.GetKeyDown(KeyCode.Escape))
                {
                    CloseTerminal();
                }
            }
        }

        public void OpenTerminal()
        {
            if (terminalPanel != null)
            {
                terminalPanel.SetActive(true);
                if (commandInputField != null)
                {
                    commandInputField.ActivateInputField();
                }
            }
        }

        public void CloseTerminal()
        {
            if (terminalPanel != null)
            {
                terminalPanel.SetActive(false);
            }
        }

        private void OnInputSubmit(string input)
        {
            if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter))
            {
                ProcessCommand(input);
                if (commandInputField != null)
                {
                    commandInputField.text = "";
                    commandInputField.ActivateInputField();
                }
            }
        }

        public void ProcessCommand(string input)
        {
            if (_vfs == null) _vfs = new VirtualFilesystem();
            if (_historyBuffer == null) _historyBuffer = new StringBuilder();

            string trimmed = input.Trim();
            if (string.IsNullOrEmpty(trimmed)) return;

            AppendOutput(trimmed + "\n");

            if (trimmed.Equals("hint", System.StringComparison.OrdinalIgnoreCase))
            {
                OnAskGemmaClicked();
                return;
            }

            string result = _vfs.ExecuteCommand(trimmed, out bool foundFlag);
            if (result == "__CLEAR__")
            {
                _historyBuffer.Clear();
                if (terminalOutputText != null) terminalOutputText.text = "";
            }
            else
            {
                if (!string.IsNullOrEmpty(result))
                {
                    AppendOutput(result + "\n");
                }
            }

            if (foundFlag)
            {
                AppendOutput("\n>>> [FLAG DETECTED] Incident flag retrieved! Notifying Outpost Network...\n");
                if (QuestManager.Instance != null)
                {
                    QuestManager.Instance.CompleteCurrentQuest();
                }
            }

            AppendOutput($"adventurer@blocklands-outpost:{_vfs.CurrentPath}$ ");
        }

        private void AppendOutput(string text)
        {
            if (_historyBuffer == null) _historyBuffer = new StringBuilder();
            _historyBuffer.Append(text);
            if (_historyBuffer.Length > 4000)
            {
                _historyBuffer.Remove(0, 1000);
            }
            if (terminalOutputText != null)
            {
                terminalOutputText.text = _historyBuffer.ToString();
            }
        }

        private void OnAskGemmaClicked()
        {
            if (_isQueryingGemma) return;
            StartCoroutine(QueryGemmaRoutine());
        }

        private IEnumerator QueryGemmaRoutine()
        {
            _isQueryingGemma = true;
            AppendOutput("\n[Gemma Tutor] Consulting local Ollama model (gemma2:2b)...\n");

            if (_gemmaClient != null)
            {
                string prompt = "Explain briefly in 1-2 sentences how to find a security audit log in Linux using cd and cat or grep.";
                string responseText = "";

                yield return _gemmaClient.QueryGemma(prompt, (success, result) =>
                {
                    if (success && !string.IsNullOrEmpty(result))
                    {
                        int respIdx = result.IndexOf("\"response\":\"", System.StringComparison.Ordinal);
                        if (respIdx >= 0)
                        {
                            int start = respIdx + 12;
                            int end = result.IndexOf("\"", start);
                            if (end > start)
                            {
                                responseText = result.Substring(start, end - start).Replace("\\n", "\n").Replace("\\\"", "\"");
                            }
                            else responseText = result;
                        }
                        else
                        {
                            responseText = result;
                        }
                    }
                });

                if (!string.IsNullOrEmpty(responseText))
                {
                    AppendOutput($"[Gemma Tutor]: {responseText.Trim()}\n");
                }
                else
                {
                    // Pedagogical fallback
                    AppendOutput("[Gemma Tutor Hint]: Try navigating to the logs folder: 'cd /var/log' then list files with 'ls' and read the audit report using 'cat sys_audit.log'.\n");
                }
            }
            else
            {
                AppendOutput("[Gemma Tutor Hint]: Try navigating to the logs folder: 'cd /var/log' then list files with 'ls' and read the audit report using 'cat sys_audit.log'.\n");
            }

            _isQueryingGemma = false;
            AppendOutput($"adventurer@blocklands-outpost:{_vfs.CurrentPath}$ ");
        }
    }
}
