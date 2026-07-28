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

export function Top3Panel({
  topTasks,
  onDemote,
  onEstMin,
  onCategory,
  onPlace,
}: {
  topTasks: PlanTask[]
  onDemote: (task: PlanTask) => void
  onEstMin: (id: string, value: number | null) => void
  onCategory: (id: string, value: CategoryKey) => void
  onPlace: (task: PlanTask) => void
}) {
  function handleEstMinCommit(task: PlanTask, raw: string) {
    if (raw.trim() === '') {
      if (task.est_min !== null) {
        onEstMin(task.id, null)
      }
      return
    }
    const value = Number(raw)
    if (!Number.isInteger(value) || value < 5 || value > 1440) {
      return
    }
    if (value !== task.est_min) {
      onEstMin(task.id, value)
    }
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
          return (
            <li
              key={task.id}
              className="top3-card"
              data-cat={task.category ?? undefined}
            >
              {/* 카드 본문 클릭 = 다음 빈 슬롯 자동 배치 (PRD 7.1 #4) */}
              <button
                type="button"
                onClick={() => onPlace(task)}
                title="클릭하면 다음 빈 슬롯에 배치"
                className="flex-1 min-w-0 text-left cursor-pointer"
              >
                <div className="top3-kicker">
                  {String(index + 1).padStart(2, '0')}
                  {label !== null ? ` · ${label}` : ''}
                </div>
                <div className="text-[16px] font-semibold truncate">
                  {task.title}
                </div>
              </button>

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

              <label className="tag-tint">
                <input
                  key={`${task.id}-${task.est_min}`}
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  defaultValue={task.est_min ?? ''}
                  aria-label={`${task.title} 소요시간(분)`}
                  onBlur={(e) => handleEstMinCommit(task, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    }
                  }}
                />
                분
              </label>

              <button
                type="button"
                onClick={() => onDemote(task)}
                className="top3-tool text-[12px] text-text/50 hover:text-accent-2 shrink-0"
              >
                내리기
              </button>
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
