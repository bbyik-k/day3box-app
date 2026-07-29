'use client'

import { useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteBlock, moveBlock, setBlockStatus } from '@/app/tasks/actions'
import { shiftDate } from '@/lib/date'
import { overlaps } from '@/lib/grid'
import type { BlockStatus } from '@/types/block'
import { PlanPanel } from '@/components/plan-panel'
import type { PlanTask } from '@/components/plan-panel'
import { RecordPanel } from '@/components/record-panel'
import { TimeGrid } from '@/components/time-grid'
import type { BlockView } from '@/components/time-grid'

type BlockAction =
  | { type: 'move'; id: string; start_min: number; end_min: number }
  | { type: 'status'; id: string; status: BlockStatus }

// 선택(우측 그리드 클릭)과 편집 카드(좌측)가 열을 가로지르므로 상태를 여기서 소유한다.
// 부모(page)가 key={date}로 리마운트해 날짜 전환 시 선택·낙관·토글 상태가 전량 초기화된다.
export function DayView({
  date,
  isToday,
  displayDate,
  tasks,
  blocks,
  carryTasks,
}: {
  date: string
  isToday: boolean
  displayDate: string
  tasks: PlanTask[]
  blocks: BlockView[]
  carryTasks: PlanTask[]
}) {
  const [mode, setMode] = useState<'plan' | 'record'>('plan')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [optimisticBlocks, applyOptimistic] = useOptimistic(
    blocks,
    (state: BlockView[], action: BlockAction): BlockView[] =>
      state.map((b) => {
        if (b.id !== action.id) {
          return b
        }
        return action.type === 'move'
          ? { ...b, start_min: action.start_min, end_min: action.end_min }
          : { ...b, status: action.status }
      }),
  )

  // refresh 후 선택 블록이 사라졌으면(삭제 등) 선택 해제
  const selectedBlock =
    optimisticBlocks.find((b) => b.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
    // 편집 카드는 저녁 기록 패널에 있다 — 계획 모드에서 선택하면 전환해 연동을 유지 (Task 007)
    setMode('record')
  }

  function handleCommitMove(id: string, startMin: number, endMin: number) {
    // 겹침 검사는 낙관 배열 기준(자기 자신 제외) — in-flight 이동을 반영한다
    const conflict = optimisticBlocks.some(
      (b) => b.id !== id && overlaps(startMin, endMin, b.start_min, b.end_min),
    )
    if (conflict) {
      setError('해당 시간대에 이미 다른 블록이 있습니다.')
      return
    }
    startTransition(async () => {
      setError(null)
      applyOptimistic({ type: 'move', id, start_min: startMin, end_min: endMin })
      const result = await moveBlock(id, startMin, endMin)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  // 배치 취소 — 드문 조작이라 낙관 반영 없이 refresh 결과 대기 (placeBlock 패턴).
  // 삭제 후 selectedBlock lookup이 null이 되어 편집 카드는 자동으로 플레이스홀더 복귀
  function handleDeleteBlock(id: string) {
    startTransition(async () => {
      setError(null)
      const result = await deleteBlock(id)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  function handleStatus(id: string, status: BlockStatus) {
    startTransition(async () => {
      setError(null)
      applyOptimistic({ type: 'status', id, status })
      const result = await setBlockStatus(id, status)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <>
      {/* 마스트헤드 — h1 날짜 + 아침/저녁 토글 + ‹어제 내일› (목업 정본 구조) */}
      <div className="flex flex-wrap items-end justify-between gap-4 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[40px] font-semibold leading-tight">
            {displayDate}
          </h1>
          <span className="text-[14px] tracking-[0.04em] text-text/55">
            타임박싱 플래너 · 계획 대비 실제
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn"
            aria-pressed={mode === 'plan'}
            onClick={() => setMode('plan')}
          >
            아침 계획
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={mode === 'record'}
            onClick={() => setMode('record')}
          >
            저녁 기록
          </button>
          <span
            aria-hidden="true"
            className="mx-1 h-[22px] w-px bg-divider"
          />
          <Link
            href={{ pathname: '/', query: { date: shiftDate(date, -1) } }}
            scroll={false}
            className="btn-ghost"
            data-testid="nav-prev"
          >
            ‹ 어제
          </Link>
          <Link
            href={{ pathname: '/', query: { date: shiftDate(date, 1) } }}
            scroll={false}
            className="btn-ghost"
            data-testid="nav-next"
          >
            내일 ›
          </Link>
        </div>
      </div>
      <div aria-hidden="true" className="mb-6 h-px bg-text opacity-40" />

      <div className="grid grid-cols-[352px_1fr] gap-8 items-start">
        <div className="flex flex-col gap-6">
          {mode === 'plan' ? (
            <PlanPanel tasks={tasks} date={date} carryTasks={carryTasks} />
          ) : (
            <RecordPanel
              tasks={tasks}
              blocks={optimisticBlocks}
              selectedBlock={selectedBlock}
              onStatus={handleStatus}
              onDelete={handleDeleteBlock}
            />
          )}
        </div>
        <div className="border-l border-divider pl-6">
          <TimeGrid
            blocks={optimisticBlocks}
            selectedId={selectedBlock?.id ?? null}
            isToday={isToday}
            error={error}
            onSelect={handleSelect}
            onCommitMove={handleCommitMove}
          />
        </div>
      </div>
    </>
  )
}
