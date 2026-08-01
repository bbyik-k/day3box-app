'use client'

import { useState } from 'react'

// 제목 인라인 편집 (D14-3·4) — 리스트 행·TOP3 카드·그리드 블록 공용 (한 규칙, 새 어휘 없음).
// 클릭 = 편집 진입. Enter/blur 저장, Esc 취소, 빈 값은 원래 제목으로 원복(삭제 아님).
// 편집 중 pointerdown 전파를 끊어 드래그가 시작되지 않는다
export function InlineTitle({
  title,
  onRename,
  className,
  inputClassName,
  interceptPointer = false,
}: {
  title: string
  onRename: (title: string) => void
  className?: string
  inputClassName?: string
  // true면 제목에서 드래그가 시작되지 않는다 — 그리드 블록용 (선택·기록 모드 전환 방지).
  // 리스트·카드에서는 false: 행 전체 드래그(D14-1)를 살리고, 드래그 시 유령 클릭 억제가 편집 진입을 막는다
  interceptPointer?: boolean
}) {
  const [editing, setEditing] = useState(false)

  function commit(value: string) {
    setEditing(false)
    const trimmed = value.trim()
    if (trimmed !== '' && trimmed !== title) {
      onRename(trimmed)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        title="클릭해서 제목 수정"
        data-testid="inline-title"
        // 호버 밑줄 — 클릭 전에 편집 가능함을 알린다 (할 일 앱 공통 관례)
        className={`min-w-0 truncate text-left hover:underline decoration-divider underline-offset-2 ${className ?? ''}`}
        onPointerDown={(e) => {
          if (interceptPointer) {
            e.stopPropagation()
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
      >
        {title}
      </button>
    )
  }

  return (
    <input
      autoFocus
      type="text"
      defaultValue={title}
      aria-label="제목 수정"
      data-testid="inline-title-input"
      className={`min-w-0 bg-transparent outline-none border-b border-accent ${inputClassName ?? ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(e.currentTarget.value)
        }
        if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
      onBlur={(e) => commit(e.currentTarget.value)}
    />
  )
}
