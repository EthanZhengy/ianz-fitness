-- AI 导入训练计划: one row per import request, used for the per-user daily limit in the plan-import Edge Function.
-- Run once in Supabase → SQL Editor (after schema.sql). Safe to run again.
create table if not exists public.plan_imports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  ok boolean not null default false,
  input_tokens integer,
  output_tokens integer
);
create index if not exists plan_imports_user_idx on public.plan_imports (user_id, created_at desc);

-- Users may read their own usage; only the Edge Function (service role) writes.
alter table public.plan_imports enable row level security;
drop policy if exists "plan imports: read own" on public.plan_imports;
create policy "plan imports: read own" on public.plan_imports for select to authenticated using (user_id = auth.uid());
