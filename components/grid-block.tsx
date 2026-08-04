'use client'

import { useRef, useState } from 'react'
import {
  DRAG_THRESHOLD_PX,
  GRID_END_MIN,
  GRID_START_MIN,
  PX_PER_HOUR,
  SNAP_MIN,
  floorToSnap,
  formatMin,
  minToY,
  roundToSnap,
  TOUCH_TAP_SLOP_PX,
} from '@/lib/grid'
import { BLOCK_STATUS_LABELS, isBlockStatus } from '@/types/block'
import type { BlockStatus } from '@/types/block'
import type { BlockView } from '@/components/time-grid'
import { InlineTitle } from '@/components/inline-title'

// 표식 클릭 = 상태 순환 (D14-4) — 편집 카드 세그먼트의 빠른 경로
const NEXT_STATUS: Record<BlockStatus, BlockStatus> = {
  planned: 'done',
  done: 'partial',
  partial: 'moved',
  moved: 'planned',
}

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

type DragState = {
  mode: DragMode
  pointerId: number
  // 터치는 탭 선택만 — temp를 갱신하지 않아 이동 커밋에 구조적으로 도달하지 않는다 (Task 017)
  pointerType: string
  startClientY: number
  startClientX: number
  // pointerdown 시점 값 고정 — 드래그 중 props rebase가 와도 delta 기준이 흔들리지 않는다
  originStart: number
  originEnd: number
  tempStart: number
  tempEnd: number
  moved: boolean
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), upper)
}

export function GridBlock({
  block,
  selected,
  onCommit,
  onSelect,
  onDelete,
  onRename,
  onStatus,
}: {
  block: BlockView
  selected: boolean
  onCommit: (id: string, startMin: number, endMin: number) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onStatus: (id: string, status: BlockStatus) => void
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || drag !== null) {
      return
    }
    // 터치 리사이즈는 시작하지 않는다 — 6px 핸들은 터치 대상이 아니다 (모바일은 기록 동선만, R3)
    if (e.pointerType === 'touch' && mode !== 'move') {
      return
    }
    rootRef.current?.setPointerCapture(e.pointerId)
    setDrag({
      mode,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startClientY: e.clientY,
      startClientX: e.clientX,
      originStart: block.start_min,
      originEnd: block.end_min,
      tempStart: block.start_min,
      tempEnd: block.end_min,
      moved: false,
    })
  }

  function handleMove(e: React.PointerEvent) {
    if (drag === null || e.pointerId !== drag.pointerId) {
      return
    }
    // 터치: 위치를 절대 바꾸지 않는다 — 슬롭 초과만 기록해 탭(선택)과 스와이프(무시)를 구분.
    // 세로 스크롤은 pan-y로 브라우저가 가져가며 pointercancel → handleCancel로 정리된다
    if (drag.pointerType === 'touch') {
      if (
        !drag.moved &&
        Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) >=
          TOUCH_TAP_SLOP_PX
      ) {
        setDrag({ ...drag, moved: true })
      }
      return
    }
    const dy = e.clientY - drag.startClientY
    if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) {
      return
    }
    const deltaMin = (dy / PX_PER_HOUR) * 60
    const duration = drag.originEnd - drag.originStart
    let tempStart = drag.tempStart
    let tempEnd = drag.tempEnd

    if (drag.mode === 'move') {
      // clamp 상한도 스냅 정렬 — 비배수 duration에서 비정렬 start가 생기지 않게
      const maxStart = floorToSnap(GRID_END_MIN - duration)
      tempStart = clamp(
        roundToSnap(drag.originStart + deltaMin),
        GRID_START_MIN,
        maxStart,
      )
      tempEnd = tempStart + duration
    } else if (drag.mode === 'resize-bottom') {
      tempEnd = clamp(
        roundToSnap(drag.originEnd + deltaMin),
        drag.originStart + SNAP_MIN,
        GRID_END_MIN,
      )
    } else {
      const maxStart = Math.max(
        GRID_START_MIN,
        floorToSnap(drag.originEnd - SNAP_MIN),
      )
      tempStart = clamp(
        roundToSnap(drag.originStart + deltaMin),
        GRID_START_MIN,
        maxStart,
      )
    }

    setDrag({ ...drag, tempStart, tempEnd, moved: true })
  }

  function handleUp(e: React.PointerEvent) {
    if (drag === null || e.pointerId !== drag.pointerId) {
      return
    }
    if (
      drag.moved &&
      (drag.tempStart !== drag.originStart || drag.tempEnd !== drag.originEnd)
    ) {
      onCommit(block.id, drag.tempStart, drag.tempEnd)
    } else if (!drag.moved) {
      // 임계값 미달의 무이동 up = 클릭 → 선택
      onSelect(block.id)
    }
    // 거부되면 커밋이 없으므로 props 위치로 렌더 = 원위치 복귀
    setDrag(null)
  }

  function handleCancel() {
    setDrag(null)
  }

  const dragging = drag !== null && drag.moved
  const startMin = dragging ? drag.tempStart : block.start_min
  const endMin = dragging ? drag.tempEnd : block.end_min
  const duration = endMin - startMin
  const heightPx = (duration / 60) * PX_PER_HOUR
  // 길이별 3단계 레이아웃 (handoff-v0-003 §2: ≥45분 2줄 / 25~44분 한 줄 / 10~24분 초경량)
  const tier = duration >= 45 ? 'full' : duration >= 25 ? 'line' : 'micro'

  const status = isBlockStatus(block.status) ? block.status : 'planned'
  // 고정 시간(fixed)은 기록 대상이 아니다 — 상태 표식 미표시 (1b)
  const fixed = block.kind === 'fixed'

  // 분할 표기(D4, handoff §5): n/N + 잘린 변. head=첫 조각, tail=마지막, mid=중간
  const split =
    block.part === null
      ? undefined
      : block.part.index === 1
        ? 'head'
        : block.part.index === block.part.total
          ? 'tail'
          : 'mid'
  const partLabel =
    block.part !== null ? `${block.part.index}/${block.part.total}` : null
  // 뒤 조각은 4px 들여쓰기 — 파선만으로는 잘림 신호가 약하다 (handoff §5)
  const indent = split === 'tail' || split === 'mid'
  // 상태는 우측 인쇄 표식(□■◧▨)으로만 — 본문 무게는 4상태 동일 (6b, handoff §4)
  const MK_CLASS = {
    planned: 'mk-plan',
    done: 'mk-done',
    partial: 'mk-part',
    moved: 'mk-move',
  } as const
  // 표식 클릭 = 상태 순환 (D14-4). fixed는 기록 대상이 아니라 표식 없음
  const statusMark = fixed ? null : (
    <button
      type="button"
      aria-label={`상태 순환 (현재 ${BLOCK_STATUS_LABELS[status]})`}
      data-testid="status-mark"
      className={`mk ${MK_CLASS[status]} shrink-0 cursor-pointer`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onStatus(block.id, NEXT_STATUS[status])}
    />
  )

  const dragShadow = '0 4px 12px rgba(32, 30, 29, 0.25)'
  const selectRing = '0 0 0 2px var(--color-accent)'
  const boxShadow = dragging
    ? selected
      ? `${selectRing}, ${dragShadow}`
      : dragShadow
    : selected
      ? selectRing
      : undefined

  return (
    <div
      ref={rootRef}
      className="grid-block touch-pan-y lg:touch-none select-none cursor-grab"
      data-cat={block.category ?? undefined}
      data-status={status}
      data-kind={fixed ? 'fixed' : undefined}
      data-selected={selected || undefined}
      data-split={split}
      data-testid="grid-block"
      style={{
        top: minToY(startMin),
        height: heightPx,
        zIndex: dragging ? 20 : selected ? 5 : undefined,
        boxShadow,
      }}
      onPointerDown={(e) => beginDrag('move', e)}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleCancel}
    >
      {tier === 'full' ? (
        <div className={`py-[7px] ${indent ? 'pl-[14px] pr-[10px]' : 'px-[10px]'}`}>
          <div className="flex items-center gap-1">
            {/* 제목 클릭 = 편집 (D14-4, 리스트와 같은 규칙) — 팝오버 없음, 편집 대상은 제목 하나 */}
            <InlineTitle
              title={block.title}
              onRename={(t) => onRename(block.task_id, t)}
              interceptPointer
              className="font-semibold text-[14px]"
              inputClassName="flex-1 font-semibold text-[14px]"
            />
            {partLabel && (
              <span className="shrink-0 text-[11px] font-normal text-text/45">
                {partLabel}
              </span>
            )}
          </div>
          {/* 메타 + 우측 표식·라벨 — 이월에 날짜·부분에 비율을 쓰지 않는다 (미결 3·4) */}
          <div className="mt-[2px] flex items-center gap-[5px] text-[11px] text-text/60">
            <span className="flex-1 truncate">
              {formatMin(startMin)}–{formatMin(endMin)} · {duration}분
            </span>
            {statusMark}
            {!fixed && (
              <span className="shrink-0">{BLOCK_STATUS_LABELS[status]}</span>
            )}
          </div>
        </div>
      ) : (
        // line(25~44분)·micro(10~24분): 한 줄 — 제목 좌측 + 시간·표식 우측
        <div
          // pr-26px: hover 시 우측 상단 × 버튼이 상태 표식을 덮지 않도록 자리 확보
          className={`h-full flex items-center gap-2 leading-none ${
            indent ? 'pl-[14px]' : 'pl-[10px]'
          } pr-[26px] ${tier === 'micro' ? 'text-[11px]' : 'text-[13px]'}`}
        >
          <InlineTitle
            title={block.title}
            onRename={(t) => onRename(block.task_id, t)}
            interceptPointer
            className="font-semibold"
            inputClassName="font-semibold w-[45%]"
          />
          {partLabel && (
            <span className="shrink-0 text-[11px] font-normal text-text/45">
              {partLabel}
            </span>
          )}
          <span className="flex-1" />
          <span className="shrink-0 text-[11px] text-text/60">
            {tier === 'micro'
              ? `${formatMin(startMin)} · ${duration}분`
              : `${formatMin(startMin)}–${formatMin(endMin)} · ${duration}분`}
          </span>
          {statusMark}
        </div>
      )}

      {/* 배치 취소 × — hover/선택 시 노출. pointerdown 차단으로 드래그·선택과 충돌하지 않는다.
          15분 블록엔 안 들어가므로 top 핸들과 같은 기준으로 생략 (편집 카드 경로 사용) */}
      {heightPx >= 18 && (
        <button
          type="button"
          aria-label={`${block.title} 배치 취소`}
          data-testid="block-delete-grid"
          className="block-delete absolute right-1 top-0.5 z-10 px-1 py-0.5 text-[13px] leading-none bg-surface"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(block.id)}
        >
          ×
        </button>
      )}

      {/* 리사이즈 핸들 — 15분 블록(10.5px)은 본문이 없어지므로 top 핸들 생략 */}
      {heightPx >= 18 && (
        <div
          className="absolute inset-x-0 top-0 h-[6px] cursor-ns-resize"
          data-testid="resize-top"
          onPointerDown={(e) => {
            e.stopPropagation()
            beginDrag('resize-top', e)
          }}
        />
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-[6px] cursor-ns-resize"
        data-testid="resize-bottom"
        onPointerDown={(e) => {
          e.stopPropagation()
          beginDrag('resize-bottom', e)
        }}
      />
    </div>
  )
}
