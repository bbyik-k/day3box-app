// 타임 그리드 좌표계 (PRD 7.1 #1: 06:00–24:00 고정, 목업: 1시간 = 42px)
// 분 ↔ y좌표가 단순 산술이 되도록 시간은 int(자정 기준 분)로만 다룬다
export const GRID_START_MIN = 6 * 60
export const GRID_END_MIN = 24 * 60
export const PX_PER_HOUR = 42

export const GRID_HOURS = (GRID_END_MIN - GRID_START_MIN) / 60
export const GRID_HEIGHT_PX = GRID_HOURS * PX_PER_HOUR

export function minToY(min: number): number {
  return ((min - GRID_START_MIN) / 60) * PX_PER_HOUR
}

// 배치·스냅은 항상 15분 단위 (PRD 7.1 #2)
export const SNAP_MIN = 15

export function ceilToSnap(min: number): number {
  return Math.ceil(min / SNAP_MIN) * SNAP_MIN
}

// [aStart, aEnd)와 [bStart, bEnd)의 겹침 판정 — 경계 접촉(end === start)은 겹침 아님
export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}
