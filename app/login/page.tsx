import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { login } from '@/app/auth/actions'

// 로그인 화면 — 스타일은 최소 마크업 (Broadsheet 토큰 이식은 Task 002 범위)
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  const { sent, error } = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">day3box</h1>

      {sent === '1' ? (
        <p>
          로그인 링크를 이메일로 보냈습니다. 메일함을 확인해 주세요.
        </p>
      ) : (
        <form action={login} className="flex flex-col gap-3 w-full max-w-xs">
          <label htmlFor="email">이메일로 로그인</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="border px-3 py-2"
          />
          <button type="submit" className="border px-3 py-2">
            매직링크 받기
          </button>
        </form>
      )}

      {error === 'auth' && (
        <p>링크가 만료되었거나 잘못되었습니다. 다시 시도해 주세요.</p>
      )}
      {error === 'send' && (
        <p>메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
      )}
      {error === 'invalid' && <p>올바른 이메일을 입력해 주세요.</p>}
    </main>
  )
}
