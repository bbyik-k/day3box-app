-- 이 프로젝트의 기본 권한 설정에 DML grant가 빠져 있어 명시적으로 부여한다.
-- anon에는 부여하지 않는다 — 비로그인 접근은 권한 레벨에서 차단 (RLS 정책도 authenticated 전용)
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.blocks to authenticated;
