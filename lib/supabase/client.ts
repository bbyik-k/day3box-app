import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

// 브라우저용 클라이언트 팩토리 — 모듈 최상위 전역 선언 금지 규칙에 따라 호출 시 생성
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
