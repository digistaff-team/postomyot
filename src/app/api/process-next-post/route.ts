import { NextRequest, NextResponse } from 'next/server';
import { readNextRow, deleteRow2 } from '@/lib/google-sheets';
import {
  generatePostText,
  generateTitle,
} from '@/lib/protalk';
import { sendMessage } from '@/lib/telegram';
import { savePostHistory } from '@/lib/neon';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  console.log('[START] process-next-post handler started');
  
  // Авторизация: Vercel Cron или ручной вызов из дашборда
  const auth = req.headers.get('authorization') ?? '';
  const validCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = auth === `Bearer ${process.env.DASHBOARD_PASSWORD}`;
  if (!validCron && !validManual) {
    console.log('[AUTH] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log('[AUTH] Authorized');

  let topic = '';
  const postType: 'text' | 'photo' | 'video' = 'text';

  try {
    console.log('[STEP 1] Reading next row from Google Sheets...');
    const start1 = Date.now();
    const { topic: t } = await readNextRow();
    topic = t;
    console.log(`[STEP 1 DONE] Sheets read in ${Date.now() - start1}ms, topic: "${topic}"`);

    if (!topic) {
      console.log('[EMPTY] Queue is empty');
      return NextResponse.json({ ok: true, message: 'Queue is empty' }, { status: 200 });
    }

    console.log('[STEP 2] Generating text and title...');
    const start2 = Date.now();
    const [text, title] = await Promise.all([
      generatePostText(topic),
      generateTitle(topic),
    ]);
    console.log(`[STEP 2 DONE] Generated in ${Date.now() - start2}ms`);
    console.log(`  Title: ${title.slice(0, 60)}...`);
    console.log(`  Text: ${text.slice(0, 100)}...`);

    const caption = `${title}\n\n${text}`;

    console.log('[STEP 3] Sending message to Telegram...');
    const start3 = Date.now();
    await sendMessage(caption);
    console.log(`[STEP 3 DONE] Sent in ${Date.now() - start3}ms`);

    console.log('[STEP 4] Deleting row from Sheets...');
    const start4 = Date.now();
    try { 
      await deleteRow2(); 
      console.log(`[STEP 4 DONE] Deleted in ${Date.now() - start4}ms`);
    } catch (e) {
      console.log(`[STEP 4 WARN] Delete failed: ${e}`);
    }

    console.log('[STEP 5] Saving to history (Neon)...');
    const start5 = Date.now();
    await savePostHistory({
      topic,
      post_type: postType,
      status: 'success',
      title_preview: title.slice(0, 100),
      text_preview: text.slice(0, 200),
    });
    console.log(`[STEP 5 DONE] Saved in ${Date.now() - start5}ms`);

    console.log('[SUCCESS] Returning 200');
    return NextResponse.json({ ok: true, type: postType, topic });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ERROR] ${message}`);
    console.error(err);
    
    if (topic) {
      console.log('[ERROR SAVE] Attempting to save error to history...');
      try {
        await savePostHistory({
          topic,
          post_type: postType,
          status: 'error',
          title_preview: '',
          text_preview: '',
          error_message: message,
        });
        console.log('[ERROR SAVE DONE]');
      } catch (e) {
        console.error(`[ERROR SAVE FAILED] ${e}`);
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
