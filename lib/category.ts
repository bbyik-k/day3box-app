// 카테고리 5색 프리셋 (PRD 7.1 #3): 색은 프리셋 고정, 이름만 편집 가능 — 자유 색 입력 금지
// tasks.category에는 색 키('cat1'~'cat5')만 저장하고, 표시 이름은 앱 상수로 시작한다
export const CATEGORY_KEYS = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export function isCategoryKey(value: string): value is CategoryKey {
  return CATEGORY_KEYS.some((key) => key === value)
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  cat1: '집중',
  cat2: '준비',
  cat3: '작업',
  cat4: '생활',
  cat5: '기타',
}

// DB의 category(text | null)를 표시 이름으로 — 프리셋 밖 값·null은 이름 없음
export function categoryLabel(category: string | null): string | null {
  return category !== null && isCategoryKey(category)
    ? CATEGORY_LABELS[category]
    : null
}
