import { useState, useEffect } from 'react'
import type { ItemCategory, ListType } from '../types'
import type { ThemeMode } from '../lib/theme'
import { getTheme, setTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'

import './SettingsScreen.css'

interface SettingsScreenProps {
  userName: string
  listName: string
  joinCode: string
  onLeave: () => void
  onRename: (newName: string) => void
  categories: ItemCategory[]
  listId: string
  onCategoriesChange: () => void
}

export default function SettingsScreen({
  userName,
  listName,
  joinCode,
  onLeave,
  onRename,
  categories,
  listId,
  onCategoriesChange,
}: SettingsScreenProps) {
  const [theme, setThemeState] = useState<ThemeMode>('auto')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(userName)

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeState(mode)
    setTheme(mode)
  }

  const handleSaveName = () => {
    const trimmed = newName.trim()
    if (trimmed && trimmed !== userName) {
      onRename(trimmed)
    }
    setEditingName(false)
  }

  const updateCategory = async (id: string, fields: Partial<ItemCategory>) => {
    await supabase.from('categories').update(fields).eq('id', id)
    onCategoriesChange()
  }

  const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    onCategoriesChange()
  }

  const addCategory = async (listType: ListType) => {
    const sortOrder = categories.filter((c) => c.list_type === listType).length + 1
    await supabase.from('categories').insert({
      list_id: listId,
      list_type: listType,
      name: 'Neue Kategorie',
      color: '#9b6dd9',
      bg: '#e8dcf7',
      sort_order: sortOrder,
    })
    onCategoriesChange()
  }

  const renderCategoryEditor = (listType: ListType, title: string) => {
    const cats = categories.filter((c) => c.list_type === listType)
    return (
      <div className="settings-cat-subsection" key={listType}>
        <div className="settings-cat-subsection-header">
          <span className="settings-cat-subsection-title">{title}</span>
          <button
            className="settings-cat-add-btn"
            onClick={() => addCategory(listType)}
          >
            + Kategorie
          </button>
        </div>
        {cats.length === 0 && (
          <p className="settings-cat-empty">Keine Kategorien</p>
        )}
        {cats.map((cat) => (
          <div key={cat.id} className="settings-cat-item">
            <input
              className="settings-cat-name-input"
              type="text"
              value={cat.name}
              onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
            />
            <button
              className="settings-cat-delete-btn"
              onClick={() => deleteCategory(cat.id)}
              aria-label="Kategorie löschen"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="settings-screen">
      {/* ── Erscheinungsbild ────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Erscheinungsbild</h3>
        <div className="settings-item">
          <span className="settings-item-icon">🎨</span>
          <span className="settings-item-label">Design</span>
          <div className="settings-item-control theme-toggle-group">
            <button
              className={`theme-toggle-btn ${theme === 'auto' ? 'active' : ''}`}
              onClick={() => handleThemeChange('auto')}
            >
              Auto
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              ☀️ Hell
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              🌙 Dunkel
            </button>
          </div>
        </div>
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-info-row">
          <span className="settings-info-label">Name</span>
          <span className="settings-info-value">{userName}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Liste</span>
          <span className="settings-info-value">{listName}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Join-Code</span>
          <span className="settings-info-value">{joinCode}</span>
        </div>

        {editingName ? (
          <div className="settings-inline-form">
            <input
              className="settings-inline-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <button className="settings-btn settings-btn-primary" onClick={handleSaveName}>
              Speichern
            </button>
            <button className="settings-btn settings-btn-secondary" onClick={() => setEditingName(false)}>
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            className="settings-btn settings-btn-secondary"
            style={{ marginTop: '0.6rem', width: '100%' }}
            onClick={() => { setNewName(userName); setEditingName(true) }}
          >
            ✏️ Namen ändern
          </button>
        )}

        <button className="settings-btn-danger" onClick={onLeave}>
          Liste verlassen
        </button>
      </div>

      {/* ── Kategorien ──────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Kategorien</h3>
        <p className="settings-cat-hint">Kategorien für Einkaufsliste und Mitbringen getrennt verwalten.</p>
        {renderCategoryEditor('shopping', 'Einkaufsliste')}
        {renderCategoryEditor('bring', 'Mitbringen')}
      </div>

      {/* ── Info ─────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Info</h3>
        <div className="settings-info-block">
          <div className="settings-app-name">🇮🇹 Bella Mozzarella</div>
          <div className="settings-app-version">Version 1.0.0</div>
          <p className="settings-app-desc">
            Gemeinsame Einkaufsliste mit Realtime-Sync. Built with React, Supabase &amp; Vite.
          </p>
          <a
            className="settings-link"
            href="https://github.com/flokoko/BellaMozzarella"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Repository →
          </a>
        </div>
      </div>
    </div>
  )
}