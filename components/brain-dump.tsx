'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { addTask, deleteTask } from '@/app/tasks/actions'
import type { Tables } from '@/types/supabase'

export type DumpTask = Pick<Tables<'tasks'>, 'id' | 'title' | 'is_top3'>

type OptimisticAction =
  | { type: 'add'; tempId: string; title: string }
  | { type: 'delete'; id: string }

// tasks prop은 초기값이 아니라 항상 최신 canonical state — refresh() 후 useOptimistic이 자동 rebase된다
export function BrainDump({ tasks }: { tasks: DumpTask[] }) {
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: DumpTask[], action: OptimisticAction): DumpTask[] =>
      action.type === 'add'
        ? [...state, { id: action.tempId, title: action.title, is_top3: false }]
        : state.filter((t) => t.id !== action.id),
  )

  async function handleAdd(formData: FormData) {
    const value = formData.get('title')
    const title = typeof value === 'string' ? value.trim() : ''
    if (title === '') {
      return
    }
    setError(null)
    applyOptimistic({ type: 'add', tempId: `temp-${crypto.randomUUID()}`, title })
    const result = await addTask(title)
    if (result?.error) {
      setError(result.error)
    }
    inputRef.current?.focus()
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      setError(null)
      applyOptimistic({ type: 'delete', id })
      const result = await deleteTask(id)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <section>
      <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
        쏟아내기 · Brain dump
      </h6>
      <p className="text-[13px] text-text/60 mt-1">
        머릿속을 다 비운다. 개수 제한 없음.
      </p>

      <ul className="mt-3">
        {optimisticTasks.map((task) => {
          const isPending = task.id.startsWith('temp-')
          return (
            <li key={task.id} className="dump-row">
              <span
                aria-hidden="true"
                className="size-[15px] shrink-0 rounded-sm border-[1.5px] border-divider"
              />
              <span className="flex-1">{task.title}</span>
              {task.is_top3 && <span className="tag-outline">TOP 3</span>}
              <button
                type="button"
                aria-label={`${task.title} 삭제`}
                disabled={isPending}
                onClick={() => handleDelete(task.id)}
                className="dump-delete text-[15px] leading-none px-1 disabled:opacity-30"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      <form action={handleAdd} className="mt-2">
        <div className="dump-add-input flex items-center gap-2">
          <span aria-hidden="true">＋</span>
          <input
            ref={inputRef}
            name="title"
            type="text"
            placeholder="할 일 추가…"
            aria-label="할 일 추가"
            className="flex-1"
          />
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[13px] text-accent-2">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
