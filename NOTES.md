# Life App 引き継ぎメモ

最終更新: 2026-10-29 / 持ち主: 美織 / 相談相手: ゆめお(Claude)

## 1. これは何か
生活を便利にする個人用Webアプリ(PWA)。PC(Windows)とiPhoneの両方で使う。
タスク、定期タスク、予定(授業を含む)、カレンダー、通知を1つにまとめる。月額0円の運用が前提。

## 2. 環境
| 項目 | 内容 |
|---|---|
| PC / スマホ | Windows / iPhone(ホーム画面に追加して使う) |
| 作業場所 | `C:\Users\gotom\dev\life-app`(PowerShell。管理者権限では開かない) |
| フレームワーク | Next.js 16.4.3(App Router / TypeScript / Turbopack)。`cacheComponents` が有効 |
| スタイル | Tailwind CSS(v4系の書き方で動作確認済み) |
| DB・ログイン | Supabase(Postgres、メール+パスワード認証) |
| 公開 | Vercel(Hobbyプラン)。GitHub(Private)へpushすると自動デプロイ |
| 通知 | web-push(Web Push + VAPID) |
| src フォルダ | なし |

## 3. 日々の作業の流れ
```powershell
cd $HOME\dev\life-app
npm run dev          # http://localhost:3000 で確認(止めるときは Ctrl + C)
git add .
git commit -m "変更内容"
git push             # Vercelが自動で公開版を更新
```
- 環境変数を足したら、Vercelの Environment Variables にも登録してから push(または Redeploy)する。
- `.env.local` を直したら、開発サーバーを起動し直す。

## 4. 環境変数(値はここに書かない。NOTES.md は GitHub に上がる)
| 名前 | 置き場所 | 性質 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | .env.local / Vercel | 公開してよい |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | .env.local / Vercel | 公開用キー。公開してよい |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | .env.local / Vercel | 公開してよい |
| VAPID_PRIVATE_KEY | .env.local / Vercel(Sensitive) | 秘密。画面側に出さない |
| VAPID_SUBJECT | .env.local / Vercel | `mailto:` で始まる連絡先 |

Supabaseの service_role key(秘密のキー)は、まだ使っていない。使うのは、定時の通知送信(E4)のサーバー側だけ。
必ず `NEXT_PUBLIC_` を付けずに、Vercelの環境変数にだけ登録する。コードやGitHubには絶対に入れない。

## 5. データベース(Supabase)
全テーブルでRLSを有効化。ポリシー名は "own rows"(`auth.uid() = user_id`)。
`user_id` は `default auth.uid()` なので、insert時に渡さなくてよい。

| テーブル | 役割 | 主な列 |
|---|---|---|
| tasks | 不定期タスク | title, note, due_at(timestamptz), due_has_time, status(todo/doing/done), tags |
| routine_tasks | 定期タスクのひな型 | title, recurrence(weekly/monthly), weekdays, month_mode(day/last_day/nth_weekday), month_days, nth_week(-1=最終), clamp_to_month_end, is_active |
| routine_logs | 定期タスクの完了記録 | routine_id, log_date。(routine_id, log_date)は一意 |
| schedules | 予定(単発・毎週) | title, location, kind(single/weekly), all_day, start_date, end_date, weekdays, start_time, end_time |
| schedule_exceptions | 休講などの例外 | schedule_id, occurrence_date, kind(cancelled/modified), new_start_time, new_end_time, new_location。(schedule_id, occurrence_date)は一意 |
| push_subscriptions | 通知の宛先(端末ごと) | endpoint(一意), p256dh, auth, user_agent |
| events | 未使用。将来の .ics 取り込み用に予約 | - |

テーブル作成のSQLは、Supabaseの SQL Editor で実行した。リポジトリには保存していない。

## 6. ファイル構成
| ファイル | 役割 |
|---|---|
| app/layout.tsx | 全体の枠。テーマ適用スクリプト(ちらつき防止)、PWAのメタ情報 |
| app/globals.css | 色のCSS変数、ライト/ダーク、5色のアクセント、Tailwind v4の設定 |
| app/page.tsx | トップ。AuthGateの中に各部品を並べる |
| app/login/page.tsx | ログイン画面(メール+パスワード) |
| app/manifest.ts | PWAの設定(名前、色、アイコン、standalone) |
| app/pwa-icon/route.tsx | 仮アイコンをコードで描くAPI(`?size=192` など) |
| app/api/push/test/route.ts | テスト通知。ログイン中の本人の権限で動く。`export const runtime` は書かない |
| public/sw.js | service worker。通知の受信と、タップ時の動作 |
| lib/supabase/client.ts | Supabaseのブラウザ用クライアント |
| lib/routine.ts | 定期タスクの対象日判定(isRoutineDue)、説明文、日付ユーティリティ |
| lib/schedule.ts | 予定を日付ごとに展開(occurrencesInRange)。休講・変更を反映 |
| lib/calendar.ts | 日曜始まりの月グリッド、日本時間への分解(jstParts)など |
| components/AuthGate.tsx | ログインしていないと /login へ移動。上部にメール表示とログアウト |
| components/ThemeSwitcher.tsx | ライト/ダーク/自動 と アクセント5色の切り替え |
| components/TaskBoard.tsx | 不定期タスク(期限は日付のみ or 日付+時間) |
| components/RoutineBoard.tsx / RoutineForm.tsx | 定期タスク(週次・月次)、今日の一覧、週ビュー |
| components/EventBoard.tsx / ScheduleForm.tsx | 予定と定期予定(授業)、休講ボタン、7日間の一覧 |
| components/CalendarBoard.tsx | 月表示と週表示(時間軸)。タスク・予定・定期タスクを統合 |
| components/PushSettings.tsx | 通知の許可、テスト送信、オフ。iPhoneはホーム画面追加を案内 |

## 7. 認証の仕組み
- ユーザーは、Supabaseのダッシュボードで手動作成した1人だけ。新規登録は閉じている。
- ブラウザ側のクライアントでログインし、AuthGate で画面を見張る。サーバー側の見張り(middleware / proxy)は入れていない。
- 本当の防御は、データベースのRLS。ログインしていなければ、データは1行も返らない。

## 8. 仕様の決めごと
- 時刻は日本時間(JST)固定。
- tasks.due_at は timestamptz。日付だけの期限は、その日のJST 23:59で保存し、due_has_time=false で区別する。
- schedules は date / time 型で、日本時間のみを前提とする。
- 週の始まり: カレンダーは日曜始まり。定期タスクの週ビュー(lib/routine.ts の startOfWeek)は月曜始まり。
- 月次の定期タスクで、29〜31日指定がない月は、その月の末日に実施する(clamp_to_month_end)。
- 休講は schedule_exceptions の kind='cancelled'。休講の授業は、取り消し線つきで残す。
- 時間変更・教室変更(kind='modified')は、列だけ用意済みで、操作画面は未実装。

## 9. 通知についての制約と方針
- iPhoneは、ホーム画面に追加したPWAからでないと通知を受け取れない(iOS 16.4以降)。許可は、ボタンを押したときだけ求められる。
- ホーム画面のアプリは、Safariとは保存領域が別。ログインとテーマ設定は、ホーム画面側で改めて行う。
- Vercel Hobby の cron は1日1回までで、時刻の精度も低い。n分前通知には使えない。
- 定時送信の方針(E4): 外部の無料スケジューラ → アプリのAPI → web-push で送信。送信済みの記録で二重送信を防ぐ。休講の授業は通知しない。
- 起床用の目覚ましは、iPhone標準の時計アプリに任せる。

## 10. TimeTree・乗換・時計
- TimeTreeの公式APIは2023年12月に終了。予定はこのアプリに直接登録する方針。必要なら .ics ファイルを手動で取り込む(events テーブルを使う想定)。
- 乗換検索は、Googleマップの経路検索へのリンクを生成する方式(無料)。
- デスクトップ時計は、Windowsで Rainmeter(無料)を使う。このアプリとは別物。

## 11. 進捗
完了: 環境構築 / ログイン / テーマ(ライト・ダーク・5色。初期色はスレート) / 不定期タスク(時間つき期限) / 定期タスク(週次・月次) / 予定・定期予定・休講 / PWA化と通知の土台(PC・iPhone受信確認済み) / カレンダー(月・週)

未着手:
- UIの全面的な仕上げ(PCは複数カラム、スマホは下部タブ、フォント、画像、アイコン)
- 通知ルール(毎日決まった時間 / n分前。名前と本文は自由、差し込みあり)と定時送信
- 乗換検索リンク
- .ics 取り込み
- デスクトップ時計
- 設定(テーマ色など)のPC・iPhone間の同期(user_settings テーブルを予定)
- 画面を開いたままの即時同期(リアルタイム同期)

## 12. つまずきメモ
- `@/lib/xxx` が見つからないときは、ファイルが `lib` の直下にあるかを確認する(`lib/supabase/` の中に入れてしまったことがある)。
- Next.js 16 の `cacheComponents` が有効なので、route.ts に `export const runtime` を書くとビルドエラーになる。
-