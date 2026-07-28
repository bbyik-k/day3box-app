-- Task 001: tasks·blocks 초기 스키마 + RLS (PRD 4장 확정 모델 그대로)
-- 시간은 timestamp가 아닌 int(자정 기준 분), status는 text + 앱 레이어 TS union

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  date date not null,
  title text not null,
  is_top3 boolean not null default false,
  est_min integer,
  category text,
  created_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  start_min integer not null,
  end_min integer not null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  constraint blocks_end_after_start check (end_min > start_min)
);

-- 핵심 조회는 항상 user_id + date 필터 (하루 뷰), task_id는 cascade 삭제·FK 조회용
create index tasks_user_date_idx on public.tasks (user_id, date);
create index blocks_user_date_idx on public.blocks (user_id, date);
create index blocks_task_id_idx on public.blocks (task_id);

alter table public.tasks enable row level security;
alter table public.blocks enable row level security;

-- 소유자 전권: user_id = auth.uid() 행만 select/insert/update/delete
create policy "tasks_owner_all" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "blocks_owner_all" on public.blocks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
