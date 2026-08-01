# CHANGE-002 — 쏟아내기 행 재설계 (체크박스 제거)

> **선행 문서**: `README.md`(v0 구현 지시서), `DESIGN-DECISION-001.md`(시안 확정 6건)
> **적용 범위**: 아침 계획 화면 좌측 상단 **쏟아내기 목록의 행**. 그리드·TOP 3 카드·저녁 기록은 변경 없음.
> **확정 시안**: 드래그 손잡이(9b) + 배치 표시는 옅어짐만(10a)
> **반영 위치**: `reference/day3box-ui.dc.html` (아침 계획 화면), `day3box.css`
> **캡처**: `captures/04-braindump-row.png`

---

## 1. 왜 바꾸는가

체크박스가 세 가지 문제를 만들고 있었다.

1. **형태의 거짓말** — 사각 체크박스는 앱 전체에서 "완료"를 뜻한다. 이 제품의 완료는 **저녁에 블록 위에서** 기록한다. 같은 기호가 두 화면에서 다른 뜻이 되었다.
2. **위치의 거짓말** — 행의 맨 왼쪽은 진입점이다. 그 자리에 **하루 세 번만 쓰는** 동작(TOP 3 지정)이 놓였고, **열 번 넘게 쓰는** 동작(타임박스 배치)은 호버해야 나타났다. 빈도와 시각적 무게가 뒤집혀 있었다.
3. **빠진 정보** — 배치가 끝난 뒤 그 행이 어떻게 되는지가 없어, 이미 놓은 것을 또 놓게 되었다.

관측된 증상: 사용자가 일반 task를 타임박스에 배치하려고 좌측 체크박스를 누른다.

---

## 2. 무엇으로 바꾸는가

### 2-1. 행 구조

```
[⠿ 손잡이] [3px 색 막대] [할 일 이름 ................] [호버 시 힌트] [TOP 3 배지]
   좌측 진입점 = 주 동작(배치)                              보조 동작(승격)
```

| 요소 | 폭 | 역할 |
|---|---|---|
| `.grip` (⠿) | 13px | **드래그 시작점.** 잡아서 그리드로 끈다. 호버 시 시안색으로 변함 |
| `.bar3` | 3px | TOP 3 색 막대. 일반 task는 빈 칸(투명) — 그리드의 위계와 동일 |
| 이름 | `flex:1` | |
| `.hint` | auto | 호버 시에만 `visibility:visible` → "끌어서 시간 위로" |
| `.tbtn` | auto | TOP 3 토글 버튼. 지정됨 = `.tbtn-on`(검정 테두리 + 굵게) |

행 높이 `min-height:40px`, 패딩 `9px 8px`, gap `10px`.

**체크박스(`.box`)는 완전히 삭제한다.** 쏟아내기 목록에 완료 개념은 없다.

### 2-2. 조작 방법 3가지 (모두 지원)

| 동작 | 결과 |
|---|---|
| **손잡이를 끌어 그리드에 놓기** | 주 경로. 드롭 지점이 시작 시각(10분 스냅) |
| **손잡이 클릭** | 다음 빈 자리에 자동 배치. *드래그를 강요하지 않는다* |
| **TOP 3 배지 클릭** | 승격/강등 토글. 셋이 차 있으면 교체 화면으로(§3-2 in README) |

모바일: 길게 눌러 집기(long-press to drag). 손잡이 히트 영역은 좌우 패딩 포함 최소 40×40px 확보.

### 2-3. 배치 표시 — 옅어짐만 (10a)

- 배치된 행: **`opacity: .62`**. 다른 기호를 더하지 않는다.
- **목록을 두 묶음으로 나누지 않는다.** 항목이 자리를 옮기지 않아 위치 기억이 유지되고, 쏟아낸 순서(생각의 순서)가 보존된다.
- **배치 시각을 행에 쓰지 않는다.** 그리드가 이미 말한다. 행이 반복하면 두 곳을 동기화해야 하고 우측이 붐빈다.
- 배치된 행도 손잡이가 살아 있어 **다시 끌어 옮길 수 있다.**
- 호버 시 `opacity`는 그대로 두고 배경 틴트만 얹는다(옅어짐이 "비활성"이 아니라 "이미 처리됨"임을 유지).

### 2-4. 호버 시에도 사라지지 않는 것

⚠️ **호버가 요소를 삭제하지 않는다.** 힌트는 TOP 3 배지 **옆에** 나타나고, 배지는 항상 클릭 가능하다. 힌트를 `visibility:hidden`으로 예약해 두면 나타날 때 행 폭이 흔들리지 않는다.

---

## 3. CSS (`day3box.css`에 반영됨)

```css
.dump{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:var(--radius-sm);min-height:40px;box-sizing:border-box}
.dump:hover{background:color-mix(in srgb,var(--color-text) 4%,transparent)}
.dump-set{opacity:.62}                              /* 배치 완료 */
.grip{width:13px;flex:none;font-size:13px;line-height:1;color:color-mix(in srgb,var(--color-text) 28%,transparent);cursor:grab}
.dump:hover > .grip{color:var(--color-accent)}
.bar3{width:3px;height:17px;flex:none}              /* 색은 인라인: var(--top1|2|3) */
.hint{font-size:12px;color:var(--color-accent-700);white-space:nowrap;visibility:hidden}
.dump:hover > .hint{visibility:visible}
.tbtn{font-family:var(--font-body);font-size:11px;letter-spacing:.08em;padding:5px 9px;border:1px solid color-mix(in srgb,var(--color-text) 18%,transparent);border-radius:var(--radius-sm);background:transparent;color:color-mix(in srgb,var(--color-text) 45%,transparent);cursor:pointer;white-space:nowrap}
.tbtn:hover{border-color:var(--color-accent);color:var(--color-accent-700)}
.tbtn:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.tbtn-on{border-color:var(--color-text);color:var(--color-text);font-weight:600}
.tbtn-on:hover{border-color:var(--color-text);color:var(--color-text)}
```

## 4. 마크업

```html
<!-- 배치됨 · TOP 3 -->
<div class="dump dump-set" draggable="true">
  <span class="grip">⠿</span>
  <span class="bar3" style="background:var(--top1)"></span>
  <span style="flex:1">이력서 수정</span>
  <span class="hint">끌어서 시간 위로</span>
  <button type="button" class="tbtn tbtn-on">TOP 3</button>
</div>

<!-- 미배치 · 일반 -->
<div class="dump" draggable="true">
  <span class="grip">⠿</span>
  <span class="bar3"></span>
  <span style="flex:1">업체 탐색</span>
  <span class="hint">끌어서 시간 위로</span>
  <button type="button" class="tbtn">TOP 3</button>
</div>
```

## 5. 상태 매트릭스

| is_top3 | 배치됨 | `.bar3` | `.tbtn` | 행 |
|---|---|---|---|---|
| ✓ | ✓ | `var(--top1\|2\|3)` | `.tbtn-on` | `.dump-set` |
| ✓ | ✗ | `var(--top1\|2\|3)` | `.tbtn-on` | — |
| ✗ | ✓ | 투명 | 기본 | `.dump-set` |
| ✗ | ✗ | 투명 | 기본 | — |

## 6. 드래그 구현 노트

- 드래그 중 그리드에는 TURN 4(4a)에서 확정한 **고스트 블록**을 그린다 — 하단(끄는 쪽) 2px 실선, 소요시간(좌)·시각 범위(우)를 하단에 표시, 10분 스냅.
- TOP 3인 항목은 `est_min`을 이미 갖고 있으므로 드롭 시 **그 길이로 블록이 생성**된다(고스트도 그 높이로 고정).
- 소요시간이 없는 일반 task는 드래그 길이가 소요시간이 된다.
- 겹치는 자리에는 드롭되지 않는다. 겹침 표시에 **크림슨을 쓰지 말 것**(TOP 2 막대·현재 시각선과 충돌).
- 이미 배치된 항목을 다시 끌면 **이동**이다(새 블록 생성이 아니다).

## 7. 검수 체크리스트

- [ ] 쏟아내기 목록에 체크박스 형태의 요소가 하나도 없는가
- [ ] 좌측 손잡이가 배치 동작으로 읽히는가 (일반 task 배치 시 오조작이 없는가)
- [ ] 손잡이 클릭만으로도 배치되는가 (드래그가 강요되지 않는가)
- [ ] 배치된 행이 62%로 물러나 있고, **자리는 그대로**인가
- [ ] 배치된 행을 다시 끌어 옮길 수 있는가
- [ ] 호버 시 TOP 3 배지가 사라지지 않는가
- [ ] 힌트가 나타날 때 행 폭이 흔들리지 않는가
- [ ] 모바일에서 손잡이 히트 영역이 40px 이상인가
