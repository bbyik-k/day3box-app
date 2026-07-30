'use client'

import { useState } from 'react'
import type { CategoryKey } from '@/lib/category'
import { categoryLabel } from '@/lib/category'
import type { Tables } from '@/types/supabase'
import { BrainDump } from '@/components/brain-dump'
import { Top3Panel } from '@/components/top3-panel'

export type PlanTask = Pick<
  Tables<'tasks'>,
  'id' | 'title' | 'is_top3' | 'est_min' | 'category'
>

const TOP3_LIMIT = 3

// 프레젠테이션 컴포넌트 — 낙관 상태·서버 액션은 DayView가 소유하고,
// 여기는 교체 모달 로컬 상태와 하드 제한(3개) 선분기만 담당한다
export function PlanPanel({
  tasks,
  carryTasks,
  error,
  onAdd,
  onDelete,
  onToggleTop3,
  onSwap,
  onEstMin,
  onCategory,
  onPlace,
  onCarry,
  onCarryDelete,
}: {
  tasks: PlanTask[]
  carryTasks: PlanTask[]
  error: string | null
  onAdd: (title: string) => Promise<void>
  onDelete: (id: string) => void
  onToggleTop3: (task: PlanTask, next: boolean) => void
  onSwap: (demoteId: string, promoteId: string) => void
  onEstMin: (id: string, value: number | null) => void
  onCategory: (id: string, value: CategoryKey) => void
  onPlace: (task: PlanTask) => void
  onCarry: (id: string) => void
  onCarryDelete: (id: string) => void
}) {
  const [swapTarget, setSwapTarget] = useState<PlanTask | null>(null)
  const [demoteId, setDemoteId] = useState<string | null>(null)

  const topTasks = tasks.filter((t) => t.is_top3)

  // 4번째 승격 시도 → 단순 차단이 아니라 교체 모달 (PRD 7.1)
  function handleToggleTop3(task: PlanTask) {
    const next = !task.is_top3
    if (next && topTasks.length >= TOP3_LIMIT) {
      setDemoteId(null)
      setSwapTarget(task)
      return
    }
    onToggleTop3(task, next)
  }

  function closeSwapModal() {
    setSwapTarget(null)
    setDemoteId(null)
  }

  function handleSwapConfirm() {
    if (!swapTarget || !demoteId) {
      return
    }
    const demote = demoteId
    const promote = swapTarget.id
    closeSwapModal()
    onSwap(demote, promote)
  }

  return (
    <div className="flex flex-col gap-6">
      <BrainDump
        tasks={tasks}
        error={error}
        onAdd={onAdd}
        onDelete={onDelete}
        onToggleTop3={handleToggleTop3}
        onPlace={onPlace}
      />

      {/* 어제의 미배치 task — 소실되지 않고 여기서 접근·가져오기 가능 (길 B, PRD 3장) */}
      {carryTasks.length > 0 && (
        <section data-testid="carry-section">
          <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
            어제에서 이월
          </h6>
          <ul className="mt-2 flex flex-col">
            {carryTasks.map((task) => (
              <li key={task.id} className="dump-row">
                <span className="flex-1 text-text/70">{task.title}</span>
                <button
                  type="button"
                  onClick={() => onCarry(task.id)}
                  className="shrink-0 text-[12px] text-accent hover:text-accent-2"
                >
                  가져오기 →
                </button>
                <button
                  type="button"
                  aria-label={`${task.title} 삭제`}
                  data-testid="carry-delete"
                  onClick={() => onCarryDelete(task.id)}
                  className="dump-delete shrink-0 px-1 text-[14px] leading-none"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Top3Panel
        topTasks={topTasks}
        onDemote={handleToggleTop3}
        onEstMin={onEstMin}
        onCategory={onCategory}
        onPlace={onPlace}
      />

      {swapTarget && (
        <dialog
          ref={(el) => {
            if (el && !el.open) {
              el.showModal()
            }
          }}
          onClose={closeSwapModal}
          className="swap-modal m-auto w-[360px] bg-bg text-text border border-divider rounded-[4px] p-4"
        >
          <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
            TOP 3 교체
          </h6>
          <p className="mt-2 text-[13px] text-text/60">
            『{swapTarget.title}』을(를) 올리려면 하나를 내려야 한다.
          </p>
          <div className="mt-3 flex flex-col gap-1" role="radiogroup">
            {topTasks.map((task, index) => (
              <label
                key={task.id}
                className="dump-row cursor-pointer"
              >
                <input
                  type="radio"
                  name="demote"
                  value={task.id}
                  checked={demoteId === task.id}
                  onChange={() => setDemoteId(task.id)}
                  className="accent-(--color-accent)"
                />
                <span className="top3-kicker">
                  {String(index + 1).padStart(2, '0')}
                  {categoryLabel(task.category) !== null
                    ? ` · ${categoryLabel(task.category)}`
                    : ''}
                </span>
                <span className="flex-1">{task.title}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeSwapModal}
              className="border border-divider px-3 py-1 rounded-sm text-[13px] hover:border-text"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!demoteId}
              onClick={handleSwapConfirm}
              className="border border-text px-3 py-1 rounded-sm text-[13px] hover:bg-text hover:text-bg disabled:opacity-30"
            >
              교체
            </button>
          </div>
        </dialog>
      )}
    </div>
  )
}
