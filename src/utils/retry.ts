import { getLogger } from './logger';
import { BaseError } from './errors';

const logger = getLogger();

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  exponentialBackoff?: boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  context?: string
): Promise<T> {
  const { maxRetries, delayMs, exponentialBackoff = true, onRetry } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is not retryable
      if (error instanceof BaseError && !error.isRetryable) {
        logger.debug(
          {
            context,
            error: lastError.message,
            attempt,
          },
          'Error is not retryable, not attempting retry'
        );
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        logger.warn(
          {
            context,
            error: lastError.message,
            attempts: attempt + 1,
          },
          'Max retries exceeded'
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;

      logger.warn(
        {
          context,
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
          nextRetryIn: delay,
        },
        'Operation failed, retrying'
      );

      // Call retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  if (!lastError) {
    throw new Error('Retry failed without a captured error');
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry configuration builder
 */
export class RetryConfigBuilder {
  private config: Partial<RetryOptions> = {
    maxRetries: 3,
    delayMs: 1000,
    exponentialBackoff: true,
  };

  withMaxRetries(maxRetries: number): RetryConfigBuilder {
    this.config.maxRetries = maxRetries;
    return this;
  }

  withDelay(delayMs: number): RetryConfigBuilder {
    this.config.delayMs = delayMs;
    return this;
  }

  withExponentialBackoff(enabled: boolean): RetryConfigBuilder {
    this.config.exponentialBackoff = enabled;
    return this;
  }

  withRetryCallback(callback: (error: Error, attempt: number) => void): RetryConfigBuilder {
    this.config.onRetry = callback;
    return this;
  }

  build(): RetryOptions {
    return {
      maxRetries: this.config.maxRetries ?? 3,
      delayMs: this.config.delayMs ?? 1000,
      exponentialBackoff: this.config.exponentialBackoff,
      onRetry: this.config.onRetry,
    };
  }
}
