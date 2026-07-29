'use client'

import { useRef } from 'react'
import type { PlanTask } from '@/components/plan-panel'

// 프레젠테이션 컴포넌트 — 낙관적 상태·액션 호출은 PlanPanel이 소유한다
export function BrainDump({
  tasks,
  error,
  onAdd,
  onDelete,
  onToggleTop3,
  onPlace,
}: {
  tasks: PlanTask[]
  error: string | null
  onAdd: (title: string) => Promise<void>
  onDelete: (id: string) => void
  onToggleTop3: (task: PlanTask) => void
  onPlace: (task: PlanTask) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleAdd(formData: FormData) {
    const value = formData.get('title')
    const title = typeof value === 'string' ? value.trim() : ''
    if (title === '') {
      return
    }
    await onAdd(title)
    inputRef.current?.focus()
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
        {tasks.map((task) => {
          const isPending = task.id.startsWith('temp-')
          return (
            <li key={task.id} className="dump-row">
              <button
                type="button"
                aria-pressed={task.is_top3}
                aria-label={`${task.title} TOP 3 ${task.is_top3 ? '내리기' : '올리기'}`}
                disabled={isPending}
                onClick={() => onToggleTop3(task)}
                className={`size-[15px] shrink-0 rounded-sm border-[1.5px] disabled:opacity-30 ${
                  task.is_top3
                    ? 'border-accent bg-accent'
                    : 'border-divider hover:border-accent'
                }`}
              />
              <span className="flex-1">{task.title}</span>
              {task.is_top3 && <span className="tag-outline">TOP 3</span>}
              {/* 일반 항목도 남은 시간에 배치 — 소요시간 미지정이면 기본 30분 (F4: task "주로" TOP3) */}
              <button
                type="button"
                aria-label={`${task.title} 배치`}
                data-testid="dump-place"
                disabled={isPending}
                onClick={() => onPlace(task)}
                className="dump-delete shrink-0 text-[12px] disabled:opacity-30"
              >
                배치 →
              </button>
              <button
                type="button"
                aria-label={`${task.title} 삭제`}
                disabled={isPending}
                onClick={() => onDelete(task.id)}
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
