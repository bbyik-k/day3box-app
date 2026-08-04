import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDisplayDate, isValidDateStr, shiftDate, todayInSeoul } from '@/lib/date'
import { logout } from '@/app/auth/actions'
import { DayView } from '@/components/day-view'

// 실제 인증 검증 지점 — proxy의 리다이렉트는 optimistic 체크일 뿐이다
export default async function Home(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 날짜 컨텍스트는 URL(?date=YYYY-MM-DD) — 없거나 invalid(배열·형식 오류·2월 30일)면 오늘로 폴백
  const raw = (await props.searchParams).date
  const date =
    typeof raw === 'string' && isValidDateStr(raw) ? raw : todayInSeoul()

  // 4개 쿼리 병렬 — 순차 왕복(리전 간 지연 누적)을 1왕복으로 (2026-07-30 성능 개선)
  const prevDate = shiftDate(date, -1)
  const [
    { data: tasks },
    { data: blocks },
    { data: prevTasks },
    { data: prevBlocks },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, is_top3, est_min, category, kind')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true }),
    // block 조회는 비정규화된 blocks.date로 조인 없이 — 제목·카테고리는 task에서 읽는다
    supabase
      .from('blocks')
      .select('id, task_id, start_min, end_min, status')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('start_min', { ascending: true }),
    // 미배치 task 이월 노출(길 B) — 전날 tasks + 전날 blocks의 task_id 두 쿼리 후 필터
    // (PostgREST에 NOT EXISTS가 없다). 고정 시간(fixed)은 이월 대상이 아니다 (D2)
    supabase
      .from('tasks')
      .select('id, title, is_top3, est_min, category, kind')
      .eq('user_id', user.id)
      .eq('date', prevDate)
      .eq('kind', 'task')
      .order('created_at', { ascending: true }),
    supabase
      .from('blocks')
      .select('task_id')
      .eq('user_id', user.id)
      .eq('date', prevDate),
  ])

  // 블록의 제목·카테고리 조인은 클라이언트(DayView)에서 낙관 tasks 기준으로 파생 —
  // 색·분·삭제가 카드와 그리드에 동시 반영되게 한다
  const placedIds = new Set((prevBlocks ?? []).map((b) => b.task_id))
  const carryTasks = (prevTasks ?? []).filter((t) => !placedIds.has(t.id))

  return (
    <main className="mx-auto w-full max-w-[1120px] px-3 py-6 lg:px-6">
      <header className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold tracking-[0.02em]">
          day3box
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="text-[13px] text-text/60 hover:text-accent"
          >
            로그아웃
          </button>
        </form>
      </header>
      <div aria-hidden="true" className="mt-2 h-[3px] bg-text" />

      <DayView
        key={date}
        date={date}
        isToday={date === todayInSeoul()}
        displayDate={formatDisplayDate(date)}
        tasks={tasks ?? []}
        blocks={blocks ?? []}
        carryTasks={carryTasks}
      />
    </main>
  )
}
