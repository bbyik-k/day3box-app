'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidDateStr, nowMinutesInSeoul, todayInSeoul } from '@/lib/date'
import { CATEGORY_KEYS, isCategoryKey } from '@/lib/category'
import { isBlockStatus } from '@/types/block'
import {
  GRID_END_MIN,
  GRID_START_MIN,
  SNAP_MIN,
  findNextFreeSlot,
  overlaps,
} from '@/lib/grid'

const TOP3_LIMIT = 3
// 일반(비 TOP3) task의 기본 배치 시간 — 세밀 조정은 그리드 리사이즈로 (2026-07-29 결정)
const DEFAULT_PLACE_MIN = 30

// TOP3는 무조건 유색 — 승격 시 카테고리가 없으면 그 날짜 TOP3가 안 쓰는 첫 프리셋 색을 지정.
// 클라이언트 낙관 반영도 같은 결정적 규칙을 쓰므로 refresh 후 결과가 일치한다
function firstUnusedCategory(used: (string | null)[]): string {
  return CATEGORY_KEYS.find((key) => !used.includes(key)) ?? CATEGORY_KEYS[0]
}

export async function addTask(
  title: string,
  date: string,
): Promise<{ error: string } | undefined> {
  const trimmed = title.trim()
  if (trimmed === '') {
    return { error: '할 일 내용을 입력해 주세요.' }
  }
  if (!isValidDateStr(date)) {
    return { error: '유효하지 않은 날짜입니다.' }
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
    date,
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

  // 하드 제한 백스톱 — 정상 경로는 클라이언트가 교체 모달로 선점하지만 서버에서도 봉인.
  // 카운트 기준 날짜는 대상 task.date에서 유도한다 (클라이언트 전달값은 신뢰하지 않는다)
  const update: { is_top3: boolean; category?: string } = { is_top3: next }
  if (next) {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, date, category, kind')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (taskError || !task) {
      return { error: '항목을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
    }
    // 고정 시간은 할 일이 아니다 — TOP3 승격 불가 (UI상 경로 없음, 서버 백스톱)
    if (task.kind === 'fixed') {
      return { error: '고정 시간은 TOP 3에 올릴 수 없습니다.' }
    }
    const { data: currentTop3 } = await supabase
      .from('tasks')
      .select('category')
      .eq('user_id', user.id)
      .eq('date', task.date)
      .eq('is_top3', true)
    if ((currentTop3 ?? []).length >= TOP3_LIMIT) {
      return { error: 'TOP 3가 가득 찼습니다. 하나를 내려 주세요.' }
    }
    // TOP3 무조건 유색 — 카테고리 미지정이면 미사용 프리셋 색 자동 지정
    if (task.category === null) {
      update.category = firstUnusedCategory(
        (currentTop3 ?? []).map((t) => t.category),
      )
    }
  }

  const { error } = await supabase
    .from('tasks')
    .update(update)
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

  // 재카운트 기준 날짜는 승격 대상 task.date에서 유도 (toggleTop3과 동일 원칙)
  const { data: promoteTask, error: promoteTaskError } = await supabase
    .from('tasks')
    .select('id, date, category')
    .eq('id', promoteId)
    .eq('user_id', user.id)
    .single()
  if (promoteTaskError || !promoteTask) {
    return { error: '교체에 실패했습니다. 새로고침 후 다시 시도해 주세요.' }
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

  const { data: remainingTop3 } = await supabase
    .from('tasks')
    .select('category')
    .eq('user_id', user.id)
    .eq('date', promoteTask.date)
    .eq('is_top3', true)
  if ((remainingTop3 ?? []).length >= TOP3_LIMIT) {
    return { error: 'TOP 3가 가득 찼습니다. 하나를 내려 주세요.' }
  }

  // TOP3 무조건 유색 — toggleTop3과 동일한 자동 지정 규칙
  const promoteUpdate: { is_top3: boolean; category?: string } = {
    is_top3: true,
  }
  if (promoteTask.category === null) {
    promoteUpdate.category = firstUnusedCategory(
      (remainingTop3 ?? []).map((t) => t.category),
    )
  }

  const { data: promoted, error: promoteError } = await supabase
    .from('tasks')
    .update(promoteUpdate)
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
    .select('id, date, est_min, is_top3')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single()
  if (taskError || !task) {
    return { error: '배치할 항목을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
  }
  // TOP3는 소요시간 입력이 완료 정의(PRD 엣지 케이스) — 일반 task는 기본 30분으로 즉시 배치
  if (task.est_min === null && task.is_top3) {
    return { error: '소요시간을 먼저 입력해 주세요.' }
  }
  const estMin = task.est_min ?? DEFAULT_PLACE_MIN

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('task_id, start_min, end_min')
    .eq('user_id', user.id)
    .eq('date', task.date)
  if (blocksError) {
    return { error: '배치에 실패했습니다. 다시 시도해 주세요.' }
  }

  // 블록 분할(D4): 배치 클릭 = 미배치 잔량(est − 배치 합)을 다음 빈 슬롯에.
  // 리사이즈로 줄인 뒤 다시 클릭하면 잔량이 배치된다 — 별도 분할 UI 없음
  const placedSum = (blocks ?? [])
    .filter((b) => b.task_id === task.id)
    .reduce((sum, b) => sum + (b.end_min - b.start_min), 0)
  let duration = estMin
  if (task.est_min !== null) {
    duration = task.est_min - placedSum
    if (duration <= 0) {
      return { error: '계획한 시간이 모두 배치되어 있습니다. 소요시간을 늘리거나 블록을 조정해 주세요.' }
    }
  }

  // 오늘은 "지금 이후 다음 빈 슬롯", 다른 날짜(내일 계획·과거 보정)는 그리드 시작부터 탐색
  const fromMin =
    task.date === todayInSeoul() ? nowMinutesInSeoul() : GRID_START_MIN
  const found = findNextFreeSlot(blocks ?? [], duration, fromMin)
  if (found === null) {
    return { error: '그리드에 빈 자리가 없습니다.' }
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

  // 기본값으로 배치했으면 est_min도 30으로 — 소요시간과 블록 높이는 단일 개념(양방향 동기화)
  if (task.est_min === null) {
    await supabase
      .from('tasks')
      .update({ est_min: estMin })
      .eq('id', task.id)
      .eq('user_id', user.id)
  }

  refresh()
}

// 배치 취소 — 블록만 삭제, task는 brain dump에 유지 (F4의 역연산).
// 삭제로 block 0개가 된 task는 carryTaskToDate의 검증을 통과해 익일 이월 대상이 된다.
// 단, 고정 시간(kind='fixed')은 좌측에 없어 마지막 블록 삭제 시 task도 함께 지운다 (유령 행 방지)
export async function deleteBlock(
  id: string,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: block } = await supabase
    .from('blocks')
    .select('task_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '배치 취소에 실패했습니다. 다시 시도해 주세요.' }
  }

  if (block) {
    const { count } = await supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', block.task_id)
      .eq('user_id', user.id)
    if ((count ?? 0) === 0) {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', block.task_id)
        .eq('user_id', user.id)
        .eq('kind', 'fixed')
    }
  }

  refresh()
}

// 고정 시간 생성 (D1 드래그 생성): 그리드 빈 영역 드래그 → kind='fixed' task + block.
// 좌측에 나타나지 않고 그리드에만 존재한다 — "할 일"이 아니라 "확보한 시간"
export async function createFixedBlock(
  title: string,
  date: string,
  startMin: number,
  endMin: number,
): Promise<{ error: string } | undefined> {
  const trimmed = title.trim()
  if (trimmed === '') {
    return { error: '이름을 입력해 주세요.' }
  }
  if (!isValidDateStr(date)) {
    return { error: '유효하지 않은 날짜입니다.' }
  }
  if (
    !Number.isInteger(startMin) ||
    !Number.isInteger(endMin) ||
    startMin % SNAP_MIN !== 0 ||
    endMin % SNAP_MIN !== 0 ||
    startMin < GRID_START_MIN ||
    endMin <= startMin ||
    endMin > GRID_END_MIN
  ) {
    return { error: '유효하지 않은 시간입니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('blocks')
    .select('start_min, end_min')
    .eq('user_id', user.id)
    .eq('date', date)
  if (blocksError) {
    return { error: '생성에 실패했습니다. 다시 시도해 주세요.' }
  }
  if (
    (blocks ?? []).some((b) => overlaps(startMin, endMin, b.start_min, b.end_min))
  ) {
    return { error: '해당 시간대에 이미 다른 블록이 있습니다.' }
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({ user_id: user.id, date, title: trimmed, kind: 'fixed' })
    .select('id')
    .single()
  if (taskError || !task) {
    return { error: '생성에 실패했습니다. 다시 시도해 주세요.' }
  }

  const { error: blockError } = await supabase.from('blocks').insert({
    user_id: user.id,
    task_id: task.id,
    date,
    start_min: startMin,
    end_min: endMin,
  })
  if (blockError) {
    // 고아 task 롤백 — supabase-js에 트랜잭션이 없어 보상 삭제로 처리
    await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', user.id)
    return { error: '생성에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

// 이동·리사이즈 확정 — 클라이언트 스냅·겹침 검사의 서버측 백스톱.
// end_min은 15배수를 요구하지 않는다: est_min이 임의 정수(예: 20분)라
// 비정렬 end를 가진 정상 블록이 존재하고, 이동은 duration을 보존하기 때문.
export async function moveBlock(
  id: string,
  startMin: number,
  endMin: number,
): Promise<{ error: string } | undefined> {
  if (
    !Number.isInteger(startMin) ||
    !Number.isInteger(endMin) ||
    startMin % SNAP_MIN !== 0 ||
    startMin < GRID_START_MIN ||
    endMin <= startMin ||
    endMin > GRID_END_MIN
  ) {
    return { error: '유효하지 않은 시간입니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: block, error: blockError } = await supabase
    .from('blocks')
    .select('id, date, task_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (blockError || !block) {
    return { error: '블록을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  const { data: others, error: othersError } = await supabase
    .from('blocks')
    .select('start_min, end_min')
    .eq('user_id', user.id)
    .eq('date', block.date)
    .neq('id', id)
  if (othersError) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }
  if ((others ?? []).some((b) => overlaps(startMin, endMin, b.start_min, b.end_min))) {
    return { error: '해당 시간대에 이미 다른 블록이 있습니다.' }
  }

  const { error } = await supabase
    .from('blocks')
    .update({ start_min: startMin, end_min: endMin })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  // 비동기화(ADR-0002): 리사이즈는 est_min을 갱신하지 않는다 —
  // est=계획 총량, 블록 합=배치량, 차이=미배치 잔량 (분할의 전제)

  refresh()
}

// 상태 전환 — 값은 BlockStatus union으로만 봉인 (missed는 존재하지 않는다)
export async function setBlockStatus(
  id: string,
  status: string,
): Promise<{ error: string } | undefined> {
  if (!isBlockStatus(status)) {
    return { error: '지원하지 않는 상태입니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('blocks')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) {
    return { error: '저장에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}

// 비동기화(ADR-0002): 분 수정은 배치된 블록을 건드리지 않는다 —
// est=계획 총량(칩으로 어림), 실제 조정은 그리드 리사이즈가 담당 (역할 분담, D6)
export async function setEstMin(
  id: string,
  estMin: number | null,
): Promise<{ error: string } | undefined> {
  // 10분 배수 제약 (D5·D6) — DB CHECK와 동일 규칙
  if (
    estMin !== null &&
    (!Number.isInteger(estMin) ||
      estMin < 10 ||
      estMin > 1440 ||
      estMin % 10 !== 0)
  ) {
    return { error: '소요시간은 10분 단위로 입력해 주세요.' }
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

// 미배치 task 이월("오늘 못 한 걸 내일로" — 길 B의 존재 이유): task.date를 대상 날짜로 이동.
// block이 하나라도 있으면 거부 — blocks.date가 비정규화라 task.date만 바꾸면 고아 블록이 된다.
export async function carryTaskToDate(
  id: string,
  targetDate: string,
): Promise<{ error: string } | undefined> {
  if (!isValidDateStr(targetDate)) {
    return { error: '유효하지 않은 날짜입니다.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { count, error: countError } = await supabase
    .from('blocks')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', id)
    .eq('user_id', user.id)
  if (countError) {
    return { error: '가져오기에 실패했습니다. 다시 시도해 주세요.' }
  }
  if ((count ?? 0) > 0) {
    return { error: '이미 배치된 항목은 가져올 수 없습니다.' }
  }

  // is_top3 리셋 — 대상 날짜의 TOP3 하드 제한(3개)을 이월이 우회하지 못하게 한다.
  // kind='task'만 — 고정 시간은 이월 대상이 아니다 (밥먹기를 내일로 이월하지 않는다, D2)
  const { data: updated, error } = await supabase
    .from('tasks')
    .update({ date: targetDate, is_top3: false })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('kind', 'task')
    .select('id')
  if (error || !updated || updated.length === 0) {
    return { error: '가져오기에 실패했습니다. 다시 시도해 주세요.' }
  }

  refresh()
}
