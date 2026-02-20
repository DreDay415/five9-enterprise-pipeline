/* eslint-disable no-console */
require('dotenv').config();

const { Client } = require('@notionhq/client');

const { NOTION_API_KEY, NOTION_DATABASE_ID } = process.env;

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

async function main() {
  console.log('🔌 Testing Notion connection...');

  requireEnv('NOTION_API_KEY');
  requireEnv('NOTION_DATABASE_ID');

  const notion = new Client({ auth: NOTION_API_KEY });

  try {
    console.log('✅ Connected to Notion API');

    console.log('🔎 Retrieving database...');
    const database = await notion.databases.retrieve({
      database_id: NOTION_DATABASE_ID,
    });

    const dbTitle =
      Array.isArray(database.title) && database.title.length > 0
        ? database.title.map((t) => t.plain_text).join('')
        : 'Untitled';

    console.log(`✅ Database found: ${dbTitle}`);
    const callIdProperty = database.properties?.['Call ID'];
    if (callIdProperty && callIdProperty.type) {
      console.log(`ℹ️ Call ID property type: ${callIdProperty.type}`);
    }

    const properties = {
      'Call ID': {
        title: [{ text: { content: 'TEST - Connection Check' } }],
      },
      'Phone number': {
        number: 15035518338,
      },
      Transcription: {
        rich_text: [{ text: { content: 'Stored in page body' } }],
      },
      'Duration (seconds)': {
        rich_text: [{ text: { content: '123' } }],
      },
      'File Size (bytes)': {
        rich_text: [{ text: { content: '456789' } }],
      },
      Agent: {
        rich_text: [{ text: { content: 'test-agent@example.com' } }],
      },
      Campaign: {
        rich_text: [{ text: { content: 'Test Campaign' } }],
      },
      Skill: {
        rich_text: [{ text: { content: 'Test Skill' } }],
      },
      'Call Timestamp': {
        rich_text: [{ text: { content: new Date().toISOString() } }],
      },
      Language: {
        rich_text: [{ text: { content: 'en' } }],
      },
      'Upload Date': {
        rich_text: [{ text: { content: new Date().toISOString() } }],
      },
      'Processed Date': {
        rich_text: [{ text: { content: new Date().toISOString() } }],
      },
    };

    console.log('📝 Creating test entry...');
    const response = await notion.pages.create({
      parent: {
        database_id: NOTION_DATABASE_ID,
      },
      properties,
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'This is a test entry to verify the connection works',
                },
              },
            ],
          },
        },
      ],
    });

    console.log('✅ Test entry created successfully');
    console.log(`   Page ID: ${response.id}`);
    if ('url' in response && response.url) {
      console.log(`   URL: ${response.url}`);
    }

    console.log('🎉 Notion connection test complete');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Notion connection test failed');
    console.error(`   Message: ${err.message}`);

    if (error && typeof error === 'object') {
      const maybeError = error;
      if ('status' in maybeError) {
        console.error(`   Status: ${maybeError.status}`);
      }
      if ('code' in maybeError) {
        console.error(`   Code: ${maybeError.code}`);
      }
    }

    process.exit(1);
  }
}

main();
