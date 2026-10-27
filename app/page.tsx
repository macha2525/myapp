import AuthGate from '@/components/AuthGate';
import RoutineBoard from '@/components/RoutineBoard';
import TaskBoard from '@/components/TaskBoard';
import ThemeSwitcher from '@/components/ThemeSwitcher';

export default function Home() {
  return (
    <AuthGate>
      <main className="mx-auto max-w-xl space-y-10 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Life App</h1>
          <p className="text-sm text-muted">生活を、少しだけ整えるためのアプリ。</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">定期タスク</h2>
          <RoutineBoard />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">タスク</h2>
          <TaskBoard />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">テーマ</h2>
          <ThemeSwitcher />
        </section>
      </main>
    </AuthGate>
  );
}