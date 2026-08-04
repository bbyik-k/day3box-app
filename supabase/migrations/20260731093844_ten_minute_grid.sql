-- Task 010 (Brief 002 D5·D6): 10분 체계 — 기존 데이터 10분 격자 라운딩 + est_min 10분 배수 제약
--
-- ⚠️ 역산 백필 (2026-08-04, Task 017): 이 마이그레이션은 2026-07-31 MCP apply_migration으로
-- 원격에 직접 적용되었고 로컬 SQL 파일이 남지 않았다. 원격 스키마(제약·컬럼)를 역산해 복원한
-- 파일이며, 원격에는 이미 적용된 상태다 (version 20260731093844).
-- 라운딩 UPDATE는 원 적용 당시 실데이터 기준 겹침 0건을 사전 확인 후 실행되었다.

-- 기존 데이터 10분 격자 라운딩 (멱등 — 이미 10분 배수면 무변경)
update public.blocks
set
  start_min = ((start_min + 5) / 10) * 10,
  end_min   = ((end_min + 5) / 10) * 10
where start_min % 10 <> 0 or end_min % 10 <> 0;

update public.tasks
set est_min = greatest(10, least(1440, ((est_min + 5) / 10) * 10))
where est_min is not null and est_min % 10 <> 0;

-- est_min은 10분 배수·10~1440만 허용 (칩 + ±10 스테퍼 입력과 정합 — 자유 분 입력 제거)
alter table public.tasks
  add constraint tasks_est_min_step
  check (est_min is null or (est_min % 10 = 0 and est_min between 10 and 1440));
