'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 매직링크 발송 (PKCE): 링크는 GoTrue verify를 거쳐 ?code=와 함께 /auth/confirm으로 돌아온다
export async function login(formData: FormData) {
  const email = formData.get('email')

  if (typeof email !== 'string' || email.trim() === '') {
    redirect('/login?error=invalid')
  }

  const headerStore = await headers()
  const origin = headerStore.get('origin') ?? 'http://localhost:3000'

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  // redirect()는 NEXT_REDIRECT를 throw하므로 try/catch 밖에서 호출
  if (error) {
    redirect('/login?error=send')
  }
  redirect('/login?sent=1')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
