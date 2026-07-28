import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// 서버(서버 컴포넌트·Server Action·Route Handler)용 클라이언트 팩토리
// Next 16: cookies()는 비동기 — 반드시 await
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다 — 세션 갱신은 proxy가 담당
          }
        },
      },
    },
  )
}
