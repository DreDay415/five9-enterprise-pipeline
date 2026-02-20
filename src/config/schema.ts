import { z } from 'zod';

/**
 * Environment validation schema
 */
export const environmentSchema = z
  .enum(['development', 'production', 'test'])
  .default('development');

/**
 * SFTP configuration schema
 */
export const sftpConfigSchema = z.object({
  host: z.string().min(1, 'SFTP host is required'),
  port: z.coerce.number().int().positive().default(22),
  username: z.string().min(1, 'SFTP username is required'),
  password: z.string().min(1, 'SFTP password is required'),
  remotePath: z.string().default('/five9sftp/recordings/SB CS'),
});

/**
 * OpenAI configuration schema (Optional)
 */
export const openAiConfigSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().default('whisper-1'),
  postProcessModel: z.string().default('gpt-4.1-mini'),
}).optional();

/**
 * ElevenLabs configuration schema
 */
export const elevenLabsConfigSchema = z.object({
  apiKey: z.string().min(1, 'ElevenLabs API key is required'),
  productNames: z.string().optional(),
}).optional();
/**
 * Notion configuration schema
 */
export const notionConfigSchema = z.object({
  apiKey: z.string().min(1, 'Notion API key is required'),
  databaseId: z.string().min(1, 'Notion database ID is required'),
});
/**
 * Digital Ocean Spaces configuration schema
 */
export const spacesConfigSchema = z.object({
  endpoint: z.string().default(''),
  bucket: z.string().default('spaces-bucket'),
  accessKey: z.string().default(''),
  secretKey: z.string().default(''),
  region: z.string().default('sfo3'),
  folder: z.string().default('five9-recordings'),
});/**
 * Directory configuration schema
 */
export const directoryConfigSchema = z.object({
  downloadDir: z.string().default('./data/downloads'),
  processedDir: z.string().default('./data/processed'),
  failedDir: z.string().default('./data/failed'),
});

/**
 * Processing configuration schema
 */
export const processingConfigSchema = z.object({
  batchSize: z.coerce.number().int().positive().default(5),
  maxFileSize: z.coerce.number().int().positive().default(25000000), // 25MB
  allowedExtensions: z
    .string()
    .default('.wav,.mp3,.m4a,.flac')
    .transform((val) => val.split(',').map((ext) => ext.trim())),
  concurrencyLimit: z.coerce.number().int().positive().default(3),
  maxFiles: z.coerce.number().int().positive().optional(),
});

/**
 * Retry configuration schema
 */
export const retryConfigSchema = z.object({
  maxRetries: z.coerce.number().int().nonnegative().default(3),
  retryDelayMs: z.coerce.number().int().positive().default(1000),
});

/**
 * Cleanup configuration schema
 */
export const cleanupConfigSchema = z.object({
  enabled: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true'),
  daysOld: z.coerce.number().int().positive().default(30),
});

/**
 * Monitoring configuration schema
 */
export const monitoringConfigSchema = z.object({
  metricsPort: z.coerce.number().int().positive().default(9090).optional(),
  healthCheckPort: z.coerce.number().int().positive().default(8080).optional(),
});

/**
 * Notification configuration schema
 */
export const notificationConfigSchema = z.object({
  slackWebhookUrl: z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim() === '') {
        return undefined;
      }
      return value;
    },
    z.string().url().optional()
  ),
});


/**
 * Run logging configuration schema
 */
export const runLoggingConfigSchema = z.object({
  enabled: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  logDir: z.string().default('/srv/five9/logs'),
  serviceName: z.string().default('five9-transcribe'),
  maxEventsInMemory: z.coerce.number().int().positive().default(50),
  notionRunsDbId: z.string().default(''),
});
/**
 * Complete configuration schema
 */
export const configSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  sftp: sftpConfigSchema,
  openai: openAiConfigSchema,
  elevenlabs: elevenLabsConfigSchema,
  notion: notionConfigSchema,
  directories: directoryConfigSchema,
  processing: processingConfigSchema,
  retry: retryConfigSchema,
  cleanup: cleanupConfigSchema,
  monitoring: monitoringConfigSchema,
  notifications: notificationConfigSchema,
  runLogging: runLoggingConfigSchema,
  spaces: spacesConfigSchema.optional(),
});
/**
 * TypeScript types derived from Zod schemas
 */
export type Environment = z.infer<typeof environmentSchema>;
export type SftpConfig = z.infer<typeof sftpConfigSchema>;
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;
export type ElevenLabsConfig = z.infer<typeof elevenLabsConfigSchema>;
export type Config = z.infer<typeof configSchema>;
export type NotionConfig = z.infer<typeof notionConfigSchema>;
export type DirectoryConfig = z.infer<typeof directoryConfigSchema>;
export type ProcessingConfig = z.infer<typeof processingConfigSchema>;
export type RetryConfig = z.infer<typeof retryConfigSchema>;
export type CleanupConfig = z.infer<typeof cleanupConfigSchema>;
export type MonitoringConfig = z.infer<typeof monitoringConfigSchema>;
export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type SpacesConfig = z.infer<typeof spacesConfigSchema>;
