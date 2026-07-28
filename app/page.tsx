import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/auth/actions'

// 실제 인증 검증 지점 — proxy의 리다이렉트는 optimistic 체크일 뿐이다
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">day3box</h1>
      <p>{user.email} 로 로그인됨</p>
      <form action={logout}>
        <button type="submit" className="border px-3 py-2">
          로그아웃
        </button>
      </form>
    </main>
  )
}
