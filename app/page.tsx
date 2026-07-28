import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayInSeoul } from '@/lib/date'
import { logout } from '@/app/auth/actions'
import { BrainDump } from '@/components/brain-dump'

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
    .select('id, title, is_top3')
    .eq('user_id', user.id)
    .eq('date', today)
    .order('created_at', { ascending: true })

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

      <div className="grid grid-cols-[352px_1fr] gap-8 items-start pt-6">
        <BrainDump tasks={tasks ?? []} />
        {/* 우측 타임 그리드 자리 — Task 004에서 구현 */}
        <section aria-hidden="true" className="min-h-[400px] border-l border-divider" />
      </div>
    </main>
  )
}
