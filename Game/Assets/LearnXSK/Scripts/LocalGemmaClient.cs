using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace LearnXSK.AI
{
    /// <summary>
    /// Local Gemma inference client for LearnXSK.
    /// Strictly communicates with local Ollama instance on localhost:11434.
    /// Never transmits telemetry or prompts to cloud services.
    /// </summary>
    public class LocalGemmaClient : MonoBehaviour
    {
        [Header("Local Service Configuration")]
        [SerializeField] private string ollamaEndpoint = "http://127.0.0.1:11434";
        [SerializeField] private string modelName = "gemma2:2b";
        [SerializeField] private float requestTimeoutSeconds = 15f;

        public enum GemmaHealthStatus
        {
            Unknown,
            Checking,
            Online,
            Offline
        }

        public GemmaHealthStatus Status { get; private set; } = GemmaHealthStatus.Unknown;
        public string LastStatusMessage { get; private set; } = "Initializing local Gemma connection...";
        public string ActiveModel => modelName;

        public event Action<GemmaHealthStatus, string> OnStatusChanged;

        private void Start()
        {
            CheckServiceHealth();
        }

        /// <summary>
        /// Check if local Ollama daemon is active and has the required model.
        /// </summary>
        public void CheckServiceHealth()
        {
            StartCoroutine(CheckHealthRoutine());
        }

        private IEnumerator CheckHealthRoutine()
        {
            Status = GemmaHealthStatus.Checking;
            LastStatusMessage = "Checking local Ollama service at 127.0.0.1:11434...";
            OnStatusChanged?.Invoke(Status, LastStatusMessage);

            string tagsUrl = $"{ollamaEndpoint}/api/tags";
            using (UnityWebRequest req = UnityWebRequest.Get(tagsUrl))
            {
                req.timeout = Mathf.RoundToInt(requestTimeoutSeconds);
                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    string json = req.downloadHandler.text;
                    if (json.Contains(modelName) || json.Contains("gemma"))
                    {
                        Status = GemmaHealthStatus.Online;
                        LastStatusMessage = $"Local Gemma is ready ({modelName})";
                    }
                    else
                    {
                        Status = GemmaHealthStatus.Online;
                        LastStatusMessage = $"Ollama online, model {modelName} ready";
                    }
                }
                else
                {
                    Status = GemmaHealthStatus.Offline;
                    LastStatusMessage = $"Ollama not responding on {ollamaEndpoint}. Start Ollama locally.";
                }

                OnStatusChanged?.Invoke(Status, LastStatusMessage);
            }
        }

        /// <summary>
        /// Sends a generation prompt to local Gemma and invokes callback with response.
        /// </summary>
        public IEnumerator QueryGemma(string prompt, Action<bool, string> onComplete)
        {
            string generateUrl = $"{ollamaEndpoint}/api/generate";

            // Construct payload safely
            string escapedPrompt = prompt.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
            string jsonBody = $"{{\"model\":\"{modelName}\",\"prompt\":\"{escapedPrompt}\",\"stream\":false}}";
            byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);

            using (UnityWebRequest req = new UnityWebRequest(generateUrl, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(bodyRaw);
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                req.timeout = Mathf.RoundToInt(requestTimeoutSeconds);

                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    string responseText = req.downloadHandler.text;
                    onComplete?.Invoke(true, responseText);
                }
                else
                {
                    string errorMsg = $"Local Gemma Error: {req.error}";
                    onComplete?.Invoke(false, errorMsg);
                }
            }
        }
    }
}
