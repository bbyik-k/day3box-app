# day3box

타임박싱 플래너. 할 일을 쏟아내고(brain dump), TOP 3를 골라 소요시간을 정한 뒤, 시간 블록으로 배치해 하루를 계획하고 실제 달성을 기록한다. **좌(리스트) → 우(시간 그리드) 흐름이 제품 정체성**이다 — 좌측 절차(쏟아내기 → 고르기 → 추정)를 빼면 그냥 캘린더가 된다.

**프로덕션**: https://day3box-app.vercel.app (main push마다 자동 배포)

## 핵심 기능 (v0)

- **Brain dump**: 할 일 무제한 입력 — 새로고침에도 유지되고, 배치 안 한 할 일은 다음날로 이월된다
- **TOP 3**: 하드 제한 3개 (4번째는 교체 모달로 하나를 내려야 올라온다), 소요시간·5색 카테고리
- **타임 그리드**: 06:00–24:00, 클릭 한 번으로 다음 빈 슬롯 자동 배치, 드래그 이동·리사이즈(15분 스냅·겹침 금지)
- **기록**: 블록마다 완료/부분/이월 — `missed`는 없다 (실패를 전시하지 않는다)
- **날짜 이동**: 어제/오늘/내일, URL(`?date=`)로 컨텍스트 유지
- 모든 조작은 **즉시 반영**(낙관 업데이트)되고 서버가 검증·확정한다

## 스택 · 시작하기

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 / Supabase (이메일+비밀번호 Auth · Postgres · RLS) / Vercel

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

`.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 두 개가 필요하다.

## 문서 지도

| 문서 | 역할 |
|---|---|
| [docs/PRD_2.md](docs/PRD_2.md) | v0 범위(F1~F9)·데이터 모델·UX 파라미터 확정본 — **최우선 정본** |
| [ROADMAP.md](ROADMAP.md) | 개발 실행 로드맵 — Task 순서·수락 기준·진행 상태 |
| [docs/ROADMAP_v1.md](docs/ROADMAP_v1.md) | v0→v1→v2 단계 구조와 단계 이동 규칙 (기획 정본) |
| [docs/LEAN-CANVAS.md](docs/LEAN-CANVAS.md) | UVP("시간 축"과 "사진")·리스크 — 기능 추가 판단 필터 |
| [docs/design_handoff_day3box_v0/](docs/design_handoff_day3box_v0/README.md) | Broadsheet 디자인 토큰·화면 명세 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 변경 기록 — 사용자에게 보이는 변경, 날짜 기준 |
| [docs/adr/](docs/adr/README.md) | 구조적 의사결정 기록 (ADR) |

## 현재 상태

v0 기능 완성 · 프로덕션 배포 완료 (2026-07-30). **본인 연속 3일 실사용 검증 중** — 통과하면 v1(사진 + 공유 산출물) 계획을 시작한다.
