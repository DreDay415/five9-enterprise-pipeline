import { Client } from '@notionhq/client';
import { getLogger } from '../utils/logger';
import { RunLogger } from './runLogger';

export interface NotionRunReporterConfig {
  notionToken: string;
  runsDbId: string;
  enabled: boolean;
}

export class NotionRunReporter {
  private notion: Client;
  private config: NotionRunReporterConfig;
  private logger = getLogger();
  private runPageId?: string;

  constructor(config: NotionRunReporterConfig) {
    this.config = config;
    this.notion = new Client({ auth: config.notionToken });
  }

  async createRunPage(runLogger: RunLogger): Promise<string | undefined> {
    if (!this.config.enabled) {
      this.logger.info('Notion run reporting disabled');
      return undefined;
    }

    try {
      const metadata = runLogger.getRunMetadata();
      
      const response = await this.retryNotionCall(async () =>
        this.notion.pages.create({
          parent: { database_id: this.config.runsDbId },
          properties: {
            'Run ID': {
              title: [{ text: { content: metadata.runId } }],
            },
            'Started At': {
              date: { start: metadata.startTime },
            },
            'Status': {
              select: { name: 'running' },
            },
          },
        })
      );

      this.runPageId = response.id;
      this.logger.info({ pageId: this.runPageId }, 'Created Notion run page');
      return this.runPageId;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to create Notion run page - continuing without Notion reporting'
      );
      return undefined;
    }
  }

  async updateRunPage(
    runLogger: RunLogger,
    status: 'success' | 'failed',
    error?: Error
  ): Promise<void> {
    if (!this.config.enabled || !this.runPageId) {
      return;
    }

    try {
      const metrics = runLogger.getMetrics();

    const properties: any = {
        'Ended At': {
          date: { start: new Date().toISOString() },
        },
        'Status': {
          select: { name: status },
        },
        // CHANGED: Providing a Date object as requested by Notion logs
        'Duration (ms)': {
          date: { start: new Date().toISOString() },
        },
        // CHANGED: Providing an empty files array to satisfy the 'Files' column type
        'Total Files': {
          files: [],
        },
        // CHANGED: Wrapping numbers in the 'rich_text' array format
// KEEP THIS: It formats the number into a text object for Notion
        'Success Count': {
          rich_text: [{ text: { content: metrics.filesTranscribed.toString() } }],
        },
        // KEEP THIS: It does the same for the failure count
        'Failure Count': {
          rich_text: [{ text: { content: metrics.filesFailed.toString() } }],
        },
        };
      if (error && status === 'failed') {
        properties['Error'] = {
          rich_text: [
            {
              text: {
                content: `${error.message}\n\n${error.stack?.substring(0, 1500) || ''}`,
              },
            },
          ],
        };
      } else if (metrics.errorsCount > 0) {
        const errorSummary = runLogger.getErrorSummary();
        properties['Error'] = {
          rich_text: [
            {
              text: {
                content: errorSummary.substring(0, 2000),
              },
            },
          ],
        };
      }

      await this.retryNotionCall(async () =>
        this.notion.pages.update({
          page_id: this.runPageId!,
          properties,
        })
      );

      this.logger.info({ pageId: this.runPageId, status }, 'Updated Notion run page');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to update Notion run page'
      );
    }
  }

  private async retryNotionCall<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRateLimit =
          lastError.message.includes('rate_limited') ||
          lastError.message.includes('429');

        if (isRateLimit && attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            { attempt, delayMs },
            'Notion rate limit hit, retrying...'
          );
          await this.delay(delayMs);
        } else if (attempt < maxRetries - 1) {
          await this.delay(500);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async reportRun(
    runLogger: RunLogger,
    status: 'success' | 'failed',
    error?: Error
  ): Promise<void> {
    try {
      if (!this.runPageId) {
        this.runPageId = await this.createRunPage(runLogger);
      }

      await this.updateRunPage(runLogger, status, error);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to report run to Notion'
      );
    }
  }
}
