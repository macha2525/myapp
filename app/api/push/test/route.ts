import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !key || !vapidPublic || !vapidPrivate || !subject) {
    return NextResponse.json({ error: 'サーバーの設定が足りません' }, { status: 500 });
  }

  // ログインした本人の権限で動かす(RLSが効くので、自分の端末の分だけ読める)
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'ログイン情報が無効です' }, { status: 401 });
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth');
  if (error) {
    return NextResponse.json({ error: '端末情報の読み込みに失敗しました' }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: '登録された端末がありません' }, { status: 404 });
  }

  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
  const payload = JSON.stringify({
    title: 'Life App',
    body: 'テスト通知です。届いていれば成功!',
    url: '/',
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 端末側で通知が解除されている宛先は、掃除しておく
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id);
      }
      console.error('push failed', statusCode);
    }
  }

  return NextResponse.json({ sent, total: subs.length });
}