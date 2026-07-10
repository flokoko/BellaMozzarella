import type { ListItem } from '../types'
import { CATEGORY_META } from '../types'
import { supabase } from '../lib/supabase'
import './ItemRow.css'

interface ItemRowProps {
  item: ListItem
  onChange?: () => void
}

export default function ItemRow({ item, onChange }: ItemRowProps) {
  const meta = CATEGORY_META[item.category]

  const toggleChecked = async () => {
    await supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id)
    onChange?.()
  }

  const deleteItem = async () => {
    await supabase.from('items').delete().eq('id', item.id)
    onChange?.()
  }

  return (
    <div className={`item-row ${item.is_checked ? 'checked' : ''}`}>
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
      <span className="item-cat-badge" style={{ background: meta.bg, color: meta.color }} data-cat={item.category}>
        {meta.icon}
      </span>
      <button className="item-delete" onClick={deleteItem} aria-label="Löschen">
        🗑
      </button>
    </div>
  )
}