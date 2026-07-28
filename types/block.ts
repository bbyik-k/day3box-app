// 블록 상태값 (PRD 4장 확정): DB는 text, 타입 안전성은 이 union으로만 보장
// `missed`는 존재하지 않는다 — 실패를 전시하지 않는다 (리텐션 방어)
export type BlockStatus = 'planned' | 'done' | 'partial' | 'moved'
