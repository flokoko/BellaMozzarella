import type { ListItem } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../lib/supabase'
import './ItemRow.css'

interface ItemRowProps {
  item: ListItem
  onChange?: () => void
  dragHandleProps?: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
  }
  isDragging?: boolean
  isDragOver?: boolean
  registerRef?: (el: HTMLDivElement | null) => void
}

export default function ItemRow({ item, onChange, dragHandleProps, isDragging, isDragOver, registerRef }: ItemRowProps) {

  const toggleChecked = async () => {
    await supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id)
    onChange?.()
  }

  const deleteItem = async () => {
    await supabase.from('items').delete().eq('id', item.id)
    onChange?.()
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
          ☰
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
          {item.assigned_to && <span className="item-assigned">→ {item.assigned_to}</span>}
        </div>
      </div>
      <button className="item-delete" onClick={deleteItem} aria-label="Löschen">
        🗑
      </button>
    </div>
  )
}