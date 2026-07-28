import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayInSeoul } from '@/lib/date'
import { logout } from '@/app/auth/actions'
import { DayView } from '@/components/day-view'

// 실제 인증 검증 지점 — proxy의 리다이렉트는 optimistic 체크일 뿐이다
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = todayInSeoul()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, is_top3, est_min, category')
    .eq('user_id', user.id)
    .eq('date', today)
    .order('created_at', { ascending: true })

  // block 조회는 비정규화된 blocks.date로 조인 없이 — 제목·카테고리는 task에서 읽는다
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, task_id, start_min, end_min, status')
    .eq('user_id', user.id)
    .eq('date', today)
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

  const displayDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-6">
      <header className="flex items-baseline justify-between border-b border-divider pb-4">
        <h1 className="text-[42px] font-semibold leading-tight">
          {displayDate}
        </h1>
        {/* 로그아웃은 임시 위치 — 마스트헤드 내비는 Task 008에서 구성 */}
        <form action={logout}>
          <button
            type="submit"
            className="text-[13px] text-text/60 hover:text-accent"
          >
            로그아웃
          </button>
        </form>
      </header>

      <DayView tasks={tasks ?? []} blocks={blockViews} />
    </main>
  )
}
