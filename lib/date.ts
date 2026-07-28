// 날짜 기준은 Asia/Seoul 고정 — 배포 환경(UTC)에서도 사용자의 "오늘"과 일치해야 한다
export function todayInSeoul(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(
    new Date(),
  )
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
  return (hour % 24) * 60 + minute
}
