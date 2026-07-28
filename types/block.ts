// 블록 상태값 (PRD 4장 확정): DB는 text, 타입 안전성은 이 union으로만 보장
// `missed`는 존재하지 않는다 — 실패를 전시하지 않는다 (리텐션 방어)
export type BlockStatus = 'planned' | 'done' | 'partial' | 'moved'

export const BLOCK_STATUS_LABELS: Record<BlockStatus, string> = {
  planned: '계획됨',
  done: '완료',
  partial: '부분',
  moved: '이월',
}

export function isBlockStatus(value: string): value is BlockStatus {
  return (
    value === 'planned' ||
    value === 'done' ||
    value === 'partial' ||
    value === 'moved'
  )
}
