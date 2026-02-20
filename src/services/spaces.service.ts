import { readFileSync } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface SpacesUploadResult {
  audioUrl: string;
  transcriptUrl: string;
}

export class SpacesService {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private folder: string;

constructor(_config: any) {
    // Hardcoded to match your screenshot exactly
    this.bucket = 'spaces-bucket'; 
    this.region = 'sfo3';          
    this.folder = 'five9-recordings';
    
    this.client = new S3Client({
      endpoint: `https://sfo3.digitaloceanspaces.com`,
      region: 'us-east-1', // Required for DO signature compatibility
      credentials: {
        accessKeyId: process.env.SPACES_KEY || '',
        secretAccessKey: process.env.SPACES_SECRET || '',
      },
    });
  }
  async uploadCallFiles(
    audioPath: string,
    transcriptPath: string,
    _recording: any
  ): Promise<SpacesUploadResult> {
    const audioKey = `${this.folder}/${path.basename(audioPath)}`;
    const transcriptKey = `${this.folder}/${path.basename(transcriptPath)}`;

    try {
      // 1. Upload MP3
      const audioUrl = await this.uploadFile(audioPath, audioKey, 'audio/mpeg');
      // 2. Upload Transcript
      const transcriptUrl = await this.uploadFile(transcriptPath, transcriptKey, 'text/plain');

      return { audioUrl, transcriptUrl };
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Spaces upload failed');
      throw error;
    }
  }

  private async uploadFile(filePath: string, key: string, contentType: string): Promise<string> {
    const fileBuffer = readFileSync(filePath);

    try {
      // NOTE: We removed ACL: 'public-read' to test if permissions are the issue.
      // If this works, the files will be PRIVATE but the upload will succeed.
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      return `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
    } catch (error: any) {
      // THIS WILL LOG THE EXACT ERROR FROM DIGITAL OCEAN
      logger.error({ 
        name: error.name, 
        message: error.message,
        code: error.$metadata?.httpStatusCode 
      }, '❌ DETAILED S3 ERROR');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!(process.env.SPACES_KEY && process.env.SPACES_SECRET);
  }
}
