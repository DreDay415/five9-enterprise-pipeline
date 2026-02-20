import { createWriteStream, WriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { getLogger } from '../utils/logger';

export interface RunMetrics {
  filesFound: number;
  filesDownloaded: number;
  filesTranscribed: number;
  filesSkipped: number;
  filesFailed: number;
  errorsCount: number;
  sftpMs: number;
  transcribeMs: number;
  notionMs: number;
  totalMs: number;
}

export interface RunLogEvent {
  ts: string;
  runId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  step: 'sftp_list' | 'download' | 'transcribe' | 'notion_write' | 'cleanup' | 'system';
  message: string;
  filePath?: string;
  fileSize?: number;
  durationMs?: number;
  errorStack?: string;
  meta?: Record<string, unknown>;
}

export interface RunLoggerConfig {
  logDir: string;
  serviceName: string;
  maxEventsInMemory: number;
  enabled: boolean;
}

export class RunLogger {
  private runId: string;
  private startTime: number;
  private logFilePath: string;
  private logStream?: WriteStream;
  private metrics: RunMetrics;
  private stepTimers: Map<string, number>;
  private importantEvents: RunLogEvent[];
  private config: RunLoggerConfig;
  private logger = getLogger();

  constructor(config: RunLoggerConfig) {
    this.config = config;
    this.runId = this.generateRunId();
    this.startTime = Date.now();
    this.logFilePath = join(config.logDir, `${this.runId}.jsonl`);
    this.stepTimers = new Map();
    this.importantEvents = [];
    
    this.metrics = {
      filesFound: 0,
      filesDownloaded: 0,
      filesTranscribed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      errorsCount: 0,
      sftpMs: 0,
      transcribeMs: 0,
      notionMs: 0,
      totalMs: 0,
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('RunLogger disabled via config');
      return;
    }

    try {
      await fs.mkdir(this.config.logDir, { recursive: true });
      this.logStream = createWriteStream(this.logFilePath, { flags: 'a' });
      this.logEvent('info', 'system', 'Run logger initialized', {
        runId: this.runId,
        logFile: this.logFilePath,
        host: hostname(),
      });
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to initialize RunLogger - continuing without file logging'
      );
    }
  }

  logEvent(
    level: RunLogEvent['level'],
    step: RunLogEvent['step'],
    message: string,
    meta?: {
      filePath?: string;
      fileSize?: number;
      durationMs?: number;
      errorStack?: string;
      [key: string]: unknown;
    }
  ): void {
    const event: RunLogEvent = {
      ts: new Date().toISOString(),
      runId: this.runId,
      level,
      step,
      message,
      ...meta,
    };

    if (this.logStream && this.config.enabled) {
      this.logStream.write(JSON.stringify(event) + '\n');
    }

    console.log(JSON.stringify(event));

    if (
      level === 'error' ||
      level === 'warn' ||
      message.includes('started') ||
      message.includes('completed') ||
      message.includes('failed')
    ) {
      if (this.importantEvents.length < this.config.maxEventsInMemory) {
        this.importantEvents.push(event);
      }
    }
  }

  increment(metric: keyof RunMetrics, amount = 1): void {
    this.metrics[metric] += amount;
  }

  set(metric: keyof RunMetrics, value: number): void {
    this.metrics[metric] = value;
  }

  startStep(stepName: string): void {
    this.stepTimers.set(stepName, Date.now());
  }

  endStep(stepName: string): number {
    const startTime = this.stepTimers.get(stepName);
    if (!startTime) {
      this.logger.warn({ stepName }, 'Step timer not found');
      return 0;
    }

    const duration = Date.now() - startTime;
    this.stepTimers.delete(stepName);

    if (stepName.includes('sftp')) {
      this.metrics.sftpMs += duration;
    } else if (stepName.includes('transcribe')) {
      this.metrics.transcribeMs += duration;
    } else if (stepName.includes('notion')) {
      this.metrics.notionMs += duration;
    }

    return duration;
  }

  async timeStep<T>(
    stepName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startStep(stepName);
    try {
      const result = await operation();
      const duration = this.endStep(stepName);
      this.logEvent('info', this.getStepCategory(stepName), `${stepName} completed`, {
        durationMs: duration,
      });
      return result;
    } catch (error) {
      const duration = this.endStep(stepName);
      this.logEvent(
        'error',
        this.getStepCategory(stepName),
        `${stepName} failed`,
        {
          durationMs: duration,
          errorStack: error instanceof Error ? error.stack : String(error),
        }
      );
      throw error;
    }
  }

  async finalize(
    status: 'success' | 'failed',
    error?: Error
  ): Promise<void> {
    this.metrics.totalMs = Date.now() - this.startTime;

    this.logEvent(
      status === 'success' ? 'info' : 'error',
      'system',
      `Run ${status}`,
      {
        ...this.metrics,
        errorStack: error?.stack,
      }
    );

    if (this.logStream) {
      await new Promise<void>((resolve) => {
        this.logStream!.end(() => resolve());
      });
    }

    this.logger.info(
      {
        runId: this.runId,
        status,
        metrics: this.metrics,
        logFile: this.logFilePath,
      },
      'Run finalized'
    );
  }

  getMetrics(): RunMetrics {
    return { ...this.metrics };
  }

  getImportantEvents(): RunLogEvent[] {
    return [...this.importantEvents];
  }

  getRunMetadata() {
    return {
      runId: this.runId,
      startTime: new Date(this.startTime).toISOString(),
      host: hostname(),
      serviceName: this.config.serviceName,
      logFilePath: this.logFilePath,
    };
  }

  private generateRunId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private getStepCategory(stepName: string): RunLogEvent['step'] {
    if (stepName.includes('sftp') || stepName.includes('list')) return 'sftp_list';
    if (stepName.includes('download')) return 'download';
    if (stepName.includes('transcribe')) return 'transcribe';
    if (stepName.includes('notion')) return 'notion_write';
    if (stepName.includes('cleanup')) return 'cleanup';
    return 'system';
  }

  getErrorSummary(): string {
    const errorEvents = this.importantEvents.filter((e) => e.level === 'error');
    
    if (errorEvents.length === 0) {
      return 'No errors';
    }

    const errorGroups = new Map<string, number>();
    for (const event of errorEvents) {
      const key = `${event.step}: ${event.message}`;
      errorGroups.set(key, (errorGroups.get(key) || 0) + 1);
    }

    const topErrors = Array.from(errorGroups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => `${error} (${count}x)`)
      .join('\n');

    return topErrors;
  }
}
