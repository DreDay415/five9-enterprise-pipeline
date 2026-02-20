import { config as dotenvConfig } from 'dotenv';
import { ZodError } from 'zod';
import { configSchema, Config } from './schema';

// Load environment variables
dotenvConfig();

/**
 * Custom error for configuration validation failures
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Parse and validate environment variables
 */
function parseConfig(): Config {
  const rawConfig = {
    env: process.env.NODE_ENV,
    sftp: {
      host: process.env.SFTP_HOST,
      port: process.env.SFTP_PORT,
      username: process.env.SFTP_USERNAME,
      password: process.env.SFTP_PASSWORD,
      remotePath: process.env.SFTP_REMOTE_PATH,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL,
      postProcessModel: process.env.OPENAI_POSTPROCESS_MODEL,
    },
    elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    productNames: process.env.PRODUCT_NAMES || '',
    },
    notion: {
      apiKey: process.env.NOTION_API_KEY,
      databaseId: process.env.NOTION_DATABASE_ID,
    },
    directories: {
      downloadDir: process.env.DOWNLOAD_DIR,
      processedDir: process.env.PROCESSED_DIR,
      failedDir: process.env.FAILED_DIR,
    },
    processing: {
      batchSize: process.env.BATCH_SIZE,
      maxFileSize: process.env.MAX_FILE_SIZE,
      allowedExtensions: process.env.ALLOWED_EXTENSIONS,
      concurrencyLimit: process.env.CONCURRENCY_LIMIT,
      maxFiles: process.env.MAX_FILES,
    },
    retry: {
      maxRetries: process.env.MAX_RETRIES,
      retryDelayMs: process.env.RETRY_DELAY_MS,
    },
    cleanup: {
      enabled: process.env.CLEANUP_ENABLED,
      daysOld: process.env.CLEANUP_DAYS_OLD,
    },
    monitoring: {
      metricsPort: process.env.METRICS_PORT,
      healthCheckPort: process.env.HEALTH_CHECK_PORT,
    },
    notifications: {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    },
    runLogging: {
      enabled: process.env.RUN_LOGGING_ENABLED,
      logDir: process.env.RUN_LOGGING_LOG_DIR,
      serviceName: process.env.RUN_LOGGING_SERVICE_NAME,
      maxEventsInMemory: process.env.RUN_LOGGING_MAX_EVENTS,
      notionRunsDbId: process.env.RUN_LOGGING_NOTION_RUNS_DB_ID,
    },
    spaces: {
      endpoint: process.env.DO_SPACES_ENDPOINT,
      bucket: process.env.DO_SPACES_BUCKET,
      accessKey: process.env.DO_SPACES_ACCESS_KEY,
      secretKey: process.env.DO_SPACES_SECRET_KEY,
      region: process.env.DO_SPACES_REGION,
      folder: process.env.DO_SPACES_FOLDER,
    },
  };
  try {
    const config = configSchema.parse(rawConfig) as Config;
    const spaces = config.spaces;
    if (spaces) {
      // DigitalOcean Spaces: use region endpoint when endpoint is empty so the SDK
      // never resolves to AWS (e.g. s3.sfo3.amazonaws.com). Accept either
      // https://sfo3.digitaloceanspaces.com or https://bucket.sfo3.digitaloceanspaces.com.
      if (spaces.region && (!spaces.endpoint || spaces.endpoint === '')) {
        spaces.endpoint = `https://${spaces.region}.digitaloceanspaces.com`;
      } else if (spaces.endpoint && spaces.endpoint.includes('.digitaloceanspaces.com')) {
        // If user set a bucket URL like https://spaces-bucket.sfo3.digitaloceanspaces.com,
        // normalize to region endpoint so the S3 client works (bucket is passed separately).
        const match = spaces.endpoint.match(/https:\/\/(?:[^.]+\.)?([^.]+)\.digitaloceanspaces\.com/);
        if (match) spaces.endpoint = `https://${match[1]}.digitaloceanspaces.com`;
      }
    }
    return config;
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      const errorMessage = [
        '❌ Configuration validation failed:',
        '',
        ...formattedErrors.map((e) => `  • ${e.path}: ${e.message}`),
        '',
        'Please check your .env file and ensure all required variables are set.',
      ].join('\n');

      throw new ConfigValidationError(errorMessage, formattedErrors);
    }
    throw error;
  }
}

/**
 * Sanitize config for logging (remove sensitive data)
 */
export function sanitizeConfig(config: Config): Record<string, unknown> {
  return {
    env: config.env,
    sftp: {
      host: config.sftp.host,
      port: config.sftp.port,
      username: config.sftp.username,
      password: '***REDACTED***',
      remotePath: config.sftp.remotePath,
    },
    notion: {
      apiKey: 'secret_***REDACTED***',
      databaseId: config.notion.databaseId,
    },
    directories: config.directories,
    processing: config.processing,
    retry: config.retry,
    cleanup: config.cleanup,
    monitoring: config.monitoring,
    notifications: {
      slackWebhookUrl: config.notifications.slackWebhookUrl ? '***CONFIGURED***' : undefined,
    },
    runLogging: config.runLogging,
    openai: config.openai?.apiKey ? {
      apiKey: `${config.openai.apiKey.slice(0, 8)}...***REDACTED***`,
      model: config.openai.model,
    } : undefined,
    elevenlabs: config.elevenlabs?.apiKey ? {
      apiKey: '***REDACTED***',
      productNames: config.elevenlabs.productNames,
    } : undefined,
    spaces: config.spaces ? {
      bucket: config.spaces.bucket,
      folder: config.spaces.folder,
      region: config.spaces.region,
    } : undefined,
  };
}

/**
 * Singleton config instance
 */
let configInstance: Config | null = null;

/**
 * Get validated configuration
 * Throws ConfigValidationError if validation fails
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = parseConfig();
  }
  return configInstance;
}

/**
 * Reset config instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

// Export types and schema
export * from './schema';
