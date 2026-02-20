# Architecture Documentation

## System Overview

The Five9 Enterprise Recording Pipeline is a production-grade TypeScript service designed to automate the processing of call recordings from Five9's SFTP server, transcribe them using OpenAI's Whisper API, and store the results in Notion.

## High-Level Architecture

```
┌─────────────────┐
│   Five9 SFTP    │
│     Server      │
└────────┬────────┘
         │
         │ Download
         ▼
┌─────────────────────────────────────┐
│     Pipeline Orchestrator           │
│  ┌──────────────────────────────┐  │
│  │  1. SFTP Service             │  │
│  │  2. Transcription Service    │  │
│  │  3. Notion Service           │  │
│  │  4. Notification Service     │  │
│  └──────────────────────────────┘  │
└──┬────────┬────────┬────────┬──────┘
   │        │        │        │
   ▼        ▼        ▼        ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│Local│ │ AI  │ │Notion│ │Slack│
│Files│ │ API │ │  DB │ │     │
└─────┘ └─────┘ └─────┘ └─────┘
```

## Core Components

### 1. Configuration Layer (`src/config/`)

**Purpose**: Validate and manage all application configuration

**Components**:
- `schema.ts`: Zod schemas for type-safe configuration
- `index.ts`: Configuration loader and validator

**Features**:
- Environment variable validation
- Type safety with TypeScript + Zod
- Fail-fast on invalid configuration
- Sanitized logging (no secrets in logs)

### 2. Services Layer (`src/services/`)

#### SFTP Service
- **Responsibility**: Manage SFTP connections and file operations
- **Features**:
  - Connection pooling and management
  - Retry logic with exponential backoff
  - File listing, downloading, and deletion
  - Health checks

#### Transcription Service
- **Responsibility**: Transcribe audio files using OpenAI Whisper
- **Features**:
  - File validation (size, format)
  - Streaming file upload
  - Segment-level transcription
  - Rate limit handling

#### Notion Service
- **Responsibility**: Store transcription results in Notion database
- **Features**:
  - Database schema validation
  - Idempotent page creation
  - Rate limit handling
  - Query existing entries

#### Notification Service
- **Responsibility**: Send alerts via Slack
- **Features**:
  - Rich message formatting
  - Success/failure notifications
  - Daily summaries
  - Non-blocking operation

### 3. Pipeline Layer (`src/pipeline/`)

**Orchestrator**: Central coordinator for all services

**Workflow**:
1. Initialize all services
2. Connect to SFTP
3. List available recordings
4. Process in configurable batches
5. For each recording:
   - Download from SFTP
   - Transcribe with Whisper
   - Store in Notion
   - Archive locally
6. Handle errors gracefully
7. Send notifications
8. Clean up

**Features**:
- Batch processing
- Concurrency control
- Progress tracking
- Graceful shutdown
- State recovery

### 4. Utilities Layer (`src/utils/`)

#### Logger
- Structured logging with Pino
- Pretty printing in development
- JSON output in production
- Context-aware logging

#### Error Handling
- Custom error classes with error codes
- Retryable vs non-retryable errors
- Error context and serialization
- Type-safe error handling

#### Filesystem
- Directory management
- File movement and archiving
- Cleanup of old files
- Safe file operations

#### Retry Logic
- Exponential backoff
- Configurable retry attempts
- Conditional retry (based on error type)
- Retry callbacks

### 5. Monitoring Layer (`src/monitoring/`)

#### Metrics
- Prometheus-compatible metrics
- Counters, histograms, and gauges
- Performance tracking
- Health indicators

#### Health Checks
- Component-level health checks
- Overall service health
- Readiness and liveness probes
- Dependency validation

## Data Flow

### Processing Pipeline

```
1. SFTP Server
   ↓
2. Download to local storage
   ↓
3. Validate file (size, format)
   ↓
4. Transcribe with OpenAI Whisper
   ↓
5. Create Notion page with results
   ↓
6. Save JSON backup
   ↓
7. Move to processed directory
   ↓
8. Update metrics
```

### Error Flow

```
Error Occurs
   ↓
Is Retryable?
   ├─ Yes → Retry with backoff → Success?
   │                                ├─ Yes → Continue
   │                                └─ No → Log error
   └─ No → Log error
              ↓
         Move to failed directory
              ↓
         Send notification
              ↓
         Continue with next file
```

## Scalability Considerations

### Current Design
- **Single instance**: Processes files sequentially with batching
- **Concurrency**: Configurable within single instance
- **State**: In-memory (stateless restarts)

### Future Enhancements
1. **Multi-instance processing**:
   - Add distributed locking (Redis/DynamoDB)
   - Shared state management
   - Work queue distribution

2. **Event-driven architecture**:
   - Watch for new files via SFTP polling
   - Event queue (SQS, RabbitMQ)
   - Lambda/serverless functions

3. **Database integration**:
   - PostgreSQL for processing state
   - Track file history
   - Enable resume after crash

## Security

### Secrets Management
- Environment variables only
- No hardcoded credentials
- Sanitized logging
- Docker secrets support

### Network Security
- SFTP over SSH (encrypted)
- HTTPS for APIs
- No exposed ports (except monitoring)

### Data Security
- Files deleted after processing
- Configurable retention
- No sensitive data in logs

## Performance

### Bottlenecks
1. **SFTP Download**: Network I/O
2. **Transcription**: OpenAI API latency
3. **Notion API**: Rate limits

### Optimizations
- Concurrent file processing
- Batch operations
- Connection reuse
- Retry logic
- Caching (future)

## Monitoring & Observability

### Metrics (Prometheus)
- `files_processed_total{status="success|failure"}`
- `transcription_duration_seconds`
- `notion_api_duration_seconds`
- `active_sftp_connections`
- `pipeline_health`

### Logs (Pino)
- Structured JSON logs
- Request tracing
- Error context
- Performance metrics

### Health Checks
- `/health`: Overall health
- `/ready`: Readiness probe
- `/metrics`: Prometheus metrics

## Error Recovery

### Transient Errors
- Network failures
- API rate limits
- Temporary service outages

**Strategy**: Retry with exponential backoff

### Permanent Errors
- Invalid file format
- File too large
- Invalid configuration

**Strategy**: Move to failed directory, log, continue

### Catastrophic Errors
- Service crashes
- Out of memory
- Database corruption

**Strategy**: Graceful shutdown, state preservation, alerting

## Deployment Models

### Docker
- Single container
- Volume mounts for data
- Health checks
- Resource limits

### Kubernetes (Future)
- Deployment with replicas
- Persistent volumes
- ConfigMaps and Secrets
- Horizontal Pod Autoscaling

### Serverless (Future)
- AWS Lambda for processing
- S3 for file storage
- SQS for work queue
- DynamoDB for state

## Testing Strategy

### Unit Tests
- Service logic
- Utility functions
- Error handling
- Mock external dependencies

### Integration Tests
- End-to-end workflow
- Service interactions
- Error scenarios

### Performance Tests (Future)
- Load testing
- Stress testing
- Benchmark API calls

## Maintenance

### Regular Tasks
- Monitor logs and metrics
- Clean old files
- Update dependencies
- Review error rates

### Incident Response
1. Check health endpoints
2. Review logs
3. Check service dependencies
4. Restart if necessary
5. Escalate if unresolved

## Future Roadmap

1. **Phase 1** (Current): Core functionality
2. **Phase 2**: Enhanced monitoring, alerting
3. **Phase 3**: Multi-instance support
4. **Phase 4**: Event-driven architecture
5. **Phase 5**: Advanced analytics, ML insights
