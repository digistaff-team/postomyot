'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

type PostType = 'text' | 'photo' | 'video';
type PostStatus = 'success' | 'error';

interface HistoryRow {
  id: number;
  created_at: string;
  topic: string;
  post_type: PostType;
  status: PostStatus;
  title_preview: string;
  text_preview: string;
  error_message: string | null;
}

const TYPE_ICON: Record<PostType, string> = {
  text: '💬',
  photo: '📷',
  video: '🎬',
};

export default function DashboardClient({ password }: { password: string }) {
  const [queue, setQueue] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [q, h] = await Promise.all([
        fetch('/api/queue').then((r) => r.json()),
        fetch('/api/history').then((r) => r.json()),
      ]);
      setQueue(Array.isArray(q) ? q : []);
      setHistory(Array.isArray(h) ? h : []);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProcess = async () => {
    setLoading(true);
    setLastResult(null);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);

      const res = await fetch('/api/process-next-post', {
        headers: { Authorization: `Bearer ${password}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok) {
        setLastResult({
          ok: true,
          message: data.message ?? `Отправлено: ${TYPE_ICON[data.type as PostType] ?? ''} ${data.type} — ${data.topic}`,
        });
      } else {
        setLastResult({ ok: false, message: data.error ?? 'Неизвестная ошибка' });
      }
      await fetchData();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setLastResult({ ok: false, message: 'Таймаут 90с — проверьте Telegram вручную' });
      } else {
        setLastResult({ ok: false, message: 'Ошибка сети' });
      }
      await fetchData();
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
    }
  };

  const stats = {
    total: history.length,
    success: history.filter((h) => h.status === 'success').length,
    error: history.filter((h) => h.status === 'error').length,
    text: history.filter((h) => h.post_type === 'text').length,
    photo: history.filter((h) => h.post_type === 'photo').length,
    video: history.filter((h) => h.post_type === 'video').length,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">📨 Постомёт — Дашборд</h1>
          <button
            onClick={fetchData}
            disabled={fetching}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            {fetching ? '⏳ Обновление...' : '🔄 Обновить'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[
            ['Всего', stats.total, ''],
            ['Успешно', stats.success, 'text-green-500'],
            ['Ошибок', stats.error, 'text-red-500'],
            ['💬 Текст', stats.text, ''],
            ['📷 Фото', stats.photo, ''],
            ['🎬 Видео', stats.video, ''],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handleProcess}
            disabled={loading || queue.length === 0}
            className="bg-primary text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Обрабатываю... {elapsed}s
              </>
            ) : (
              '▶️ Обработать сейчас'
            )}
          </button>
          {lastResult && (
            <span className={`text-sm ${lastResult.ok ? 'text-green-500' : 'text-red-500'}`}>
              {lastResult.ok ? '✅' : '❌'} {lastResult.message}
            </span>
          )}
        </div>

        {/* Queue */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            📋 Очередь тем
            <span className="ml-2 text-sm font-normal text-muted-foreground">({queue.length})</span>
          </h2>
          <div className="rounded-lg border overflow-hidden">
            {queue.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                {fetching ? 'Загрузка...' : 'Очередь пуста'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium w-10">#</th>
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Тема</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((topic, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30 transition">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5">{topic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* History */}
        <div>
          <h2 className="text-lg font-semibold mb-3">
            📜 История постов
            <span className="ml-2 text-sm font-normal text-muted-foreground">({history.length})</span>
          </h2>
          <div className="rounded-lg border overflow-hidden">
            {history.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                {fetching ? 'Загрузка...' : 'История пуста'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">Дата</th>
                      <th className="px-4 py-2 text-left text-muted-foreground font-medium">Тема</th>
                      <th className="px-4 py-2 text-left text-muted-foreground font-medium">Тип</th>
                      <th className="px-4 py-2 text-left text-muted-foreground font-medium">Статус</th>
                      <th className="px-4 py-2 text-left text-muted-foreground font-medium">Превью</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-muted/30 transition">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(row.created_at).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2.5 max-w-[160px] truncate" title={row.topic}>
                          {row.topic}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                            {TYPE_ICON[row.post_type]} {row.post_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              row.status === 'success'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {row.status === 'success' ? '✅ ok' : '❌ error'}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate"
                          title={row.error_message ?? row.text_preview}
                        >
                          {row.error_message ?? row.text_preview}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
