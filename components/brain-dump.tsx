'use client'

import { useRef } from 'react'
import type { PlanTask } from '@/components/plan-panel'
import { InlineTitle } from '@/components/inline-title'

// 프레젠테이션 컴포넌트 — 낙관적 상태·액션 호출·드래그 오케스트레이션은 상위가 소유한다.
// 행 구조 (CHANGE-002, D9): [⠿ 손잡이|색 막대|이름|힌트|삭제|TOP3 배지] — 체크박스 없음.
// 좌측 진입점 = 주 동작(배치: 클릭=다음 빈 슬롯, 드래그=시각 지정), 배지 = 보조 동작(승격)
export function BrainDump({
  tasks,
  blocks,
  error,
  onAdd,
  onDelete,
  onToggleTop3,
  onPlace,
  onRename,
  onDragStart,
}: {
  tasks: PlanTask[]
  blocks: { task_id: string; start_min: number; end_min: number }[]
  error: string | null
  onAdd: (title: string) => void
  onDelete: (id: string) => void
  onToggleTop3: (task: PlanTask) => void
  onPlace: (task: PlanTask) => void
  onRename: (id: string, title: string) => void
  onDragStart: (task: PlanTask, e: React.PointerEvent) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // form action 금지(D16) — action이 startTransition과 entangle되면 React의 자동 폼 리셋이
  // 서버 왕복 뒤로 밀리고, 지연 리셋이 타이핑 중인 다음 항목을 지울 수 있다. 수동 초기화로 즉시.
  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = inputRef.current
    const title = input?.value.trim() ?? ''
    if (title === '') {
      return
    }
    onAdd(title)
    if (input) {
      input.value = ''
      input.focus()
    }
  }

  // 미배치 개수 (D9-6) — 묶음을 가르지 않고도 "몇 개 남았나"를 얻는다
  const placedIds = new Set(blocks.map((b) => b.task_id))
  const remainingCount = tasks.filter((t) => !placedIds.has(t.id)).length

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          쏟아내기 · Brain dump
        </h6>
        {remainingCount > 0 && (
          <span className="text-[12px] text-text/50" data-testid="remaining-count">
            {remainingCount}개 남음
          </span>
        )}
      </div>
      <p className="text-[13px] text-text/60 mt-1">
        머릿속을 다 비운다. 개수 제한 없음.
      </p>

      <ul className="mt-3">
        {tasks.map((task) => {
          const isPending = task.id.startsWith('temp-')
          const placedSum = blocks
            .filter((b) => b.task_id === task.id)
            .reduce((sum, b) => sum + (b.end_min - b.start_min), 0)
          const placed = placedSum > 0
          // 잔량이 남았을 때만 끌 수 있다 (전량 배치 행은 드래그 시도 시 에러 — 이동은 그리드에서)
          const remaining =
            task.est_min !== null ? task.est_min - placedSum : placed ? 0 : 1
          return (
            <li
              key={task.id}
              className={`dump-row min-h-[40px] select-none ${placed ? 'dump-set' : ''}`}
              // 행 전체가 드래그 시작 영역 (D14-1) — 5px 임계로 내부 클릭 대상과 공존.
              // input(제목 편집 중)은 자체 stopPropagation으로 제외된다
              onPointerDown={(e) => {
                if (!isPending) {
                  onDragStart(task, e)
                }
              }}
            >
              <button
                type="button"
                aria-label={`${task.title} 배치`}
                data-testid="dump-grip"
                disabled={isPending}
                // 손잡이 클릭 = 마지막 블록 뒤 배치 (D13) — 어포던스로도 유지 (D14-1)
                onClick={() => onPlace(task)}
                className={`grip select-none ${isPending ? 'opacity-30' : ''}`}
              >
                ⠿
              </button>
              {/* 색 막대 — TOP3만 컬러 (그리드 위계와 동일), 일반은 투명 */}
              <span
                aria-hidden="true"
                className="bar3"
                data-cat={
                  task.is_top3 ? (task.category ?? undefined) : undefined
                }
                style={{ background: task.is_top3 ? 'var(--cat, var(--color-neutral))' : 'transparent' }}
              />
              {/* 제목 클릭 = 편집 (D14-3) — 각 지점이 뜻을 하나만 갖는다 */}
              <InlineTitle
                title={task.title}
                onRename={(t) => onRename(task.id, t)}
                className="flex-1"
                inputClassName="flex-1 text-[15px]"
              />
              <span className="hint">
                {remaining > 0
                  ? placed
                    ? '끌어서 남은 시간 배치'
                    : '끌어서 시간 위로'
                  : ''}
              </span>
              <button
                type="button"
                aria-label={`${task.title} 삭제`}
                disabled={isPending}
                onClick={() => onDelete(task.id)}
                className="dump-delete text-[15px] leading-none px-1 disabled:opacity-30"
              >
                ×
              </button>
              <button
                type="button"
                aria-pressed={task.is_top3}
                aria-label={`${task.title} TOP 3 ${task.is_top3 ? '내리기' : '올리기'}`}
                disabled={isPending}
                onClick={() => onToggleTop3(task)}
                className={`tbtn ${task.is_top3 ? 'tbtn-on' : ''} disabled:opacity-30`}
              >
                TOP 3
              </button>
            </li>
          )
        })}
      </ul>

      <form onSubmit={handleAdd} className="mt-2">
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
