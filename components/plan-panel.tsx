'use client'

import { useEffect, useRef, useState } from 'react'
import type { CategoryKey } from '@/lib/category'
import { categoryLabel } from '@/lib/category'
import { formatMin } from '@/lib/grid'
import type { Tables } from '@/types/supabase'
import { BrainDump } from '@/components/brain-dump'
import { Top3Panel } from '@/components/top3-panel'

export type PlanTask = Pick<
  Tables<'tasks'>,
  'id' | 'title' | 'is_top3' | 'est_min' | 'category' | 'kind'
>

const TOP3_LIMIT = 3

// 프레젠테이션 컴포넌트 — 낙관 상태·서버 액션은 DayView가 소유하고,
// 여기는 교체 모달 로컬 상태와 하드 제한(3개) 선분기만 담당한다
export function PlanPanel({
  tasks,
  blocks,
  carryTasks,
  error,
  onAdd,
  onDelete,
  onToggleTop3,
  onSwap,
  onEstMin,
  onCategory,
  onPlace,
  onRename,
  onDragStart,
  onCarry,
  onCarryDelete,
}: {
  tasks: PlanTask[]
  blocks: { task_id: string; start_min: number; end_min: number }[]
  carryTasks: PlanTask[]
  error: string | null
  onAdd: (title: string) => void
  onDelete: (id: string) => void
  onToggleTop3: (task: PlanTask, next: boolean) => void
  onSwap: (demoteId: string, promoteId: string) => void
  onEstMin: (id: string, value: number | null) => void
  onCategory: (id: string, value: CategoryKey) => void
  onPlace: (task: PlanTask) => void
  onRename: (id: string, title: string) => void
  onDragStart: (task: PlanTask, e: React.PointerEvent) => void
  onCarry: (id: string) => void
  onCarryDelete: (id: string) => void
}) {
  const [swapTarget, setSwapTarget] = useState<PlanTask | null>(null)
  const [demoteId, setDemoteId] = useState<string | null>(null)
  const swapRef = useRef<HTMLElement>(null)

  const topTasks = tasks.filter((t) => t.is_top3)

  // 전환 신호 — 클릭 지점(상단 체크박스)과 전환 지점(하단 TOP3 자리)이 멀어
  // 시선·포커스를 선택 영역으로 함께 옮긴다 (실사용 피드백 2026-07-31)
  useEffect(() => {
    if (swapTarget === null) {
      return
    }
    const section = swapRef.current
    section?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    section?.querySelector<HTMLButtonElement>('.pick')?.focus()
  }, [swapTarget])

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

  function cancelSwap() {
    setSwapTarget(null)
    setDemoteId(null)
  }

  function handleSwapConfirm() {
    if (!swapTarget || !demoteId) {
      return
    }
    const demote = demoteId
    const promote = swapTarget.id
    cancelSwap()
    onSwap(demote, promote)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 교체 중에는 스포트라이트 — 선택 영역 밖 좌측을 옅게·비활성 (가벼운 포커스 트랩) */}
      <div
        className={`flex flex-col gap-6 transition-opacity ${
          swapTarget !== null ? 'opacity-40 pointer-events-none' : ''
        }`}
        data-testid="dimmable"
      >
      <BrainDump
        tasks={tasks}
        blocks={blocks}
        error={error}
        onAdd={onAdd}
        onDelete={onDelete}
        onToggleTop3={handleToggleTop3}
        onPlace={onPlace}
        onRename={onRename}
        onDragStart={onDragStart}
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
      </div>

      {swapTarget === null ? (
        <Top3Panel
          topTasks={topTasks}
          blocks={blocks}
          onDemote={handleToggleTop3}
          onEstMin={onEstMin}
          onCategory={onCategory}
          onPlace={onPlace}
          onRename={onRename}
          onDragStart={onDragStart}
        />
      ) : (
        // TOP3 교체(5a) — 모달 없이 좌측 제자리에서 자리를 내준다 (handoff §3-2, D7)
        <section
          ref={swapRef}
          data-testid="swap-picker"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              cancelSwap()
            }
          }}
        >
          <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
            TOP 3 — 자리 바꾸기
          </h6>
          <div className="mt-2 flex items-center gap-2 border-l-4 border-text pl-2">
            <span className="text-[15px] font-semibold truncate">
              {swapTarget.title}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-text/60">
            어느 자리에 넣을까요? 내려간 하나는 일반 할 일이 됩니다. 배치는
            그대로 유지됩니다.
          </p>

          <div className="mt-3 flex flex-col gap-2" role="radiogroup">
            {topTasks.map((task, index) => {
              const taskBlocks = blocks
                .filter((b) => b.task_id === task.id)
                .sort((a, b) => a.start_min - b.start_min)
              const label = categoryLabel(task.category)
              const selected = demoteId === task.id
              // 이미 배치한 것을 내리는 것과 아직 안 놓은 것은 무게가 다르다 (5b에서 가져온 개선)
              const info =
                taskBlocks.length > 0
                  ? `${task.est_min !== null ? `${task.est_min}분 · ` : ''}${formatMin(taskBlocks[0].start_min)} 배치됨`
                  : `${task.est_min !== null ? `${task.est_min}분 · ` : ''}미배치`
              return (
                <button
                  key={task.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-selected={selected || undefined}
                  data-cat={task.category ?? undefined}
                  onClick={() => setDemoteId(task.id)}
                  className="pick"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="top3-kicker">
                      {String(index + 1).padStart(2, '0')}
                      {label !== null ? ` · ${label}` : ''}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[11px] text-text/50">{info}</span>
                  </div>
                  <div
                    className={`mt-[2px] text-[16px] font-semibold truncate ${
                      selected ? 'text-text/50' : ''
                    }`}
                  >
                    {task.title}
                  </div>
                  {selected && (
                    <div className="mt-[6px] text-[12px] text-accent">
                      ↑ {swapTarget.title}이(가) 이 자리로
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelSwap}
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
              바꾸기
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
