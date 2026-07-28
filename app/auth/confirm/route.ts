import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 매직링크 콜백 (PKCE): ?code= 교환 → 세션 쿠키 설정 (Route Handler라 쿠키 쓰기 허용)
// 주의: 코드 교환은 링크를 요청한 브라우저의 verifier 쿠키가 필요하다 — 같은 브라우저에서 열어야 한다
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      redirect('/')
    }
  }

  redirect('/login?error=auth')
}
