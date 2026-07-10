import type { ListItem, ItemCategory } from '../types'
import ItemRow from './ItemRow'
import AddItemForm from './AddItemForm'
import './ListScreen.css'

interface ListScreenProps {
  items: ListItem[]
  categories: ItemCategory[]
  listId: string
  userName: string
  onItemChange?: () => void
}

export default function ListScreen({ items, categories, listId, userName, onItemChange }: ListScreenProps) {
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
        const checkedCount = catItems.filter((i) => i.is_checked).length
        return (
          <div key={cat.id} className="cat-section">
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
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}