'use client'

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { moveBlock } from '@/app/tasks/actions'
import { nowMinutesInSeoul } from '@/lib/date'
import {
  GRID_END_MIN,
  GRID_HEIGHT_PX,
  GRID_HOURS,
  GRID_START_MIN,
  minToY,
  overlaps,
} from '@/lib/grid'
import { GridBlock } from '@/components/grid-block'

// 그리드 렌더용 블록 뷰 — 제목·카테고리는 task에서 조인 (정규화: blocks에는 없다)
export type BlockView = {
  id: string
  start_min: number
  end_min: number
  status: string
  title: string
  category: string | null
}

function formatMin(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

// 매분 갱신되는 현재 시각 구독 — 하루 종일 열어두는 화면이라 고정 라인은 거짓말이 된다
function subscribeMinuteTick(onStoreChange: () => void) {
  const timer = setInterval(onStoreChange, 60_000)
  return () => clearInterval(timer)
}

function serverNowSnapshot(): number | null {
  return null
}

type MoveAction = { id: string; start_min: number; end_min: number }

export function TimeGrid({ blocks }: { blocks: BlockView[] }) {
  // 서버 스냅샷은 null — 지금 라인은 클라이언트에서만 렌더돼 hydration 불일치가 없다
  const nowMin = useSyncExternalStore<number | null>(
    subscribeMinuteTick,
    nowMinutesInSeoul,
    serverNowSnapshot,
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const didAutoScroll = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticBlocks, applyOptimistic] = useOptimistic(
    blocks,
    (state: BlockView[], action: MoveAction): BlockView[] =>
      state.map((b) =>
        b.id === action.id
          ? { ...b, start_min: action.start_min, end_min: action.end_min }
          : b,
      ),
  )

  function handleCommit(id: string, startMin: number, endMin: number) {
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
      applyOptimistic({ id, start_min: startMin, end_min: endMin })
      const result = await moveBlock(id, startMin, endMin)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  // 진입 시 현재 시각으로 자동 스크롤 (PRD 7.1 #1 — 범위보다 스크롤 위치가 체감 UX를 좌우)
  useEffect(() => {
    const container = scrollRef.current
    if (
      nowMin === null ||
      didAutoScroll.current ||
      container === null ||
      nowMin < GRID_START_MIN ||
      nowMin > GRID_END_MIN
    ) {
      return
    }
    didAutoScroll.current = true
    container.scrollTop = minToY(nowMin) - container.clientHeight / 2
  }, [nowMin])

  const showNowLine =
    nowMin !== null && nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          타임박스 · 06 – 24시
        </h6>
        <div className="flex items-center gap-4 text-[12px] text-text/60">
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden="true" className="size-[9px] bg-accent" />
            완료
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span aria-hidden="true" className="size-[9px] bg-accent opacity-50" />
            부분
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <span
              aria-hidden="true"
              className="size-[9px] border border-dashed border-cat4"
            />
            이월
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" data-testid="grid-error" className="mb-2 text-[13px] text-accent-2">
          {error}
        </p>
      )}

      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[calc(100vh-240px)]"
        data-testid="grid-scroll"
      >
        <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
          {Array.from({ length: GRID_HOURS + 1 }, (_, i) => {
            const min = GRID_START_MIN + i * 60
            return (
              <div
                key={min}
                className="absolute inset-x-0 border-t border-divider"
                style={{ top: minToY(min) }}
                data-hourline={formatMin(min)}
              >
                <span className="absolute left-0 -top-2 text-[11px] tracking-[0.06em] bg-bg pr-2 text-text/55">
                  {formatMin(min)}
                </span>
              </div>
            )
          })}

          {optimisticBlocks.map((block) => (
            <GridBlock key={block.id} block={block} onCommit={handleCommit} />
          ))}

          {showNowLine && (
            <div
              className="absolute right-0 left-[44px] border-t-[1.5px] border-accent-2 z-10 pointer-events-none"
              style={{ top: minToY(nowMin) }}
              data-testid="now-line"
            >
              <span className="absolute left-3 -top-2 text-[10px] tracking-[0.04em] bg-accent-2 text-bg px-[5px] py-px">
                지금 {formatMin(nowMin)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
