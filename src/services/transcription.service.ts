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
      logger.info({ filePath }, '🎙️ Starting Whisper transcription...');
      
      // 1. Get raw text from Whisper
      const whisperResponse = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });

      logger.info('🧠 Whisper complete. Starting Speaker Diarization pass...');

      // 2. Pass text to GPT-4o-mini to separate speakers
      const diarizationResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a specialized call transcript formatter. Take the raw text from this call center recording and format it as a clear dialogue between 'Speaker 1' and 'Speaker 2'. Identify speaker changes based on context and break into separate paragraphs. Only return the formatted dialogue." 
          },
          { role: "user", content: whisperResponse.text }
        ],
        temperature: 0.3,
      });

      // FIX: Added optional chaining (?.) to satisfy TypeScript's undefined check
// FIX: Added optional chaining (?.) to satisfy TypeScript's undefined check
      const formattedText = diarizationResponse.choices[0]?.message?.content || whisperResponse.text;

      // SAVE FORMATTED TEXT TO FILE: This ensures the Spacebucket version is speaker-labeled
      const transcriptPath = filePath.replace(/\.[^/.]+$/, "") + ".txt";
      fs.writeFileSync(transcriptPath, formattedText);

      return { text: formattedText };
    } catch (error: any) {
      logger.error({ error: error.message, filePath }, '❌ OpenAI Pipeline Failed');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }
}
