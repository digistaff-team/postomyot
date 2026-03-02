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
  console.log(`[Neon] savePostHistory: topic="${data.topic}", status=${data.status}`);
  const start = Date.now();
  try {
    await sql`
      INSERT INTO post_history
        (topic, post_type, status, title_preview, text_preview, error_message)
      VALUES
        (${data.topic}, ${data.post_type}, ${data.status},
         ${data.title_preview}, ${data.text_preview}, ${data.error_message ?? null})
    `;
    console.log(`[Neon] savePostHistory SUCCESS in ${Date.now() - start}ms`);
  } catch (e) {
    console.error(`[Neon] savePostHistory FAILED in ${Date.now() - start}ms:`, e);
    throw e;
  }
}

export async function getPostHistory(limit = 50) {
  console.log(`[Neon] getPostHistory: limit=${limit}`);
  const start = Date.now();
  const result = await sql`
    SELECT * FROM post_history
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  console.log(`[Neon] getPostHistory SUCCESS in ${Date.now() - start}ms, rows: ${result.length}`);
  return result;
}
