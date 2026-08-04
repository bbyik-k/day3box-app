-- Task 012 (Brief 002 D2): 고정 시간 — tasks.kind ('task' = 할 일 | 'fixed' = 확보한 시간)
-- 고정 시간은 좌측 목록에 없고 그리드에만 존재한다. 별도 테이블 대신 kind 구분 (두 테이블 유지)
--
-- ⚠️ 역산 백필 (2026-08-04, Task 017): 2026-07-31 MCP apply_migration으로 원격에 직접
-- 적용되었고 로컬 SQL 파일이 남지 않았다. 원격 스키마를 역산해 복원 (version 20260731121139).

alter table public.tasks
  add column kind text not null default 'task';

alter table public.tasks
  add constraint tasks_kind_check
  check (kind in ('task', 'fixed'));
