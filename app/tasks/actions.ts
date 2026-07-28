'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { nowMinutesInSeoul, todayInSeoul } from '@/lib/date'
import { isCategoryKey } from '@/lib/category'
import {
  GRID_END_MIN,
  GRID_START_MIN,
  SNAP_MIN,
  ceilToSnap,
  overlaps,
} from '@/lib/grid'

const TOP3_LIMIT = 3

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

export async function toggleTop3(
  id: string,
  next: boolean,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 하드 제한 백스톱 — 정상 경로는 클라이언트가 교체 모달로 선점하지만 서버에서도 봉인
  if (next) {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date', todayInSeoul())
      .eq('is_top3', true)
    if ((count ?? 0) >= TOP3_LIMIT) {
      return { error: 'TOP 3가 가득 찼습니다. 하나를 내려 주세요.' }
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update({ is_top3: next })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

// 교체: 해제 먼저 → 재카운트 → 승격 순서라 어떤 순간에도 TOP3가 3을 넘지 않는다.
// supabase-js는 트랜잭션이 없어 중간 실패 시 최악 결과는 'TOP3 2개'로만 수렴하며
// 재승격 한 번으로 복구된다 — v1에서 다중 기기 동시 편집이 생기면 RPC 함수로 전환한다.
export async function swapTop3(
  demoteId: string,
  promoteId: string,
): Promise<{ error: string } | undefined> {
  if (demoteId === promoteId) {
    return { error: '같은 항목은 교체할 수 없습니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: demoted, error: demoteError } = await supabase
    .from('tasks')
    .update({ is_top3: false })
    .eq('id', demoteId)
    .eq('user_id', user.id)
    .eq('is_top3', true)
    .select('id')
  if (demoteError || !demoted || demoted.length === 0) {
    return { error: '교체에 실패했습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('date', todayInSeoul())
    .eq('is_top3', true)
  if ((count ?? 0) >= TOP3_LIMIT) {
    return { error: 'TOP 3가 가득 찼습니다. 하나를 내려 주세요.' }
  }

  const { data: promoted, error: promoteError } = await supabase
    .from('tasks')
    .update({ is_top3: true })
    .eq('id', promoteId)
    .eq('user_id', user.id)
    .select('id')
  if (promoteError || !promoted || promoted.length === 0) {
    return { error: '교체에 실패했습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  refresh()
}

// 배치: 현재 시각 이후 15분 정렬 슬롯 중 기존 블록과 겹치지 않는 첫 자리에 블록 생성.
// 슬롯 탐색과 겹침 검사는 여기(서버)가 단일 진실 지점이다 (한 시간대 = 최대 한 블록).
export async function placeBlock(
  taskId: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, date, est_min')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single()
  if (taskError || !task) {
    return { error: '배치할 항목을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
  }
  if (task.est_min === null) {
    return { error: '소요시간을 먼저 입력해 주세요.' }
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('start_min, end_min')
    .eq('user_id', user.id)
    .eq('date', task.date)
  if (blocksError) {
    return { error: '배치에 실패했습니다. 다시 시도해 주세요.' }
  }

  const existing = blocks ?? []
  let start = Math.max(ceilToSnap(nowMinutesInSeoul()), GRID_START_MIN)
  let found: { start: number; end: number } | null = null
  while (start + task.est_min <= GRID_END_MIN) {
    const end = start + task.est_min
    const candidateStart = start
    if (!existing.some((b) => overlaps(candidateStart, end, b.start_min, b.end_min))) {
      found = { start, end }
      break
    }
    start += SNAP_MIN
  }
  if (found === null) {
    return { error: '오늘 그리드에 빈 자리가 없습니다.' }
  }

  const { error } = await supabase.from('blocks').insert({
    user_id: user.id,
    task_id: task.id,
    date: task.date,
    start_min: found.start,
    end_min: found.end,
  })
  if (error) {
    return { error: '배치에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

export async function setEstMin(
  id: string,
  estMin: number | null,
): Promise<{ error: string } | undefined> {
  if (
    estMin !== null &&
    (!Number.isInteger(estMin) || estMin < 5 || estMin > 1440)
  ) {
    return { error: '소요시간은 5~1440 사이의 분 단위로 입력해 주세요.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('tasks')
    .update({ est_min: estMin })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

export async function setCategory(
  id: string,
  category: string,
): Promise<{ error: string } | undefined> {
  // 카테고리는 5색 프리셋 밖 값을 저장할 수 없다 (PRD 7.1 #3의 서버측 봉인)
  if (!isCategoryKey(category)) {
    return { error: '지원하지 않는 카테고리입니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('tasks')
    .update({ category })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}
