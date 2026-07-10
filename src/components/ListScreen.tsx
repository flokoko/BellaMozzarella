import type { ListItem, ItemCategory } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import ItemRow from './ItemRow'
import AddItemForm from './AddItemForm'
import { useDragReorder } from '../hooks/useDragReorder'
import './ListScreen.css'

interface ListScreenProps {
  items: ListItem[]
  categories: ItemCategory[]
  listId: string
  userName: string
  onItemChange?: () => void
  onReorder?: (listType: 'shopping', newOrder: string[]) => void
}

/** Wraps one category's items with independent drag-reorder. */
function DraggableCategorySection({
  catItems,
  cat,
  onItemChange,
  onReorder,
}: {
  catItems: ListItem[]
  cat: ItemCategory
  onItemChange?: () => void
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
        <span className="cat-icon">{cat.icon}</span>
        <span className="cat-title" style={{ color: cat.color }}>{cat.name}</span>
        <span className="cat-count">
          {checkedCount}/{catItems.length} erledigt
        </span>
      </div>
      {catItems.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onChange={onItemChange}
          categoryMeta={{ icon: cat.icon, color: cat.color, bg: cat.bg }}
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

export default function ListScreen({ items, categories, listId, userName, onItemChange, onReorder }: ListScreenProps) {
  return (
    <div className="list-screen">
      <AddItemForm
        listId={listId}
        userName={userName}
        onAdded={onItemChange}
        categories={categories}
        listType="shopping"
      />

      {items.length === 0 && (
        <p className="list-empty">Noch keine Items — füge welche hinzu! ☀️</p>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.name)
        if (catItems.length === 0) return null
        return (
          <DraggableCategorySection
            key={cat.id}
            catItems={catItems}
            cat={cat}
            onItemChange={onItemChange}
            onReorder={(newOrder) => onReorder?.('shopping', newOrder)}
          />
        )
      })}
    </div>
  )
}