# API Reference

## Configuration Schema

### Environment Variables

#### SFTP Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `SFTP_HOST` | string | - | ✅ | Five9 SFTP server hostname |
| `SFTP_PORT` | number | 22 | ❌ | SFTP server port |
| `SFTP_USERNAME` | string | - | ✅ | SFTP username |
| `SFTP_PASSWORD` | string | - | ✅ | SFTP password |
| `SFTP_REMOTE_PATH` | string | /recordings | ❌ | Remote directory path |

#### OpenAI Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `OPENAI_API_KEY` | string | - | ✅ | OpenAI API key (must start with `sk-`) |
| `OPENAI_MODEL` | string | whisper-1 | ❌ | Whisper model to use |

#### Notion Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `NOTION_API_KEY` | string | - | ✅ | Notion integration key (must start with `secret_`) |
| `NOTION_DATABASE_ID` | string | - | ✅ | Target Notion database ID |

#### Directory Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DOWNLOAD_DIR` | string | ./data/downloads | ❌ | Directory for downloaded files |
| `PROCESSED_DIR` | string | ./data/processed | ❌ | Directory for processed files |
| `FAILED_DIR` | string | ./data/failed | ❌ | Directory for failed files |

#### Processing Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `BATCH_SIZE` | number | 5 | ❌ | Number of files per batch |
| `MAX_FILE_SIZE` | number | 25000000 | ❌ | Maximum file size in bytes (25MB) |
| `ALLOWED_EXTENSIONS` | string | .wav,.mp3,.m4a,.flac | ❌ | Comma-separated list of allowed extensions |
| `CONCURRENCY_LIMIT` | number | 3 | ❌ | Maximum concurrent file processing |

#### Retry Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `MAX_RETRIES` | number | 3 | ❌ | Maximum retry attempts |
| `RETRY_DELAY_MS` | number | 1000 | ❌ | Initial retry delay in milliseconds |

#### Cleanup Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `CLEANUP_ENABLED` | boolean | true | ❌ | Enable automatic cleanup of old files |
| `CLEANUP_DAYS_OLD` | number | 30 | ❌ | Delete files older than N days |

#### Monitoring Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `METRICS_PORT` | number | 9090 | ❌ | Port for Prometheus metrics |
| `HEALTH_CHECK_PORT` | number | 8080 | ❌ | Port for health check endpoint |

#### Notification Configuration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `SLACK_WEBHOOK_URL` | string | - | ❌ | Slack webhook URL for notifications |

## HTTP Endpoints

### Health Check

**Endpoint**: `GET /health`

**Description**: Returns overall service health and component status

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "components": {
    "sftp": {
      "status": "healthy",
      "message": "SFTP connection active",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "openai": {
      "status": "healthy",
      "message": "OpenAI API accessible",
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "notion": {
      "status": "healthy",
      "message": "Notion API accessible",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "uptime": 3600000
}
```

**Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "components": {
    "sftp": {
      "status": "unhealthy",
      "message": "SFTP connection failed",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "uptime": 3600000
}
```

### Readiness Check

**Endpoint**: `GET /ready`

**Description**: Returns whether the service is ready to accept requests

**Response** (200 OK):
```json
{
  "ready": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response** (503 Service Unavailable):
```json
{
  "ready": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Prometheus Metrics

**Endpoint**: `GET /metrics`

**Description**: Returns Prometheus-compatible metrics

**Response** (200 OK):
```
# HELP files_processed_total Total number of files processed
# TYPE files_processed_total counter
files_processed_total{status="success"} 42
files_processed_total{status="failure"} 3

# HELP transcription_duration_seconds Duration of transcription operations
# TYPE transcription_duration_seconds histogram
transcription_duration_seconds_bucket{le="1"} 5
transcription_duration_seconds_bucket{le="5"} 20
transcription_duration_seconds_bucket{le="10"} 35
transcription_duration_seconds_sum 450.5
transcription_duration_seconds_count 42

# HELP notion_api_duration_seconds Duration of Notion API operations
# TYPE notion_api_duration_seconds histogram
notion_api_duration_seconds_bucket{le="0.1"} 10
notion_api_duration_seconds_bucket{le="0.5"} 35
notion_api_duration_seconds_bucket{le="1"} 42
notion_api_duration_seconds_sum 25.3
notion_api_duration_seconds_count 42

# HELP active_sftp_connections Number of active SFTP connections
# TYPE active_sftp_connections gauge
active_sftp_connections 1

# HELP pipeline_health Pipeline health status
# TYPE pipeline_health gauge
pipeline_health 1
```

## Internal Service APIs

### SftpService

```typescript
class SftpService {
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  async listFiles(remotePath?: string): Promise<FileInfo[]>
  async downloadFile(remotePath: string, localPath: string): Promise<void>
  async deleteFile(remotePath: string): Promise<void>
  async healthCheck(): Promise<boolean>
}

interface FileInfo {
  name: string
  size: number
  modifyTime: number
  remotePath: string
}
```

### TranscriptionService

```typescript
class TranscriptionService {
  async transcribe(filePath: string): Promise<TranscriptionResult>
  async healthCheck(): Promise<boolean>
}

interface TranscriptionResult {
  text: string
  duration: number
  language: string
  segments: Segment[]
}

interface Segment {
  id: number
  start: number
  end: number
  text: string
}
```

### NotionService

```typescript
class NotionService {
  async initialize(): Promise<void>
  async createEntry(
    recording: RecordingInfo,
    transcription: TranscriptionResult
  ): Promise<NotionPage>
  async queryExistingEntries(): Promise<Set<string>>
  async healthCheck(): Promise<boolean>
}

interface RecordingInfo {
  name: string
  size: number
  modifyTime: number
  remotePath: string
  uploadDate?: Date
}

interface NotionPage {
  id: string
  url: string
}
```

### PipelineOrchestrator

```typescript
class PipelineOrchestrator {
  async start(): Promise<void>
  async stop(): Promise<void>
  async processRecording(recording: FileInfo): Promise<ProcessingResult>
  async processBatch(recordings: FileInfo[]): Promise<ProcessingResult[]>
  getState(): PipelineState
}

interface ProcessingResult {
  success: boolean
  recordingName: string
  error?: string
  notionPageId?: string
  duration: number
}

interface PipelineState {
  isRunning: boolean
  shouldStop: boolean
  processedCount: number
  failedCount: number
}
```

## Error Codes

### SFTP Errors

| Code | Description | Retryable |
|------|-------------|-----------|
| `SFTP_CONNECTION_FAILED` | Failed to connect to SFTP server | ✅ |
| `SFTP_AUTH_FAILED` | Authentication failed | ❌ |
| `SFTP_DOWNLOAD_FAILED` | Failed to download file | ✅ |
| `SFTP_LIST_FAILED` | Failed to list files | ✅ |
| `SFTP_DELETE_FAILED` | Failed to delete file | ✅ |

### Transcription Errors

| Code | Description | Retryable |
|------|-------------|-----------|
| `FILE_TOO_LARGE` | File exceeds size limit | ❌ |
| `INVALID_FORMAT` | Invalid file format | ❌ |
| `TRANSCRIPTION_API_ERROR` | OpenAI API error | ✅ (depends on status) |
| `FILE_NOT_FOUND` | File not found | ❌ |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded | ✅ |

### Notion Errors

| Code | Description | Retryable |
|------|-------------|-----------|
| `NOTION_API_ERROR` | Notion API error | ✅ (depends on status) |
| `DATABASE_NOT_FOUND` | Database not found | ❌ |
| `INVALID_SCHEMA` | Database schema mismatch | ❌ |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded | ✅ |
| `CREATE_PAGE_FAILED` | Failed to create page | ✅ |

### Configuration Errors

| Code | Description | Retryable |
|------|-------------|-----------|
| `CONFIG_VALIDATION_FAILED` | Configuration validation failed | ❌ |
| `CONFIG_MISSING` | Required config missing | ❌ |
| `CONFIG_INVALID` | Invalid config value | ❌ |

## Metrics

### Counters

- `files_processed_total{status="success|failure"}` - Total files processed

### Histograms

- `transcription_duration_seconds` - Transcription operation duration
- `notion_api_duration_seconds` - Notion API operation duration

### Gauges

- `active_sftp_connections` - Number of active SFTP connections
- `pipeline_health` - Pipeline health (1 = healthy, 0 = unhealthy)
