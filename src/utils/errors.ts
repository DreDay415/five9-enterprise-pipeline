/**
 * Base error class with error codes and context
 */
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      isRetryable: this.isRetryable,
      stack: this.stack,
    };
  }
}

/**
 * SFTP-related errors
 */
export class SftpError extends BaseError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context, true); // SFTP errors are generally retryable
  }

  static connectionFailed(host: string, error: Error): SftpError {
    return new SftpError('SFTP connection failed', 'SFTP_CONNECTION_FAILED', {
      host,
      originalError: error.message,
    });
  }

  static downloadFailed(remotePath: string, error: Error): SftpError {
    return new SftpError('Failed to download file from SFTP', 'SFTP_DOWNLOAD_FAILED', {
      remotePath,
      originalError: error.message,
    });
  }

  static listFailed(remotePath: string, error: Error): SftpError {
    return new SftpError('Failed to list files on SFTP', 'SFTP_LIST_FAILED', {
      remotePath,
      originalError: error.message,
    });
  }

  static deleteFailed(remotePath: string, error: Error): SftpError {
    return new SftpError('Failed to delete file on SFTP', 'SFTP_DELETE_FAILED', {
      remotePath,
      originalError: error.message,
    });
  }

  static authenticationFailed(username: string): SftpError {
    return new SftpError('SFTP authentication failed', 'SFTP_AUTH_FAILED', {
      username,
    });
  }
}

/**
 * Transcription-related errors
 */
export class TranscriptionError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    isRetryable = false
  ) {
    super(message, code, context, isRetryable);
  }

  static fileTooLarge(filePath: string, size: number, maxSize: number): TranscriptionError {
    return new TranscriptionError('File exceeds maximum size limit', 'FILE_TOO_LARGE', {
      filePath,
      size,
      maxSize,
    });
  }

  static invalidFormat(filePath: string, extension: string): TranscriptionError {
    return new TranscriptionError('Invalid file format', 'INVALID_FORMAT', {
      filePath,
      extension,
    });
  }

  static apiError(filePath: string, error: Error, statusCode?: number): TranscriptionError {
    const isRetryable = !statusCode || statusCode >= 500 || statusCode === 429;
    return new TranscriptionError(
      'OpenAI API transcription failed',
      'TRANSCRIPTION_API_ERROR',
      {
        filePath,
        originalError: error.message,
        statusCode,
      },
      isRetryable
    );
  }

  static fileNotFound(filePath: string): TranscriptionError {
    return new TranscriptionError('Transcription file not found', 'FILE_NOT_FOUND', {
      filePath,
    });
  }

  static rateLimitExceeded(retryAfter?: number): TranscriptionError {
    return new TranscriptionError(
      'OpenAI API rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      {
        retryAfter,
      },
      true
    );
  }
}

/**
 * Notion-related errors
 */
export class NotionError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    isRetryable = false
  ) {
    super(message, code, context, isRetryable);
  }

  static apiError(operation: string, error: Error, statusCode?: number): NotionError {
    const isRetryable = !statusCode || statusCode >= 500 || statusCode === 429;
    return new NotionError(
      `Notion API ${operation} failed`,
      'NOTION_API_ERROR',
      {
        operation,
        originalError: error.message,
        statusCode,
      },
      isRetryable
    );
  }

  static databaseNotFound(databaseId: string): NotionError {
    return new NotionError('Notion database not found or not accessible', 'DATABASE_NOT_FOUND', {
      databaseId,
    });
  }

  static invalidSchema(expectedSchema: string[], actualSchema: string[]): NotionError {
    return new NotionError('Notion database schema mismatch', 'INVALID_SCHEMA', {
      expectedSchema,
      actualSchema,
    });
  }

  static rateLimitExceeded(retryAfter?: number): NotionError {
    return new NotionError(
      'Notion API rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      {
        retryAfter,
      },
      true
    );
  }

  static createPageFailed(recordingName: string, error: Error): NotionError {
    return new NotionError(
      'Failed to create Notion page',
      'CREATE_PAGE_FAILED',
      {
        recordingName,
        originalError: error.message,
      },
      true
    );
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends BaseError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context, false); // Config errors are not retryable
  }

  static validationFailed(errors: Array<{ path: string; message: string }>): ConfigError {
    return new ConfigError('Configuration validation failed', 'CONFIG_VALIDATION_FAILED', {
      errors,
    });
  }

  static missingRequired(field: string): ConfigError {
    return new ConfigError(`Required configuration field missing: ${field}`, 'CONFIG_MISSING', {
      field,
    });
  }

  static invalidValue(field: string, value: unknown, reason: string): ConfigError {
    return new ConfigError(
      `Invalid configuration value for ${field}: ${reason}`,
      'CONFIG_INVALID',
      {
        field,
        value,
        reason,
      }
    );
  }
}

/**
 * File system errors
 */
export class FileSystemError extends BaseError {
  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message, code, context, true); // Filesystem errors might be retryable
  }

  static directoryCreationFailed(path: string, error: Error): FileSystemError {
    return new FileSystemError('Failed to create directory', 'DIR_CREATE_FAILED', {
      path,
      originalError: error.message,
    });
  }

  static fileMoveFailed(sourcePath: string, destPath: string, error: Error): FileSystemError {
    return new FileSystemError('Failed to move file', 'FILE_MOVE_FAILED', {
      sourcePath,
      destPath,
      originalError: error.message,
    });
  }

  static fileDeleteFailed(path: string, error: Error): FileSystemError {
    return new FileSystemError('Failed to delete file', 'FILE_DELETE_FAILED', {
      path,
      originalError: error.message,
    });
  }

  static fileReadFailed(path: string, error: Error): FileSystemError {
    return new FileSystemError('Failed to read file', 'FILE_READ_FAILED', {
      path,
      originalError: error.message,
    });
  }

  static fileWriteFailed(path: string, error: Error): FileSystemError {
    return new FileSystemError('Failed to write file', 'FILE_WRITE_FAILED', {
      path,
      originalError: error.message,
    });
  }
}

/**
 * Pipeline orchestration errors
 */
export class PipelineError extends BaseError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    isRetryable = false
  ) {
    super(message, code, context, isRetryable);
  }

  static processingFailed(recordingName: string, error: Error): PipelineError {
    return new PipelineError(
      'Failed to process recording',
      'PROCESSING_FAILED',
      {
        recordingName,
        originalError: error.message,
      },
      error instanceof BaseError ? error.isRetryable : false
    );
  }

  static circuitBreakerOpen(service: string): PipelineError {
    return new PipelineError(
      `Circuit breaker open for ${service}`,
      'CIRCUIT_BREAKER_OPEN',
      {
        service,
      },
      true
    );
  }

  static shutdownTimeout(): PipelineError {
    return new PipelineError('Pipeline shutdown timeout exceeded', 'SHUTDOWN_TIMEOUT', {});
  }
}
