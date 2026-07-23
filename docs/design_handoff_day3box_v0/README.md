# Handoff: day3box — v0 (타임박싱 플래너 / 개인 도구)

## Overview
day3box는 일론 머스크 타임박싱 기법을 옮긴 하루 계획·기록 도구다. 사용자가
① 할 일을 전부 쏟아내고(brain dump) → ② 가장 중요한 3개(TOP 3)를 골라 소요시간을 정하고 →
③ 우측 세로 시간축에 블록으로 배치한 뒤 → ④ 하루가 끝나면 각 블록의 실제 상태
(완료/부분/이월)를 기록한다. **좌(리스트) → 우(시간 그리드)** 흐름이 제품의 뼈대다.

이 문서는 **v0(개인 도구) 구현 범위만** 다룬다. 목표는 개발자 본인이 매일 쓸 만한
타임박싱 절차를 완성하는 것이며, 성공 기준은 **본인 연속 3일 실사용**이다.

> 정본 문서: `../uploads/PRD_2.md`, `../uploads/ROADMAP.md`, `../uploads/LEAN-CANVAS.md`.
> 충돌 시 PRD_2 / ROADMAP이 우선한다. 이 README는 그 문서 + 목업을 구현으로
> 잇는 다리이지, 전략 문서를 대체하지 않는다.

---

## About the Design Files
이 번들의 HTML 파일(`references/*.dc.html`)은 **디자인 레퍼런스**다 — 의도한 모양과
동작을 보여주는 프로토타입이지, 그대로 복사해 배포할 프로덕션 코드가 아니다.
`.dc.html`은 사내 프리뷰 런타임 전용 포맷이므로 **소스로 읽어 참조**하고, 실제 구현은
이미 세팅된 **Next.js (App Router) + TypeScript + Supabase** 환경에 그 환경의 패턴으로
재현한다(PRD 5장 기술 스택 참조).

시각적 정본은 다음 두 캡처다:
- `captures/01-morning-plan.png` — 아침 계획 화면
- `captures/02-evening-record.png` — 저녁 기록 화면

## Fidelity
- **High-fidelity**: `references/타임박싱 플래너 UI.dc.html` 및 두 캡처. 색·타이포·간격·
  레이아웃을 정본으로 삼아 픽셀에 가깝게 재현한다.
- **Low-fidelity**: `references/타임박싱 플래너 와이어프레임.dc.html`. 다른 방향
  (1b 앨범형, 1c 모바일 탭 등) 탐색용 참고. **v0 구현 기준이 아님** — 구조 아이디어 참고용.

---

## ⚠️ v0 스코프 (반드시 지킬 경계)

구현 대상은 **PRD F1~F9 뿐**이다. 아래는 목업에 그려져 있어도 **v0에서 구현하지 않는다**
(ROADMAP "단계 이동 규칙": 앞 단계 성공 기준 통과 전 다음 단계 코드 금지).

| 목업에 보이는 요소 | v0 처리 |
|---|---|
| 블록 안 **사진 슬롯**(하프톤 이미지) | **구현 안 함 (v1)**. v0 저녁 블록은 사진 없이 **상태 색/태그만** 채운다. |
| **이미지로 저장** 버튼 | **구현 안 함 (v1)**. 버튼 자체를 v0 UI에서 뺀다. |
| 상단 **주간 / 서클** 내비 링크 | **구현 안 함 (v1~v2)**. 링크를 비활성/숨김 처리. |
| **한 줄 회고** 텍스트영역 | v0 범위 밖. 넣지 않는다(원하면 v1에서). |
| 카테고리 **5색 프리셋** | v0 포함. 단 색은 프리셋만, 이름만 편집(자유 색 입력 금지, PRD 7.1 #3). |

> 즉 v0 저녁 그리드 = **계획 블록 + planned/done/partial/moved 상태 색**. 사진·저장·공유는
> 다음 단계. 그리드 컴포넌트는 "나중에 이미지로 캡처될 구조"임만 염두에 두되(블록 최소
> 높이 확보, 그리드가 독립 렌더 단위), **그 코드를 미리 작성하지 않는다**(PRD 5장).

---

## Design Tokens (Broadsheet 디자인 시스템)

목업은 프로젝트에 바인딩된 **Broadsheet** 시스템(신문 편집체)을 따른다. 코드베이스에는
동일 토큰을 CSS 변수/테마로 옮겨 사용한다. 원본: `_ds/broadsheet-.../styles.css`.

**색**
| 역할 | 값 |
|---|---|
| 배경 `--color-bg` | `#f3f2f2` |
| 표면(카드/블록/입력) `--color-surface` | `#eae9e9` |
| 본문 `--color-text` | `#201e1d` |
| 강조(상호작용) `--color-accent` (cyan) | `#0088b0` |
| 강조2(드물게) `--color-accent-2` (magenta) | `#d6006c` |
| 구분선 `--color-divider` | `rgba(32,30,29,.16)` |

**카테고리 5색 프리셋** (블록 좌측 4px 바 + TOP3 점). 신문 스팟컬러로 절제해 사용:
`--cat1 #0088b0` (cyan) · `--cat2 #d6006c` (magenta) · `--cat3 #edbb00` (yellow) ·
`--cat4 #7d7979` (neutral-600) · `--cat5 #006786` (accent-700). 이름만 편집 가능.

**상태 색 (v0 핵심)**
- `planned` — 표면 채움 `#eae9e9`, 좌측 카테고리색 바
- `done` — 완료 태그 `tag-accent`(cyan 틴트). 좌측 바 = 카테고리색
- `partial` — 부분 태그 `tag-accent-2`(magenta 틴트)
- `moved` — **점선 테두리 + 중립 회색 + "→ 내일로 이월"**. 빨강/실패 색 절대 금지
  (PRD 4.1: `missed` 아님, 성취는 보여주되 실패는 전시하지 않는다)

**타이포**: Source Serif 4 (heading 600 / body 400 / italic 400). h1 42px, h4 20px,
h6 13px(대문자·letter-spacing .08em). 본문 15px/1.55. UI 크롬도 세리프(산세리프 도입 금지).

**간격/반경**: space 5·10·15·20·30·40px, radius 1·2·4px, shadow sm/md/lg (styles.css).

**그리드 눈금(목업 값)**: 1시간 = **42px**. 06:00 top=0 → 22:00 top=672px. 블록
`top = (hour-6)*42 + (min/60)*42`, `height = est_min/60*42`. 좌측 시각 라벨 거터 ≈ 56px.
(실제 구현 스냅 단위는 **15분** — PRD 7.1 #2. 42px/시간 기준 15분 = 10.5px.)

**아이콘**: Phosphor, duotone weight.

---

## Screens / Views

### 1. 아침 계획 (`captures/01-morning-plan.png`) — ROADMAP Task 2~6
**Purpose**: 오늘 할 일을 쏟아내고, TOP 3를 고르고, 시간 위에 배치한다.

**Layout**: 상단 nav(브랜드 좌 / 링크 / 아바타 우) → thick(3px) 룰 → 마스트헤드
(좌: h1 날짜 40px + 서브텍스트 / 우: [아침 계획][저녁 기록] 토글 + ‹어제 내일›) →
thin(1px .4) 룰 → 2열 CSS grid `grid-template-columns: 352px 1fr; gap: 40px; align-items:start`.

**좌열 (352px)**
- `쏟아내기 · Brain dump` (h6) + 설명. 항목 행: 체크박스형 사각(15px) + 제목 + (TOP3면
  `tag-outline` "TOP 3"). 행 hover 시 옅은 잉크 틴트. 하단 점선 "＋ 할 일 추가…" 입력.
- `TOP 3` (h6) + 설명. 카드 3장(`.card`, flex-row, 좌측 4px 카테고리색 바): 좌측 kicker
  ("01 · 집중" 등) + 제목 16px, 우측 소요시간 태그(90분/60분/90분). 4번째 자리에는
  점선 안내 "3개 채움 · 4번째는 하나를 내려야 올라온다".

**우열 (1fr)**
- 헤더: `타임박스 · 06 – 22시` (h6) + 범례(완료/부분/이월).
- 그리드(`position:relative; height:714px`): 06~22시 시각선 17개, 현재 시각 마젠타 라인
  ("지금 14:30", `top:399px` 예시). 계획 블록들(planned): 이력서 수정(08:00–09:30,cat1),
  면접 스터디(10:00,cat2), 점심·산책(12:30,cat4), 포트폴리오 리팩터(14:00,cat3).
- 하단 캡션.

### 2. 저녁 기록 (`captures/02-evening-record.png`) — ROADMAP Task 7
**Purpose**: 배치한 블록의 실제 결과를 완료/부분/이월로 기록한다.

**좌열 (352px)**
- `오늘의 기록`: 완료 3 / 부분 1 / 이월 1 — 큰 세리프 숫자(34px, 각 상태 색) + 라벨.
- `TOP 3 결과`: 3행, 카테고리 점 + 제목 + 상태 태그(완료/부분/완료).
- **상태 기록 편집 카드**(`.card.elev-sm`, 좌측 accent 바): kicker "상태 기록 · 편집 중",
  제목 "면접 스터디 · 10:00", **세그먼트 컨트롤 [완료 | 부분 | 이월]** (부분 선택됨),
  ~~"＋ 사진 추가"~~(v1, v0에서 제거), 안내 문구.
- ~~한 줄 회고~~ (v0 제외).

**우열 (1fr)**: 헤더 `보낸 하루` + ~~이미지로 저장~~(v1, 제거). 그리드는 아침과 동일 눈금.
블록은 상태별로: 완료/부분(색·태그), 선택 블록은 **accent 2px 링**, 운동(18:00)은 점선 이월.
**v0에서는 각 블록의 하프톤 사진 슬롯 자리에 사진 대신 상태 색면만** 들어간다.

**선택-편집 연결**: 그리드에서 블록을 클릭하면 좌측 편집 카드가 그 블록으로 바뀌고,
블록에 accent 링이 생긴다. 세그먼트로 상태를 바꾸면 블록 태그·색이 즉시 갱신된다.

---

## Interactions & Behavior (F1~F9)

- **F1 Brain dump**: 항목 추가(엔터/버튼)·삭제. DB 저장, 새로고침 후 유지. 개수 제한 없음.
- **F2 TOP 3 + 소요시간**: 항목을 TOP3로 승격/해제(`is_top3`), `est_min`(분) 입력.
  **하드 제한 3개** — 4번째 승격 시도 시 막지 말고 **교체 모달**: 기존 3개 중 하나를
  라디오로 내리게 하고 새 항목을 올린다(PRD 7.1). 교체 UX가 F2 완료 정의에 포함.
- **F3 타임 그리드**: 06:00–24:00 고정 세로축, 눈금선. 진입 시 **현재 시각으로 자동
  스크롤**(PRD 7.1 #1). 데이터 없이도 뼈대가 안정적으로 렌더.
- **F4 블록 배치**: 좌측 task(주로 TOP3) **클릭 → 다음 빈 슬롯에 자동 배치**
  (클릭 지점 배치·정교한 drag-across는 v0 제외, PRD 7.1 #4). 소요시간 = 블록 높이.
- **F5 이동/리사이즈**: 배치된 블록 드래그 이동, 가장자리 리사이즈. **15분 스냅**,
  **겹침 방지**(한 시간대 최대 1블록). 범용 dnd 라이브러리 없이 pointer 이벤트로 직접 구현.
- **F6 상태 토글**: `planned → done / partial / moved` 전환(세그먼트/클릭). DB 반영.
  `missed` 없음 — `moved`만(PRD 4.1).
- **F7 날짜 이동**: 어제/오늘/내일. 날짜별 task·block 함께 로드.
- **F8 인증**: 이메일 매직링크. 로그인 유저 데이터만 조회/수정.
- **F9 영속성**: Supabase Postgres. 새로고침·재로그인 후 유지.

**넘어가는 할 일**: 어제 쏟아냈지만 배치 안 한 task는 사라지지 않고 오늘도 보이거나
가져올 수 있다(데이터 모델 task 영속화 근거).

### Edge cases (반드시 처리)
- TOP3 4번째 승격 → 교체 모달(단순 차단 금지).
- 블록 겹침 시도 → 배치/이동 거부(스냅으로 밀거나 막기).
- 미배치 task 새로고침 → 소실되면 안 됨(길 B: task를 DB에 영속화).
- `est_min` 없는 TOP3 → 배치 전 소요시간 입력 요구.
- 빈 하루(데이터 0) → 그리드 뼈대만, 깨지지 않게.

---

## State Management
전역 상태 라이브러리 없이 **React 내장(useState/useReducer)**로 충분(PRD 5장).
- 현재 `date` (어제/오늘/내일)
- `tasks[]` — 해당 날짜의 brain dump 항목 (`is_top3`, `est_min` 포함)
- `blocks[]` — 해당 날짜에 배치된 블록 (`start_min`, `end_min`, `status`)
- UI: 선택된 블록 id, 교체 모달 open, 드래그 중 임시 위치
- 데이터 페칭: 날짜 변경 시 tasks/blocks 로드; 변경은 낙관적 업데이트 후 Supabase 반영.

## Data Model (PRD 4장 — 두 테이블)
```
tasks   (무엇을 · 좌측)          blocks  (언제 · 우측)
  id uuid pk                       id uuid pk
  user_id uuid  → auth.users       user_id uuid → auth.users
  date date                        task_id uuid → tasks(id) on delete cascade
  title text                       date date            (비정규화: task.date 복사)
  is_top3 bool  default false      start_min int        (자정 기준 분, 09:00=540)
  est_min int   (TOP3일 때)         end_min int          (end > start)
  category text (프리셋 5색)         status text default 'planned'
  created_at timestamptz                 -- 'planned'|'done'|'partial'|'moved'
                                   created_at timestamptz
```
- 관계 tasks 1 : N blocks (분할 UI는 v0 제외, 모델만 1:N 허용, UI는 1:1 운용).
- 시간은 **int(분)** — timestamp 아님. 겹침검사·리사이즈가 단순 산술.
- status는 **text** — Postgres enum 아님. 앱 레이어 TS union으로 타입 안전(`as/any` 금지).
- **RLS**: 두 테이블 모두 `user_id = auth.uid()` 행만 CRUD 가능.

## 구현 순서 (ROADMAP Task = 커밋 단위, 각 Task는 눈에 보이는 산출물로 끝난다)
1. 셋업 — Next + TS + Supabase 연결, 매직링크 로그인 동작.
2. Brain dump (F1) — 좌측 추가/삭제, DB 저장·로드.
3. TOP 3 + 소요시간 (F2) — 승격/해제, `est_min`, **교체 UX**.
4. 정적 그리드 (F3) — 06–24 세로축, 현재 시각 자동 스크롤.
5. 블록 배치 (F4) — task 클릭 → 다음 빈 슬롯, 소요시간=높이.
6. 이동/리사이즈 (F5) — 드래그·리사이즈·15분 스냅·겹침 방지.
7. 상태 토글 (F6) — planned/done/partial/moved.
8. 날짜 이동 (F7) — 어제/오늘/내일.
9. 배포(Vercel) + 본인 실사용 → 성공 기준 검증.

**성공 기준**: 본인 **연속 3일 실사용**(아침 계획 + 저녁 기록). 통과 못 하면 v1로 가지
않고 v0를 고친다.

---

## Assets
- 카테고리/상태 색: Broadsheet 토큰(위 참조). 별도 이미지 에셋 없음.
- 아이콘: Phosphor(duotone) — 코드베이스에 설치해 사용.
- 폰트: Source Serif 4 (Google Fonts).
- v0에는 사진/이미지 업로드 없음(v1).

## Files (이 번들)
- `README.md` — 이 문서(단독으로 v0 구현 가능하게 작성).
- `captures/01-morning-plan.png` — 아침 계획 화면(정본 시각).
- `captures/02-evening-record.png` — 저녁 기록 화면(정본 시각, 사진 슬롯은 v1).
- `references/타임박싱 플래너 UI.dc.html` — 하이파이 목업 소스(읽기 참조용).
- `references/타임박싱 플래너 와이어프레임.dc.html` — 방향 탐색 와이어프레임(로파이).
- 정본 기획: 프로젝트 루트 `uploads/PRD_2.md`, `uploads/ROADMAP.md`, `uploads/LEAN-CANVAS.md`.
