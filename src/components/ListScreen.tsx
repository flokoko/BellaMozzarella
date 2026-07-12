import type { ListItem, ItemCategory, ListType } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'
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
  return (
    <div className="list-screen">
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

      {items.length === 0 && (
        <p className="list-empty">🍕<br/>Noch keine Items — füge welche hinzu!</p>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.name)
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
    </div>
  )
}