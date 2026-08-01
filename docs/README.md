# docs — 문서 구조

```
docs/
├── PRD_2.md            정본: v0 범위(F1~F9)·데이터 모델·UX 파라미터 (최우선)
├── ROADMAP_v1.md       정본: v0→v1→v2 단계 구조·이동 규칙 (기획)
├── LEAN-CANVAS.md      정본: UVP("시간 축"·"사진")·리스크 — 기능 추가 판단 필터
├── handoff-v0-003/     정본: 현행 디자인 핸드오프 (v0 UI 단일 진실)
├── CHANGELOG.md        기록: 사용자에게 보이는 변경, 날짜 기준
├── adr/                기록: 구조적 의사결정 (ADR)
├── briefs/             의사결정 브리프 — 실사용 피드백 사이클별 결정·근거·배제안
│   ├── DECISION-BRIEF-002.md   (D1~D6: 드래그 생성·kind·분할·스냅 10분·칩 입력)
│   ├── DESIGN-DECISION-001.md  (시안 확정 6건 — 002와 003 사이에 읽는다)
│   ├── DECISION-BRIEF-003.md   (D7·D8 + 미결 데이터 정의 4건)
│   └── DECISION-BRIEF-004.md   (D9: brain dump 행 재설계 + D10 정의)
└── archive/            폐기 문서 — 참조하지 않는다 (이력 보존용)
    ├── design_handoff_day3box_v0/   (최초 핸드오프)
    └── handoff-v0-002/              (2차 핸드오프 — v0-003으로 대체)
```

- 충돌 시 우선순위: **PRD_2 = ROADMAP_v1 > 디자인 핸드오프 > Lean Canvas** (CLAUDE.md)
- 개발 실행 로드맵은 루트 [ROADMAP.md](../ROADMAP.md)
- 새 브리프는 `briefs/`에 번호 이어서, 핸드오프 개정판이 오면 이전 판은 `archive/`로
