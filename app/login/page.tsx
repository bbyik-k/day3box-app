import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from '@/app/auth/actions'

// 로그인 화면 — 스타일은 최소 마크업 (Broadsheet 마감은 이후 Task에서)
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">day3box</h1>

      <form action={login} className="flex flex-col gap-3 w-full max-w-xs">
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="border border-divider bg-surface px-3 py-2 rounded-sm"
        />
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="border border-divider bg-surface px-3 py-2 rounded-sm"
        />
        <button
          type="submit"
          className="border border-text px-3 py-2 rounded-sm hover:bg-text hover:text-bg"
        >
          로그인
        </button>
      </form>

      {error === 'auth' && (
        <p role="alert" className="text-[13px] text-accent-2">
          이메일 또는 비밀번호가 올바르지 않습니다.
        </p>
      )}
      {error === 'invalid' && (
        <p role="alert" className="text-[13px] text-accent-2">
          이메일과 비밀번호를 입력해 주세요.
        </p>
      )}
    </main>
  )
}
