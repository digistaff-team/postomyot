const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT = '@bot_test_alex';
const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function checkTgResponse(res: Response, method: string) {
  console.log(`[Telegram] ${method} response status: ${res.status}`);
  const start = Date.now();
  const data = await res.json();
  console.log(`[Telegram] ${method} JSON parsed in ${Date.now() - start}ms`);
  if (!data.ok) {
    console.error(`[Telegram] ${method} ERROR: ${data.error_code} - ${data.description}`);
    throw new Error(`Telegram ${method} error ${data.error_code}: ${data.description}`);
  }
  console.log(`[Telegram] ${method} SUCCESS`);
  return data;
}

export async function sendMessage(text: string) {
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
  console.log(`[Telegram] sendPhoto to ${CHAT}, image: ${imageUrl.slice(0, 60)}...`);
  const start = Date.now();
  const res = await fetch(`${BASE}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      photo: imageUrl,
      caption,
      parse_mode: 'HTML',
    }),
  });
  console.log(`[Telegram] sendPhoto fetch completed in ${Date.now() - start}ms`);
  await checkTgResponse(res, 'sendPhoto');
}

// Стриминг видео без буферизации в память
export async function sendVideo(videoUrl: string, caption: string) {
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
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  // @ts-expect-error ReadableStream совместим с FormData в Node 18+
  form.append('video', videoResponse.body, { filename: 'video.mp4', contentType: 'video/mp4' });

  console.log('[Telegram] Sending video to Telegram...');
  const start = Date.now();
  const res = await fetch(`${BASE}/sendVideo`, { method: 'POST', body: form });
  console.log(`[Telegram] sendVideo fetch completed in ${Date.now() - start}ms`);
  await checkTgResponse(res, 'sendVideo');
}
