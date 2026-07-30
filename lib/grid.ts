// 타임 그리드 좌표계 (PRD 7.1 #1: 06:00–24:00 고정)
// 분 ↔ y좌표가 단순 산술이 되도록 시간은 int(자정 기준 분)로만 다룬다
// 1시간 = 60px (1분 = 1px) — 구 목업 42px에서 2026-07-29 시안(captures/03-edit-timebox.png)으로 변경.
// 15분 스냅이 15px 정수가 되고, 15분 블록도 텍스트 한 줄이 들어간다
export const GRID_START_MIN = 6 * 60
export const GRID_END_MIN = 24 * 60
export const PX_PER_HOUR = 60

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

export function floorToSnap(min: number): number {
  return Math.floor(min / SNAP_MIN) * SNAP_MIN
}

export function roundToSnap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN
}

// 다음 빈 슬롯 탐색 — 배치의 단일 로직 (서버 placeBlock과 클라이언트 낙관 미리보기가 공용,
// 같은 코드라 정상 흐름에서 낙관 슬롯 = 서버 확정 슬롯)
export function findNextFreeSlot(
  existing: { start_min: number; end_min: number }[],
  durationMin: number,
  fromMin: number,
): { start: number; end: number } | null {
  let start = Math.max(ceilToSnap(fromMin), GRID_START_MIN)
  while (start + durationMin <= GRID_END_MIN) {
    const end = start + durationMin
    const candidateStart = start
    if (
      !existing.some((b) =>
        overlaps(candidateStart, end, b.start_min, b.end_min),
      )
    ) {
      return { start, end }
    }
    start += SNAP_MIN
  }
  return null
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
