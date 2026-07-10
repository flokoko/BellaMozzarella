import type { ListItem } from '../types'
import { CATEGORIES, CATEGORY_META } from '../types'
import ItemRow from './ItemRow'
import AddItemForm from './AddItemForm'
import './ListScreen.css'

interface ListScreenProps {
  items: ListItem[]
  listId: string
  userName: string
}

export default function ListScreen({ items, listId, userName }: ListScreenProps) {
  return (
    <div className="list-screen">
      <AddItemForm listId={listId} userName={userName} />

      {items.length === 0 && (
        <p className="list-empty">Noch keine Items — füge welche hinzu! ☀️</p>
      )}

      {CATEGORIES.map((cat) => {
        const catItems = items.filter((i) => i.category === cat)
        if (catItems.length === 0) return null
        const meta = CATEGORY_META[cat]
        const checkedCount = catItems.filter((i) => i.is_checked).length
        return (
          <div key={cat} className="cat-section">
            <div className="cat-header" style={{ background: meta.bg }} data-cat={cat}>
              <span className="cat-icon">{meta.icon}</span>
              <span className="cat-title" style={{ color: meta.color }}>{cat}</span>
              <span className="cat-count">
                {checkedCount}/{catItems.length} erledigt
              </span>
            </div>
            {catItems.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </div>
        )
      })}
    </div>
  )
}