import { retryWithBackoff, sleep } from '../../../src/utils/retry';
import { BaseError } from '../../../src/utils/errors';

describe('Retry Utilities', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(
        fn,
        { maxRetries: 3, delayMs: 100 },
        'test'
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(
        fn,
        { maxRetries: 3, delayMs: 10 },
        'test'
      );

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, delayMs: 10 }, 'test')
      ).rejects.toThrow('Always fails');

      expect(fn).toHaveBeenCalledTimes(3); // Initial attempt + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      class NonRetryableError extends BaseError {
        constructor() {
          super('Non-retryable', 'NON_RETRYABLE', {}, false);
        }
      }

      const fn = jest.fn().mockRejectedValue(new NonRetryableError());

      await expect(
        retryWithBackoff(fn, { maxRetries: 3, delayMs: 10 }, 'test')
      ).rejects.toThrow('Non-retryable');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retryWithBackoff(
        fn,
        { maxRetries: 2, delayMs: 100, exponentialBackoff: true },
        'test'
      );
      const duration = Date.now() - startTime;

      // First retry: 100ms, second retry: 200ms = 300ms total minimum
      expect(duration).toBeGreaterThanOrEqual(280);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');

      await retryWithBackoff(
        fn,
        { maxRetries: 2, delayMs: 10, onRetry },
        'test'
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });
  });

  describe('sleep', () => {
    it('should wait for specified duration', async () => {
      const startTime = Date.now();
      await sleep(100);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThan(150);
    });
  });
});
