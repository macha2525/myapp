'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  due_has_time: boolean;
  status: 'todo' | 'doing' | 'done';
  created_at: string;
};

function formatDue(iso: string, hasTime: boolean) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  });
  if (!hasTime) return date;
  const time = d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });
  return `${date} ${time}`;
}

export default function TaskBoard() {
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [dueTime, setDueTime] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id,title,note,due_at,due_has_time,status,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setError('読み込みに失敗しました。');
    } else {
      setTasks(data as Task[]);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    // 日付+時間を選んだ場合はその時刻、日付だけの場合はその日の23:59(日本時間)
    const hasTime = Boolean(due && dueTime);
    const dueAt = due
      ? new Date(`${due}T${hasTime ? dueTime : '23:59'}:00+09:00`).toISOString()
      : null;

    const { error } = await supabase.from('tasks').insert({
      title: t,
      due_at: dueAt,
      due_has_time: hasTime,
    });

    if (error) {
      setError('追加に失敗しました。');
      return;
    }
    setTitle('');
    setDue('');
    setDueTime('');
    load();
  }

  async function toggle(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id);
    if (error) {
      setError('更新に失敗しました。');
      load();
    }
  }

  async function remove(task: Task) {
    if (!window.confirm(`「${task.title}」を削除する?`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) {
      setError('削除に失敗しました。');
      return;
    }
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
  }

  const now = Date.now();
  const open = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });
  const done = tasks.filter((t) => t.status === 'done');

  const inputClass =
    'rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <div className="space-y-6">
      <form onSubmit={addTask} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="やることを入力"
          className={`w-full ${inputClass}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => {
              setDue(e.target.value);
              if (!e.target.value) setDueTime('');
            }}
            className={`min-w-[8rem] flex-1 ${inputClass}`}
          />
          <input
            type="time"
            value={dueTime}
            disabled={!due}
            onChange={(e) => setDueTime(e.target.value)}
            className={`w-28 ${inputClass} disabled:opacity-40`}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            追加
          </button>
        </div>
        <p className="text-xs text-muted">時間は空のままでもOK。その場合は、その日いっぱいが期限になるよ。</p>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">読み込み中…</p>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted">未完了 ({open.length})</h3>
            {open.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                タスクはありません。平和だね。
              </p>
            )}
            <ul className="space-y-2">
              {open.map((t) => {
                const overdue = t.due_at !== null && new Date(t.due_at).getTime() < now;
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <button
                      onClick={() => toggle(t)}
                      aria-label="完了にする"
                      className="h-5 w-5 shrink-0 rounded-full border border-muted transition hover:border-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.title}</p>
                      {t.due_at && (
                        <p className={`text-xs ${overdue ? 'text-red-500' : 'text-muted'}`}>
                          期限 {formatDue(t.due_at, t.due_has_time)}
                          {overdue && ' (過ぎています)'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => remove(t)}
                      className="text-xs text-muted underline underline-offset-4 hover:text-text"
                    >
                      削除
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {done.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted">完了済み ({done.length})</h3>
              <ul className="space-y-2">
                {done.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 opacity-60"
                  >
                    <button
                      onClick={() => toggle(t)}
                      aria-label="未完了に戻す"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] text-accent-fg"
                    >
                      ✓
                    </button>
                    <p className="min-w-0 flex-1 truncate text-sm line-through">{t.title}</p>
                    <button
                      onClick={() => remove(t)}
                      className="text-xs text-muted underline underline-offset-4 hover:text-text"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}