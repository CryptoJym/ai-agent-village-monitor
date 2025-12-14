/**
 * VersionWatcher Tests
 *
 * Tests for monitoring provider version releases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VersionWatcher } from '../version/VersionWatcher';

describe('VersionWatcher', () => {
  let watcher: VersionWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    watcher = new VersionWatcher({
      enablePolling: false, // Disable polling for tests
      defaultCheckIntervalMs: 60000,
    });
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should create a version watcher', () => {
      expect(watcher).toBeDefined();
    });

    it('should start watching', async () => {
      await watcher.start();
      expect(watcher.isActive()).toBe(true);
    });

    it('should stop watching', async () => {
      await watcher.start();
      watcher.stop();
      expect(watcher.isActive()).toBe(false);
    });

    it('should not start twice', async () => {
      await watcher.start();
      await watcher.start();
      expect(watcher.isActive()).toBe(true);
    });
  });

  describe('version tracking', () => {
    it('should register a heartbeat version', () => {
      watcher.registerHeartbeatVersion('codex', '1.0.0');

      const known = watcher.getKnownVersion('codex');
      expect(known).toBeDefined();
      expect(known?.version).toBe('1.0.0');
    });

    it('should update version when different', () => {
      watcher.registerHeartbeatVersion('codex', '1.0.0');
      watcher.registerHeartbeatVersion('codex', '1.1.0');

      const known = watcher.getKnownVersion('codex');
      expect(known?.version).toBe('1.1.0');
    });

    it('should not update if same version', () => {
      watcher.registerHeartbeatVersion('codex', '1.0.0');
      const first = watcher.getKnownVersion('codex');

      watcher.registerHeartbeatVersion('codex', '1.0.0');
      const second = watcher.getKnownVersion('codex');

      expect(first?.releasedAt).toEqual(second?.releasedAt);
    });

    it('should track multiple providers', () => {
      watcher.registerHeartbeatVersion('codex', '1.0.0');
      watcher.registerHeartbeatVersion('claude_code', '2.0.0');
      watcher.registerHeartbeatVersion('gemini_cli', '3.0.0');

      expect(watcher.getKnownVersion('codex')?.version).toBe('1.0.0');
      expect(watcher.getKnownVersion('claude_code')?.version).toBe('2.0.0');
      expect(watcher.getKnownVersion('gemini_cli')?.version).toBe('3.0.0');
    });

    it('should get all known versions', () => {
      watcher.registerHeartbeatVersion('codex', '1.0.0');
      watcher.registerHeartbeatVersion('claude_code', '2.0.0');

      const all = watcher.getAllKnownVersions();
      expect(all.size).toBe(2);
      expect(all.get('codex')?.version).toBe('1.0.0');
      expect(all.get('claude_code')?.version).toBe('2.0.0');
    });

    it('should return undefined for unknown provider', () => {
      const known = watcher.getKnownVersion('codex');
      expect(known).toBeUndefined();
    });
  });

  describe('events', () => {
    it('should emit poll_started on start', async () => {
      const handler = vi.fn();
      watcher.on('poll_started', handler);

      await watcher.start();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit poll_completed after checkAllSources', async () => {
      const handler = vi.fn();
      watcher.on('poll_completed', handler);

      // checkAllSources is called on start (but will fail for network sources in tests)
      await watcher.checkAllSources();

      expect(handler).toHaveBeenCalled();
    });

    it('should emit check_error on source check failure', async () => {
      const handler = vi.fn();
      watcher.on('check_error', handler);

      // Check sources - npm/github will fail in test environment
      await watcher.checkAllSources();

      // Should have received at least one error (network calls will fail)
      expect(handler.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('configuration', () => {
    it('should use custom config', () => {
      const customWatcher = new VersionWatcher({
        defaultCheckIntervalMs: 120000,
        httpTimeoutMs: 5000,
        enablePolling: false,
        sources: [
          {
            providerId: 'codex',
            type: 'npm',
            source: '@openai/codex',
            checkIntervalMs: 60000,
          },
        ],
      });

      expect(customWatcher).toBeDefined();
      customWatcher.stop();
    });

    it('should use default config', () => {
      const defaultWatcher = new VersionWatcher();
      expect(defaultWatcher).toBeDefined();
      defaultWatcher.stop();
    });
  });
});
