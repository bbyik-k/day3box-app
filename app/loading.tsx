// 날짜 이동 등 서버 렌더 중 즉시 전환 피드백 — 무반응(이전 화면 정지)이 체감 지연을 키운다.
// 최소 구성만: 콜드 스타트(1인 도구라 아침 첫 방문은 항상 콜드)에서 특히 유효
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-6">
      <header className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold tracking-[0.02em]">
          day3box
        </span>
      </header>
      <div aria-hidden="true" className="mt-2 h-[3px] bg-text" />
      <p className="mt-8 text-[14px] text-text/50">불러오는 중…</p>
    </main>
  )
}
