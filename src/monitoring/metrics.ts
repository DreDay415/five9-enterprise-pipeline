import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Metrics collector for Prometheus
 */
export class MetricsCollector {
  private registry: Registry;

  // Counters
  public filesProcessedTotal: Counter<'status'>;

  // Histograms
  public transcriptionDuration: Histogram<string>;
  public notionApiDuration: Histogram<string>;

  // Gauges
  public activeSftpConnections: Gauge<string>;
  public pipelineHealth: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      app: 'five9-pipeline',
      environment: process.env.NODE_ENV || 'development',
    });

    // Initialize metrics
    this.filesProcessedTotal = new Counter({
      name: 'files_processed_total',
      help: 'Total number of files processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.transcriptionDuration = new Histogram({
      name: 'transcription_duration_seconds',
      help: 'Duration of transcription operations in seconds',
      buckets: [1, 5, 10, 30, 60, 120, 300], // 1s to 5min
      registers: [this.registry],
    });

    this.notionApiDuration = new Histogram({
      name: 'notion_api_duration_seconds',
      help: 'Duration of Notion API operations in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10], // 100ms to 10s
      registers: [this.registry],
    });

    this.activeSftpConnections = new Gauge({
      name: 'active_sftp_connections',
      help: 'Number of active SFTP connections',
      registers: [this.registry],
    });

    this.pipelineHealth = new Gauge({
      name: 'pipeline_health',
      help: 'Pipeline health status (1 = healthy, 0 = unhealthy)',
      registers: [this.registry],
    });

    logger.info('Metrics collector initialized');
  }

  /**
   * Record file processing success
   */
  recordSuccess(): void {
    this.filesProcessedTotal.labels('success').inc();
  }

  /**
   * Record file processing failure
   */
  recordFailure(): void {
    this.filesProcessedTotal.labels('failure').inc();
  }

  /**
   * Record transcription duration
   */
  recordTranscriptionDuration(durationMs: number): void {
    this.transcriptionDuration.observe(durationMs / 1000);
  }

  /**
   * Record Notion API duration
   */
  recordNotionApiDuration(durationMs: number): void {
    this.notionApiDuration.observe(durationMs / 1000);
  }

  /**
   * Set active SFTP connections
   */
  setActiveSftpConnections(count: number): void {
    this.activeSftpConnections.set(count);
  }

  /**
   * Set pipeline health
   */
  setPipelineHealth(healthy: boolean): void {
    this.pipelineHealth.set(healthy ? 1 : 0);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  /**
   * Get content type for metrics
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.registry.resetMetrics();
  }
}

// Singleton instance
let metricsCollectorInstance: MetricsCollector | null = null;

/**
 * Get metrics collector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector();
  }
  return metricsCollectorInstance;
}

/**
 * Reset metrics collector instance (useful for testing)
 */
export function resetMetricsCollector(): void {
  metricsCollectorInstance = null;
}
