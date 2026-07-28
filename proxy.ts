import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Next 16: middleware.ts가 proxy.ts로 대체됨 (Node 런타임 고정)
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
