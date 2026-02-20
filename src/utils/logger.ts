import pino from 'pino';
import { getConfig } from '../config';

/**
 * Create logger instance based on environment
 */
function createLogger(): pino.Logger {
  const config = getConfig();
  const isDevelopment = config.env === 'development';
  const isTest = config.env === 'test';

  const baseConfig: pino.LoggerOptions = {
    name: 'five9-pipeline',
    level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      env: config.env,
      service: 'five9-enterprise-pipeline',
      version: process.env.npm_package_version || '1.0.0',
    },
  };

  // Pretty printing for development
  if (isDevelopment) {
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    });
  }

  // JSON output for production
  return pino(baseConfig);
}

/**
 * Logger interface with context support
 */
export interface Logger {
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
  debug(obj: object | string, msg?: string): void;
  child(bindings: pino.Bindings): Logger;
  withContext(context: Record<string, unknown>): Logger;
}

/**
 * Wrapper class for Pino logger with additional utilities
 */
class LoggerWrapper implements Logger {
  constructor(private readonly pinoLogger: pino.Logger) {}

  info(obj: object | string, msg?: string): void {
    if (typeof obj === 'string') {
      this.pinoLogger.info(obj);
    } else {
      this.pinoLogger.info(obj, msg);
    }
  }

  warn(obj: object | string, msg?: string): void {
    if (typeof obj === 'string') {
      this.pinoLogger.warn(obj);
    } else {
      this.pinoLogger.warn(obj, msg);
    }
  }

  error(obj: object | string, msg?: string): void {
    if (typeof obj === 'string') {
      this.pinoLogger.error(obj);
    } else {
      this.pinoLogger.error(obj, msg);
    }
  }

  debug(obj: object | string, msg?: string): void {
    if (typeof obj === 'string') {
      this.pinoLogger.debug(obj);
    } else {
      this.pinoLogger.debug(obj, msg);
    }
  }

  child(bindings: pino.Bindings): Logger {
    return new LoggerWrapper(this.pinoLogger.child(bindings));
  }

  withContext(context: Record<string, unknown>): Logger {
    return this.child(context);
  }
}

/**
 * Singleton logger instance
 */
let loggerInstance: Logger | null = null;

/**
 * Get logger instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new LoggerWrapper(createLogger());
  }
  return loggerInstance;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return getLogger().withContext(context);
}

/**
 * Reset logger instance (useful for testing)
 */
export function resetLogger(): void {
  loggerInstance = null;
}

/**
 * Export default logger instance
 */
export const logger = getLogger();
