'use client'

import { useOptimistic, useState, useTransition } from 'react'
import {
  addTask,
  deleteTask,
  toggleTop3,
  swapTop3,
  setEstMin,
  setCategory,
  placeBlock,
} from '@/app/tasks/actions'
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

type OptimisticAction =
  | { type: 'add'; tempId: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'toggleTop3'; id: string; value: boolean }
  | { type: 'swap'; demoteId: string; promoteId: string }
  | { type: 'estMin'; id: string; value: number | null }
  | { type: 'category'; id: string; value: CategoryKey }

function reduce(state: PlanTask[], action: OptimisticAction): PlanTask[] {
  switch (action.type) {
    case 'add':
      return [
        ...state,
        {
          id: action.tempId,
          title: action.title,
          is_top3: false,
          est_min: null,
          category: null,
        },
      ]
    case 'delete':
      return state.filter((t) => t.id !== action.id)
    case 'toggleTop3':
      return state.map((t) =>
        t.id === action.id ? { ...t, is_top3: action.value } : t,
      )
    case 'swap':
      // 한 번의 map으로 두 항목을 동시에 갱신 — 화면에도 중간 상태(4개/2개)가 없다
      return state.map((t) =>
        t.id === action.demoteId
          ? { ...t, is_top3: false }
          : t.id === action.promoteId
            ? { ...t, is_top3: true }
            : t,
      )
    case 'estMin':
      return state.map((t) =>
        t.id === action.id ? { ...t, est_min: action.value } : t,
      )
    case 'category':
      return state.map((t) =>
        t.id === action.id ? { ...t, category: action.value } : t,
      )
  }
}

// tasks prop은 항상 최신 canonical state — refresh() 후 useOptimistic이 자동 rebase된다
export function PlanPanel({ tasks }: { tasks: PlanTask[] }) {
  const [error, setError] = useState<string | null>(null)
  const [swapTarget, setSwapTarget] = useState<PlanTask | null>(null)
  const [demoteId, setDemoteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, reduce)
  const topTasks = optimisticTasks.filter((t) => t.is_top3)

  function run(
    action: OptimisticAction,
    serverCall: () => Promise<{ error: string } | undefined>,
  ) {
    startTransition(async () => {
      setError(null)
      applyOptimistic(action)
      const result = await serverCall()
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  // form action(자동 transition) 안에서 호출됨 — 별도 startTransition 불필요
  async function handleAdd(title: string) {
    setError(null)
    applyOptimistic({
      type: 'add',
      tempId: `temp-${crypto.randomUUID()}`,
      title,
    })
    const result = await addTask(title)
    if (result?.error) {
      setError(result.error)
    }
  }

  function handleDelete(id: string) {
    run({ type: 'delete', id }, () => deleteTask(id))
  }

  function handleToggleTop3(task: PlanTask) {
    const next = !task.is_top3
    if (next && topTasks.length >= TOP3_LIMIT) {
      setDemoteId(null)
      setSwapTarget(task)
      return
    }
    run({ type: 'toggleTop3', id: task.id, value: next }, () =>
      toggleTop3(task.id, next),
    )
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
    run({ type: 'swap', demoteId: demote, promoteId: promote }, () =>
      swapTop3(demote, promote),
    )
  }

  function handleEstMin(id: string, value: number | null) {
    run({ type: 'estMin', id, value }, () => setEstMin(id, value))
  }

  function handleCategory(id: string, value: CategoryKey) {
    run({ type: 'category', id, value }, () => setCategory(id, value))
  }

  // 배치는 슬롯 계산이 서버 단일 지점이라 낙관적 반영 없이 refresh() 결과를 기다린다
  function handlePlace(task: PlanTask) {
    if (task.est_min === null) {
      setError('소요시간을 먼저 입력해 주세요.')
      return
    }
    startTransition(async () => {
      setError(null)
      const result = await placeBlock(task.id)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <BrainDump
        tasks={optimisticTasks}
        error={error}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onToggleTop3={handleToggleTop3}
      />
      <Top3Panel
        topTasks={topTasks}
        onDemote={handleToggleTop3}
        onEstMin={handleEstMin}
        onCategory={handleCategory}
        onPlace={handlePlace}
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
