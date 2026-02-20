import path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { SftpConfig } from '../config/schema';
import { getLogger } from '../utils/logger';
import { SftpError } from '../utils/errors';
import { retryWithBackoff, RetryOptions } from '../utils/retry';

const logger = getLogger();

/**
 * File information from SFTP
 */
export interface FileInfo {
  name: string;
  size: number;
  modifyTime: number;
  remotePath: string;
}

/**
 * SFTP Service for Five9 server interactions
 */
export class SftpService {
  private client: SftpClient;
  private isConnected = false;
  private static readonly RECENT_FILE_LIMIT = 10000;

  constructor(
    private readonly config: SftpConfig,
    private readonly retryOptions: RetryOptions
  ) {
    this.client = new SftpClient();
  }

  /**
   * Connect to SFTP server with retry logic
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug('SFTP already connected');
      return;
    }

    await retryWithBackoff(
      async () => {
        try {
          logger.info(
            { host: this.config.host, port: this.config.port, username: this.config.username },
            'Connecting to SFTP server'
          );

          await this.client.connect({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            password: this.config.password,
            readyTimeout: 30000,
            retries: 0, // We handle retries ourselves
          });

          this.isConnected = true;
          logger.info('SFTP connection established');
        } catch (error) {
          this.isConnected = false;
          const err = error instanceof Error ? error : new Error(String(error));

          // Check for authentication errors
          if (err.message.includes('All configured authentication methods failed')) {
            throw SftpError.authenticationFailed(this.config.username);
          }

          throw SftpError.connectionFailed(this.config.host, err);
        }
      },
      this.retryOptions,
      'SFTP Connect'
    );
  }

  /**
   * Disconnect from SFTP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug('SFTP already disconnected');
      return;
    }

    try {
      logger.info('Disconnecting from SFTP server');
      await this.client.end();
      this.isConnected = false;
      logger.info('SFTP connection closed');
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Error during SFTP disconnect'
      );
      this.isConnected = false;
    }
  }

  /**
   * List files in remote directory
   */
  async listFiles(remotePath?: string, maxFiles = SftpService.RECENT_FILE_LIMIT): Promise<FileInfo[]> {
    const targetPath = remotePath || this.config.remotePath;

    return await retryWithBackoff(
      async () => {
        try {
          logger.debug({ remotePath: targetPath }, 'Listing files on SFTP');

          const files = await this.listRecentFiles(targetPath, maxFiles);

          logger.info({ remotePath: targetPath, count: files.length }, 'Files listed from SFTP');

          return files;
        } catch (error) {
          throw SftpError.listFailed(
            targetPath,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      this.retryOptions,
      'SFTP List Files'
    );
  }

  private async listRecentFiles(remotePath: string, maxFiles: number): Promise<FileInfo[]> {
    const dateFolders = await this.listDateFolders(remotePath);
    if (dateFolders.length === 0) {
      logger.warn(
        { remotePath },
        'No date folders detected, falling back to full recursive listing'
      );
      const files = await this.listFilesRecursive(remotePath);
      return files
        .sort((a, b) => b.modifyTime - a.modifyTime)
        .slice(0, maxFiles);
    }

    const collected: FileInfo[] = [];
    for (const folder of dateFolders) {
      if (collected.length >= maxFiles) break;
      await this.listFilesRecursive(folder.path, collected, maxFiles);
    }

    const sorted = collected.sort((a, b) => b.modifyTime - a.modifyTime);
    const limited = sorted.slice(0, maxFiles);

    if (sorted.length > maxFiles) {
      logger.warn(
        { maxFiles },
        'SFTP listing capped; older files may be skipped'
      );
    }

    return limited;
  }

  private async listDateFolders(remotePath: string): Promise<Array<{ path: string; date: number }>> {
    const entries = await this.client.list(remotePath);
    const folders: Array<{ path: string; date: number }> = [];

    for (const entry of entries) {
      if (entry.type !== 'd') continue;
      const campaignPath = path.posix.join(remotePath, entry.name);
      const subEntries = await this.client.list(campaignPath);
      for (const subEntry of subEntries) {
        if (subEntry.type !== 'd') continue;
        const parsed = this.parseDateFolderName(subEntry.name);
        if (!parsed) continue;
        folders.push({
          path: path.posix.join(campaignPath, subEntry.name),
          date: parsed,
        });
      }
    }

    return folders.sort((a, b) => b.date - a.date);
  }

  private parseDateFolderName(name: string): number | null {
    const yyyyMmDd = name.match(/^(\d{4})[-_](\d{1,2})[-_](\d{1,2})$/);
    if (yyyyMmDd && yyyyMmDd[1] && yyyyMmDd[2] && yyyyMmDd[3]) {
      const date = new Date(
        Number(yyyyMmDd[1]),
        Number(yyyyMmDd[2]) - 1,
        Number(yyyyMmDd[3]),
        0,
        0,
        0,
        0
      );
      return date.getTime();
    }

    const mdY = name.match(/^(\d{1,2})[-_](\d{1,2})[-_](\d{4})$/);
    if (mdY && mdY[1] && mdY[2] && mdY[3]) {
      const date = new Date(
        Number(mdY[3]),
        Number(mdY[1]) - 1,
        Number(mdY[2]),
        0,
        0,
        0,
        0
      );
      return date.getTime();
    }

    return null;
  }

  private async listFilesRecursive(
    remotePath: string,
    files: FileInfo[] = [],
    maxFiles = Number.POSITIVE_INFINITY
  ): Promise<FileInfo[]> {
    const entries = await this.client.list(remotePath);

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        break;
      }
      const entryPath = path.posix.join(remotePath, entry.name);
      if (entry.type === 'd') {
        await this.listFilesRecursive(entryPath, files, maxFiles);
        continue;
      }

      if (entry.type !== '-') {
        continue;
      }

      if (path.posix.extname(entry.name).toLowerCase() !== '.wav') {
        continue;
      }

      files.push({
        name: entry.name,
        size: entry.size,
        modifyTime: entry.modifyTime,
        remotePath: entryPath,
      });
    }

    return files;
  }

  /**
   * Download file from SFTP to local path
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    await retryWithBackoff(
      async () => {
        try {
          logger.debug({ remotePath, localPath }, 'Downloading file from SFTP');

          await this.client.fastGet(remotePath, localPath, {
            concurrency: 64,
            chunkSize: 32768,
          });

          logger.info({ remotePath, localPath }, 'File downloaded from SFTP');
        } catch (error) {
          throw SftpError.downloadFailed(
            remotePath,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      this.retryOptions,
      'SFTP Download File'
    );
  }

  /**
   * Delete file from SFTP (optional, for cleanup)
   */
  async deleteFile(remotePath: string): Promise<void> {
    await retryWithBackoff(
      async () => {
        try {
          logger.debug({ remotePath }, 'Deleting file from SFTP');

          await this.client.delete(remotePath);

          logger.info({ remotePath }, 'File deleted from SFTP');
        } catch (error) {
          throw SftpError.deleteFailed(
            remotePath,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      this.retryOptions,
      'SFTP Delete File'
    );
  }

  /**
   * Check if connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Try to list the remote directory as a health check
      await this.client.list(this.config.remotePath);
      return true;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'SFTP health check failed'
      );
      this.isConnected = false;
      return false;
    }
  }
}
