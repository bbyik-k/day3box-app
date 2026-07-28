'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { todayInSeoul } from '@/lib/date'

export async function addTask(
  title: string,
): Promise<{ error: string } | undefined> {
  const trimmed = title.trim()
  if (trimmed === '') {
    return { error: '할 일 내용을 입력해 주세요.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    date: todayInSeoul(),
    title: trimmed,
  })
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

export async function deleteTask(
  id: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 소유권은 RLS가 보장하지만 방어적으로 user_id 조건을 함께 건다
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '삭제에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}
