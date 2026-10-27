'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  status: 'todo' | 'doing' | 'done';
  created_at: string;
};

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  });
}

export default function TaskBoard() {
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id,title,note,due_at,status,created_at')
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

    const { error } = await supabase.from('tasks').insert({
      title: t,
      // 日付だけ選んだ場合は、その日の日本時間23:59を期限にする
      due_at: due ? new Date(`${due}T23:59:00+09:00`).toISOString() : null,
    });

    if (error) {
      setError('追加に失敗しました。');
      return;
    }
    setTitle('');
    setDue('');
    load();
  }

  async function toggle(task: Task) {
    const next = task.status === 'done' ? 'todo' : 'done';
    // 先に画面を更新して、体感を速くする
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

  return (
    <div className="space-y-6">
      <form onSubmit={addTask} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="やることを入力"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            追加
          </button>
        </div>
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
                          期限 {formatDue(t.due_at)}
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