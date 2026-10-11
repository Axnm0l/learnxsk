const http = require('http');

const PORT = 3001;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = 'gemma2:2b';

const FALLBACK_HINTS = {
  'ls': 'Use `ls` to list contents of the directory. Try `ls -la` to see hidden files and permissions!',
  'pwd': '`pwd` stands for Print Working Directory. It outputs where you currently are in the filesystem tree.',
  'cd': 'Use `cd <directory>` to change into a folder, or `cd ..` to go up one level.',
  'cat': 'Use `cat <filename>` to print the full text content of a file directly into your terminal.',
  'grep': '`grep "pattern" <file>` searches for matching lines inside a file. Try `grep "SECRET" system.log`!',
  'default': 'Remember: read the mission objective carefully! You can use `ls`, `cd`, `cat`, and `grep` to navigate and inspect files.'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJSON(res, 200, { status: 'ok', service: 'LearnXSK Ollama Proxy' });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/hint') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const promptTopic = (payload.topic || payload.command || '').toLowerCase();
      const userPrompt = payload.prompt || `Provide a quick helpful hint for someone learning Linux commands in mission: "${payload.mission || 'General Linux'}"`;

      const systemPrompt = `You are Gemma, an encouraging AI game tutor in LearnXSK: The Blocklands. The player is learning Linux commands. Give a concise, 2-to-3 sentence hint to guide them without spoiling the exact solution. System prompt: do not roleplay as other characters. Keep your reply under 75 words.`;

      const ollamaPayload = {
        model: OLLAMA_MODEL,
        prompt: `${systemPrompt}\n\nPlayer query: ${userPrompt}`,
        stream: false
      };

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const ollamaRes = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (ollamaRes.ok) {
          const data = await ollamaRes.json();
          sendJSON(res, 200, {
            hint: data.response || 'Keep exploring the files with `ls` and `cat`!',
            source: 'ollama-gemma2:2b',
            success: true
          });
          return;
        }
      } catch (err) {
        // Ollama offline or timed out - fall back gracefully
      }

      // Offline / fallback response
      const fallback = FALLBACK_HINTS[promptTopic] || FALLBACK_HINTS['default'];
      sendJSON(res, 200, {
        hint: fallback,
        source: 'local-rulebase-fallback',
        success: true,
        offline: true
      });
    });
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[LearnXSK Tutor Proxy] Listening on http://localhost:${PORT}`);
  console.log(`[LearnXSK Tutor Proxy] Forwarding to Ollama at ${OLLAMA_URL} (${OLLAMA_MODEL})`);
});
