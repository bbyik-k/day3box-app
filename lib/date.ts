// 날짜 기준은 Asia/Seoul 고정 — 배포 환경(UTC)에서도 사용자의 "오늘"과 일치해야 한다
export function todayInSeoul(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(
    new Date(),
  )
}
