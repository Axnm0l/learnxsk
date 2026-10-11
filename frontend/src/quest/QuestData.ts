export type QuestStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';

export interface MissionStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface Mission {
  id: string;
  number: string;
  category: 'linux' | 'network' | 'web' | 'crypto' | 'forensics';
  title: string;
  stationName: string;
  stationLocation: [number, number]; // [x, z] coordinate
  description: string;
  instructions: string[];
  steps: MissionStep[];
  recommendedCommands: string[];
  status: QuestStatus;
  rewardXP: number;
  badgeName: string;
  badgeIcon: string;
  gemmaAdvice: string;
}

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'task_001',
    number: 'MISSION 001',
    category: 'linux',
    title: 'First Foothold: System Token Recovery',
    stationName: 'Terminal Outpost Station (East)',
    stationLocation: [16, 0],
    description: 'The academy outpost system rebooted and mislaid its core configuration files. Navigate through the virtual Linux filesystem and locate the secret verification token archived in `/var/backups/token.env`.',
    instructions: [
      'Approach the Terminal Outpost Station at coordinates [16, 0] and press [E] to open the shell.',
      'Use `ls` and `cd` to explore the directory tree, or inspect `/var/backups`.',
      'Read the file using `cat /var/backups/token.env` to extract and verify the system token.'
    ],
    steps: [
      { id: 't1_open', text: 'Open Terminal Outpost Station [E]', completed: false },
      { id: 't1_locate', text: 'Locate `/var/backups/token.env` file', completed: false },
      { id: 't1_token', text: 'Read token using `cat /var/backups/token.env`', completed: false }
    ],
    recommendedCommands: ['pwd', 'ls -la', 'cd /var/backups', 'cat token.env'],
    status: 'AVAILABLE',
    rewardXP: 100,
    badgeName: 'Linux Explorer',
    badgeIcon: '🐧',
    gemmaAdvice: 'Remember, Linux paths are hierarchical! `/var/backups` stores administrative archives. Use `cat` followed by the full file path.'
  },
  {
    id: 'task_002',
    number: 'MISSION 002',
    category: 'network',
    title: 'Perimeter Recon: Port Audit & Service Discovery',
    stationName: 'Network Watchtower Terminal (North)',
    stationLocation: [0, -22],
    description: 'Network anomaly detected on the Blocklands gateway subnet (192.168.1.0/24). Perform port reconnaissance to discover open services and detect the unauthorized listener on port 2222.',
    instructions: [
      'Head to the Network Watchtower [0, -22] or use the Outpost terminal.',
      'Execute `scan` (or `netstat -tuln`) to enumerate listening services across the local subnet.',
      'Identify the stealth SSH service operating on port 2222 and verify connectivity with `ping 192.168.1.1`.'
    ],
    steps: [
      { id: 't2_scan', text: 'Run network reconnaissance scan (`scan` or `netstat`)', completed: false },
      { id: 't2_ping', text: 'Ping the gateway router (`ping 192.168.1.1`)', completed: false },
      { id: 't2_port', text: 'Inspect port 2222 service banner', completed: false }
    ],
    recommendedCommands: ['scan', 'ping 192.168.1.1', 'netstat', 'curl 192.168.1.50:2222'],
    status: 'LOCKED',
    rewardXP: 150,
    badgeName: 'Network Scout',
    badgeIcon: '📡',
    gemmaAdvice: 'Reconnaissance is step one of any assessment. `scan` probes known network nodes and prints the open ports and active service banners.'
  },
  {
    id: 'task_003',
    number: 'MISSION 003',
    category: 'web',
    title: 'Web Bastion: Authentication & API Audit',
    stationName: 'Web Bastion Security Node (South)',
    stationLocation: [0, 22],
    description: 'An internal web authentication service was deployed with a critical logic vulnerability. Audit the HTTP endpoint and inspect `/srv/web/login.php` to secure the administrative session.',
    instructions: [
      'Open the terminal at the Web Bastion Node [0, 22].',
      'Inspect the server authentication code using `cat /srv/web/login.php`.',
      'Simulate an API authentication request using `curl http://internal/api/auth` to verify the security headers.'
    ],
    steps: [
      { id: 't3_inspect', text: 'Inspect web auth source (`cat /srv/web/login.php`)', completed: false },
      { id: 't3_curl', text: 'Query API endpoint (`curl http://internal/api/auth`)', completed: false },
      { id: 't3_bypass', text: 'Validate administrative authorization token', completed: false }
    ],
    recommendedCommands: ['cat /srv/web/login.php', 'curl http://internal/api/auth', 'curl -I http://internal'],
    status: 'LOCKED',
    rewardXP: 200,
    badgeName: 'Web Sentinel',
    badgeIcon: '🌐',
    gemmaAdvice: 'In web security, never trust user input! Notice how SQL queries must use parameterized statements rather than string concatenation.'
  },
  {
    id: 'task_004',
    number: 'MISSION 004',
    category: 'crypto',
    title: 'Crypto Sanctum: Intercepted Cipher Decryption',
    stationName: 'Cryptography Sanctum Monolith (West)',
    stationLocation: [-22, 0],
    description: 'The cyber reconnaissance drone intercepted an encoded cipher transmission stored in `/etc/crypto/intercept.b64`. Use cryptographic decoding tools to recover the secret plaintext key.',
    instructions: [
      'Travel to the Cryptography Sanctum on the western plaza [-22, 0].',
      'Inspect the encoded transmission via `cat /etc/crypto/intercept.b64`.',
      'Decode the Base64 stream using `base64 -d /etc/crypto/intercept.b64` to reveal the secret master passcode.'
    ],
    steps: [
      { id: 't4_read', text: 'Inspect cipher file (`cat /etc/crypto/intercept.b64`)', completed: false },
      { id: 't4_decode', text: 'Decode stream using `base64 -d /etc/crypto/intercept.b64`', completed: false },
      { id: 't4_sha', text: 'Verify checksum (`sha256sum /etc/crypto/intercept.b64`)', completed: false }
    ],
    recommendedCommands: ['cat /etc/crypto/intercept.b64', 'base64 -d /etc/crypto/intercept.b64', 'sha256sum /etc/crypto/intercept.b64'],
    status: 'LOCKED',
    rewardXP: 250,
    badgeName: 'Crypto Analyst',
    badgeIcon: '🔐',
    gemmaAdvice: 'Base64 is an encoding format, not an encryption cipher. Passing `-d` instructs the utility to decode the radix-64 stream back into human-readable bytes.'
  },
  {
    id: 'task_005',
    number: 'MISSION 005',
    category: 'forensics',
    title: 'Threat Hunter: Rogue Webshell Quarantine',
    stationName: 'Central Defense Hub [0, 0]',
    stationLocation: [0, 0],
    description: 'Alert! Threat intelligence reports an adversary uploaded a hidden stealth backdoor to the public uploads folder. Search access logs with `grep`, pinpoint the webshell, and quarantine it with `rm`.',
    instructions: [
      'Access any terminal console in the world.',
      'Search the web server access logs for remote execution patterns using `grep "eval" /var/log/access.log`.',
      'Inspect the malicious file at `/var/www/uploads/.stealth.php`.',
      'Quarantine the backdoor by executing `rm /var/www/uploads/.stealth.php`.'
    ],
    steps: [
      { id: 't5_grep', text: 'Search logs for malicious payloads (`grep "eval" /var/log/access.log`)', completed: false },
      { id: 't5_find', text: 'Inspect backdoor (`cat /var/www/uploads/.stealth.php`)', completed: false },
      { id: 't5_delete', text: 'Quarantine and remove backdoor (`rm /var/www/uploads/.stealth.php`)', completed: false }
    ],
    recommendedCommands: ['grep "eval" /var/log/access.log', 'ls -la /var/www/uploads', 'cat /var/www/uploads/.stealth.php', 'rm /var/www/uploads/.stealth.php'],
    status: 'LOCKED',
    rewardXP: 300,
    badgeName: 'Master Defender',
    badgeIcon: '🛡️',
    gemmaAdvice: 'Threat hunters scrutinize access logs for irregular HTTP verbs and hidden dotfiles in writeable directories. Removing `.stealth.php` neutralizes the attacker persistence!'
  }
];
