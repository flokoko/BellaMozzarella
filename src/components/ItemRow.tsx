import type { ListItem } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Trash2, GripVertical } from 'lucide-react'
import './ItemRow.css'

interface ItemRowProps {
  item: ListItem
  onToggle?: (item: ListItem) => void
  onDelete?: (item: ListItem) => void
  dragHandleProps?: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
  }
  isDragging?: boolean
  isDragOver?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}

export default function ItemRow({ item, onToggle, onDelete, dragHandleProps, isDragging, isDragOver, registerRef }: ItemRowProps) {

  const toggleChecked = () => {
    onToggle?.(item)
    navigator.vibrate?.(10)
  }

  const deleteItem = () => {
    if (!confirm('Dieses Element wirklich löschen?')) return
    onDelete?.(item)
    navigator.vibrate?.(15)
  }

  const rowClass = [
    'item-row',
    item.is_checked ? 'checked' : '',
    isDragging ? 'dragging' : '',
    isDragOver ? 'drag-over' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={rowClass}
      ref={registerRef ?? undefined}
      onPointerMove={dragHandleProps?.onPointerMove}
      onPointerUp={dragHandleProps?.onPointerUp}
    >
      {dragHandleProps && (
        <span
          className="item-drag-handle"
          onPointerDown={dragHandleProps.onPointerDown}
        >
          <GripVertical size={16} strokeWidth={2} />
        </span>
      )}
      <label className="item-checkbox-wrap">
        <input type="checkbox" checked={item.is_checked} onChange={toggleChecked} />
        <span className="item-checkmark" />
      </label>
      <div className="item-content">
        <span className="item-name">{item.name}</span>
        <div className="item-meta">
          <span className="item-qty">{item.quantity}</span>
          {item.created_by && <span className="item-created-by">von {item.created_by}</span>}
        </div>
      </div>
      <button className="item-delete" onClick={deleteItem} aria-label="Löschen">
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  )
}