'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { moveBlock, setBlockStatus } from '@/app/tasks/actions'
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

// 선택(우측 그리드 클릭)과 편집 카드(좌측)가 열을 가로지르므로 상태를 여기서 소유한다
export function DayView({
  tasks,
  blocks,
}: {
  tasks: PlanTask[]
  blocks: BlockView[]
}) {
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
    <div className="grid grid-cols-[352px_1fr] gap-8 items-start pt-6">
      <div className="flex flex-col gap-6">
        <PlanPanel tasks={tasks} />
        <RecordPanel
          tasks={tasks}
          blocks={optimisticBlocks}
          selectedBlock={selectedBlock}
          onStatus={handleStatus}
        />
      </div>
      <div className="border-l border-divider pl-6">
        <TimeGrid
          blocks={optimisticBlocks}
          selectedId={selectedBlock?.id ?? null}
          error={error}
          onSelect={handleSelect}
          onCommitMove={handleCommitMove}
        />
      </div>
    </div>
  )
}
