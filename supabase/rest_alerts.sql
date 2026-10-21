-- Ianz Fitness: 休息结束提醒 — a lock-screen push when a rest timer ends, even if the app is in the background
-- or was closed by the phone. Run once in Supabase → SQL Editor, after push.sql and push_cron.sql. Safe to run again.
-- 1) Replace PASTE_CRON_SECRET_HERE below with the same CRON_SECRET as in push_cron.sql.
-- 2) Redeploy the send-reminders Edge Function (it now also sends these).

-- One pending alert per device: the app writes it when a rest starts, moves it when the rest is changed,
-- and deletes it when the rest is skipped.
create table if not exists public.rest_alerts (
  endpoint  text primary key references public.push_subs (endpoint) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fire_at   timestamptz not null,
  title     text not null default '⏰ 休息结束' check (length(title) <= 60),
  body      text not null default '开始下一组' check (length(body) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists rest_alerts_fire_idx on public.rest_alerts (fire_at);

alter table public.rest_alerts enable row level security;
drop policy if exists "rest alerts: own rows" on public.rest_alerts;
create policy "rest alerts: own rows" on public.rest_alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Every 5 seconds: only when an alert is due, ask send-reminders to deliver it (no calls while nothing is waiting).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('ianz-rest-alerts') where exists (select 1 from cron.job where jobname = 'ianz-rest-alerts');
select cron.schedule('ianz-rest-alerts', '5 seconds', $$
  select net.http_post(
    url := 'https://atpinhpsvsmgaansocse.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PASTE_CRON_SECRET_HERE'),
    body := '{"rest": true}'::jsonb
  )
  where exists (select 1 from public.rest_alerts where fire_at <= now());
$$);
