// 타임 그리드 좌표계 (PRD 7.1 #1 개정: 04:00 ~ 익일 03:00 — 2026-07-31 D9 결정)
// 분 ↔ y좌표가 단순 산술이 되도록 시간은 int(자정 기준 분)로만 다룬다.
// 1440(자정) 이후 값은 익일 새벽(00:00~03:00) — 하루 경계는 04시 (lib/date.ts)
// 1시간 = 60px (1분 = 1px, v1 사진 도입 시 90으로 전환 — 전부 이 상수에서 파생)
export const GRID_START_MIN = 4 * 60
export const GRID_END_MIN = 27 * 60
export const PX_PER_HOUR = 60

export const GRID_HOURS = (GRID_END_MIN - GRID_START_MIN) / 60
export const GRID_HEIGHT_PX = GRID_HOURS * PX_PER_HOUR

export function minToY(min: number): number {
  return ((min - GRID_START_MIN) / 60) * PX_PER_HOUR
}

// "HH:MM" 표기 — 자정 넘김(1440+)은 익일 새벽 00:00~03:00으로 표시 (D9)
export function formatMin(min: number): string {
  const normalized = min % 1440
  const h = String(Math.floor(normalized / 60)).padStart(2, '0')
  const m = String(normalized % 60).padStart(2, '0')
  return `${h}:${m}`
}

// 배치·스냅은 항상 10분 단위 (PRD 7.1 #2 개정 — D5: est_min도 10분 배수라 끝점이 항상 격자 위)
export const SNAP_MIN = 10

// 클릭과 드래그를 구분하는 이동 임계값 — 리스트 행·TOP3 카드·그리드 블록 공용 (D14-2, 구글 캘린더 방식)
// v1 모바일에서는 8~10px 상향 검토
export const DRAG_THRESHOLD_PX = 5

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

// 클릭 배치의 1순위 슬롯: 마지막 블록 직후 (D13 — 예측 가능성이 유일하고 충분한 근거).
// max end 뒤라 겹침이 불가능해 범위 검사만 한다. 블록이 없거나 안 들어가면 null → 빈 슬롯 탐색 폴백
export function findAfterLastSlot(
  existing: { start_min: number; end_min: number }[],
  durationMin: number,
): { start: number; end: number } | null {
  if (existing.length === 0) {
    return null
  }
  const lastEnd = Math.max(...existing.map((b) => b.end_min))
  return lastEnd + durationMin <= GRID_END_MIN
    ? { start: lastEnd, end: lastEnd + durationMin }
    : null
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
