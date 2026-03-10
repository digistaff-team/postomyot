import OpenAI from 'openai';

function getOpenAiApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new Error(
      '[Config] OPENAI_API_KEY is missing. Set it in .env.local as OPENAI_API_KEY=sk-... and restart the server.'
    );
  }

  const looksLikeEnvPath =
    key.includes('.env') ||
    key.includes('\\') ||
    key.includes('/') ||
    /^[A-Za-z]:/.test(key);

  if (looksLikeEnvPath) {
    throw new Error(
      `[Config] OPENAI_API_KEY looks like a file path ("${key}"), not an API key. ` +
      'Use the actual OpenAI key value (starts with "sk-"), not a path to .env.'
    );
  }

  if (!key.startsWith('sk-')) {
    throw new Error(
      '[Config] OPENAI_API_KEY has an invalid format. Expected an OpenAI key that starts with "sk-".'
    );
  }

  return key;
}

const openai = new OpenAI({
  apiKey: getOpenAiApiKey(),
});

const MODEL = 'gpt-4o-mini';

/**
 * Генерирует текст поста для Telegram на основе темы
 * Требования: до 800 символов, эмодзи умеренно, без markdown-разметки
 */
export async function generatePostText(topic: string): Promise<string> {
  console.log(`[OpenAI] Generating post text for topic: ${topic.slice(0, 50)}...`);
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Ты маркетолог по прогреву аудитории. Пиши посты для Telegram.\n' +
          'Требования:\n' +
          '- До 800 символов\n' +
          '- Эмодзи умеренно, по делу\n' +
          '- Рассказывай истории, приводи примеры, если уместно\n' +
          '- БЕЗ markdown-разметки: никаких *, _, #, `, ~\n' +
          '- БЕЗ технических пояснений в конце (никаких "(347 символов)")\n' +
          '- Пиши обычным текстом без форматирования\n' +
          '- В конце призыв к действию - попробовать именно в твоём бизнесе, чтобы узнать, как именно у тебя можно это применить\n' +
          '- Добавляй всегда СТРОГО обязательно в конце ссылку https://client-factory-score.lovable.app \n' +
          '- Используй живой, вовлекающий стиль речи, чтобы читатели чувствовали, что ты говоришь прямо с ними',
      },
      {
        role: 'user',
        content: `Напиши пост для Telegram на тему: ${topic}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const text = response.choices[0]?.message?.content ?? '';
  console.log(`[OpenAI] Post text generated in ${Date.now() - start}ms`);

  // Очищаем от возможных остатков markdown
  return stripMarkdown(text.trim());
}

/**
 * Генерирует заголовок для поста в Telegram
 * Требования: эмодзи 🚀/⚡️/🤖 в начале, HTML <b>, до 70 символов
 */
export async function generateTitle(topic: string): Promise<string> {
  console.log(`[OpenAI] Generating title for topic: ${topic.slice(0, 50)}...`);
  const start = Date.now();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Ты копирайтер. Напиши ОДИН заголовок для Telegram-поста.\n' +
          'Требования:\n' +
          '- Эмодзи 🚀 или ⚡️ или 🤖 в начале\n' +
          '- Оберни текст в <b>текст</b>\n' +
          '- Максимум 70 символов\n' +
          '- Только заголовок, без пояснений и кавычек',
      },
      {
        role: 'user',
        content: `Напиши заголовок для поста на тему: ${topic}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 50,
  });

  const title = response.choices[0]?.message?.content ?? '';
  console.log(`[OpenAI] Title generated in ${Date.now() - start}ms`);

  return title.trim();
}

/**
 * Очищает markdown-разметку из текста
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')        // *italic* → italic
    .replace(/__(.+?)__/g, '$1')        // __bold__ → bold
    .replace(/_(.+?)_/g, '$1')          // _italic_ → italic
    .replace(/~~(.+?)~~/g, '$1')        // ~~strike~~ → strike
    .replace(/`(.+?)`/g, '$1')          // `code` → code
    .replace(/#{1,6}\s/g, '')           // ## заголовки
    .replace(/^[-*]\s/gm, '')           // - маркеры списка
    .trim();
}
