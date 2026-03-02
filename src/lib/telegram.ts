const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT = '@blabluf';
const BASE = `https://api.telegram.org/bot${TOKEN}`;

export async function sendMessage(caption: string) {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      text: caption,
      parse_mode: 'HTML',
    }),
  });
}

export async function sendPhoto(imageUrl: string, caption: string) {
  await fetch(`${BASE}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT,
      photo: imageUrl,
      caption,
      parse_mode: 'HTML',
    }),
  });
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

  await fetch(`${BASE}/sendVideo`, { method: 'POST', body: form });
}
