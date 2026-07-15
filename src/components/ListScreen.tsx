import { useState } from 'react'
import type { ListItem, ItemCategory, ListType } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { supabase } from '../lib/supabase'
import ItemRow from './ItemRow'
import AddItemForm from './AddItemForm'
import CategoryManager from './CategoryManager'

import { useDragReorder } from '../hooks/useDragReorder'
import './ListScreen.css'

interface ListScreenProps {
  items: ListItem[]
  categories: ItemCategory[]
  listId: string
  userName: string
  onItemToggle?: (item: ListItem) => void
  onItemDelete?: (item: ListItem) => void
  onItemChange?: () => void
  onReorder?: (listType: ListType, newOrder: string[]) => void
  onCategoriesChange?: () => void
}

/** Wraps one category's items with independent drag-reorder. */
function DraggableCategorySection({
  catItems,
  cat,
  onItemToggle,
  onItemDelete,
  onReorder,
}: {
  catItems: ListItem[]
  cat: ItemCategory
  onItemToggle?: (item: ListItem) => void
  onItemDelete?: (item: ListItem) => void
  onReorder?: (newOrder: string[]) => void
}) {
  const {
    dragState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    registerItem,
  } = useDragReorder<ListItem>(catItems, (newOrder) => onReorder?.(newOrder))

  const checkedCount = catItems.filter((i) => i.is_checked).length

  return (
    <div className="cat-section">
      <div className="cat-header" style={{ background: cat.bg }} data-cat={cat.name}>
        <span className="cat-title" style={{ color: cat.color }}>{cat.name}</span>
        <span className="cat-count">
          {checkedCount}/{catItems.length} erledigt
        </span>
      </div>
      {catItems.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onToggle={onItemToggle}
          onDelete={onItemDelete}
          dragHandleProps={{
            onPointerDown: (e: ReactPointerEvent) => handlePointerDown(e, item.id),
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
          }}
          isDragging={dragState.draggingId === item.id}
          isDragOver={dragState.dragOverId === item.id}
          registerRef={(el) => registerItem(item.id, el)}
        />
      ))}
    </div>
  )
}

export default function ListScreen({ items, categories, listId, userName, onItemToggle, onItemDelete, onItemChange, onReorder, onCategoriesChange }: ListScreenProps) {
  const [hideChecked, setHideChecked] = useState(() => localStorage.getItem('bella_hide_checked') === 'true')

  const toggleHideChecked = () => {
    const next = !hideChecked
    setHideChecked(next)
    localStorage.setItem('bella_hide_checked', String(next))
  }

  const checkedItems = items.filter((i) => i.is_checked)

  const handleDeleteChecked = async () => {
    if (checkedItems.length === 0) return
    if (!confirm('Alle erledigten Items löschen?')) return
    await Promise.all(checkedItems.map((item) => supabase.from('items').delete().eq('id', item.id)))
    onItemChange?.()
  }

  const visibleItems = hideChecked ? items.filter((i) => !i.is_checked) : items

  return (
    <div className="list-screen">
      <div className="list-top-bar">
        <button
          className={`bring-filter-btn ${hideChecked ? 'active' : ''}`}
          onClick={toggleHideChecked}
        >
          {hideChecked ? 'Alle zeigen' : 'Erledigte ausblenden'}
        </button>
        {checkedItems.length > 0 && (
          <button
            className="bring-filter-btn list-delete-checked-btn"
            onClick={handleDeleteChecked}
          >
            🗑 Erledigte löschen ({checkedItems.length})
          </button>
        )}
      </div>

      <CategoryManager
        categories={categories}
        listId={listId}
        listType="shopping"
        onCategoriesChange={onCategoriesChange}
      />
      <AddItemForm
        listId={listId}
        userName={userName}
        onAdded={onItemChange}
        categories={categories}
        listType="shopping"
      />

      {visibleItems.length === 0 && (
        <p className="list-empty">🍕<br/>{hideChecked ? 'Alle erledigten Items ausgeblendet!' : 'Noch keine Items — füge welche hinzu!'}</p>
      )}

      {categories.map((cat) => {
        const catItems = visibleItems.filter((i) => i.category === cat.name)
        if (catItems.length === 0) return null
        return (
          <DraggableCategorySection
            key={cat.id}
            catItems={catItems}
            cat={cat}
            onItemToggle={onItemToggle}
            onItemDelete={onItemDelete}
            onReorder={(newOrder) => onReorder?.('shopping', newOrder)}
          />
        )
      })}

      {/* Fallback: items whose category was deleted or doesn't match any existing category */}
      {(() => {
        const orphanItems = categories.length === 0
          ? visibleItems
          : visibleItems.filter(item => !categories.some(cat => cat.name === item.category))
        if (orphanItems.length === 0) return null
        const fallbackCat: ItemCategory = {
          id: '__uncategorized__',
          list_id: listId,
          name: 'Ohne Kategorie',
          color: '#888',
          bg: '#f0f0f0',
          sort_order: 9999,
          list_type: 'shopping',
          created_at: '',
        }
        return (
          <DraggableCategorySection
            key="__uncategorized__"
            catItems={orphanItems}
            cat={fallbackCat}
            onItemToggle={onItemToggle}
            onItemDelete={onItemDelete}
            onReorder={(newOrder) => onReorder?.('shopping', newOrder)}
          />
        )
      })()}
    </div>
  )
}