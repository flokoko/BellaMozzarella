import { useState, useMemo } from 'react'
import type { BringFilter, ListItem, ItemCategory } from '../types'
import { supabase } from '../lib/supabase'
import AddItemForm from './AddItemForm'
import './BringScreen.css'

interface BringScreenProps {
  items: ListItem[]
  categories: ItemCategory[]
  listId: string
  userName: string
  onItemChange?: () => void
}

export default function BringScreen({ items, categories, listId, userName, onItemChange }: BringScreenProps) {
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
        const broughtCount = personItems.filter((i) => i.is_brought).length
        const isMe = person === userName
        return (
          <div key={person} className="bring-group">
            <div className="bring-group-header">
              <span className="bring-person">
                {isMe && <span className="bring-me-badge">Du</span>}
                {person}
              </span>
              <span className="bring-group-count">{broughtCount}/{personItems.length} mitgebracht</span>
            </div>
            {personItems.map((item) => (
              <div key={item.id} className={`bring-item ${item.is_brought ? 'brought' : ''}`}>
                <label className="bring-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={item.is_brought}
                    onChange={() => toggleBrought(item)}
                  />
                  <span className="bring-checkmark" />
                </label>
                <span className="bring-item-name">{item.name}</span>
                <span className="bring-item-qty">{item.quantity}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}