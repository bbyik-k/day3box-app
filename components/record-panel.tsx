'use client'

import { BLOCK_STATUS_LABELS, isBlockStatus } from '@/types/block'
import type { BlockStatus } from '@/types/block'
import type { PlanTask } from '@/components/plan-panel'
import type { BlockView } from '@/components/time-grid'

const STATUS_ORDER: BlockStatus[] = ['planned', 'done', 'partial', 'moved']

function formatMin(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0')
  const m = String(min % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function RecordPanel({
  tasks,
  blocks,
  selectedBlock,
  onStatus,
  onDelete,
}: {
  tasks: PlanTask[]
  blocks: BlockView[]
  selectedBlock: BlockView | null
  onStatus: (id: string, status: BlockStatus) => void
  onDelete: (id: string) => void
}) {
  const doneCount = blocks.filter((b) => b.status === 'done').length
  const partialCount = blocks.filter((b) => b.status === 'partial').length
  const movedCount = blocks.filter((b) => b.status === 'moved').length

  const topTasks = tasks.filter((t) => t.is_top3)

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          오늘의 기록
        </h6>
        <div className="mt-2 flex gap-6" data-testid="record-summary">
          <div>
            <div className="text-[34px] font-semibold leading-none text-accent">
              {doneCount}
            </div>
            <div className="text-[12px] text-text/60 mt-1">완료</div>
          </div>
          <div>
            <div className="text-[34px] font-semibold leading-none text-accent-2">
              {partialCount}
            </div>
            <div className="text-[12px] text-text/60 mt-1">부분</div>
          </div>
          <div>
            <div className="text-[34px] font-semibold leading-none text-cat4">
              {movedCount}
            </div>
            <div className="text-[12px] text-text/60 mt-1">이월</div>
          </div>
        </div>
      </div>

      {topTasks.length > 0 && (
        <div>
          <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
            TOP 3 결과
          </h6>
          <ul className="mt-2 flex flex-col gap-1">
            {topTasks.map((task) => {
              // v0은 task:블록 사실상 1:1 — 첫 블록의 상태를 대표로 쓴다
              const firstBlock = blocks.find((b) => b.task_id === task.id)
              const status =
                firstBlock !== undefined && isBlockStatus(firstBlock.status)
                  ? firstBlock.status
                  : null
              return (
                <li key={task.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-[9px] shrink-0 rounded-full"
                    data-cat={task.category ?? undefined}
                    style={{ background: 'var(--cat, var(--color-divider))' }}
                  />
                  <span className="flex-1 truncate">{task.title}</span>
                  {status === null ? (
                    <span className="text-[12px] text-text/45">미배치</span>
                  ) : status === 'done' ? (
                    <span className="tag-done">{BLOCK_STATUS_LABELS.done}</span>
                  ) : status === 'partial' ? (
                    <span className="tag-partial">
                      {BLOCK_STATUS_LABELS.partial}
                    </span>
                  ) : (
                    <span className="text-[12px] text-text/60">
                      {BLOCK_STATUS_LABELS[status]}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div>
        <h6 className="text-[13px] font-semibold uppercase tracking-[0.08em]">
          상태 기록
        </h6>
        {selectedBlock === null ? (
          <p className="mt-2 text-[12px] text-text/50">
            블록을 누르면 상태를 기록할 수 있다.
          </p>
        ) : (
          <div className="record-card mt-2" data-testid="record-card">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              상태 기록 · 편집 중
            </div>
            <div className="text-[17px] font-semibold mt-1 truncate">
              {selectedBlock.title} · {formatMin(selectedBlock.start_min)}
            </div>
            <div className="seg mt-3" role="radiogroup" aria-label="블록 상태">
              {STATUS_ORDER.map((status) => (
                <label key={status} className="seg-opt relative">
                  <input
                    type="radio"
                    name="block-status"
                    value={status}
                    checked={selectedBlock.status === status}
                    onChange={() => onStatus(selectedBlock.id, status)}
                  />
                  <span>{BLOCK_STATUS_LABELS[status]}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[12px] text-text/50">
                블록을 눌러 완료 / 부분 / 이월을 기록한다.
              </p>
              {/* 중립 조작 — 실패 색 아님. task는 목록에 남고 재배치는 원클릭이라 confirm 없음 */}
              <button
                type="button"
                data-testid="block-delete"
                onClick={() => onDelete(selectedBlock.id)}
                className="shrink-0 text-[12px] text-text/50 hover:text-accent-2"
              >
                배치 취소 ×
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
