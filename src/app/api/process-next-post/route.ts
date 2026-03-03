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

// Увеличиваем лимит выполнения Vercel Function (до 300 секунд)
export const maxDuration = 300;

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
  let postType: 'text' | 'photo' | 'video' = 'text';

  try {
    console.log('[STEP 1] Reading next row from Google Sheets...');
    const start1 = Date.now();
    const { topic: t, video_url } = await readNextRow();
    topic = t;
    console.log(`[STEP 1 DONE] Sheets read in ${Date.now() - start1}ms, topic: "${topic}", video_url: "${video_url}"`);

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

    // 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб
    const day = new Date().getDay();
    console.log(`[DAY CHECK] Current day of week is ${day}`);

    // Логика: если день видео, но ссылки нет -> переключаемся на фото
    const isVideoDay = day === 2 || day === 6;
    const isPhotoDay = day === 1 || day === 3;
    const hasVideo = !!video_url && video_url.trim() !== '' && video_url !== 'undefined';

    if (isVideoDay && hasVideo) {
      // Вторник / Суббота + есть ссылка → Видео
      postType = 'video';
      console.log(`[STEP 3] Sending VIDEO to Telegram...`);
      const start3 = Date.now();
      await sendVideo(video_url, caption);
      console.log(`[STEP 3 DONE] Sent VIDEO in ${Date.now() - start3}ms`);
    } else if (isPhotoDay || (isVideoDay && !hasVideo)) {
      // Понедельник / Среда ИЛИ (день видео, но ссылки нет) → Фото
      postType = 'photo';
      if (isVideoDay && !hasVideo) {
         console.log(`[FALLBACK] Video day but no URL found. Falling back to PHOTO.`);
      }

      try {
        console.log(`[STEP 3A] Generating image prompt and hook...`);
        const start3a = Date.now();
        const [imgPrompt, hook] = await Promise.all([
          generateImagePrompt(topic),
          generateHook(topic),
        ]);
        console.log(`[STEP 3A DONE] Prompt & hook generated in ${Date.now() - start3a}ms`);
        console.log(`  Prompt: ${imgPrompt.slice(0, 50)}...`);
        console.log(`  Hook: ${hook}`);

        console.log(`[STEP 3B] Generating image via ProTalk...`);
        const start3b = Date.now();
        const imageUrl = await generateImage(imgPrompt, hook);
        console.log(`[STEP 3B DONE] Image generated in ${Date.now() - start3b}ms. URL: ${imageUrl}`);

        console.log(`[STEP 3C] Sending PHOTO to Telegram...`);
        const start3c = Date.now();
        await sendPhoto(imageUrl, caption);
        console.log(`[STEP 3C DONE] Sent PHOTO in ${Date.now() - start3c}ms`);
      } catch (imgError) {
        console.error(`[IMAGE ERROR] Failed to generate/send photo:`, imgError);
        console.log(`[FALLBACK 2] Falling back to TEXT post...`);
        postType = 'text';
        const startTextFallback = Date.now();
        await sendMessage(caption);
        console.log(`[FALLBACK 2 DONE] Sent TEXT in ${Date.now() - startTextFallback}ms`);
      }
    } else {
      // Чт / Пт / Вс → Текст
      postType = 'text';
      console.log('[STEP 3] Sending TEXT to Telegram...');
      const start3 = Date.now();
      await sendMessage(caption);
      console.log(`[STEP 3 DONE] Sent TEXT in ${Date.now() - start3}ms`);
    }

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
