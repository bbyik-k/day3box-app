import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// proxy에서의 세션 갱신 + 비로그인 리다이렉트 (optimistic 체크 전용 —
// 실제 검증은 데이터 접근 지점의 getUser()가 담당)
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // createServerClient와 getUser() 사이에 다른 로직을 넣지 않는다 (세션 갱신 누락 방지)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // 리다이렉트 응답에도 갱신된 세션 쿠키를 복사해야 한다
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    )
    return redirectResponse
  }

  return supabaseResponse
}
