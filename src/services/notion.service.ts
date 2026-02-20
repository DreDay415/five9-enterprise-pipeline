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
      const filename = data.name;
      
      // 1. EXTRACT PHONE: Keeping as string to prevent comma formatting
      const phoneMatch = filename.match(/-(\d{10})\s+by/);
      const phoneNumber = phoneMatch ? phoneMatch[1] : '';

      // 2. EXTRACT AGENT: Remove email domain and capitalize
      const agentMatch = filename.match(/by\s+([^@\s]+)/);
      let agentName = agentMatch ? agentMatch[1] : 'Unknown';
      agentName = agentName.charAt(0).toUpperCase() + agentName.slice(1);

      // 3. EXTRACT TIME & DATE
      const timeMatch = filename.match(/@\s+([^.]+)\.wav/);
      const callTimeRaw = timeMatch ? timeMatch[1].replace(/_/g, ':') : 'Unknown';
      const dateMatch = data.remotePath?.match(/(\d{1,2}_\d{1,2}_\d{4})/);
      const callDateStr = dateMatch ? dateMatch[1].replace(/_/g, '/') : 'Unknown';

      await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          'Call ID': { 
            title: [{ text: { content: filename } }] 
          },
          'Phone number': {
            phone_number: phoneNumber // Using phone_number type avoids number formatting
          },
          'Agent': {
            rich_text: [{ text: { content: agentName } }] 
          },
          'Call Timestamp': {
             rich_text: [{ text: { content: `${callDateStr} ${callTimeRaw}` } }]
          },
          'Transcript File': { url: data.transcriptUrl || null },
          'Audio File': { url: data.audioUrl || null },
          'Language': { 
            rich_text: [{ text: { content: 'english' } }]
          },
          'Processed Date': {
            rich_text: [{ text: { content: new Date().toLocaleString() } }]
          },
          'Transcription': {
            rich_text: [{ text: { content: (data.transcription || '').substring(0, 2000) } }]
          }
        }
      });

      logger.info({ agent: agentName, phone: phoneNumber }, '✨ Recorded in Notion (Clean Formatting)');
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Notion Final Mapping Error');
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.notion.databases.retrieve({ database_id: this.databaseId });
      return true;
    } catch { return false; }
  }
}
