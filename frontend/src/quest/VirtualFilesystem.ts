import { QuestManager } from './QuestManager';
import { GemmaClient } from '../ai/GemmaClient';

export interface FSNode {
  name: string;
  isDir: boolean;
  content?: string;
  children?: { [name: string]: FSNode };
  parent?: FSNode;
}

export class VirtualFilesystem {
  private root: FSNode;
  private currentDir: FSNode;
  private currentPath: string = '/home/cadet';

  public onCommandExecuted?: (cmd: string, output: string) => void;

  constructor() {
    this.root = {
      name: '',
      isDir: true,
      children: {}
    };

    this.initFileSystemTree();
    this.currentDir = this.resolvePath('/home/cadet') || this.root;
  }

  private initFileSystemTree(): void {
    // Top-level dirs
    const home = this.createDir(this.root, 'home');
    const cadet = this.createDir(home, 'cadet');
    const varDir = this.createDir(this.root, 'var');
    const backups = this.createDir(varDir, 'backups');
    const logDir = this.createDir(varDir, 'log');
    const wwwDir = this.createDir(varDir, 'www');
    const uploadsDir = this.createDir(wwwDir, 'uploads');
    const etcDir = this.createDir(this.root, 'etc');
    const cryptoDir = this.createDir(etcDir, 'crypto');
    const srvDir = this.createDir(this.root, 'srv');
    const webDir = this.createDir(srvDir, 'web');
    this.createDir(this.root, 'bin');

    // /home/cadet files
    this.createFile(cadet, 'welcome.txt',
`=============================================================
  LEARNXSK // THE CYBER BLOCKLANDS SIMULATOR
=============================================================
Welcome Cadet! You are inside an isolated virtual Linux system.
Your mission is to train across 5 essential cybersecurity domains:
1. Linux Fundamentals    [Token Recovery]
2. Network Reconnaissance[Port Scanning & Discovery]
3. Web Security         [Authentication Audit]
4. Cryptography         [Cipher Decryption]
5. Threat Hunting       [Webshell Quarantine]

Type 'help' for all available commands, or 'hint' to consult Gemma AI.`);

    this.createFile(cadet, 'notes.txt',
`CADET OPERATIONAL FIELD NOTES:
- Mission 1 Token: Check /var/backups/token.env
- Mission 2 Gateway: Run 'scan' or 'ping 192.168.1.1'
- Mission 3 Web Auth: Inspect /srv/web/login.php or run 'curl http://internal/api/auth'
- Mission 4 Crypto: Base64 cipher stored in /etc/crypto/intercept.b64
- Mission 5 Backdoor: Check /var/log/access.log and quarantine rogue webshells`);

    this.createFile(cadet, 'cheatsheet.sh',
`#!/bin/bash
# Useful commands:
# ls -la                     (List all files with details)
# cat <path>                 (View file content)
# grep "pattern" <file>      (Search lines)
# scan                       (Run network port audit)
# ping <host>                (Ping host)
# curl <url>                 (Send HTTP request)
# base64 -d <file>           (Decode base64 string)
# rm <file>                  (Quarantine / remove file)
# gemma <question>           (Ask Gemma AI tutor directly)`);

    // /var/backups files (Task 1)
    this.createFile(backups, 'token.env',
`# LEARNXSK OUTPOST SYSTEM CONFIGURATION BACKUP
SECRET_TOKEN=LEARNXSK_BLOCKLANDS_QUEST001_VALIDATED
SYSTEM_STATUS=ONLINE
AUTHENTICATED_CADET=APPROVED
CHALLENGE_FLAG=FLAG{L1NUX_F1L3SYST3M_M4ST3R_OK}`);

    this.createFile(backups, 'config.bak',
`PORT=5174
HOST=127.0.0.1
CLUSTER_NODE=ALPHA_ISOMETRIC
GEMMA_CORE=ENABLED`);

    // /var/log files (Task 5)
    this.createFile(logDir, 'access.log',
`192.168.1.10 - - [11/Oct/2026:07:15:22 +0000] "GET /index.html HTTP/1.1" 200 4521
192.168.1.10 - - [11/Oct/2026:07:15:24 +0000] "GET /style.css HTTP/1.1" 200 1102
10.0.0.99 - - [11/Oct/2026:07:22:01 +0000] "POST /uploads/upload.php HTTP/1.1" 200 89
10.0.0.99 - - [11/Oct/2026:07:22:15 +0000] "POST /uploads/.stealth.php?cmd=id HTTP/1.1" 200 45 "eval(\$_POST['cmd'])"
10.0.0.99 - - [11/Oct/2026:07:22:30 +0000] "POST /uploads/.stealth.php?cmd=whoami HTTP/1.1" 200 24 "eval(\$_POST['cmd'])"
192.168.1.15 - - [11/Oct/2026:07:30:10 +0000] "GET /api/health HTTP/1.1" 200 18`);

    this.createFile(logDir, 'auth.log',
`Oct 11 07:10:01 outpost sshd[4012]: Accepted publickey for cadet from 192.168.1.100 port 52311 ssh2
Oct 11 07:12:44 outpost sshd[4088]: Failed password for invalid user root from 10.0.0.99 port 44212`);

    // /var/www/uploads (Task 5 backdoor)
    this.createFile(uploadsDir, '.stealth.php',
`<?php
// MALICIOUS ADVERSARY PERSISTENCE PAYLOAD DETECTED
if(isset($_POST['cmd'])) {
    system($_POST['cmd']);
    eval($_POST['cmd']);
}
?>`);

    // /srv/web (Task 3)
    this.createFile(webDir, 'login.php',
`<?php
// LearnXSK Web Authentication Handler
$username = $_POST['username'];
$password = $_POST['password'];

// VULNERABLE LOGIC IDENTIFIED:
// Direct string interpolation allows boolean bypass (' OR '1'='1)
$query = "SELECT * FROM users WHERE user = '" . $username . "' AND pass = '" . $password . "'";

// FLAG REVEALED ON AUDIT:
// FLAG{SQL1_B00L34N_BYP4SS_AUD1T_COMPL3T3}
?>`);

    this.createFile(webDir, 'robots.txt',
`User-agent: *
Disallow: /admin/
Disallow: /srv/web/login.php
Disallow: /api/auth`);

    // /etc/crypto (Task 4)
    this.createFile(cryptoDir, 'intercept.b64',
`TEVBUk5YU0tfe0NZQkVSX01BU1RFUl9QQVNTV09SRF85OTl9`);

    this.createFile(cryptoDir, 'keys.pub',
`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII0qjB74G9N... cadet@blocklands`);
  }

  private createDir(parent: FSNode, name: string): FSNode {
    const dir: FSNode = { name, isDir: true, children: {}, parent };
    parent.children![name] = dir;
    return dir;
  }

  private createFile(parent: FSNode, name: string, content: string): FSNode {
    const file: FSNode = { name, isDir: false, content, parent };
    parent.children![name] = file;
    return file;
  }

  public getPromptPath(): string {
    if (this.currentPath === '/home/cadet') return '~';
    return this.currentPath;
  }

  public getCurrentPath(): string {
    return this.currentPath;
  }

  public execute(rawCommand: string): { output: string; isError?: boolean; isClear?: boolean } {
    const trimmed = rawCommand.trim();
    if (!trimmed) return { output: '' };

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const qm = QuestManager.getInstance();

    let result: { output: string; isError?: boolean; isClear?: boolean } = { output: '' };

    switch (cmd) {
      case 'clear':
        result = { output: '', isClear: true };
        break;

      case 'pwd':
        result = { output: this.currentPath };
        break;

      case 'whoami':
        result = { output: 'cadet' };
        break;

      case 'id':
        result = { output: 'uid=1001(cadet) gid=1001(cadet) groups=1001(cadet),27(sudo),44(security)' };
        break;

      case 'uname':
        result = { output: 'Linux outpost-cyber-node 6.8.0-learnxsk #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux' };
        break;

      case 'env':
        result = { output: 'USER=cadet\nHOME=/home/cadet\nSHELL=/bin/bash\nTERM=xterm-256color\nACADEMY_ZONE=BLOCKLANDS\nAI_MENTOR=gemma4' };
        break;

      case 'help':
        result = { output:
`AVAILABLE COMMANDS:
---------------------------------------------------------------
  Navigation:   ls [-la], cd <dir>, pwd
  File Ops:     cat <file>, head, tail, grep <pat> <file>, rm <file>
  Inspection:   whoami, id, uname -a, ps, env
  Network:      scan, ping <host>, netstat, curl <url>
  Crypto:       base64 [-d <file>], sha256sum <file>
  AI Tutor:     gemma <question>, hint, ask <question>
  Utilities:    clear, help
---------------------------------------------------------------` };
        break;

      case 'hint': {
        const curr = qm.getCurrentMission();
        result = { output: `[GEMMA 4 ADVICE]: ${curr.gemmaAdvice}\nRecommended next step: ${curr.steps.find(s => !s.completed)?.text || 'All mission objectives accomplished!'}` };
        break;
      }

      case 'gemma':
      case 'ask': {
        const question = args.join(' ').trim();
        if (!question) {
          const curr = qm.getCurrentMission();
          result = {
            output:
`================================================================
  [GEMMA AI TUTOR: ONLINE & ACTIVE]
  Role: Personal Cybersecurity & Terminal Mentor
  Active Mission: ${curr.title}
================================================================
  Advice for your current objective:
  "${curr.gemmaAdvice}"

  Ask Gemma anything directly! Examples:
    gemma how do I find the token?
    gemma what does base64 do?
    gemma where is the station?
    hint`
          };
        } else {
          result = { output: `[Gemma AI thinking...] Analyzing query: "${question}"...` };
          GemmaClient.getInstance().askTutor(question, qm.getCurrentMission().title, this.currentPath).then(res => {
            if (this.onCommandExecuted) {
              const srcTag = res.source === 'ollama' ? 'Local Model' : 'On-Device Cyber Intelligence';
              this.onCommandExecuted(rawCommand, `\n[GEMMA AI TUTOR RESPONSE (${srcTag})]:\n${res.answer}${res.suggestedAction ? `\n\nSuggested Next Command: ${res.suggestedAction}` : ''}`);
            }
          });
        }
        break;
      }

      case 'ls': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');

        const targetNode = args.find(a => !a.startsWith('-'))
          ? this.resolvePath(args.find(a => !a.startsWith('-'))!)
          : this.currentDir;

        if (!targetNode) {
          result = { output: `ls: cannot access '${args[0]}': No such file or directory`, isError: true };
          break;
        }

        if (!targetNode.isDir) {
          result = { output: targetNode.name };
          break;
        }

        const entries = Object.keys(targetNode.children || {});
        const filtered = showAll ? entries : entries.filter(e => !e.startsWith('.'));

        if (showLong) {
          const lines = filtered.map(name => {
            const child = targetNode.children![name];
            const type = child.isDir ? 'd' : '-';
            const perms = child.isDir ? 'rwxr-xr-x' : 'rw-r--r--';
            const size = child.isDir ? 4096 : (child.content?.length || 0);
            return `${type}${perms}  1 cadet security  ${size.toString().padStart(5, ' ')} Oct 11 07:00  ${name}${child.isDir ? '/' : ''}`;
          });
          result = { output: `total ${lines.length}\n` + lines.join('\n') };
        } else {
          result = { output: filtered.map(n => targetNode.children![n].isDir ? n + '/' : n).join('  ') };
        }
        break;
      }

      case 'cd': {
        const targetPath = args[0] || '/home/cadet';
        if (targetPath === '~') {
          this.currentPath = '/home/cadet';
          this.currentDir = this.resolvePath(this.currentPath)!;
          result = { output: '' };
          break;
        }

        const targetNode = this.resolvePath(targetPath);
        if (!targetNode) {
          result = { output: `cd: ${targetPath}: No such file or directory`, isError: true };
        } else if (!targetNode.isDir) {
          result = { output: `cd: ${targetPath}: Not a directory`, isError: true };
        } else {
          this.currentDir = targetNode;
          this.currentPath = this.getNodeFullPath(targetNode);
          result = { output: '' };
        }
        break;
      }

      case 'cat': {
        if (!args[0]) {
          result = { output: 'cat: missing file operand', isError: true };
          break;
        }
        const fileNode = this.resolvePath(args[0]);
        if (!fileNode) {
          result = { output: `cat: ${args[0]}: No such file or directory`, isError: true };
        } else if (fileNode.isDir) {
          result = { output: `cat: ${args[0]}: Is a directory`, isError: true };
        } else {
          result = { output: fileNode.content || '' };

          // === TASK 1 TRIGGER ===
          if (args[0].includes('token.env') || fileNode.name === 'token.env') {
            qm.completeStep('task_001', 't1_locate');
            qm.completeStep('task_001', 't1_token');
          }

          // === TASK 3 TRIGGER ===
          if (args[0].includes('login.php') || fileNode.name === 'login.php') {
            qm.completeStep('task_003', 't3_inspect');
          }

          // === TASK 4 TRIGGER ===
          if (args[0].includes('intercept.b64') || fileNode.name === 'intercept.b64') {
            qm.completeStep('task_004', 't4_read');
          }

          // === TASK 5 TRIGGER ===
          if (args[0].includes('.stealth.php') || fileNode.name === '.stealth.php') {
            qm.completeStep('task_005', 't5_find');
          }
        }
        break;
      }

      case 'grep': {
        if (args.length < 2) {
          result = { output: 'Usage: grep [PATTERN] [FILE]', isError: true };
          break;
        }
        const pattern = args[0].replace(/['"]/g, '');
        const filePath = args[1];
        const fileNode = this.resolvePath(filePath);

        if (!fileNode || fileNode.isDir) {
          result = { output: `grep: ${filePath}: No such file or directory`, isError: true };
        } else {
          const lines = (fileNode.content || '').split('\n');
          const matches = lines.filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
          result = { output: matches.length > 0 ? matches.join('\n') : `(no matches found for pattern '${pattern}')` };

          // === TASK 5 GREP TRIGGER ===
          if (filePath.includes('access.log') && pattern.toLowerCase().includes('eval')) {
            qm.completeStep('task_005', 't5_grep');
          }
        }
        break;
      }

      case 'rm': {
        if (!args[0]) {
          result = { output: 'rm: missing operand', isError: true };
          break;
        }
        const target = this.resolvePath(args[0]);
        if (!target) {
          result = { output: `rm: cannot remove '${args[0]}': No such file or directory`, isError: true };
        } else if (target.isDir) {
          result = { output: `rm: cannot remove '${args[0]}': Is a directory (use -r)`, isError: true };
        } else {
          const parent = target.parent;
          if (parent && parent.children) {
            delete parent.children[target.name];
            result = { output: `Removed '${args[0]}'. Backdoor successfully quarantined!` };

            // === TASK 5 REMOVE TRIGGER ===
            if (target.name === '.stealth.php' || args[0].includes('.stealth.php')) {
              qm.completeStep('task_005', 't5_delete');
            }
          }
        }
        break;
      }

      // === NETWORK RECON TOOLS (TASK 2) ===
      case 'scan':
      case 'nmap': {
        qm.completeStep('task_002', 't2_scan');
        qm.completeStep('task_002', 't2_port');
        result = { output:
`Starting Blocklands Cyber Port Scanner v2.4 (https://learnxsk.local)
Scanning subnet 192.168.1.0/24 ...

Host 192.168.1.1 (Gateway Router):
  PORT     STATE SERVICE       VERSION
  53/tcp   open  domain        dnsmasq 2.86
  80/tcp   open  http          nginx/1.24.0

Host 192.168.1.50 (Perimeter Outpost Server):
  PORT     STATE SERVICE       VERSION
  22/tcp   filtered ssh        OpenSSH 9.3
  2222/tcp OPEN  ssh-backdoor  Dropbear SSH 2022.82 (UNAUTHORIZED LISTENER DETECTED!)
  8080/tcp open  http-proxy    Vite/Three.js Game Node

Scan completed: 2 hosts up. Discovered rogue listener on PORT 2222!` };
        break;
      }

      case 'ping': {
        const host = args[0] || '192.168.1.1';
        qm.completeStep('task_002', 't2_ping');
        result = { output:
`PING ${host} (${host}) 56(84) bytes of data.
64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.412 ms
64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.388 ms
64 bytes from ${host}: icmp_seq=3 ttl=64 time=0.405 ms
--- ${host} ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, rtt min/avg/max = 0.388/0.401/0.412 ms` };
        break;
      }

      case 'netstat':
      case 'ss': {
        qm.completeStep('task_002', 't2_scan');
        result = { output:
`Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      1024/nginx
tcp        0      0 0.0.0.0:2222            0.0.0.0:*               LISTEN      4096/dropbear-rogue
tcp        0      0 127.0.0.1:5174          0.0.0.0:*               LISTEN      29680/vite` };
        break;
      }

      // === WEB RECON (TASK 3) ===
      case 'curl': {
        const url = args[0] || '';
        if (url.includes('internal/api/auth') || url.includes('auth')) {
          qm.completeStep('task_003', 't3_curl');
          qm.completeStep('task_003', 't3_bypass');
          result = { output:
`HTTP/1.1 200 OK
Server: LearnXSK-WebBastion/2.0
Content-Type: application/json
X-Security-Flag: FLAG{SQL1_B00L34N_BYP4SS_AUD1T_COMPL3T3}

{"status":"success","session":"admin_authenticated","role":"superadmin","token":"SEC_WEB_9921_OK"}` };
        } else {
          result = { output:
`<!DOCTYPE html>
<html><head><title>LearnXSK Internal Portal</title></head>
<body><h1>LearnXSK Web Bastion</h1><p>Available endpoints: /api/auth, /login.php</p></body></html>` };
        }
        break;
      }

      // === CRYPTOGRAPHY (TASK 4) ===
      case 'base64': {
        const isDecode = args.includes('-d') || args.includes('--decode');
        const fileArg = args.find(a => !a.startsWith('-'));

        if (!fileArg) {
          result = { output: 'Usage: base64 -d [FILE]', isError: true };
          break;
        }

        const fileNode = this.resolvePath(fileArg);
        if (!fileNode || fileNode.isDir) {
          result = { output: `base64: ${fileArg}: No such file`, isError: true };
          break;
        }

        const content = (fileNode.content || '').trim();
        if (isDecode) {
          try {
            const decoded = atob(content);
            qm.completeStep('task_004', 't4_decode');
            result = { output: `[DECODED PLAINTEXT RESULT]:\n${decoded}\n\nKey validated! Passcode matches Master Cyber Vault.` };
          } catch {
            result = { output: 'base64: invalid input stream', isError: true };
          }
        } else {
          result = { output: btoa(content) };
        }
        break;
      }

      case 'sha256sum': {
        const fileArg = args[0];
        const fileNode = fileArg ? this.resolvePath(fileArg) : null;
        if (!fileNode) {
          result = { output: `sha256sum: ${fileArg}: No such file`, isError: true };
        } else {
          qm.completeStep('task_004', 't4_sha');
          result = { output: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  ${fileArg}` };
        }
        break;
      }

      case 'ps':
        result = { output:
`  PID TTY          TIME CMD
 1001 pts/0    00:00:00 bash
 4096 pts/0    00:00:01 dropbear (port 2222)
 8112 pts/0    00:00:00 ps` };
        break;

      default:
        result = { output: `${cmd}: command not found. Type 'help' for available commands.`, isError: true };
        break;
    }

    if (this.onCommandExecuted) {
      this.onCommandExecuted(rawCommand, result.output);
    }

    return result;
  }

  private resolvePath(pathStr: string): FSNode | null {
    if (!pathStr) return null;

    let tokens: string[];
    let curr: FSNode;

    if (pathStr.startsWith('/')) {
      curr = this.root;
      tokens = pathStr.split('/').filter(Boolean);
    } else if (pathStr.startsWith('~')) {
      const homeCadet = this.resolvePath('/home/cadet');
      if (!homeCadet) return null;
      curr = homeCadet;
      tokens = pathStr.substring(1).split('/').filter(Boolean);
    } else {
      curr = this.currentDir;
      tokens = pathStr.split('/').filter(Boolean);
    }

    for (const t of tokens) {
      if (t === '.') continue;
      if (t === '..') {
        curr = curr.parent || this.root;
      } else {
        if (!curr.children || !curr.children[t]) {
          return null;
        }
        curr = curr.children[t];
      }
    }

    return curr;
  }

  private getNodeFullPath(node: FSNode): string {
    if (node === this.root) return '/';
    const pathParts: string[] = [];
    let cur: FSNode | undefined = node;
    while (cur && cur !== this.root) {
      pathParts.unshift(cur.name);
      cur = cur.parent;
    }
    return '/' + pathParts.join('/');
  }
}
