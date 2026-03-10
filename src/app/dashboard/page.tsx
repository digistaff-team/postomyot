import DashboardClient from './DashboardClient';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pwd?: string }>;
}) {
  const { pwd } = await searchParams;

  if (!pwd || pwd !== process.env.DASHBOARD_PASSWORD) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <form method="GET" className="flex flex-col gap-4 w-80">
          <h1 className="text-xl font-bold text-center">📨 Постомёт</h1>
          <p className="text-sm text-muted-foreground text-center">Введите пароль для доступа</p>
          <input
            name="pwd"
            type="password"
            placeholder="Пароль"
            className="border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Войти
          </button>
          {pwd !== undefined && (
            <p className="text-sm text-destructive text-center">Неверный пароль</p>
          )}
        </form>
      </div>
    );
  }

  return <DashboardClient password={pwd} />;
}
