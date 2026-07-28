'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email')
  const password = formData.get('password')

  if (
    typeof email !== 'string' ||
    email.trim() === '' ||
    typeof password !== 'string' ||
    password === ''
  ) {
    redirect('/login?error=invalid')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  // redirect()는 NEXT_REDIRECT를 throw하므로 try/catch 밖에서 호출
  if (error) {
    redirect('/login?error=auth')
  }
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
