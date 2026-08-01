'use client'

import { useRef, useState } from 'react'
import {
  GRID_END_MIN,
  GRID_START_MIN,
  PX_PER_HOUR,
  SNAP_MIN,
  floorToSnap,
  formatMin,
  minToY,
  roundToSnap,
} from '@/lib/grid'
import { BLOCK_STATUS_LABELS, isBlockStatus } from '@/types/block'
import type { BlockView } from '@/components/time-grid'

// 클릭(무이동 up)과 드래그를 구분하는 이동 임계값 — Task 007의 클릭 선택이 onClick만 얹으면 된다
const DRAG_THRESHOLD_PX = 4

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

type DragState = {
  mode: DragMode
  pointerId: number
  startClientY: number
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
}: {
  block: BlockView
  selected: boolean
  onCommit: (id: string, startMin: number, endMin: number) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  function beginDrag(mode: DragMode, e: React.PointerEvent) {
    if (e.button !== 0 || !e.isPrimary || drag !== null) {
      return
    }
    rootRef.current?.setPointerCapture(e.pointerId)
    setDrag({
      mode,
      pointerId: e.pointerId,
      startClientY: e.clientY,
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
  const statusMark = fixed ? null : (
    <span aria-hidden="true" className={`mk ${MK_CLASS[status]} shrink-0`} />
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
      className="grid-block touch-none select-none cursor-grab"
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
            <div className="font-semibold truncate text-[14px]">
              {block.title}
            </div>
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
          className={`h-full flex items-center gap-2 leading-none ${
            indent ? 'pl-[14px] pr-[10px]' : 'px-[10px]'
          } ${tier === 'micro' ? 'text-[11px]' : 'text-[13px]'}`}
        >
          <div className="font-semibold truncate">{block.title}</div>
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
