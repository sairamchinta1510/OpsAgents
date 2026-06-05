import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export interface RepoConfig {
  repoUrl: string;        // HTTPS GitHub URL, e.g. "https://github.com/owner/repo"
  cloneDir: string;       // absolute local path to clone into
  branch?: string;        // branch to checkout; defaults to default branch
}

export interface RepoConnectionResult {
  cloneDir: string;
  language: string;       // "typescript" | "java" | "python" | "c" | "unknown"
  logPaths: string[];     // discovered log paths (globs resolved to absolute paths)
  branch: string;
}

export class RepoConnector {
  private shellRunner: (cmd: string, cwd: string) => string;

  constructor(shellRunner?: (cmd: string, cwd: string) => string) {
    this.shellRunner = shellRunner ?? ((cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8' }));
  }

  connect(config: RepoConfig): RepoConnectionResult {
    // 1. Clone or pull
    if (fs.existsSync(path.join(config.cloneDir, '.git'))) {
      this.shellRunner('git pull', config.cloneDir);
    } else {
      fs.mkdirSync(config.cloneDir, { recursive: true });
      this.shellRunner(`git clone ${config.repoUrl} .`, config.cloneDir);
    }

    // 2. Checkout branch if specified
    let branch = config.branch ?? 'main';
    if (config.branch) {
      this.shellRunner(`git checkout ${config.branch}`, config.cloneDir);
    } else {
      // detect default branch
      try {
        branch = this.shellRunner('git rev-parse --abbrev-ref HEAD', config.cloneDir).trim();
      } catch { branch = 'main'; }
    }

    // 3. Detect language
    const language = this.detectLanguage(config.cloneDir);

    // 4. Discover log paths
    const logPaths = this.discoverLogPaths(config.cloneDir, language);

    return { cloneDir: config.cloneDir, language, logPaths, branch };
  }

  detectLanguage(dir: string): string {
    if (fs.existsSync(path.join(dir, 'package.json'))) return 'typescript';
    if (fs.existsSync(path.join(dir, 'pom.xml')) || fs.existsSync(path.join(dir, 'build.gradle'))) return 'java';
    if (fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'Pipfile'))) return 'python';
    if (fs.existsSync(path.join(dir, 'CMakeLists.txt')) || fs.existsSync(path.join(dir, 'Makefile'))) return 'c';
    return 'unknown';
  }

  discoverLogPaths(dir: string, language: string): string[] {
    const candidates: string[] = [];

    // Common log directories
    const commonDirs = ['logs', 'log', 'var/log', 'tmp/logs', 'output'];
    for (const d of commonDirs) {
      const full = path.join(dir, d);
      if (fs.existsSync(full)) {
        const files = fs.readdirSync(full).filter(f => f.endsWith('.log') || f.endsWith('.txt'));
        candidates.push(...files.map(f => path.join(full, f)));
      }
    }

    // Language-specific
    if (language === 'java') {
      // Spring Boot / Maven targets
      const springLog = path.join(dir, 'spring.log');
      if (fs.existsSync(springLog)) candidates.push(springLog);
    }
    if (language === 'typescript') {
      const nodeLog = path.join(dir, 'npm-debug.log');
      if (fs.existsSync(nodeLog)) candidates.push(nodeLog);
    }

    return [...new Set(candidates)];
  }
}
