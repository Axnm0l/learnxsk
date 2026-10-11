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

  public onTokenFound?: (token: string) => void;

  constructor() {
    // Construct VFS hierarchy
    this.root = {
      name: '',
      isDir: true,
      children: {}
    };

    const home: FSNode = { name: 'home', isDir: true, children: {}, parent: this.root };
    const cadet: FSNode = { name: 'cadet', isDir: true, children: {}, parent: home };
    const varDir: FSNode = { name: 'var', isDir: true, children: {}, parent: this.root };
    const backups: FSNode = { name: 'backups', isDir: true, children: {}, parent: varDir };
    const binDir: FSNode = { name: 'bin', isDir: true, children: {}, parent: this.root };

    this.root.children!['home'] = home;
    this.root.children!['var'] = varDir;
    this.root.children!['bin'] = binDir;

    home.children!['cadet'] = cadet;
    varDir.children!['backups'] = backups;

    // Files in /home/cadet
    cadet.children!['welcome.txt'] = {
      name: 'welcome.txt',
      isDir: false,
      content: 'Welcome to LearnXSK: The Blocklands!\nYour mission is to locate the lost outpost system token in the filesystem backups.\nUse `ls`, `cd`, and `cat` to explore!',
      parent: cadet
    };

    cadet.children!['notes.txt'] = {
      name: 'notes.txt',
      isDir: false,
      content: 'MEMORANDUM:\nOutpost sysadmin archived critical system keys to `/var/backups/token.env`.\nInspect the backups folder to complete Mission 001.',
      parent: cadet
    };

    // Files in /var/backups
    backups.children!['token.env'] = {
      name: 'token.env',
      isDir: false,
      content: 'SECRET_TOKEN=LEARNXSK_BLOCKLANDS_QUEST001_VALIDATED\nSYSTEM_STATUS=ONLINE\nCLUSTER_NODE=ALPHA\nCHALLENGE_FLAG=COMPLETE',
      parent: backups
    };

    backups.children!['config.bak'] = {
      name: 'config.bak',
      isDir: false,
      content: '# LearnXSK Outpost Configuration Backup\nPORT=5173\nHOST=127.0.0.1\nENV=production\nAI_TUTOR=gemma2:2b',
      parent: backups
    };

    backups.children!['system.log'] = {
      name: 'system.log',
      isDir: false,
      content: '2026-10-11 04:55:00 [INFO] System kernel booted.\n2026-10-11 05:00:12 [INFO] Outpost terminal beacon enabled.\n2026-10-11 05:02:45 [AUTH] Token verified and saved to token.env',
      parent: backups
    };

    this.currentDir = cadet;
  }

  public getPromptPath(): string {
    if (this.currentPath === '/home/cadet') return '~';
    return this.currentPath;
  }

  public execute(rawCommand: string): { output: string; isError?: boolean; isClear?: boolean } {
    const trimmed = rawCommand.trim();
    if (!trimmed) return { output: '' };

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'clear':
        return { output: '', isClear: true };

      case 'pwd':
        return { output: this.currentPath };

      case 'whoami':
        return { output: 'cadet' };

      case 'help':
        return {
          output: [
            'LearnXSK Simulated Linux Shell - Available Commands:',
            '  ls [-l|-la]       List directory contents',
            '  cd <path>         Change current working directory (e.g. cd /var/backups, cd ..)',
            '  pwd               Print current working directory',
            '  cat <filename>    Display contents of a file',
            '  grep <word> <file> Search for pattern in file',
            '  hint              Ask Gemma AI Tutor for assistance',
            '  clear             Clear screen'
          ].join('\n')
        };

      case 'ls':
        return this.handleLs(args);

      case 'cd':
        return this.handleCd(args[0]);

      case 'cat':
        return this.handleCat(args[0]);

      case 'grep':
        return this.handleGrep(args);

      default:
        return {
          output: `bash: ${cmd}: command not found. Type 'help' for available commands.`,
          isError: true
        };
    }
  }

  private handleLs(args: string[]): { output: string } {
    if (!this.currentDir.children) return { output: '' };

    const showDetails = args.includes('-l') || args.includes('-la') || args.includes('-al');
    const keys = Object.keys(this.currentDir.children);

    if (keys.length === 0) return { output: '(empty directory)' };

    if (!showDetails) {
      const formatted = keys.map(k => {
        const node = this.currentDir.children![k];
        return node.isDir ? `\x1b[34m${k}/\x1b[0m` : k;
      }).join('  ');
      return { output: formatted };
    }

    const lines = keys.map(k => {
      const node = this.currentDir.children![k];
      const type = node.isDir ? 'drwxr-xr-x' : '-rw-r--r--';
      const size = node.isDir ? '4096' : (node.content?.length.toString() || '0');
      return `${type} 1 cadet cadet ${size.padStart(5, ' ')} Oct 11 ${node.isDir ? k + '/' : k}`;
    });

    return { output: `total ${keys.length * 4}\n` + lines.join('\n') };
  }

  private handleCd(targetPath?: string): { output: string; isError?: boolean } {
    if (!targetPath || targetPath === '~') {
      // Go to /home/cadet
      const homeCadet = this.resolvePath('/home/cadet');
      if (homeCadet) {
        this.currentDir = homeCadet;
        this.currentPath = '/home/cadet';
      }
      return { output: '' };
    }

    const resolved = this.resolvePath(targetPath);
    if (!resolved) {
      return { output: `bash: cd: ${targetPath}: No such file or directory`, isError: true };
    }

    if (!resolved.isDir) {
      return { output: `bash: cd: ${targetPath}: Not a directory`, isError: true };
    }

    this.currentDir = resolved;
    this.currentPath = this.reconstructPath(resolved);
    return { output: '' };
  }

  private handleCat(targetFile?: string): { output: string; isError?: boolean } {
    if (!targetFile) {
      return { output: 'usage: cat <filename>', isError: true };
    }

    const resolved = this.resolvePath(targetFile);
    if (!resolved) {
      return { output: `cat: ${targetFile}: No such file or directory`, isError: true };
    }

    if (resolved.isDir) {
      return { output: `cat: ${targetFile}: Is a directory`, isError: true };
    }

    const content = resolved.content || '';

    // Check if player read the target quest token!
    if (resolved.name === 'token.env' || content.includes('SECRET_TOKEN')) {
      if (this.onTokenFound) {
        this.onTokenFound('LEARNXSK_BLOCKLANDS_QUEST001_VALIDATED');
      }
    }

    return { output: content };
  }

  private handleGrep(args: string[]): { output: string; isError?: boolean } {
    if (args.length < 2) {
      return { output: 'usage: grep <pattern> <filename>', isError: true };
    }

    const pattern = args[0];
    const targetFile = args[1];

    const resolved = this.resolvePath(targetFile);
    if (!resolved) {
      return { output: `grep: ${targetFile}: No such file or directory`, isError: true };
    }

    if (resolved.isDir) {
      return { output: `grep: ${targetFile}: Is a directory`, isError: true };
    }

    const lines = (resolved.content || '').split('\n');
    const matched = lines.filter(l => l.toLowerCase().includes(pattern.toLowerCase()));

    if (matched.length === 0) {
      return { output: '' };
    }

    // Trigger token discovery if grep hits SECRET
    if (pattern.toUpperCase().includes('SECRET') || matched.some(m => m.includes('SECRET_TOKEN'))) {
      if (this.onTokenFound) {
        this.onTokenFound('LEARNXSK_BLOCKLANDS_QUEST001_VALIDATED');
      }
    }

    return { output: matched.join('\n') };
  }

  private resolvePath(pathStr: string): FSNode | null {
    if (pathStr === '/') return this.root;

    const isAbsolute = pathStr.startsWith('/');
    let current = isAbsolute ? this.root : this.currentDir;

    const segments = pathStr.split('/').filter(s => s.length > 0);

    for (const seg of segments) {
      if (seg === '.') continue;
      if (seg === '..') {
        current = current.parent || this.root;
      } else {
        if (!current.children || !current.children[seg]) {
          return null;
        }
        current = current.children[seg];
      }
    }

    return current;
  }

  private reconstructPath(node: FSNode): string {
    if (node === this.root) return '/';
    const parts: string[] = [];
    let curr: FSNode | undefined = node;
    while (curr && curr !== this.root) {
      parts.unshift(curr.name);
      curr = curr.parent;
    }
    return '/' + parts.join('/');
  }
}
