'use client'

import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  addTask,
  carryTaskToDate,
  createFixedBlock,
  deleteBlock,
  deleteTask,
  moveBlock,
  placeBlock,
  renameTask,
  setBlockStatus,
  setCategory,
  setEstMin,
  swapTop3,
  toggleTop3,
} from '@/app/tasks/actions'
import { nowMinutesInSeoul, shiftDate } from '@/lib/date'
import {
  DRAG_THRESHOLD_PX,
  GRID_END_MIN,
  GRID_START_MIN,
  PX_PER_HOUR,
  SNAP_MIN,
  findAfterLastSlot,
  findNextFreeSlot,
  minToY,
  overlaps,
  roundToSnap,
} from '@/lib/grid'
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
  | { type: 'rename'; id: string; title: string }
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
            kind: 'task',
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
    case 'rename':
      // 제목은 tasks에만 — 블록 제목은 파생이라 자동 갱신 (D14-4, ADR-0001)
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.id ? { ...t, title: action.title } : t,
        ),
      }
    case 'estMin':
      // 비동기화(ADR-0002) — est는 계획 총량, 블록은 건드리지 않는다
      return {
        ...store,
        tasks: store.tasks.map((t) =>
          t.id === action.id ? { ...t, est_min: action.value } : t,
        ),
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
      // 비동기화(ADR-0002) — 리사이즈는 est_min을 갱신하지 않는다
      return {
        ...store,
        blocks: store.blocks.map((b) =>
          b.id === action.id
            ? { ...b, start_min: action.start_min, end_min: action.end_min }
            : b,
        ),
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
  // 리스트→그리드 드래그 배치(D9) — 그리드 좌표 판정·자동 스크롤을 위해 ref를 여기서 소유
  const gridScrollRef = useRef<HTMLDivElement>(null)
  const gridInnerRef = useRef<HTMLDivElement>(null)
  const [listPreview, setListPreview] = useState<{
    start: number
    end: number
    invalid: boolean
  } | null>(null)
  // 커서 추종 프리뷰 (D11) — "지금 무엇을 잡고 있는가". 위치는 리렌더 없이 ref로 직접 갱신
  const [dragging, setDragging] = useState<{
    title: string
    duration: number
  } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const base = useMemo<Store>(
    () => ({ tasks, blocks, carryTasks }),
    [tasks, blocks, carryTasks],
  )
  const [store, apply] = useOptimistic(base, reduce)

  // 블록 뷰 파생 — 제목·카테고리를 낙관 tasks에서 조인 (정규화: blocks에는 없다)
  // + 분할 표기(D4): 같은 task의 블록이 여럿이면 시간순 n/N
  const taskById = new Map(store.tasks.map((t) => [t.id, t]))
  const siblingsByTask = new Map<string, RawBlock[]>()
  for (const b of store.blocks) {
    const arr = siblingsByTask.get(b.task_id)
    if (arr) {
      arr.push(b)
    } else {
      siblingsByTask.set(b.task_id, [b])
    }
  }
  for (const arr of siblingsByTask.values()) {
    arr.sort((a, b) => a.start_min - b.start_min)
  }
  const blockViews: BlockView[] = store.blocks.map((b) => {
    const task = taskById.get(b.task_id)
    const siblings = siblingsByTask.get(b.task_id)
    const part =
      siblings !== undefined && siblings.length > 1
        ? { index: siblings.indexOf(b) + 1, total: siblings.length }
        : null
    return {
      ...b,
      title: task?.title ?? '(삭제된 항목)',
      // 색은 TOP3에만 (관통 규칙 1) — 강등되면 막대가 즉시 회색이 된다
      category:
        task !== undefined && task.is_top3 ? task.category : null,
      kind: task?.kind ?? 'task',
      part,
    }
  })

  // 좌측(계획·기록)은 할 일만 — 고정 시간(fixed)은 그리드에만 존재한다 (D2)
  const planTasks = store.tasks.filter((t) => t.kind === 'task')

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

  // 제목 인라인 편집 (D14) — 리스트·블록 공용. 빈 값 원복은 각 입력 UI가 담당
  function handleRename(id: string, title: string) {
    const trimmed = title.trim()
    if (trimmed === '') {
      return
    }
    run({ type: 'rename', id, title: trimmed }, () => renameTask(id, trimmed))
  }

  function handleEstMin(id: string, value: number | null) {
    // 비동기화(ADR-0002) — 블록과 무관하게 계획 총량만 갱신, 선검사 불필요
    run({ type: 'estMin', id, value }, () => setEstMin(id, value))
  }

  function handleCategory(id: string, value: CategoryKey) {
    run({ type: 'category', id, value }, () => setCategory(id, value))
  }

  // 배치 — 서버와 같은 findNextFreeSlot으로 낙관 미리보기 (정상 흐름에서 슬롯 동일).
  // 블록 분할(D4): 배치 클릭 = 미배치 잔량(est − 배치 합)을 다음 빈 슬롯에.
  // 일반 task는 소요시간 미지정이어도 기본 30분 (서버 규칙 미러)
  function handlePlace(task: PlanTask) {
    if (task.is_top3 && task.est_min === null) {
      setError('소요시간을 먼저 입력해 주세요.')
      return
    }
    let estMin = task.est_min ?? DEFAULT_PLACE_MIN
    if (task.est_min !== null) {
      const placedSum = store.blocks
        .filter((b) => b.task_id === task.id)
        .reduce((sum, b) => sum + (b.end_min - b.start_min), 0)
      estMin = task.est_min - placedSum
      if (estMin <= 0) {
        setError('계획한 시간이 모두 배치되어 있습니다. 소요시간을 늘리거나 블록을 조정해 주세요.')
        return
      }
    }
    // 클릭 배치 = 마지막 블록 뒤 (D13 — 예측 가능). 안 들어가면 빈 슬롯 폴백
    let slot = findAfterLastSlot(store.blocks, estMin)
    let fellBack = false
    if (slot === null) {
      const fromMin = isToday ? nowMinutesInSeoul() : GRID_START_MIN
      slot = findNextFreeSlot(store.blocks, estMin, fromMin)
      // 마지막 블록이 있었는데 뒤에 못 넣은 경우만 "예측이 깨진" 경우다
      fellBack = store.blocks.length > 0
    }
    if (slot === null) {
      setError('그리드에 빈 자리가 없습니다.')
      return
    }
    if (fellBack) {
      // 예측이 깨진 유일한 경우 — 어디에 놓였는지 보여준다 (D13 예외 지시)
      const scroll = gridScrollRef.current
      if (scroll) {
        scroll.scrollTop = minToY(slot.start) - scroll.clientHeight / 2
      }
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

  // 고정 시간 드래그 생성(D1) — 이름 입력 단계가 있어 낙관 없이 refresh 결과 대기 (handoff §6)
  function handleCreateFixed(startMin: number, endMin: number, title: string) {
    startTransition(async () => {
      setError(null)
      const result = await createFixedBlock(title, date, startMin, endMin)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  // 리스트→그리드 드래그 배치(D9): 손잡이 pointerdown → window 추적 → 드롭 지점이 시작 시각.
  // 무이동(4px 미만)이면 클릭 = 다음 빈 슬롯 배치. 잔량 규칙은 클릭 배치와 동일 —
  // 전량 배치된 행은 드래그를 시작하지 않는다 (이동은 그리드에서 직접, 2026-08-01 오너 확정)
  function handleListDragStart(task: PlanTask, e: React.PointerEvent) {
    // 잔량·소요시간 검사는 드래그 확정(임계 통과) 시점에 — pointerdown만으로 에러를
    // 띄우면 행/카드 안 모든 클릭(칩·배지 등)에 에러가 번쩍인다 (Task 015 E2E에서 발견)
    const placedSum = store.blocks
      .filter((b) => b.task_id === task.id)
      .reduce((sum, b) => sum + (b.end_min - b.start_min), 0)
    const duration =
      task.est_min !== null ? task.est_min - placedSum : DEFAULT_PLACE_MIN
    const blockReason =
      task.is_top3 && task.est_min === null
        ? '소요시간을 먼저 입력해 주세요.'
        : duration <= 0 || (task.est_min === null && placedSum > 0)
          ? '계획한 시간이 모두 배치되어 있습니다. 소요시간을 늘리거나 블록을 조정해 주세요.'
          : null
    const startX = e.clientX
    const startY = e.clientY
    const blocksSnapshot = store.blocks
    let moved = false
    let currentMin: number | null = null

    const computeInvalid = (start: number) => {
      const end = start + duration
      return (
        end > GRID_END_MIN ||
        blocksSnapshot.some((b) => overlaps(start, end, b.start_min, b.end_min))
      )
    }

    const onMove = (ev: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX
      ) {
        return
      }
      if (!moved) {
        moved = true
        // 드래그 불가 상태(잔량 0 등)면 여기서야 에러를 알리고 종료
        if (blockReason !== null) {
          setError(blockReason)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          return
        }
        // 임계 통과 = 드래그 시작 — 커서 추종 프리뷰 표시 (D11)
        setDragging({ title: task.title, duration })
      }
      // 프리뷰는 리렌더 없이 커서를 따라간다 (리스트 위든 그리드 위든 항상)
      const preview = previewRef.current
      if (preview) {
        preview.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`
      }
      const inner = gridInnerRef.current
      const scroll = gridScrollRef.current
      if (!inner || !scroll) {
        return
      }
      const sr = scroll.getBoundingClientRect()
      const overGrid =
        ev.clientX >= sr.left &&
        ev.clientX <= sr.right &&
        ev.clientY >= sr.top &&
        ev.clientY <= sr.bottom
      if (!overGrid) {
        currentMin = null
        setListPreview(null)
        return
      }
      // 가장자리 자동 스크롤 — 화면 밖 시간대에도 놓을 수 있다
      if (ev.clientY < sr.top + 48) {
        scroll.scrollTop -= 12
      } else if (ev.clientY > sr.bottom - 48) {
        scroll.scrollTop += 12
      }
      const rect = inner.getBoundingClientRect()
      const raw =
        GRID_START_MIN + ((ev.clientY - rect.top) / PX_PER_HOUR) * 60
      const min = Math.min(
        Math.max(roundToSnap(raw), GRID_START_MIN),
        GRID_END_MIN - SNAP_MIN,
      )
      currentMin = min
      setListPreview({
        start: min,
        end: Math.min(min + duration, GRID_END_MIN),
        invalid: computeInvalid(min),
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setListPreview(null)
      setDragging(null)
      if (!moved) {
        // 무이동 = 클릭 — 각 요소의 onClick이 담당한다 (행 전체 드래그와 클릭 대상 공존, D14-2)
        return
      }
      // 드래그 후 남는 유령 클릭 한 번을 캡처 단계에서 삼킨다
      window.addEventListener(
        'click',
        (ce) => {
          ce.stopPropagation()
          ce.preventDefault()
        },
        { capture: true, once: true },
      )
      if (currentMin === null || computeInvalid(currentMin)) {
        return
      }
      run(
        {
          type: 'place',
          task,
          tempId: `temp-${crypto.randomUUID()}`,
          start: currentMin,
          end: currentMin + duration,
        },
        () => placeBlock(task.id, currentMin ?? undefined),
      )
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
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
              tasks={planTasks}
              blocks={store.blocks}
              carryTasks={store.carryTasks}
              error={error}
              onAdd={handleAdd}
              onDelete={handleDelete}
              onToggleTop3={handleToggleTop3}
              onSwap={handleSwap}
              onEstMin={handleEstMin}
              onCategory={handleCategory}
              onPlace={handlePlace}
              onRename={handleRename}
              onDragStart={handleListDragStart}
              onCarry={handleCarry}
              onCarryDelete={handleCarryDelete}
            />
          ) : (
            <RecordPanel
              tasks={planTasks}
              blocks={blockViews}
              selectedBlock={selectedBlock}
              onStatus={handleStatus}
              onDelete={handleDeleteBlock}
            />
          )}
        </div>
        {/* 커서 추종 드래그 프리뷰 (D11) — "잡았다"가 리스트·그리드 어디서든 끊기지 않는다 */}
        {dragging !== null && (
          <div ref={previewRef} className="drag-preview" data-testid="drag-preview">
            {dragging.title} · {dragging.duration}분
          </div>
        )}

        <div className="border-l border-divider pl-6">
          <TimeGrid
            blocks={blockViews}
            selectedId={selectedBlock?.id ?? null}
            isToday={isToday}
            error={error}
            scrollRef={gridScrollRef}
            innerRef={gridInnerRef}
            listPreview={listPreview}
            onSelect={handleSelect}
            onCommitMove={handleCommitMove}
            onDelete={handleDeleteBlock}
            onCreateFixed={handleCreateFixed}
            onRename={handleRename}
            onStatus={handleStatus}
          />
        </div>
      </div>
    </>
  )
}
