'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  addTask,
  carryTaskToDate,
  deleteBlock,
  deleteTask,
  moveBlock,
  placeBlock,
  setBlockStatus,
  setCategory,
  setEstMin,
  swapTop3,
  toggleTop3,
} from '@/app/tasks/actions'
import { nowMinutesInSeoul, shiftDate } from '@/lib/date'
import { GRID_END_MIN, GRID_START_MIN, findNextFreeSlot, overlaps } from '@/lib/grid'
import type { CategoryKey } from '@/lib/category'
import { CATEGORY_KEYS } from '@/lib/category'
import type { BlockStatus } from '@/types/block'
import { PlanPanel } from '@/components/plan-panel'
import type { PlanTask } from '@/components/plan-panel'
import { RecordPanel } from '@/components/record-panel'
import { TimeGrid } from '@/components/time-grid'
import type { BlockView } from '@/components/time-grid'

// 일반(비 TOP3) task의 기본 배치 시간 — 서버 placeBlock의 DEFAULT_PLACE_MIN 미러
const DEFAULT_PLACE_MIN = 30

// page.tsx select 그대로의 블록 — 제목·카테고리는 낙관 tasks에서 클라이언트 조인(파생)
export type RawBlock = Pick<
  BlockView,
  'id' | 'task_id' | 'start_min' | 'end_min' | 'status'
>

type Store = {
  tasks: PlanTask[]
  blocks: RawBlock[]
  carryTasks: PlanTask[]
}

type StoreAction =
  | { type: 'add'; tempId: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'toggleTop3'; id: string; value: boolean }
  | { type: 'swap'; demoteId: string; promoteId: string }
  | { type: 'estMin'; id: string; value: number | null }
  | { type: 'category'; id: string; value: CategoryKey }
  | { type: 'place'; task: PlanTask; tempId: string; start: number; end: number }
  | { type: 'move'; id: string; start_min: number; end_min: number }
  | { type: 'status'; id: string; status: BlockStatus }
  | { type: 'deleteBlock'; id: string }
  | { type: 'carry'; id: string }
  | { type: 'carryDelete'; id: string }

// TOP3 무조건 유색 — 승격 낙관 반영 시 서버와 동일한 결정적 규칙(미사용 첫 프리셋 색)으로
// 색을 지정해 무채색 플래시를 막는다. refresh 후 서버 계산 결과와 일치한다
function firstUnusedCategory(
  tasks: PlanTask[],
  excludeId?: string,
): CategoryKey {
  const used = tasks
    .filter((t) => t.is_top3 && t.id !== excludeId)
    .map((t) => t.category)
  return CATEGORY_KEYS.find((key) => !used.includes(key)) ?? CATEGORY_KEYS[0]
}

// 낙관 reducer — 서버 액션의 결과를 미러한다 (서버가 진실, 여기는 미리보기)
function reduce(store: Store, action: StoreAction): Store {
  switch (action.type) {
    case 'add':
      return {
        ...store,
        tasks: [
          ...store.tasks,
          {
            id: action.tempId,
            title: action.title,
            is_top3: false,
            est_min: null,
            category: null,
          },
        ],
      }
    case 'delete':
      // cascade 미러 — task 삭제 시 그 task의 블록도 즉시 소멸
      return {
        ...store,
        tasks: store.tasks.filter((t) => t.id !== action.id),
        blocks: store.blocks.filter((b) => b.task_id !== action.id),
      }
    case 'toggleTop3': {
      const autoCat = action.value ? firstUnusedCategory(store.tasks) : null
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                is_top3: action.value,
                category:
                  action.value && t.category === null ? autoCat : t.category,
              }
            : t,
        ),
      }
    }
    case 'swap': {
      // 한 번의 map으로 두 항목을 동시에 갱신 — 화면에도 중간 상태(4개/2개)가 없다
      const autoCat = firstUnusedCategory(store.tasks, action.demoteId)
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.demoteId
            ? { ...t, is_top3: false }
            : t.id === action.promoteId
              ? {
                  ...t,
                  is_top3: true,
                  category: t.category === null ? autoCat : t.category,
                }
              : t,
        ),
      }
    }
    case 'estMin': {
      // 양방향 동기화 미러 — 배치된 블록 높이도 함께 (서버 setEstMin과 동일 규칙)
      const est = action.value
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.id ? { ...t, est_min: est } : t,
        ),
        blocks:
          est === null
            ? store.blocks
            : store.blocks.map((b) =>
                b.task_id === action.id
                  ? { ...b, end_min: b.start_min + est }
                  : b,
              ),
      }
    }
    case 'category':
      // 블록 색은 tasks에서 파생되므로 tasks 갱신만으로 그리드도 즉시 반영된다
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.id ? { ...t, category: action.value } : t,
        ),
      }
    case 'place':
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.task.id && t.est_min === null
            ? { ...t, est_min: action.end - action.start }
            : t,
        ),
        blocks: [
          ...store.blocks,
          {
            id: action.tempId,
            task_id: action.task.id,
            start_min: action.start,
            end_min: action.end,
            status: 'planned',
          },
        ],
      }
    case 'move':
      return {
        ...store,
        blocks: store.blocks.map((b) =>
          b.id === action.id
            ? { ...b, start_min: action.start_min, end_min: action.end_min }
            : b,
        ),
        // 리사이즈 → 분 갱신 미러 (이동은 duration 보존이라 사실상 no-op)
        tasks: store.tasks.map((t) => {
          const target = store.blocks.find((b) => b.id === action.id)
          return target && t.id === target.task_id
            ? { ...t, est_min: action.end_min - action.start_min }
            : t
        }),
      }
    case 'status':
      return {
        ...store,
        blocks: store.blocks.map((b) =>
          b.id === action.id ? { ...b, status: action.status } : b,
        ),
      }
    case 'deleteBlock':
      return {
        ...store,
        blocks: store.blocks.filter((b) => b.id !== action.id),
      }
    case 'carry': {
      // 서버 carryTaskToDate 미러 — 오늘로 이동 + is_top3 리셋
      const task = store.carryTasks.find((t) => t.id === action.id)
      return {
        ...store,
        carryTasks: store.carryTasks.filter((t) => t.id !== action.id),
        tasks: task
          ? [...store.tasks, { ...task, is_top3: false }]
          : store.tasks,
      }
    }
    case 'carryDelete':
      return {
        ...store,
        carryTasks: store.carryTasks.filter((t) => t.id !== action.id),
      }
  }
}

// 낙관 상태(계획·블록·이월)를 한 곳에서 소유한다 — 좌측 카드와 우측 그리드가 같은
// 낙관 tasks에서 파생되어 색·분·삭제가 양쪽에 동시에 반영된다.
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
  blocks: RawBlock[]
  carryTasks: PlanTask[]
}) {
  const [mode, setMode] = useState<'plan' | 'record'>('plan')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const base = useMemo<Store>(
    () => ({ tasks, blocks, carryTasks }),
    [tasks, blocks, carryTasks],
  )
  const [store, apply] = useOptimistic(base, reduce)

  // 블록 뷰 파생 — 제목·카테고리를 낙관 tasks에서 조인 (정규화: blocks에는 없다)
  const taskById = new Map(store.tasks.map((t) => [t.id, t]))
  const blockViews: BlockView[] = store.blocks.map((b) => {
    const task = taskById.get(b.task_id)
    return {
      ...b,
      title: task?.title ?? '(삭제된 항목)',
      category: task?.category ?? null,
    }
  })

  // refresh 후 선택 블록이 사라졌으면(삭제 등) 선택 해제
  const selectedBlock = blockViews.find((b) => b.id === selectedId) ?? null

  // 공통 실행 패턴: 낙관 반영 → 서버 호출 → 실패 시 에러 (refresh가 rebase로 정정)
  function run(
    action: StoreAction,
    serverCall: () => Promise<{ error: string } | undefined>,
  ) {
    startTransition(async () => {
      setError(null)
      apply(action)
      const result = await serverCall()
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  // ── 블록 조작 (temp- 블록은 서버 id가 없어 조작 불가 — refresh 후 가능)

  function handleSelect(id: string) {
    if (id.startsWith('temp-')) {
      return
    }
    setSelectedId(id)
    // 편집 카드는 저녁 기록 패널에 있다 — 계획 모드에서 선택하면 전환해 연동을 유지 (Task 007)
    setMode('record')
  }

  function handleCommitMove(id: string, startMin: number, endMin: number) {
    if (id.startsWith('temp-')) {
      return
    }
    // 겹침 검사는 낙관 배열 기준(자기 자신 제외) — in-flight 이동을 반영한다
    const conflict = store.blocks.some(
      (b) => b.id !== id && overlaps(startMin, endMin, b.start_min, b.end_min),
    )
    if (conflict) {
      setError('해당 시간대에 이미 다른 블록이 있습니다.')
      return
    }
    run({ type: 'move', id, start_min: startMin, end_min: endMin }, () =>
      moveBlock(id, startMin, endMin),
    )
  }

  function handleStatus(id: string, status: BlockStatus) {
    run({ type: 'status', id, status }, () => setBlockStatus(id, status))
  }

  function handleDeleteBlock(id: string) {
    if (id.startsWith('temp-')) {
      return
    }
    run({ type: 'deleteBlock', id }, () => deleteBlock(id))
  }

  // ── 계획 조작 (좌측 패널 콜백)

  // form action(자동 transition) 안에서 호출됨 — 별도 startTransition 불필요
  async function handleAdd(title: string) {
    setError(null)
    apply({ type: 'add', tempId: `temp-${crypto.randomUUID()}`, title })
    const result = await addTask(title, date)
    if (result?.error) {
      setError(result.error)
    }
  }

  function handleDelete(id: string) {
    run({ type: 'delete', id }, () => deleteTask(id))
  }

  function handleToggleTop3(task: PlanTask, next: boolean) {
    run({ type: 'toggleTop3', id: task.id, value: next }, () =>
      toggleTop3(task.id, next),
    )
  }

  function handleSwap(demoteId: string, promoteId: string) {
    run({ type: 'swap', demoteId, promoteId }, () =>
      swapTop3(demoteId, promoteId),
    )
  }

  function handleEstMin(id: string, value: number | null) {
    // 배치된 블록이 있으면 서버 검증(겹침·범위)을 클라이언트에서 선검사 — 즉시 에러, 서버 호출 생략
    if (value !== null) {
      const taskBlocks = store.blocks.filter((b) => b.task_id === id)
      for (const b of taskBlocks) {
        const newEnd = b.start_min + value
        if (newEnd > GRID_END_MIN) {
          setError('그리드 범위(24:00)를 넘어 소요시간을 변경할 수 없습니다.')
          return
        }
        const conflict = store.blocks.some(
          (o) =>
            o.id !== b.id && overlaps(b.start_min, newEnd, o.start_min, o.end_min),
        )
        if (conflict) {
          setError(
            '겹치는 블록이 있어 소요시간을 변경할 수 없습니다. 블록을 먼저 옮겨 주세요.',
          )
          return
        }
      }
    }
    run({ type: 'estMin', id, value }, () => setEstMin(id, value))
  }

  function handleCategory(id: string, value: CategoryKey) {
    run({ type: 'category', id, value }, () => setCategory(id, value))
  }

  // 배치 — 서버와 같은 findNextFreeSlot으로 낙관 미리보기 (정상 흐름에서 슬롯 동일).
  // 일반 task는 소요시간 미지정이어도 기본 30분 (서버 규칙 미러)
  function handlePlace(task: PlanTask) {
    if (task.is_top3 && task.est_min === null) {
      setError('소요시간을 먼저 입력해 주세요.')
      return
    }
    const estMin = task.est_min ?? DEFAULT_PLACE_MIN
    const fromMin = isToday ? nowMinutesInSeoul() : GRID_START_MIN
    const slot = findNextFreeSlot(store.blocks, estMin, fromMin)
    if (slot === null) {
      setError('그리드에 빈 자리가 없습니다.')
      return
    }
    run(
      {
        type: 'place',
        task,
        tempId: `temp-${crypto.randomUUID()}`,
        start: slot.start,
        end: slot.end,
      },
      () => placeBlock(task.id),
    )
  }

  function handleCarry(id: string) {
    run({ type: 'carry', id }, () => carryTaskToDate(id, date))
  }

  function handleCarryDelete(id: string) {
    run({ type: 'carryDelete', id }, () => deleteTask(id))
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
            <PlanPanel
              tasks={store.tasks}
              carryTasks={store.carryTasks}
              error={error}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onToggleTop3={handleToggleTop3}
              onSwap={handleSwap}
              onEstMin={handleEstMin}
              onCategory={handleCategory}
              onPlace={handlePlace}
              onCarry={handleCarry}
              onCarryDelete={handleCarryDelete}
            />
          ) : (
            <RecordPanel
              tasks={store.tasks}
              blocks={blockViews}
              selectedBlock={selectedBlock}
              onStatus={handleStatus}
              onDelete={handleDeleteBlock}
            />
          )}
        </div>
        <div className="border-l border-divider pl-6">
          <TimeGrid
            blocks={blockViews}
            selectedId={selectedBlock?.id ?? null}
            isToday={isToday}
            error={error}
            onSelect={handleSelect}
            onCommitMove={handleCommitMove}
            onDelete={handleDeleteBlock}
          />
        </div>
      </div>
    </>
  )
}
