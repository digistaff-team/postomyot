# Postomyot Bot 🦾

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black.svg?style=flat&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.3-blue.svg?style=flat&logo=react)](https://react.dev)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-orange.svg?style=flat&logo=vercel)](https://vercel.com)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-purple.svg?style=flat&logo=telegram)](https://core.telegram.org/bots)

**Postomyot Bot** — автоматизированный контент-фабрика для Telegram-каналов. Бот читает темы из Google Sheets, генерирует посты на русском языке (текст via OpenAI GPT-4o-mini, изображения via KIE.ai Z-Image), публикует по расписанию или вручную. Развёрнут на Vercel с Neon DB для логов.

## ✨ Функции
- **Автогенерация постов**: Темы из Sheets → AI-текст (OpenAI) → Изображение/видео (KIE.ai Z-Image).
- **Логика по дням**: Фото по будням, видео по выходным (fallback на фото).
- **Обработка ошибок**: Таймауты до 300с (Vercel), retry, логирование (Neon DB, console).
- **UI-дашборд**: Простой интерфейс на shadcn/ui + Tailwind для мониторинга/триггера.
- **Интеграции**: Google Sheets (авторизация service account), Telegram Bot API (fetch), Neon Postgres (serverless).
- **Оптимизации**: Короткие промпты изображений, стрип маркдауна, счётчик символов опционально.

## 🛠 Tech Stack
| Компонент | Версия/Детали |
|-----------|---------------|
| Framework | Next.js 16.1.6 (App Router) |
| UI | React 19.2.3, shadcn/ui, Tailwind CSS 4, Lucide icons |
| DB | Neon Postgres (serverless) |
| Sheets | Google Auth Library |
| Deploy | Vercel (maxDuration: 300s, cron-jobs) |
| Lint/Type | ESLint 9, TypeScript 5 |

Структура: `src/` (app, components, lib/utils), `public/`, `vercel.json` (конфиг runtime).

## 🚀 Быстрый старт (локально)
1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/digistaff-team/postomyot.git
   cd postomyot
   ```
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Создайте `.env.local` (см. ниже).
4. Запустите dev-сервер:
   ```bash
   npm run dev
   ```
   Откройте [http://localhost:3000](http://localhost:3000).

Скрипты: `dev` / `build` / `start` / `lint` (стандартные).

## 🔑 Environment Variables
Создайте `.env.local` (gitignore'ится). Обязательные ключи:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHANNEL_ID=@your_channel_or_-100xxxxxxxxxx

PROTALK_API_KEY=sk-..._protalk_key  # Для /ask endpoint
Z_IMAGE_API_KEY=...  # Или endpoint для генерации изображений/видео
Z_IMAGE_ENDPOINT=https://z-image.api/ask  # Кастомный

NEON_DATABASE_URL=postgres://...@neon.tech/db?sslmode=require

GOOGLE_SHEETS_ID=1abc...google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=path/to/service-account.json  # Или inline JSON

VERCEL_CRON_SECRET=secret_for_webhook  # Опционально для триггера
LOG_LEVEL=debug  # debug/info/error
```

**Sheets структура**: Лист "Лист тем курс 4" (или "Лист1") с колонками: Тема, Доп.инфо. Бот берёт следующую тему по порядку.

## ☁️ Деплой на Vercel
1. Push в GitHub.
2. Vercel Dashboard → Import repo → Deploy.
3. Добавьте env vars в Settings.
4. Настройте Cron Jobs: `0 12 * * *` (/api/generate-post) для ежедневных постов в 12:00 UTC.
5. Триггер вручную: POST /api/generate-post?secret=your_secret.

vercel.json настраивает functions timeout/CPU.

## 📖 Использование
- **Автопостинг**: Cron вызывает `/api/generate-post` → Читает Sheet → Генерит → Постит в канал.
- **Ручной триггер**: UI на `/` или webhook.
- **Мониторинг**: Логи в Vercel/Neon, console в dev.
- **Локальный тест**: `curl -X POST http://localhost:3000/api/generate-post`.

Последовательность (из кода/коммитов):
1. Get next theme from Sheets.
2. Generate text prompt (ProTalk /ask, timeout 90s).
3. Gen image/video (Z-Image, short prompt).
4. Strip markdown, add emojis if needed.
5. Post via Telegram API (photo/video message).

## 🐛 Troubleshooting
- **Timeout 504/500**: Увеличьте промпты, проверьте API-ключи. Логи в Neon.
- **Sheets auth**: Создайте service account, share Sheet с email.
- **Русский текст**: Промпт forbids slang/hashtags/char count.
- **Video fallback**: Если нет video_url → photo post.

## 🤝 Contributing
- Создайте issue для фич/багов.
- Branch: `feat/xxx` → PR в main.
- Lint: `npm run lint`.
- Тесты: TODO (добавить).

## 📄 License
MIT (стандарт Next.js).

## 👥 Авторы
- [Alexander Bobkov (@abconsult)](https://github.com/abconsult) — основной dev.
- digistaff-team

[🚀 Demo-канал](https://t.me/postomyot) | [Vercel Logs](https://vercel.com/digistaff-team/postomyot)

---

*Актуально на 03.03.2026. Коммиты: ~20 за сутки (фиксы AI/таймаутов).*
