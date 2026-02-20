import { Client } from '@notionhq/client';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class NotionService {
  private notion: Client;
  private databaseId: string;

  constructor(config: any) {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY || config.notion.apiKey });
    this.databaseId = config.notion.databaseId;
  }

  async addRecording(data: any): Promise<void> {
    try {
      await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          'Call ID': { 
            title: [{ text: { content: data.name || 'Unknown' } }]
          },
          'Transcript File': { 
            url: data.transcriptUrl || null
          },
          'Audio File': { 
            url: data.audioUrl || null
          },
          'Transcription': {
            rich_text: [{ text: { content: (data.transcription || 'No text').substring(0, 2000) } }]
          }
        }
      });
      logger.info({ recordingName: data.name }, '✨ Successfully recorded in Notion');
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to add to Notion');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.notion.databases.retrieve({ database_id: this.databaseId });
      return true;
    } catch {
      return false;
    }
  }
}
