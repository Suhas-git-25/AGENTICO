import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';

export const EMAIL_INDEX_NAME = 'emails';

function createElasticClient(): Client {
  const options: any = {
    node: env.ELASTICSEARCH_URL,
  };

  if (env.ELASTICSEARCH_API_KEY && env.ELASTICSEARCH_API_KEY.trim() !== '') {
    options.auth = {
      apiKey: env.ELASTICSEARCH_API_KEY,
    };
  }

  return new Client(options);
}

export const elasticClient = createElasticClient();

/**
 * Initializes the Elasticsearch 'emails' index with full-text search mappings
 * for subject/body and keyword filters for email, status, and senderId.
 */
export async function initEmailIndex(): Promise<void> {
  try {
    const exists = await elasticClient.indices.exists({ index: EMAIL_INDEX_NAME });

    if (!exists) {
      console.log(`🔍 Creating Elasticsearch index '${EMAIL_INDEX_NAME}'...`);
      await elasticClient.indices.create({
        index: EMAIL_INDEX_NAME,
        mappings: {
          properties: {
            toEmail: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledFor: { type: 'date' },
            sentAt: { type: 'date' },
            senderId: { type: 'keyword' },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX_NAME}' created successfully.`);
    }
  } catch (error: any) {
    console.warn(`⚠️ [Elasticsearch] Could not initialize '${EMAIL_INDEX_NAME}' index:`, error.message);
  }
}
