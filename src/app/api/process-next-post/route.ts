import { NextRequest, NextResponse } from 'next/server';
import { readNextRow, deleteRow2 } from '@/lib/google-sheets';
import {
  generatePostText,
  generateTitle,
  generateImagePrompt,
  generateHook,
  generateImage,
} from '@/lib/protalk';
import { sendMessage, sendPhoto, sendVideo } from '@/lib/telegram';
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
  let postType: 'text' | 'photo' | 'video' = 'text';

  try {
    const { topic: t, video_url } = await readNextRow();
    topic = t;

    if (!topic) {
      return NextResponse.json({ ok: true, message: 'Queue is empty' }, { status: 200 });
    }

    const [text, title] = await Promise.all([
      generatePostText(topic),
      generateTitle(topic),
    ]);
    const caption = `${title}\n\n${text}`;

    // 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб
    const day = new Date().getDay();

    if (day === 2 || day === 6) {
      // Вторник / Суббота → Видео
      postType = 'video';
      await sendVideo(video_url, caption);
    } else if (day === 1 || day === 3) {
      // Понедельник / Среда → Фото
      postType = 'photo';
      const [imgPrompt, hook] = await Promise.all([
        generateImagePrompt(topic),
        generateHook(topic),
      ]);
      const imageUrl = await generateImage(imgPrompt, hook);
      await sendPhoto(imageUrl, caption);
    } else {
      // Чт / Пт / Вс → Текст
      postType = 'text';
      await sendMessage(caption);
    }

    // Удалить строку 2 и сохранить результат
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
