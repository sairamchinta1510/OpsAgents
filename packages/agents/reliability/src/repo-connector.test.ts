import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { RepoConnector } from './repo-connector.js';

describe('RepoConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectLanguage', () => {
    it('returns "typescript" when package.json exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return (p as string).endsWith('package.json');
      });

      const connector = new RepoConnector();
      const result = connector.detectLanguage('/fake/dir');

      expect(result).toBe('typescript');
      expect(existsSpy).toHaveBeenCalledWith(path.join('/fake/dir', 'package.json'));
      existsSpy.mockRestore();
    });

    it('returns "java" when pom.xml exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return (p as string).endsWith('pom.xml');
      });

      const connector = new RepoConnector();
      const result = connector.detectLanguage('/fake/dir');

      expect(result).toBe('java');
      expect(existsSpy).toHaveBeenCalledWith(path.join('/fake/dir', 'pom.xml'));
      existsSpy.mockRestore();
    });

    it('returns "python" when requirements.txt exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return (p as string).endsWith('requirements.txt');
      });

      const connector = new RepoConnector();
      const result = connector.detectLanguage('/fake/dir');

      expect(result).toBe('python');
      expect(existsSpy).toHaveBeenCalledWith(path.join('/fake/dir', 'requirements.txt'));
      existsSpy.mockRestore();
    });

    it('returns "c" when CMakeLists.txt exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        return (p as string).endsWith('CMakeLists.txt');
      });

      const connector = new RepoConnector();
      const result = connector.detectLanguage('/fake/dir');

      expect(result).toBe('c');
      expect(existsSpy).toHaveBeenCalledWith(path.join('/fake/dir', 'CMakeLists.txt'));
      existsSpy.mockRestore();
    });

    it('returns "unknown" when no marker file exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const connector = new RepoConnector();
      const result = connector.detectLanguage('/fake/dir');

      expect(result).toBe('unknown');
      existsSpy.mockRestore();
    });
  });

  describe('discoverLogPaths', () => {
    it('returns files from logs/ directory', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        const pathStr = p as string;
        // Only the 'logs' dir exists, not 'log', 'var/log', 'tmp/logs', or 'output'
        return pathStr === path.join('/fake/dir', 'logs');
      });

      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([
        'app.log',
        'error.log',
        'debug.txt',
        'other.json', // should be filtered out
      ] as any);

      const connector = new RepoConnector();
      const result = connector.discoverLogPaths('/fake/dir', 'unknown');

      expect(result).toEqual([
        path.join('/fake/dir', 'logs', 'app.log'),
        path.join('/fake/dir', 'logs', 'error.log'),
        path.join('/fake/dir', 'logs', 'debug.txt'),
      ]);

      existsSpy.mockRestore();
      readdirSpy.mockRestore();
    });
  });

  describe('connect', () => {
    it('calls git pull when .git dir already exists', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        // .git exists, no log dirs
        return (p as string).includes('.git');
      });

      const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([] as any);

      const shellMock = vi.fn((cmd: string, _cwd: string) => {
        if (cmd === 'git pull') return '';
        if (cmd === 'git rev-parse --abbrev-ref HEAD') return 'main\n';
        return '';
      });

      const connector = new RepoConnector(shellMock);
      const result = connector.connect({
        repoUrl: 'https://github.com/test/repo',
        cloneDir: '/fake/clone',
      });

      expect(shellMock).toHaveBeenCalledWith('git pull', '/fake/clone');
      expect(shellMock).not.toHaveBeenCalledWith(
        expect.stringContaining('git clone'),
        expect.anything()
      );
      expect(mkdirSpy).not.toHaveBeenCalled();
      expect(result.cloneDir).toBe('/fake/clone');
      expect(result.branch).toBe('main');

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      readdirSpy.mockRestore();
    });

    it('calls git clone when .git dir does NOT exist', () => {
      const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const mkdirSpy = vi.spyOn(fs, 'mkdirSync');
      const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue([] as any);

      const shellMock = vi.fn((cmd: string, _cwd: string) => {
        if (cmd === 'git clone https://github.com/test/repo .') return '';
        if (cmd === 'git rev-parse --abbrev-ref HEAD') return 'main\n';
        return '';
      });

      const connector = new RepoConnector(shellMock);
      const result = connector.connect({
        repoUrl: 'https://github.com/test/repo',
        cloneDir: '/fake/clone',
      });

      expect(mkdirSpy).toHaveBeenCalledWith('/fake/clone', { recursive: true });
      expect(shellMock).toHaveBeenCalledWith('git clone https://github.com/test/repo .', '/fake/clone');
      expect(shellMock).not.toHaveBeenCalledWith('git pull', expect.anything());
      expect(result.cloneDir).toBe('/fake/clone');
      expect(result.branch).toBe('main');

      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      readdirSpy.mockRestore();
    });
  });
});
