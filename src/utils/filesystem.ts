import { promises as fs } from 'fs';
import path from 'path';
import { getLogger } from './logger';
import { FileSystemError } from './errors';

const logger = getLogger();

/**
 * Ensure all required directories exist
 */
export async function ensureDirectories(directories: string[]): Promise<void> {
  logger.info({ directories }, 'Ensuring directories exist');

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      logger.debug({ directory: dir }, 'Directory ensured');
    } catch (error) {
      throw FileSystemError.directoryCreationFailed(
        dir,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

/**
 * Move file to processed directory
 */
export async function moveToProcessed(filePath: string, processedDir: string): Promise<string> {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newFileName = `${timestamp}_${fileName}`;
  const newPath = path.join(processedDir, newFileName);

  try {
    await fs.rename(filePath, newPath);
    logger.debug({ from: filePath, to: newPath }, 'File moved to processed');
    return newPath;
  } catch (error) {
    throw FileSystemError.fileMoveFailed(
      filePath,
      newPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Move file to failed directory
 */
export async function moveToFailed(filePath: string, failedDir: string): Promise<string> {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const newFileName = `${timestamp}_${fileName}`;
  const newPath = path.join(failedDir, newFileName);

  try {
    await fs.rename(filePath, newPath);
    logger.debug({ from: filePath, to: newPath }, 'File moved to failed');
    return newPath;
  } catch (error) {
    throw FileSystemError.fileMoveFailed(
      filePath,
      newPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Save transcription result as JSON
 */
export async function saveTranscriptionJson(
  data: object,
  fileName: string,
  processedDir: string
): Promise<void> {
  const jsonFileName = `${fileName.replace(/\.[^.]+$/, '')}.json`;
  const jsonPath = path.join(processedDir, jsonFileName);

  try {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    logger.debug({ path: jsonPath }, 'Transcription JSON saved');
  } catch (error) {
    throw FileSystemError.fileWriteFailed(
      jsonPath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Clean up old files from a directory
 */
export async function cleanupOldFiles(directory: string, daysOld: number): Promise<number> {
  logger.info({ directory, daysOld }, 'Starting cleanup of old files');

  const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const files = await fs.readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);

      try {
        const stats = await fs.stat(filePath);

        // Only delete files, not directories
        if (stats.isFile() && stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.debug({ file: filePath, age: daysOld }, 'Old file deleted');
        }
      } catch (error) {
        logger.warn(
          { file: filePath, error: error instanceof Error ? error.message : String(error) },
          'Failed to delete old file, skipping'
        );
      }
    }

    logger.info({ directory, deletedCount }, 'Cleanup completed');
    return deletedCount;
  } catch (error) {
    logger.error(
      { directory, error: error instanceof Error ? error.message : String(error) },
      'Failed to cleanup directory'
    );
    return deletedCount;
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    throw FileSystemError.fileReadFailed(
      filePath,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Validate file extension against allowed list
 */
export function isAllowedExtension(filePath: string, allowedExtensions: string[]): boolean {
  const extension = getFileExtension(filePath);
  return allowedExtensions.includes(extension);
}
