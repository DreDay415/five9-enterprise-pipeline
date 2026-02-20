import fs from 'fs';
import OpenAI from 'openai';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class TranscriptionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async transcribe(filePath: string): Promise<{ text: string }> {
    try {
      // The Orchestrator already handled the MP3 conversion.
      // We just stream the file to OpenAI.
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });

      return { text: response.text };
    } catch (error: any) {
      logger.error({ error: error.message, filePath }, '❌ OpenAI Whisper Failed');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }
}
