# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

**day3box** — 타임박싱 플래너. 할 일을 쏟아내고(brain dump), TOP 3를 골라 소요시간을 추정한 뒤, 시간 블록으로 배치해 하루를 계획하고 실제 달성을 기록한다. **좌(리스트)→우(시간 그리드) 흐름이 제품 정체성**이며, 좌측 절차(쏟아내기→고르기→추정)를 빼면 그냥 캘린더가 된다.

### 정본 문서 (충돌 시 우선순위: PRD_2 = ROADMAP_v1 > 디자인 핸드오프 > Lean Canvas)

| 문서 | 역할 |
|---|---|
| `docs/PRD_2.md` | v0 범위(F1~F9)·데이터 모델·UX 파라미터 확정본. **최우선 정본** |
| `ROADMAP.md` (루트) | 개발 실행 로드맵 — Task 001~009 순서·수락 기준·테스트 체크리스트. **작업은 이 순서를 따른다** |
| `docs/ROADMAP_v1.md` | v0→v1→v2 단계 구조와 단계 이동 규칙 (기획 정본) |
| `docs/LEAN-CANVAS.md` | UVP("시간 축"과 "사진")·리스크 — 기능 추가 판단 필터 |
| `docs/design_handoff_day3box_v0/README.md` | Broadsheet 디자인 토큰·화면 명세·엣지 케이스. 시각 정본은 `captures/*.png` |

## 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npx tsc --noEmit     # 타입 검사
```

- 테스트 프레임워크는 설정되어 있지 않다. E2E 검증은 **Playwright MCP**로 수행하며, 시나리오는 ROADMAP.md의 각 Task "테스트 체크리스트"에 정의되어 있다.
- Supabase 스키마 변경(DDL)은 마이그레이션으로만 (Supabase MCP `apply_migration` 또는 `supabase/migrations/` SQL). 변경 후 타입 재생성 → `types/supabase.ts`.

## 아키텍처

**스택**: Next.js 16.2.11 (App Router) + React 19 + TypeScript strict + Tailwind v4 / Supabase (매직링크 Auth + Postgres + RLS) / Vercel / npm

**v0 구조**: 사실상 단일 핵심 화면(하루 뷰: 좌 brain dump·TOP3 패널 + 우 타임 그리드) + 로그인/인증 콜백. 날짜 이동(어제/오늘/내일)은 별도 라우트가 아니라 날짜 컨텍스트로 처리.

**데이터 모델 (두 테이블만 — PRD 4장 확정)**:
- `tasks`(무엇을·좌측) 1 : N `blocks`(언제·우측), `blocks.task_id → tasks on delete cascade`
- 시간은 **int(자정 기준 분)** — timestamp 금지. 그리드 렌더·겹침 검사·리사이즈가 단순 산술(분 ↔ y좌표, 1시간=42px)
- `blocks.status`: text + 앱 레이어 TS union `'planned'|'done'|'partial'|'moved'` — **`missed`는 존재하지 않는다** (실패를 전시하지 않는 리텐션 방어 장치)
- 제목·카테고리는 task에만(정규화), `blocks.date`는 조회용 비정규화
- **RLS**: 두 테이블 모두 `user_id = auth.uid()` 행만 CRUD — 데이터가 안 보이면 RLS부터 의심 (에러 없이 빈 배열 반환)

**확정된 결정 (재논의 금지 — PRD 5·7장)**:
- TOP3 **하드 제한 3개** + 4번째 승격 시 교체 모달 (단순 차단 금지)
- 그리드 06:00–24:00 고정 + 진입 시 현재 시각 자동 스크롤 / 스냅 **15분** / **블록 겹침 금지**(한 시간대 최대 1블록)
- 배치는 "task 클릭 → 다음 빈 슬롯 자동 배치" (drag-across 아님)
- 드래그/리사이즈는 pointer 이벤트 **직접 구현** — dnd 라이브러리 금지
- 상태관리는 React 내장(useState/useReducer)만 — 전역 상태 라이브러리 금지
- **shadcn/ui 미사용** — Broadsheet 디자인 토큰(CSS 변수) + Source Serif 4 세리프(산세리프 금지) + Phosphor(duotone) 아이콘
- 인증은 이메일 매직링크만 (소셜 로그인 v0 제외)
- Supabase 클라이언트는 server/client 분리(`lib/supabase/`), 모듈 최상위 전역 선언 금지

**오버엔지니어링 방어 (이 프로젝트의 최우선 규율)**:
- v0 성공 기준(본인 연속 3일 실사용) 통과 전에 v1 기능(사진·이미지 다운로드·서클·모바일) 코드를 작성하지 않는다
- "나중에 쓸 거니까 미리" 금지 — 데이터 모델·컴포넌트·유틸 모두 현 단계 범위만큼만
- 기능 추가 요청은 UVP 두 축("시간 축"과 "사진")으로 필터링, 밖이면 기각하거나 v3+로
- 기술 선택마다 "왜 + 배제한 대안"을 기록

## 개발 워크플로우

1. `ROADMAP.md`에서 현재 "- 우선순위" Task 확인 (항상 정확히 1개)
2. 각 Task는 **UI+DB 영속성이 함께 완성되는 수직 슬라이스** — 눈에 보이는 산출물로 끝난다 ("골격 전체 → 더미 UI → 실기능" 방식 아님)
3. 구현 후 해당 Task의 수락 기준·Playwright MCP 테스트 체크리스트 검증
4. Task 완료 시 `/docs:update-roadmap`으로 ROADMAP.md 갱신 (✅ 표시 + 다음 우선순위 지정), **각 Task 완료 후 중단하고 지시 대기**
5. 커밋: 컨벤셔널 + 괄호 스코프 + 한국어 (예: `feat(braindump): 좌측 패널 task 추가/삭제 구현`)

전문 서브에이전트가 `.claude/agents/`에 구성되어 있다: `development-planner`(ROADMAP 관리), `nextjs-supabase-expert`(풀스택 구현), `nextjs-app-developer`(라우팅/구조), `ui-markup-specialist`(Broadsheet 마크업), `code-reviewer`, `supabase-db-architect`(스키마/RLS), `prd-generator`/`prd-validator`/`dev-chronicle-writer`(문서).
