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
  // Авторизация: Vercel Cron или ручной вызов из дашборда
  const auth = req.headers.get('authorization') ?? '';
  const validCron = auth === `Bearer ${process.env.CRON_SECRET}`;
  const validManual = auth === `Bearer ${process.env.DASHBOARD_PASSWORD}`;
  if (!validCron && !validManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let topic = '';
  const postType: 'text' | 'photo' | 'video' = 'text'; // ДИАГНОСТИКА: принудительно text

  try {
    const { topic: t } = await readNextRow();
    topic = t;

    if (!topic) {
      return NextResponse.json({ ok: true, message: 'Queue is empty' }, { status: 200 });
    }

    const [text, title] = await Promise.all([
      generatePostText(topic),
      generateTitle(topic),
    ]);
    const caption = `${title}\n\n${text}`;

    await sendMessage(caption);

    try { await deleteRow2(); } catch (_) {}

    await savePostHistory({
      topic,
      post_type: postType,
      status: 'success',
      title_preview: title.slice(0, 100),
      text_preview: text.slice(0, 200),
    });

    return NextResponse.json({ ok: true, type: postType, topic });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (topic) {
      await savePostHistory({
        topic,
        post_type: postType,
        status: 'error',
        title_preview: '',
        text_preview: '',
        error_message: message,
      }).catch(() => {});
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
