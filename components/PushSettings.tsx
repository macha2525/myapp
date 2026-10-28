'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

type Status = 'checking' | 'unsupported' | 'need-install' | 'denied' | 'off' | 'on';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const STATUS_TEXT: Record<Status, string> = {
  checking: '確認中…',
  unsupported: 'このブラウザは、通知に対応していません。',
  'need-install':
    'iPhoneでは、Safariの共有ボタンから「ホーム画面に追加」して、そのアイコンから開き直すと、通知を設定できます。',
  denied: '通知がブロックされています。端末の設定から、許可し直してください。',
  off: '通知はオフです。',
  on: '通知はオンです。この端末に届きます。',
};

export default function PushSettings() {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    // iPhoneでSafariのまま開いている場合は、先にホーム画面への追加を案内する
    if (isIos && !standalone) return setStatus('need-install');

    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return setStatus('unsupported');
    if (Notification.permission === 'denied') return setStatus('denied');

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setStatus(sub ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus('unsupported'));
  }, [refresh]);

  async function enable() {
    if (!PUBLIC_KEY) return setMessage('公開鍵が設定されていません(.env.local を確認してね)。');
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as unknown as BufferSource,
      });
      const json = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw error;
      setStatus('on');
      setMessage('通知を有効にしました。');
    } catch (e) {
      console.error(e);
      setMessage('通知の登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setMessage('ログイン情報が見つかりません。もう一度ログインしてね。');

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? `テスト通知を送りました(${body.sent}/${body.total}台)。数秒待ってね。`
          : `送信に失敗しました: ${body.error ?? res.status}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('off');
      setMessage('通知をオフにしました。');
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    'rounded-lg px-4 py-2 text-sm transition disabled:opacity-50';

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm">{STATUS_TEXT[status]}</p>

      <div className="flex flex-wrap gap-2">
        {status === 'off' && (
          <button
            onClick={enable}
            disabled={busy}
            className={`${buttonClass} bg-accent font-medium text-accent-fg hover:opacity-90`}
          >
            通知を許可する
          </button>
        )}
        {status === 'on' && (
          <>
            <button
              onClick={sendTest}
              disabled={busy}
              className={`${buttonClass} bg-accent font-medium text-accent-fg hover:opacity-90`}
            >
              テスト通知を送る
            </button>
            <button
              onClick={disable}
              disabled={busy}
              className={`${buttonClass} border border-border text-muted hover:text-text`}
            >
              通知をオフにする
            </button>
          </>
        )}
      </div>

      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}