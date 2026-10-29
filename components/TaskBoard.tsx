'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { jstParts } from '@/lib/calendar';
import { COPY } from '@/lib/copy';

type Task = {
  id: string;
  title: string;
  note: string | null;
  due_at: string | null;
  due_has_time: boolean;
  status: 'todo' | 'doing' | 'done';
  created_at: string;
};

// メモの中のURLを、押せるリンクにする(日本語の文字の手前で止まる)
const URL_RE = /(https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+)/g;

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-2 hover:text-text"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

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

// 日付+時間を選んだ場合はその時刻、日付だけの場合はその日の23:59(日本時間)
function toDueAt(date: string, time: string) {
  if (!date) return { due_at: null, due_has_time: false };
  const hasTime = Boolean(time);
  return {
    due_at: new Date(`${date}T${hasTime ? time : '23:59'}:00+09:00`).toISOString(),
    due_has_time: hasTime,
  };
}

export default function TaskBoard() {
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [dueTime, setDueTime] = useState('');

  // 修正フォーム
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eNote, setENote] = useState('');
  const [eDue, setEDue] = useState('');
  const [eTime, setETime] = useState('');
  const [saving, setSaving] = useState(false);

  // メモを広げているタスク
  const [openNotes, setOpenNotes] = useState<string[]>([]);

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

    const { error } = await supabase.from('tasks').insert({
      title: t,
      note: note.trim() || null,
      ...toDueAt(due, dueTime),
    });

    if (error) {
      setError('追加に失敗しました。');
      return;
    }
    setTitle('');
    setNote('');
    setDue('');
    setDueTime('');
    load();
  }

  function startEdit(t: Task) {
    const p = t.due_at ? jstParts(t.due_at) : null;
    setEditingId(t.id);
    setETitle(t.title);
    setENote(t.note ?? '');
    setEDue(p ? p.date : '');
    setETime(p && t.due_has_time ? p.time : '');
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const t = eTitle.trim();
    if (!t) {
      setError('名前を入力してね。');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('tasks')
      .update({
        title: t,
        note: eNote.trim() || null,
        ...toDueAt(eDue, eTime),
      })
      .eq('id', editingId);
    setSaving(false);

    if (error) {
      setError('保存に失敗しました。');
      return;
    }
    setEditingId(null);
    setError(null);
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
    if (editingId === task.id) setEditingId(null);
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
  }

  function toggleNote(id: string) {
    setOpenNotes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const linkBtn =
    'shrink-0 text-xs text-muted underline underline-offset-4 hover:text-text';

  function renderTask(t: Task, isDone: boolean) {
    const overdue = !isDone && t.due_at !== null && new Date(t.due_at).getTime() < now;
    const editing = editingId === t.id;

    return (
      <li
        key={t.id}
        className={`rounded-xl border border-border bg-surface px-4 py-3 ${
          isDone && !editing ? 'opacity-60' : ''
        }`}
      >
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-3">
            <input
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              className={`w-full ${inputClass}`}
            />
            <textarea
              value={eNote}
              onChange={(e) => setENote(e.target.value)}
              rows={4}
              placeholder={COPY.tasks.notePlaceholder}
              className={`w-full resize-y leading-relaxed ${inputClass}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={eDue}
                onChange={(e) => {
                  setEDue(e.target.value);
                  if (!e.target.value) setETime('');
                }}
                className={`min-w-[8rem] flex-1 ${inputClass}`}
              />
              <input
                type="time"
                value={eTime}
                disabled={!eDue}
                onChange={(e) => setETime(e.target.value)}
                className={`w-28 ${inputClass} disabled:opacity-40`}
              />
              {eDue && (
                <button
                  type="button"
                  onClick={() => {
                    setEDue('');
                    setETime('');
                  }}
                  className={linkBtn}
                >
                  期限を消す
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition hover:text-text"
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggle(t)}
                aria-label={isDone ? '未完了に戻す' : '完了にする'}
                className={
                  isDone
                    ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] text-accent-fg'
                    : 'h-5 w-5 shrink-0 rounded-full border border-muted transition hover:border-accent'
                }
              >
                {isDone ? '✓' : ''}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm ${isDone ? 'line-through' : ''}`}>{t.title}</p>
                {t.due_at && (
                  <p className={`text-xs ${overdue ? 'text-red-500' : 'text-muted'}`}>
                    期限 {formatDue(t.due_at, t.due_has_time)}
                    {overdue && ' (過ぎています)'}
                  </p>
                )}
              </div>
              <button onClick={() => startEdit(t)} className={linkBtn}>
                編集
              </button>
              <button onClick={() => remove(t)} className={linkBtn}>
                削除
              </button>
            </div>

            {t.note && (
              <div
                onClick={() => toggleNote(t.id)}
                title="タップで開閉"
                className={`mt-2 cursor-pointer whitespace-pre-wrap break-words pl-8 text-xs leading-relaxed text-muted ${
                  openNotes.includes(t.id) ? '' : 'line-clamp-2'
                }`}
              >
                <LinkifiedText text={t.note} />
              </div>
            )}
          </>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addTask} className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={COPY.tasks.titlePlaceholder}
          className={`w-full ${inputClass}`}
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={COPY.tasks.notePlaceholder}
          className={`w-full resize-y leading-relaxed ${inputClass}`}
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
        <p className="text-xs text-muted">{COPY.tasks.dueHint}</p>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">読み込み中…</p>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted">
              {COPY.tasks.openHeading} ({open.length})
            </h3>
            {open.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                {COPY.tasks.empty}
              </p>
            )}
            <ul className="space-y-2">{open.map((t) => renderTask(t, false))}</ul>
          </section>

          {done.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted">
                {COPY.tasks.doneHeading} ({done.length})
              </h3>
              <ul className="space-y-2">{done.map((t) => renderTask(t, true))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}