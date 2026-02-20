import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getLogger } from './utils/logger';
import { getMetricsCollector } from './monitoring/metrics';
import { HealthCheckService, HealthStatus } from './monitoring/health';

const logger = getLogger();

/**
 * Simple HTTP server for monitoring endpoints
 */
export class MonitoringServer {
  private server?: ReturnType<typeof createServer>;

  constructor(
    private readonly port: number,
    private readonly healthCheckService: HealthCheckService
  ) {}

  /**
   * Start the monitoring server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          void this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
          logger.info({ port: this.port }, 'Monitoring server started');
          resolve();
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the monitoring server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          reject(error);
        } else {
          logger.info('Monitoring server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';

    try {
      switch (url) {
        case '/health':
          await this.handleHealth(res);
          break;

        case '/ready':
          await this.handleReady(res);
          break;

        case '/metrics':
          await this.handleMetrics(res);
          break;

        default:
          this.send404(res);
          break;
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), url },
        'Error handling request'
      );
      this.send500(res);
    }
  }

  /**
   * Handle /health endpoint
   */
  private async handleHealth(res: ServerResponse): Promise<void> {
    const health = await this.healthCheckService.check();

    const statusCode = health.status === HealthStatus.HEALTHY ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * Handle /ready endpoint
   */
  private async handleReady(res: ServerResponse): Promise<void> {
    const isReady = await this.healthCheckService.isReady();

    const statusCode = isReady ? 200 : 503;
    const response = {
      ready: isReady,
      timestamp: new Date().toISOString(),
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));
  }

  /**
   * Handle /metrics endpoint
   */
  private async handleMetrics(res: ServerResponse): Promise<void> {
    const metrics = getMetricsCollector();
    const metricsData = await metrics.getMetrics();

    res.writeHead(200, { 'Content-Type': metrics.getContentType() });
    res.end(metricsData);
  }

  /**
   * Send 404 response
   */
  private send404(res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }

  /**
   * Send 500 response
   */
  private send500(res: ServerResponse): void {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}
