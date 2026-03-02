const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT = '@bot_test_alex';
const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function checkTgResponse(res: Response, method: string) {
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} error ${data.error_code}: ${data.description}`);
  }
  return data;
}

export async function sendMessage(text: string) {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      parse_mode: 'HTML',
    }),
  });
  await checkTgResponse(res, 'sendMessage');
}

export async function sendPhoto(imageUrl: string, caption: string) {
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
  await checkTgResponse(res, 'sendPhoto');
}

// Стриминг видео без буферизации в память
export async function sendVideo(videoUrl: string, caption: string) {
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok || !videoResponse.body) {
    throw new Error(`Failed to fetch video: ${videoResponse.status}`);
  }
  const form = new FormData();
  form.append('chat_id', CHAT);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  // @ts-expect-error ReadableStream совместим с FormData в Node 18+
  form.append('video', videoResponse.body, { filename: 'video.mp4', contentType: 'video/mp4' });

  const res = await fetch(`${BASE}/sendVideo`, { method: 'POST', body: form });
  await checkTgResponse(res, 'sendVideo');
}
