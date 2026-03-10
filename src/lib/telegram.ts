const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT = process.env.TELEGRAM_CHANNEL_ID?.trim();
const BASE = `https://api.telegram.org/bot${TOKEN}`;
const TELEGRAM_MEDIA_CAPTION_LIMIT = 1024;

function fitCaptionForMedia(caption: string): string {
  if (caption.length <= TELEGRAM_MEDIA_CAPTION_LIMIT) {
    return caption;
  }

  const limit = TELEGRAM_MEDIA_CAPTION_LIMIT;
  const chunk = caption.slice(0, limit);
  const breakCandidates = ['\n\n', '. ', '! ', '? ', '; ', ', ', ' '];

  let splitIndex = -1;
  for (const marker of breakCandidates) {
    const i = chunk.lastIndexOf(marker);
    if (i > splitIndex) {
      splitIndex = i + marker.length;
    }
  }

  // Avoid tiny media caption if no good breakpoint exists early in text.
  if (splitIndex < Math.floor(limit * 0.6)) {
    splitIndex = limit;
  }

  const mediaCaption = caption.slice(0, splitIndex).trimEnd();
  return `${mediaCaption}\n\n...`;
}

async function checkTgResponse(res: Response, method: string) {
  console.log(`[Telegram] ${method} response status: ${res.status}`);
  const start = Date.now();
  const data = await res.json();
  console.log(`[Telegram] ${method} JSON parsed in ${Date.now() - start}ms`);
  if (!data.ok) {
    console.error(`[Telegram] ${method} ERROR: ${data.error_code} - ${data.description}`);
    if (data.error_code === 403) {
      console.error(
        '[Telegram] 403 hint: add the bot to the target channel/group and grant admin permission to post messages.'
      );
    }
    throw new Error(`Telegram ${method} error ${data.error_code}: ${data.description}`);
  }
  console.log(`[Telegram] ${method} SUCCESS`);
  return data;
}

export async function sendMessage(text: string) {
  if (!CHAT) {
    throw new Error(
      '[Config] TELEGRAM_CHANNEL_ID is missing. Set it in .env.local as @channel_username or -100xxxxxxxxxx.'
    );
  }
  console.log(`[Telegram] sendMessage to ${CHAT}, text length: ${text.length}`);
  const start = Date.now();
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      parse_mode: 'HTML',
    }),
  });
  console.log(`[Telegram] sendMessage fetch completed in ${Date.now() - start}ms`);
  await checkTgResponse(res, 'sendMessage');
}

export async function sendPhoto(imageUrl: string, caption: string) {
  if (!CHAT) {
    throw new Error(
      '[Config] TELEGRAM_CHANNEL_ID is missing. Set it in .env.local as @channel_username or -100xxxxxxxxxx.'
    );
  }
  const mediaCaption = fitCaptionForMedia(caption);
  console.log(`[Telegram] sendPhoto to ${CHAT}, image: ${imageUrl.slice(0, 60)}...`);
  const start = Date.now();

  // First try URL-based send (fast path). Some image hosts are inaccessible for Telegram.
  try {
    const res = await fetch(`${BASE}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT,
        photo: imageUrl,
        caption: mediaCaption,
        parse_mode: 'HTML',
      }),
    });
    console.log(`[Telegram] sendPhoto(URL) fetch completed in ${Date.now() - start}ms`);
    await checkTgResponse(res, 'sendPhoto');
    return;
  } catch (urlError) {
    console.warn(`[Telegram] sendPhoto(URL) failed, trying file upload fallback: ${urlError}`);
  }

  // Fallback: download image server-side and upload as multipart file.
  const imageStart = Date.now();
  const imageResponse = await fetch(imageUrl);
  console.log(
    `[Telegram] Image fetch for upload completed in ${Date.now() - imageStart}ms, status: ${imageResponse.status}`
  );
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image for Telegram upload: ${imageResponse.status}`);
  }

  const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
  const extension =
    contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const imageBlob = await imageResponse.blob();

  const form = new FormData();
  form.append('chat_id', CHAT);
  form.append('caption', mediaCaption);
  form.append('parse_mode', 'HTML');
  form.append('photo', imageBlob, `image.${extension}`);

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${BASE}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
  console.log(`[Telegram] sendPhoto(upload) completed in ${Date.now() - uploadStart}ms`);
  await checkTgResponse(uploadRes, 'sendPhoto');
}

// Стриминг видео без буферизации в память
export async function sendVideo(videoUrl: string, caption: string) {
  if (!CHAT) {
    throw new Error(
      '[Config] TELEGRAM_CHANNEL_ID is missing. Set it in .env.local as @channel_username or -100xxxxxxxxxx.'
    );
  }
  const mediaCaption = fitCaptionForMedia(caption);
  console.log(`[Telegram] sendVideo to ${CHAT}, video: ${videoUrl}`);
  console.log('[Telegram] Fetching video...');
  const videoStart = Date.now();
  const videoResponse = await fetch(videoUrl);
  console.log(`[Telegram] Video fetch completed in ${Date.now() - videoStart}ms, status: ${videoResponse.status}`);
  
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Failed to fetch video: ${videoResponse.status}`);
  }
  
  console.log('[Telegram] Building FormData...');
  const form = new FormData();
  form.append('chat_id', CHAT);
  form.append('caption', mediaCaption);
  form.append('parse_mode', 'HTML');
  // @ts-expect-error ReadableStream совместим с FormData в Node 18+
  form.append('video', videoResponse.body, { filename: 'video.mp4', contentType: 'video/mp4' });

  console.log('[Telegram] Sending video to Telegram...');
  const start = Date.now();
  const res = await fetch(`${BASE}/sendVideo`, { method: 'POST', body: form });
  console.log(`[Telegram] sendVideo fetch completed in ${Date.now() - start}ms`);
  await checkTgResponse(res, 'sendVideo');
}
