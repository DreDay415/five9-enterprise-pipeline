import { NotificationConfig } from '../config/schema';
import { getLogger } from '../utils/logger';
import { sleep } from '../utils/retry';

const logger = getLogger();

/**
 * Pipeline summary statistics
 */
export interface PipelineSummary {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  duration: number;
  averageTimePerFile: number;
}

/**
 * Daily statistics
 */
export interface DailyStats extends PipelineSummary {
  date: string;
}

/**
 * Notification Service for Slack alerts
 */
export class NotificationService {
  private isEnabled: boolean;

  constructor(private readonly config: NotificationConfig) {
    this.isEnabled = !!this.config.slackWebhookUrl;
    if (this.isEnabled) {
      logger.info('Slack notifications enabled');
    } else {
      logger.info('Slack notifications disabled (no webhook URL configured)');
    }
  }

  /**
   * Send success notification
   */
  async notifySuccess(summary: PipelineSummary): Promise<void> {
    if (!this.isEnabled) return;

    const message = {
      text: '✅ Five9 Pipeline Run Completed Successfully',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '✅ Pipeline Run Completed',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Files:*\n${summary.totalFiles}`,
            },
            {
              type: 'mrkdwn',
              text: `*Success:*\n${summary.successCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Failed:*\n${summary.failureCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${this.formatDuration(summary.duration)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Avg Time/File:*\n${this.formatDuration(summary.averageTimePerFile)}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Completed at ${new Date().toISOString()}_`,
            },
          ],
        },
      ],
    };

    await this.sendToSlack(message);
  }

  /**
   * Send failure notification
   */
  async notifyFailure(error: Error, context: Record<string, unknown>): Promise<void> {
    if (!this.isEnabled) return;

    const message = {
      text: '❌ Five9 Pipeline Run Failed',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '❌ Pipeline Run Failed',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:* ${error.message}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Context:*\n\`\`\`${JSON.stringify(context, null, 2)}\`\`\``,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Failed at ${new Date().toISOString()}_`,
            },
          ],
        },
      ],
    };

    await this.sendToSlack(message);
  }

  /**
   * Send daily summary notification
   */
  async notifyDailySummary(stats: DailyStats): Promise<void> {
    if (!this.isEnabled) return;

    const successRate =
      stats.totalFiles > 0 ? ((stats.successCount / stats.totalFiles) * 100).toFixed(1) : '0';

    const message = {
      text: '📊 Five9 Pipeline Daily Summary',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Daily Pipeline Summary',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Date:* ${stats.date}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Total Files:*\n${stats.totalFiles}`,
            },
            {
              type: 'mrkdwn',
              text: `*Success Rate:*\n${successRate}%`,
            },
            {
              type: 'mrkdwn',
              text: `*Successful:*\n${stats.successCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Failed:*\n${stats.failureCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Total Duration:*\n${this.formatDuration(stats.duration)}`,
            },
            {
              type: 'mrkdwn',
              text: `*Avg Time/File:*\n${this.formatDuration(stats.averageTimePerFile)}`,
            },
          ],
        },
      ],
    };

    await this.sendToSlack(message);
  }

  /**
   * Send message to Slack with retry logic
   */
  private async sendToSlack(message: unknown, retries = 3): Promise<void> {
    const webhookUrl = this.config.slackWebhookUrl;
    if (!webhookUrl) {
      logger.warn('Slack webhook URL not configured, skipping notification');
      return;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        if (response.ok) {
          logger.debug('Slack notification sent successfully');
          return;
        }

        logger.warn(
          {
            status: response.status,
            statusText: response.statusText,
            attempt: attempt + 1,
          },
          'Failed to send Slack notification'
        );

        if (attempt < retries - 1) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            attempt: attempt + 1,
          },
          'Error sending Slack notification'
        );

        if (attempt < retries - 1) {
          await sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    // Don't throw error - notifications should not fail the pipeline
    logger.error('Failed to send Slack notification after all retries');
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
