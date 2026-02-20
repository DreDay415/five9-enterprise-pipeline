# Quick Start Guide

Get up and running with the Five9 Enterprise Pipeline in 5 minutes.

## Prerequisites

- Node.js 20+ installed
- Access to Five9 SFTP server
- OpenAI API key
- Notion workspace with integration

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd five9-enterprise-pipeline
npm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Five9 SFTP
SFTP_HOST=your-five9-host.com
SFTP_USERNAME=your-username
SFTP_PASSWORD=your-password

# OpenAI
OPENAI_API_KEY=sk-your-api-key

# Notion
NOTION_API_KEY=secret_your-integration-key
NOTION_DATABASE_ID=your-database-id
```

## Step 3: Set Up Notion Database

1. Create a new database in Notion
2. Add these properties:
   - **File Name** (Title)
   - **Transcription** (Text)
   - **Duration** (Number)
   - **File Size** (Number)
   - **Upload Date** (Date)
   - **Processed Date** (Date)
   - **Language** (Select)

3. Create an integration:
   - Go to https://www.notion.so/my-integrations
   - Click "New integration"
   - Give it a name and select your workspace
   - Copy the integration token

4. Share database with integration:
   - Open your database
   - Click "..." → "Add connections"
   - Select your integration

## Step 4: Run the Pipeline

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Docker

```bash
docker-compose up
```

## Step 5: Monitor

Access monitoring endpoints:

- Health: http://localhost:8080/health
- Metrics: http://localhost:9090/metrics
- Ready: http://localhost:8080/ready

## Common Issues

### Connection Refused (SFTP)

- Check host and port in `.env`
- Verify firewall settings
- Test connection: `sftp -P 22 username@host`

### OpenAI API Errors

- Verify API key is valid
- Check rate limits and billing
- Ensure sufficient credits

### Notion Access Denied

- Verify integration has access to database
- Check database ID is correct
- Ensure all required properties exist

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [CONTRIBUTING.md](../CONTRIBUTING.md) for development guide
- Review configuration options in [README.md](../README.md)

## Getting Help

- Open an issue on GitHub
- Check logs: `docker-compose logs -f`
- Enable debug logging: `LOG_LEVEL=debug npm run dev`
