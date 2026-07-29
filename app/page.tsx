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

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, is_top3, est_min, category')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  // block 조회는 비정규화된 blocks.date로 조인 없이 — 제목·카테고리는 task에서 읽는다
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, task_id, start_min, end_min, status')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('start_min', { ascending: true })

  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]))
  const blockViews = (blocks ?? []).map((b) => {
    const task = taskById.get(b.task_id)
    return {
      id: b.id,
      task_id: b.task_id,
      start_min: b.start_min,
      end_min: b.end_min,
      status: b.status,
      title: task?.title ?? '(삭제된 항목)',
      category: task?.category ?? null,
    }
  })

  // 미배치 task 이월 노출(길 B) — 보고 있는 날짜의 전날에서 배치되지 않은 task만.
  // PostgREST에 NOT EXISTS가 없어 전날 tasks + 전날 blocks의 task_id 두 쿼리 후 필터
  const prevDate = shiftDate(date, -1)
  const { data: prevTasks } = await supabase
    .from('tasks')
    .select('id, title, is_top3, est_min, category')
    .eq('user_id', user.id)
    .eq('date', prevDate)
    .order('created_at', { ascending: true })
  const { data: prevBlocks } = await supabase
    .from('blocks')
    .select('task_id')
    .eq('user_id', user.id)
    .eq('date', prevDate)
  const placedIds = new Set((prevBlocks ?? []).map((b) => b.task_id))
  const carryTasks = (prevTasks ?? []).filter((t) => !placedIds.has(t.id))

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-6">
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
        blocks={blockViews}
        carryTasks={carryTasks}
      />
    </main>
  )
}
