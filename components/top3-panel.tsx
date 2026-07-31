'use client'

import { CATEGORY_KEYS, categoryLabel } from '@/lib/category'
import type { CategoryKey } from '@/lib/category'
import type { PlanTask } from '@/components/plan-panel'

const SWATCH_CLASSES: Record<CategoryKey, string> = {
  cat1: 'bg-cat1',
  cat2: 'bg-cat2',
  cat3: 'bg-cat3',
  cat4: 'bg-cat4',
  cat5: 'bg-cat5',
}

const TOP3_LIMIT = 3

// 프리셋 5개 고정 — 240·300은 추가하지 않는다 (블록 분할과 충돌·척도 흐림, DECISION-BRIEF-003 D6 보충)
const EST_PRESETS = [30, 60, 90, 120, 180]
const EST_STEP = 10
const EST_MAX = 1440

// 배치량 메타 문구 — 미결 데이터 정의 확정 전 잠정이라 상수(함수)로 분리 (handoff §5)
function placementLabel(est: number | null, placed: number): string | null {
  if (placed === 0) {
    return est !== null ? '미배치' : null
  }
  if (est === null || placed >= est) {
    return `${placed}분 배치됨`
  }
  return `총 ${est}분 중 ${placed}분 배치됨`
}

export function Top3Panel({
  topTasks,
  blocks,
  onDemote,
  onEstMin,
  onCategory,
  onPlace,
}: {
  topTasks: PlanTask[]
  blocks: { task_id: string; start_min: number; end_min: number }[]
  onDemote: (task: PlanTask) => void
  onEstMin: (id: string, value: number | null) => void
  onCategory: (id: string, value: CategoryKey) => void
  onPlace: (task: PlanTask) => void
}) {
  // ±10 스테퍼 — 보조 수단 (프리셋 밖 값은 칩이 안 채워지고 상단 숫자만 바뀐다)
  function handleStep(task: PlanTask, delta: number) {
    const next = (task.est_min ?? 0) + delta
    if (next < EST_STEP || next > EST_MAX) {
      return
    }
    onEstMin(task.id, next)
  }

  const emptySlots = TOP3_LIMIT - topTasks.length

  return (
    <section>
      <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
        TOP 3 — 오늘 진짜 중요한 셋
      </h6>
      <p className="text-[13px] text-text/60 mt-1">
        각각 소요시간을 정하면 블록 높이가 된다.
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {topTasks.map((task, index) => {
          const label = categoryLabel(task.category)
          const placed = blocks
            .filter((b) => b.task_id === task.id)
            .reduce((sum, b) => sum + (b.end_min - b.start_min), 0)
          const placement = placementLabel(task.est_min, placed)
          return (
            <li
              key={task.id}
              className="top3-card"
              data-cat={task.category ?? undefined}
            >
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                {/* 헤더 행: 슬롯 라벨 + hover 도구 + 우측 상단 현재 소요시간 */}
                <div className="flex items-center gap-2">
                  <div className="top3-kicker flex-1 min-w-0">
                    {String(index + 1).padStart(2, '0')}
                    {label !== null ? ` · ${label}` : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    {CATEGORY_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={`카테고리 ${categoryLabel(key)}`}
                        aria-pressed={task.category === key}
                        onClick={() => onCategory(task.id, key)}
                        className={`top3-tool size-[9px] rounded-full ${SWATCH_CLASSES[key]} ${
                          task.category === key
                            ? 'ring-1 ring-text ring-offset-1'
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDemote(task)}
                    className="top3-tool text-[12px] text-text/50 hover:text-accent-2 shrink-0"
                  >
                    내리기
                  </button>
                  <span
                    className="shrink-0 text-[13px] font-semibold"
                    data-testid={`est-display-${task.id}`}
                  >
                    {task.est_min !== null ? `${task.est_min}분` : '—'}
                  </span>
                </div>

                {/* 제목 클릭 = 다음 빈 슬롯 자동 배치 (PRD 7.1 #4) */}
                <button
                  type="button"
                  onClick={() => onPlace(task)}
                  title="클릭하면 미배치 잔량을 다음 빈 슬롯에 배치"
                  className="min-w-0 text-left cursor-pointer"
                >
                  <div className="text-[16px] font-semibold truncate">
                    {task.title}
                  </div>
                  {placement !== null && (
                    <div
                      className="mt-px text-[11px] text-text/50"
                      data-testid={`placement-${task.id}`}
                    >
                      {placement}
                    </div>
                  )}
                </button>

                {/* 프리셋 칩 한 줄 5개 — 자유 입력 없음 (D6: 소요시간은 계측이 아니라 어림) */}
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label={`${task.title} 소요시간 프리셋`}
                >
                  {EST_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-pressed={task.est_min === preset}
                      onClick={() => onEstMin(task.id, preset)}
                      className={`chip ${task.est_min === preset ? 'chip-on' : ''}`}
                    >
                      {preset}분
                    </button>
                  ))}
                </div>

                {/* ±10 스테퍼 — 보조 (90과 120 사이가 필요할 때만) */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`${task.title} 소요시간 10분 줄이기`}
                    onClick={() => handleStep(task, -EST_STEP)}
                    className="stp"
                  >
                    −10
                  </button>
                  <button
                    type="button"
                    aria-label={`${task.title} 소요시간 10분 늘리기`}
                    onClick={() => handleStep(task, EST_STEP)}
                    className="stp"
                  >
                    +10
                  </button>
                </div>
              </div>
            </li>
          )
        })}

        {Array.from({ length: emptySlots }, (_, i) => (
          <li
            key={`empty-${i}`}
            className="flex items-center justify-center p-2 border border-dashed border-divider rounded-[4px] text-[13px] text-text/45"
          >
            비어 있음 · 쏟아내기에서 올린다
          </li>
        ))}

        {emptySlots === 0 && (
          <li className="flex items-center justify-center p-2 border border-dashed border-divider rounded-[4px] text-[13px] text-text/45">
            3개 채움 · 4번째는 하나를 내려야 올라온다
          </li>
        )}
      </ul>
    </section>
  )
}
