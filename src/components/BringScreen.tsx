import { useState, useMemo } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { BringFilter, ListItem, ItemCategory, ListType } from '../types'
import { supabase } from '../lib/supabase'
import AddItemForm from './AddItemForm'
import CategoryManager from './CategoryManager'
import { useDragReorder } from '../hooks/useDragReorder'
import './BringScreen.css'

interface BringScreenProps {
  items: ListItem[]
  categories: ItemCategory[]
  listId: string
  userName: string
  onItemChange?: () => void
  onReorder?: (listType: ListType, newOrder: string[]) => void
  onCategoriesChange?: () => void
}

/** Wraps one person's bring items with independent drag-reorder. */
function DraggableBringGroup({
  person,
  personItems,
  isMe,
  onToggleBrought,
  onReorder,
}: {
  person: string
  personItems: ListItem[]
  isMe: boolean
  onToggleBrought: (item: ListItem) => void
  onReorder?: (newOrder: string[]) => void
}) {
  const {
    dragState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    registerItem,
  } = useDragReorder<ListItem>(personItems, (newOrder) => onReorder?.(newOrder))

  const broughtCount = personItems.filter((i) => i.is_brought).length

  return (
    <div className="bring-group">
      <div className="bring-group-header">
        <span className="bring-person">
          {isMe && <span className="bring-me-badge">Du</span>}
          {person}
        </span>
        <span className="bring-group-count">{broughtCount}/{personItems.length} mitgebracht</span>
      </div>
      {personItems.map((item) => {
        const itemClass = [
          'bring-item',
          item.is_brought ? 'brought' : '',
          dragState.draggingId === item.id ? 'dragging' : '',
          dragState.dragOverId === item.id ? 'drag-over' : '',
        ].filter(Boolean).join(' ')

        return (
          <div
            key={item.id}
            className={itemClass}
            ref={(el) => registerItem(item.id, el)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <span
              className="bring-drag-handle"
              onPointerDown={(e: ReactPointerEvent) => handlePointerDown(e, item.id)}
            >
              ☰
            </span>
            <label className="bring-checkbox-wrap">
              <input
                type="checkbox"
                checked={item.is_brought}
                onChange={() => onToggleBrought(item)}
              />
              <span className="bring-checkmark" />
            </label>
            <span className="bring-item-name">{item.name}</span>
            <span className="bring-item-qty">{item.quantity}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function BringScreen({ items, categories, listId, userName, onItemChange, onReorder, onCategoriesChange }: BringScreenProps) {
  const [filter, setFilter] = useState<BringFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'mine') return items.filter((i) => i.assigned_to === userName)
    if (filter === 'unfilled') return items.filter((i) => !i.assigned_to)
    return items
  }, [items, filter, userName])

  const grouped = useMemo(() => {
    const map = new Map<string, ListItem[]>()
    for (const item of filtered) {
      const key = item.assigned_to || '— Niemand —'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    // Sort: userName's group first, then alphabetical
    const sorted = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === userName) return -1
      if (b[0] === userName) return 1
      return a[0].localeCompare(b[0])
    })
    return sorted
  }, [filtered, userName])

  const toggleBrought = async (item: ListItem) => {
    await supabase.from('items').update({ is_brought: !item.is_brought }).eq('id', item.id)
    onItemChange?.()
  }

  return (
    <div className="bring-screen">
      <div className="bring-filters">
        <button
          className={`bring-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Alle
        </button>
        <button
          className={`bring-filter-btn ${filter === 'mine' ? 'active' : ''}`}
          onClick={() => setFilter('mine')}
        >
          Nur meine
        </button>
        <button
          className={`bring-filter-btn ${filter === 'unfilled' ? 'active' : ''}`}
          onClick={() => setFilter('unfilled')}
        >
          Unzugewiesen
        </button>
      </div>

      <CategoryManager
        categories={categories}
        listId={listId}
        listType="bring"
        onCategoriesChange={onCategoriesChange}
      />

      <AddItemForm
        listId={listId}
        userName={userName}
        onAdded={onItemChange}
        defaultAssignedTo={userName}
        placeholder="Was bringst du mit?"
        categories={categories}
        listType="bring"
      />

      {grouped.length === 0 && (
        <p className="bring-empty">Nichts hier — vielleicht Filter ändern? 🧐</p>
      )}

      {grouped.map(([person, personItems]) => {
        const isMe = person === userName
        return (
          <DraggableBringGroup
            key={person}
            person={person}
            personItems={personItems}
            isMe={isMe}
            onToggleBrought={toggleBrought}
            onReorder={(newOrder) => onReorder?.('bring', newOrder)}
          />
        )
      })}
    </div>
  )
}