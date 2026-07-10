import { useState } from 'react'
import type { Category } from '../types'
import { CATEGORIES, CATEGORY_META } from '../types'
import { supabase } from '../lib/supabase'
import './AddItemForm.css'

interface AddItemFormProps {
  listId: string
  userName: string
}

export default function AddItemForm({ listId, userName }: AddItemFormProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState<Category>('Essen')
  const [assignedTo, setAssignedTo] = useState('')
  const [expanded, setExpanded] = useState(false)

  const handleAdd = async () => {
    const n = name.trim()
    if (!n) return
    await supabase.from('items').insert({
      list_id: listId,
      name: n,
      quantity: quantity.trim() || '1',
      category,
      assigned_to: assignedTo.trim() || null,
      is_checked: false,
      is_brought: false,
      created_by: userName,
    })
    setName('')
    setQuantity('')
    setAssignedTo('')
    setCategory('Essen')
    setExpanded(false)
  }

  return (
    <div className="add-item-form">
      {expanded ? (
        <div className="add-item-expanded">
          <input
            className="add-input"
            type="text"
            placeholder="Was soll gekauft werden?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="add-row">
            <input
              className="add-input add-qty"
              type="text"
              placeholder="Menge"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select
              className="add-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].icon} {c}
                </option>
              ))}
            </select>
          </div>
          <input
            className="add-input"
            type="text"
            placeholder="Zuweisen an (optional)"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="add-actions">
            <button className="add-btn-cancel" onClick={() => setExpanded(false)}>
              Abbrechen
            </button>
            <button className="add-btn-confirm" onClick={handleAdd} disabled={!name.trim()}>
              Hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <button className="add-item-trigger" onClick={() => setExpanded(true)}>
          <span className="add-plus">+</span> Item hinzufügen
        </button>
      )}
    </div>
  )
}