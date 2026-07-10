import type { ListItem } from '../types'
import { supabase } from '../lib/supabase'
import './ItemRow.css'

interface ItemRowProps {
  item: ListItem
  onChange?: () => void
  categoryMeta?: { icon: string; color: string; bg: string }
}

const FALLBACK_META = { icon: '📦', color: '#9b6dd9', bg: '#e8dcf7' }

export default function ItemRow({ item, onChange, categoryMeta }: ItemRowProps) {
  const meta = categoryMeta ?? FALLBACK_META

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