import { getLogger } from '../utils/logger';
import { SftpService } from '../services/sftp.service';
import { TranscriptionService } from '../services/transcription.service';
import { NotionService } from '../services/notion.service';

const logger = getLogger();

/**
 * Health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Component health
 */
export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  timestamp: string;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  components: {
    sftp: ComponentHealth;
    openai: ComponentHealth;
    notion: ComponentHealth;
  };
  uptime: number;
}

/**
 * Health Check Service
 */
export class HealthCheckService {
  private startTime: number;

  constructor(
    private readonly sftpService: SftpService,
    private readonly transcriptionService: TranscriptionService,
    private readonly notionService: NotionService
  ) {
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async check(): Promise<HealthCheckResult> {
    logger.debug('Performing health check');

    const [sftpHealth, openaiHealth, notionHealth] = await Promise.all([
      this.checkSftp(),
      this.checkOpenAI(),
      this.checkNotion(),
    ]);

    const overallStatus = this.determineOverallStatus([
      sftpHealth.status,
      openaiHealth.status,
      notionHealth.status,
    ]);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        sftp: sftpHealth,
        openai: openaiHealth,
        notion: notionHealth,
      },
      uptime: Date.now() - this.startTime,
    };

    logger.debug({ result }, 'Health check completed');

    return result;
  }

  /**
   * Check SFTP service health
   */
  private async checkSftp(): Promise<ComponentHealth> {
    try {
      const isHealthy = await this.sftpService.healthCheck();

      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isHealthy ? 'SFTP connection active' : 'SFTP connection failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'SFTP health check error'
      );

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check OpenAI service health
   */
  private async checkOpenAI(): Promise<ComponentHealth> {
    try {
      const isHealthy = await this.transcriptionService.healthCheck();

      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isHealthy ? 'OpenAI API accessible' : 'OpenAI API unavailable',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'OpenAI health check error'
      );

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Notion service health
   */
  private async checkNotion(): Promise<ComponentHealth> {
    try {
      const isHealthy = await this.notionService.healthCheck();

      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isHealthy ? 'Notion API accessible' : 'Notion API unavailable',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Notion health check error'
      );

      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Determine overall health status from component statuses
   */
  private determineOverallStatus(statuses: HealthStatus[]): HealthStatus {
    if (statuses.every((s) => s === HealthStatus.HEALTHY)) {
      return HealthStatus.HEALTHY;
    }

    if (statuses.some((s) => s === HealthStatus.UNHEALTHY)) {
      return HealthStatus.UNHEALTHY;
    }

    return HealthStatus.DEGRADED;
  }

  /**
   * Simple readiness check (is the service ready to accept requests)
   */
  async isReady(): Promise<boolean> {
    const health = await this.check();
    return health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED;
  }

  /**
   * Simple liveness check (is the service alive)
   */
  isAlive(): boolean {
    return true; // If this code is running, the service is alive
  }
}
