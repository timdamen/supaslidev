import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useServers } from '../../app/composables/useServers';

describe('waitForServerReady', () => {
  const { waitForServerReady } = useServers();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('successful connection', () => {
    it('returns true when server responds with ok status', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        type: 'basic',
      } as Response);

      const resultPromise = waitForServerReady(3000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000', {
        method: 'HEAD',
        mode: 'no-cors',
      });
    });

    it('returns true when server responds with opaque type (no-cors)', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        type: 'opaque',
      } as Response);

      const resultPromise = waitForServerReady(3000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
    });
  });

  describe('timeout behavior', () => {
    it('returns false after timeout when server never responds', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const resultPromise = waitForServerReady(3000, { timeout: 1000, interval: 100 });

      await vi.advanceTimersByTimeAsync(1100);
      const result = await resultPromise;

      expect(result).toBe(false);
    });

    it('respects custom timeout option', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const resultPromise = waitForServerReady(3000, { timeout: 500, interval: 100 });

      await vi.advanceTimersByTimeAsync(600);
      const result = await resultPromise;

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('respects custom interval option', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Not ready');
        }
        return { ok: true, type: 'basic' } as Response;
      });

      const resultPromise = waitForServerReady(3000, { timeout: 5000, interval: 200 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(callCount).toBe(3);
    });
  });

  describe('retry behavior', () => {
    it('retries on fetch errors until server is ready', async () => {
      let attempts = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Connection refused');
        }
        return { ok: true, type: 'basic' } as Response;
      });

      const resultPromise = waitForServerReady(3000, { timeout: 5000, interval: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(attempts).toBe(4);
    });

    it('continues polling when response is not ok and not opaque', async () => {
      let attempts = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return { ok: false, type: 'cors' } as Response;
        }
        return { ok: true, type: 'basic' } as Response;
      });

      const resultPromise = waitForServerReady(3000, { timeout: 5000, interval: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe(true);
      expect(attempts).toBe(3);
    });
  });
});
