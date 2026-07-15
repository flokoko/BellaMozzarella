import { useState } from 'react'
import type { ItemCategory, ListType } from '../types'
import { useCategories } from '../hooks/useCategories'

import './CategoryManager.css'

interface CategoryManagerProps {
  categories: ItemCategory[]
  listId: string
  listType: ListType
  onCategoriesChange?: () => void
}

export default function CategoryManager({ categories, listId, listType, onCategoriesChange }: CategoryManagerProps) {
  const [expanded, setExpanded] = useState(false)
  const { updateCategory, deleteCategory, addCategory } = useCategories(() => onCategoriesChange?.())

  const handleAdd = () => {
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0)
    addCategory(listId, listType, maxOrder + 1)
  }

  return (
    <div className="cat-manager">
      <button
        className="cat-manager-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="cat-manager-toggle-icon">🍝</span>
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
                className="cat-manager-name-input"
                type="text"
                value={cat.name}
                onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
              />
              <button
                className="cat-manager-delete-btn"
                onClick={() => { if (confirm('Dieses Element wirklich löschen?')) deleteCategory(cat.id) }}
                aria-label="Kategorie löschen"
              >
                🗑
              </button>
            </div>
          ))}
          <button className="cat-manager-add-btn" onClick={handleAdd}>
            + Kategorie hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}