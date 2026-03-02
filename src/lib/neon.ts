import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL!);

export async function savePostHistory(data: {
  topic: string;
  post_type: string;
  status: string;
  title_preview: string;
  text_preview: string;
  error_message?: string;
}) {
  await sql`
    INSERT INTO post_history
      (topic, post_type, status, title_preview, text_preview, error_message)
    VALUES
      (${data.topic}, ${data.post_type}, ${data.status},
       ${data.title_preview}, ${data.text_preview}, ${data.error_message ?? null})
  `;
}

export async function getPostHistory(limit = 50) {
  return sql`
    SELECT * FROM post_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}
