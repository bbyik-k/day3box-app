// 하루 경계 04:00 (2026-07-31 D9): 새벽 3시까지는 전날의 하루다 —
// 새벽에 열어도 "오늘"이 넘어가지 않고, 자정 이후 블록(00~03시)이 전날 그리드 하단에 속한다
const DAY_BOUNDARY_HOUR = 4

// 날짜 기준은 Asia/Seoul 고정 — 배포 환경(UTC)에서도 사용자의 "오늘"과 일치해야 한다
export function todayInSeoul(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  const calendarDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
  }).format(new Date())
  // 04시 이전이면 아직 전날의 하루
  return rawHourInSeoul() < DAY_BOUNDARY_HOUR
    ? shiftDate(calendarDate, -1)
    : calendarDate
}

function rawHourInSeoul(): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hour12: false,
  }).format(new Date())
  return Number(hour) % 24
}

// YYYY-MM-DD 형식 + 실존 날짜 검증 — URL 파라미터는 신뢰할 수 없다 (2월 30일 등 거부)
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false
  }
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

// 날짜 문자열 ±N일 — 순수 달력 연산이라 UTC 산술이면 타임존 무관
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

// "7월 29일 화요일" — UTC 자정 생성 + UTC 포맷 조합이라 서버 타임존과 무관하게 요일이 정확
export function formatDisplayDate(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(`${date}T00:00:00Z`))
}

// 현재 시각을 자정 기준 분으로 (Asia/Seoul 고정 — 그리드 "지금" 라인용)
export function nowMinutesInSeoul(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'hour') {
      hour = Number(part.value)
    }
    if (part.type === 'minute') {
      minute = Number(part.value)
    }
  }
  // en-GB의 hour12:false는 자정을 24로 반환할 수 있다 — 자정 기준 분이므로 0으로 정규화
  const min = (hour % 24) * 60 + minute
  // 하루 경계 04시: 새벽(00~03시)은 전날 그리드의 하단 구간(1440~1620분)이다
  return min < DAY_BOUNDARY_HOUR * 60 ? min + 24 * 60 : min
}
