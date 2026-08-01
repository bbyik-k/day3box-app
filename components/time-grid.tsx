'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { nowMinutesInSeoul } from '@/lib/date'
import {
  GRID_END_MIN,
  GRID_HEIGHT_PX,
  GRID_HOURS,
  GRID_START_MIN,
  PX_PER_HOUR,
  SNAP_MIN,
  floorToSnap,
  formatMin,
  minToY,
  overlaps,
  roundToSnap,
} from '@/lib/grid'
import { GridBlock } from '@/components/grid-block'

// 그리드 렌더용 블록 뷰 — 제목·카테고리는 task에서 조인 (정규화: blocks에는 없다).
// part: 같은 task의 블록이 여럿일 때(분할, D4) 시간순 n/N — 단일 블록이면 null
export type BlockView = {
  id: string
  task_id: string
  start_min: number
  end_min: number
  status: string
  title: string
  category: string | null
  kind: string
  part: { index: number; total: number } | null
}

// 드래그 생성(D1)의 고스트 상태 — 몇 초만 존재하고 이미지에 나오지 않는다 (handoff §6)
type Draft = {
  pointerId: number
  anchor: number
  start: number
  end: number
  moved: boolean
}

// 매분 갱신되는 현재 시각 구독 — 하루 종일 열어두는 화면이라 고정 라인은 거짓말이 된다
function subscribeMinuteTick(onStoreChange: () => void) {
  const timer = setInterval(onStoreChange, 60_000)
  return () => clearInterval(timer)
}

function serverNowSnapshot(): number | null {
  return null
}

// 프레젠테이션 컴포넌트 — 블록 낙관 상태·이동 확정·선택은 DayView가 소유한다
export function TimeGrid({
  blocks,
  selectedId,
  isToday,
  error,
  scrollRef,
  innerRef,
  listPreview,
  onSelect,
  onCommitMove,
  onDelete,
  onCreateFixed,
  onRename,
  onStatus,
}: {
  blocks: BlockView[]
  selectedId: string | null
  isToday: boolean
  error: string | null
  // 리스트→그리드 드래그(D9)의 좌표 판정·자동 스크롤을 위해 DayView가 소유
  scrollRef: React.RefObject<HTMLDivElement | null>
  innerRef: React.RefObject<HTMLDivElement | null>
  listPreview: { start: number; end: number; invalid: boolean } | null
  onSelect: (id: string) => void
  onCommitMove: (id: string, startMin: number, endMin: number) => void
  onDelete: (id: string) => void
  onCreateFixed: (startMin: number, endMin: number, title: string) => void
  onRename: (id: string, title: string) => void
  onStatus: (id: string, status: import('@/types/block').BlockStatus) => void
}) {
  // 서버 스냅샷은 null — 지금 라인은 클라이언트에서만 렌더돼 hydration 불일치가 없다
  const nowMin = useSyncExternalStore<number | null>(
    subscribeMinuteTick,
    nowMinutesInSeoul,
    serverNowSnapshot,
  )
  const didAutoScroll = useRef(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  // 놓은 뒤 이름 입력 단계 — 확정 전까지 블록은 생기지 않는다
  const [naming, setNaming] = useState<{ start: number; end: number } | null>(
    null,
  )

  // 진입 시 현재 시각으로 자동 스크롤 (PRD 7.1 #1 — 범위보다 스크롤 위치가 체감 UX를 좌우).
  // 오늘이 아니면 스킵 — 과거/미래 날짜는 그리드 시작부터 (리셋은 key={date} 리마운트가 담당)
  useEffect(() => {
    const container = scrollRef.current
    if (
      !isToday ||
      nowMin === null ||
      didAutoScroll.current ||
      container === null ||
      nowMin < GRID_START_MIN ||
      nowMin > GRID_END_MIN
    ) {
      return
    }
    didAutoScroll.current = true
    container.scrollTop = minToY(nowMin) - container.clientHeight / 2
  }, [nowMin, isToday, scrollRef])

  // "지금" 라인은 오늘 그리드에만 — 다른 날짜의 시각 표시는 거짓말이 된다
  const showNowLine =
    isToday &&
    nowMin !== null &&
    nowMin >= GRID_START_MIN &&
    nowMin <= GRID_END_MIN

  // ── 드래그 생성 (D1/4a): 빈 영역 pointerdown → 고스트 → 놓으면 이름 입력 → 고정 시간 생성

  function yToMin(clientY: number): number {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect) {
      return GRID_START_MIN
    }
    return GRID_START_MIN + ((clientY - rect.top) / PX_PER_HOUR) * 60
  }

  function draftConflicts(start: number, end: number): boolean {
    return blocks.some((b) => overlaps(start, end, b.start_min, b.end_min))
  }

  function handleGridPointerDown(e: React.PointerEvent) {
    if (
      e.button !== 0 ||
      !e.isPrimary ||
      draft !== null ||
      naming !== null ||
      (e.target instanceof Element &&
        e.target.closest('[data-testid="grid-block"]') !== null)
    ) {
      return
    }
    const anchor = Math.min(
      Math.max(floorToSnap(yToMin(e.clientY)), GRID_START_MIN),
      GRID_END_MIN - SNAP_MIN,
    )
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraft({
      pointerId: e.pointerId,
      anchor,
      start: anchor,
      end: anchor + SNAP_MIN,
      moved: false,
    })
  }

  function handleGridPointerMove(e: React.PointerEvent) {
    if (draft === null || e.pointerId !== draft.pointerId) {
      return
    }
    const cur = Math.min(
      Math.max(roundToSnap(yToMin(e.clientY)), GRID_START_MIN),
      GRID_END_MIN,
    )
    // 위·아래 어느 방향으로 끌어도 anchor 기준으로 범위가 된다
    const start = Math.min(draft.anchor, cur)
    const end = Math.max(draft.anchor + SNAP_MIN, cur)
    setDraft({ ...draft, start, end, moved: true })
  }

  function handleGridPointerUp(e: React.PointerEvent) {
    if (draft === null || e.pointerId !== draft.pointerId) {
      return
    }
    const { start, end, moved } = draft
    setDraft(null)
    // 무이동 클릭·겹침이면 생성하지 않는다
    if (!moved || draftConflicts(start, end)) {
      return
    }
    setNaming({ start, end })
  }

  function commitNaming(title: string) {
    if (naming === null) {
      return
    }
    const { start, end } = naming
    setNaming(null)
    const trimmed = title.trim()
    if (trimmed === '') {
      return
    }
    onCreateFixed(start, end, trimmed)
  }

  const draftInvalid = draft !== null && draftConflicts(draft.start, draft.end)
  const draftDuration = draft !== null ? draft.end - draft.start : 0

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          타임박스 · 04 – 익일 03시
        </h6>
        {/* 3위계 범례 (handoff §3-1) — 막대의 유무가 "이건 일인가"의 답 */}
        <div className="flex items-center gap-4 text-[12px] text-text/60">
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden="true" className="h-[11px] w-[4px] bg-accent" />
            오늘의 셋
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden="true" className="h-[11px] w-[4px] bg-neutral" />
            나머지 할 일
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span
              aria-hidden="true"
              className="h-[11px] w-[11px] border border-divider"
            />
            확보한 시간
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="grid-error" className="mb-2 text-[13px] text-accent-2">
          {error}
        </p>
      )}

      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[calc(100vh-240px)]"
        data-testid="grid-scroll"
      >
        <div
          ref={innerRef}
          className="relative touch-none"
          style={{ height: GRID_HEIGHT_PX }}
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerUp}
          onPointerCancel={() => setDraft(null)}
        >
          {Array.from({ length: GRID_HOURS + 1 }, (_, i) => {
            const min = GRID_START_MIN + i * 60
            return (
              <div
                key={min}
                className="absolute inset-x-0 border-t border-divider"
                style={{ top: minToY(min) }}
                data-hourline={formatMin(min)}
              >
                <span className="absolute left-0 -top-2 text-[11px] tracking-[0.06em] bg-bg pr-2 text-text/55">
                  {formatMin(min)}
                </span>
              </div>
            )
          })}

          {/* 10분 눈금은 드래그 중에만 (handoff §6) */}
          {draft !== null && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 left-[44px] pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0 9px, color-mix(in srgb, var(--color-text) 7%, transparent) 9px 10px)',
              }}
            />
          )}

          {blocks.map((block) => (
            <GridBlock
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onCommit={onCommitMove}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onStatus={onStatus}
            />
          ))}

          {/* 리스트 드래그 배치 고스트 (D9) — 드롭 지점이 시작 시각, 잔량 길이로 고정 */}
          {listPreview !== null && (
            <div
              className="ghost-block"
              data-invalid={listPreview.invalid || undefined}
              data-testid="list-ghost"
              style={{
                top: minToY(listPreview.start),
                height:
                  (listPreview.end - listPreview.start) * (PX_PER_HOUR / 60),
              }}
            >
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-[10px] pb-[3px] text-[11px] leading-none">
                <span className="font-semibold">
                  {listPreview.end - listPreview.start}분
                </span>
                <span className="text-text/60">
                  {formatMin(listPreview.start)}–{formatMin(listPreview.end)}
                </span>
              </div>
            </div>
          )}

          {/* 드래그 고스트 — 정보는 하단(끄는 쪽), 겹침이면 중립 실선 (크림슨 금지) */}
          {draft !== null && draft.moved && (
            <div
              className="ghost-block"
              data-invalid={draftInvalid || undefined}
              data-testid="ghost-block"
              style={{
                top: minToY(draft.start),
                height: draftDuration * (PX_PER_HOUR / 60),
              }}
            >
              <div
                className={`absolute inset-x-0 bottom-0 flex items-end justify-between px-[10px] pb-[3px] text-[11px] leading-none ${
                  draftDuration <= 20 ? 'gap-2' : ''
                }`}
              >
                <span className="font-semibold">{draftDuration}분</span>
                <span className="text-text/60">
                  {formatMin(draft.start)}–{formatMin(draft.end)}
                </span>
              </div>
            </div>
          )}

          {/* 이름 입력 — 확정(Enter) 전까지 생성되지 않는다. Esc·blur·빈 값 = 취소 */}
          {naming !== null && (
            <div
              className="ghost-block"
              style={{
                top: minToY(naming.start),
                height: (naming.end - naming.start) * (PX_PER_HOUR / 60),
              }}
            >
              <input
                autoFocus
                type="text"
                placeholder="확보할 시간의 이름…"
                aria-label="고정 시간 이름"
                data-testid="fixed-name-input"
                className="absolute inset-x-[10px] top-1/2 -translate-y-1/2 bg-transparent text-[13px] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitNaming(e.currentTarget.value)
                  }
                  if (e.key === 'Escape') {
                    setNaming(null)
                  }
                }}
                onBlur={() => setNaming(null)}
              />
            </div>
          )}

          {showNowLine && (
            <div
              className="absolute right-0 left-[44px] border-t-[1.5px] border-accent-2 z-10 pointer-events-none"
              style={{ top: minToY(nowMin) }}
              data-testid="now-line"
            >
              {/* 라벨은 우측 — 블록 텍스트가 좌측 정렬이라 우측은 늘 여백 (2026-07-29 시안) */}
              <span className="absolute right-2 -top-2 text-[10px] tracking-[0.04em] bg-accent-2 text-bg px-[5px] py-px">
                지금 {formatMin(nowMin)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
