import './Skeleton.css'

interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

export function SkeletonLine() {
  return <Skeleton className="skeleton-line" />
}

export function SkeletonCard() {
  return <Skeleton className="skeleton-card" />
}

export function SkeletonNote() {
  return <Skeleton className="skeleton-note" />
}

export function SkeletonCatHeader() {
  return <Skeleton className="skeleton-cat-header" />
}

export function SkeletonItemRow() {
  return <Skeleton className="skeleton-item-row" />
}

export function SkeletonExpenseCard() {
  return <Skeleton className="skeleton-expense-card" />
}