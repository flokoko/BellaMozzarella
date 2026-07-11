import { useState } from 'react'
import type { ItemCategory, ListType } from '../types'
import { supabase } from '../lib/supabase'
import './CategoryManager.css'

interface CategoryManagerProps {
  categories: ItemCategory[]
  listId: string
  listType: ListType
  onCategoriesChange?: () => void
}

export default function CategoryManager({ categories, listId, listType, onCategoriesChange }: CategoryManagerProps) {
  const [expanded, setExpanded] = useState(false)

  const updateCategory = async (id: string, fields: Partial<ItemCategory>) => {
    await supabase.from('categories').update(fields).eq('id', id)
    onCategoriesChange?.()
  }

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    onCategoriesChange?.()
  }

  const addCategory = async () => {
    const sortOrder = categories.length + 1
    await supabase.from('categories').insert({
      list_id: listId,
      list_type: listType,
      name: 'Neue Kategorie',
      icon: '📦',
      color: '#9b6dd9',
      bg: '#e8dcf7',
      sort_order: sortOrder,
    })
    onCategoriesChange?.()
  }

  return (
    <div className="cat-manager">
      <button
        className="cat-manager-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="cat-manager-toggle-icon">📁</span>
        <span className="cat-manager-toggle-text">Kategorien</span>
        <span className="cat-manager-toggle-count">{categories.length}</span>
        <span className={`cat-manager-chevron ${expanded ? 'open' : ''}`}>▾</span>
      </button>
      <div className={`cat-manager-panel ${expanded ? 'expanded' : ''}`}>
        <div className="cat-manager-panel-inner">
          {categories.length === 0 && (
            <p className="cat-manager-empty">Keine Kategorien</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="cat-manager-row">
              <input
                className="cat-manager-icon-input"
                type="text"
                value={cat.icon}
                maxLength={4}
                onChange={(e) => updateCategory(cat.id, { icon: e.target.value })}
              />
              <input
                className="cat-manager-name-input"
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
              />
              <label className="cat-manager-color-label" title="Textfarbe">
                <input
                  className="cat-manager-color-input"
                  type="color"
                  value={cat.color}
                  onChange={(e) => updateCategory(cat.id, { color: e.target.value })}
                />
              </label>
              <label className="cat-manager-color-label" title="Hintergrundfarbe">
                <input
                  className="cat-manager-color-input"
                  type="color"
                  value={cat.bg}
                  onChange={(e) => updateCategory(cat.id, { bg: e.target.value })}
                />
              </label>
              <button
                className="cat-manager-delete-btn"
                onClick={() => deleteCategory(cat.id)}
                aria-label="Kategorie löschen"
              >
                🗑
              </button>
            </div>
          ))}
          <button className="cat-manager-add-btn" onClick={addCategory}>
            + Kategorie hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}