import { exec } from 'child_process';
import { promisify } from 'util';
import { getLogger } from '../utils/logger';

const execPromise = promisify(exec);
const logger = getLogger();

export class FfmpegService {
  async transcode(inputPath: string, outputPath: string): Promise<void> {
    try {
      logger.info({ inputPath, outputPath }, '🔄 FFmpeg: Converting to compressed MP3...');
      // Convert to MP3 to stay under 25MB OpenAI limit
      const command = `ffmpeg -y -i "${inputPath}" -codec:a libmp3lame -qscale:a 4 -ar 16000 -ac 1 "${outputPath}"`;
      await execPromise(command);
      logger.info('✅ FFmpeg: MP3 Conversion complete');
    } catch (error: any) {
      logger.error({ error: error.message, inputPath }, '❌ FFmpeg: Conversion failed');
      throw error;
    }
  }
}
