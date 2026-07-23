---
description: '컨벤셔널 커밋 규칙(타입(범위): 설명)으로 잘 포맷된 커밋을 생성합니다'
allowed-tools: ['Bash(git add:*)', 'Bash(git status:*)', 'Bash(git commit:*)', 'Bash(git diff:*)', 'Bash(git log:*)']
---

# Claude 명령어: Commit

이모지 없이, 컨벤셔널 커밋 규칙으로 잘 포맷된 한국어 커밋을 생성합니다.

## 사용법

```
/commit
```

## 프로세스

1. 스테이지된 파일 확인 — 스테이지된 파일이 있으면 **해당 파일만** 커밋
2. `git diff`로 변경사항을 분석하고, 여러 논리적 변경이 섞였으면 분할 제안
3. `타입(범위): 설명` 포맷으로 커밋 메시지 작성
4. typecheck/lint가 통과하는 상태에서만 커밋 (깨진 코드 커밋 금지)

## 커밋 포맷

`<타입>(<범위>): <설명>`

- 범위가 한 영역으로 명확하지 않으면 생략 가능: `<타입>: <설명>`
- 이모지를 사용하지 않는다.
- 절대 가운데 점(·) 사용 금지. 맥락에 따라 쉼표(,), 슬래쉬(/), 국문(및, 또는) 등으로 구분한다.

**타입:**

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서화
- `style`: 포맷팅(동작 변화 없음)
- `refactor`: 코드 리팩토링
- `perf`: 성능 개선
- `test`: 테스트
- `chore`: 빌드/도구/설정 부수 작업

**범위(scope) — day3box 예시:**

`setup` / `db` / `auth` / `braindump` / `top3` / `grid` / `ui` / `docs` / `roadmap` / `claude` / `mcp` / `config`

## 예시 (day3box 톤)

```
chore(setup): Supabase 클라이언트 및 환경 변수 구성
feat(db): tasks, blocks 테이블 마이그레이션 및 RLS 정책 추가
feat(auth): 이메일 매직링크 로그인 플로우 구현
feat(braindump): 좌측 패널 task 추가/삭제 및 영속화 구현
feat(top3): TOP3 승격 하드 제한과 교체 모달 구현
feat(grid): 06-24시 타임 그리드 및 현재 시각 자동 스크롤 구현
fix(grid): 블록 리사이즈 시 15분 스냅 경계 계산 수정
docs(roadmap): Task 002 완료 상태 갱신
```

## 분할 기준

다른 관심사 | 혼합된 타입 | 파일 패턴 | 큰 변경사항

## 참고사항

- 스테이지된 파일이 있으면 해당 파일만 커밋
- 분할 제안을 위해 diff 분석
- **커밋에 Claude 서명 절대 추가하지 않음**
