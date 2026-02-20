import path from 'path';
import fs from 'fs';
import { Config } from '../config/schema';
import { getLogger } from '../utils/logger';
import { SftpService } from '../services/sftp.service';
import { TranscriptionService } from '../services/transcription.service';
import { NotionService } from '../services/notion.service';
import { SpacesService } from '../services/spaces.service';
import { FfmpegService } from '../services/ffmpeg.service';
import { ensureDirectories } from '../utils/filesystem';

const logger = getLogger();

export class PipelineOrchestrator {
  private state = {
    isRunning: false,
    shouldStop: false,
    processedCount: 0,
    failedCount: 0
  };

  constructor(
    private config: Config,
    private sftpService: SftpService,
    private transcriptionService: TranscriptionService,
    private notionService: NotionService,
    private ffmpegService: FfmpegService,
    private spacesService: SpacesService | null
  ) {}

  async start(): Promise<void> {
    this.state.isRunning = true;
    this.state.shouldStop = false;

    try {
      await ensureDirectories(Object.values(this.config.directories));
      await this.sftpService.connect();
      const files = await this.sftpService.listFiles(this.config.sftp.remotePath);

      logger.info({ count: files.length }, 'Files listed from SFTP');

      for (const file of files) {
        if (this.state.shouldStop) break;
        await this.processRecording(file);
      }
    } finally {
      this.state.isRunning = false;
    }
  }

  async stop(): Promise<void> {
    this.state.shouldStop = true;
    logger.info('🛑 Pipeline stop requested');
    await this.sftpService.disconnect();
  }

  private async processRecording(recording: any): Promise<void> {
    // Skip non-audio files or already processed playable files
    if (recording.name.includes('_playable') || !recording.name.endsWith('.wav')) {
      return;
    }

    const recordingLogger = logger.child({ recordingName: recording.name });

    try {
      const localPath = path.join(this.config.directories.downloadDir, recording.name);
      const playablePath = localPath.replace('.wav', '_playable.mp3');

      // 1. Download
      await this.sftpService.downloadFile(recording.remotePath, localPath);

      // 2. Transcode to MP3 (Fixes 413 size error and codec issues)
      await this.ffmpegService.transcode(localPath, playablePath);

      // 3. Transcribe
      const transcription = await this.transcriptionService.transcribe(playablePath);

      // 4. Upload & Record
      let spacesResult: any = {};
      if (this.spacesService) {
        const transcriptPath = localPath.replace('.wav', '.txt');
        fs.writeFileSync(transcriptPath, transcription.text);
        
        spacesResult = await this.spacesService.uploadCallFiles(playablePath, transcriptPath, recording);

        // Cleanup local files immediately
        [localPath, playablePath, transcriptPath].forEach(f => {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        });
      }

     await (this.notionService as any).addRecording({
        name: recording.name,
        transcription: transcription.text,
        audioUrl: spacesResult.audioUrl,
        transcriptUrl: spacesResult.transcriptUrl
      });
      this.state.processedCount++;
      recordingLogger.info('✅ Processed successfully');

    } catch (error: any) {
      this.state.failedCount++;
      recordingLogger.error({ error: error.message }, '❌ Failed to process recording');
    }
  }

  getState(): any {
    return { ...this.state };
  }
}
