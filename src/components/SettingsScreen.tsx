import { useState, useEffect } from 'react'
import type { ItemCategory, ListType, Participant } from '../types'
import type { ThemeMode } from '../lib/theme'
import { getTheme, setTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { useCategories } from '../hooks/useCategories'
import { APP_VERSION } from '../version'

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
  participants: Participant[]
  onParticipantsChange: () => void
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
  participants,
  onParticipantsChange,
}: SettingsScreenProps) {
  const [theme, setThemeState] = useState<ThemeMode>('auto')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(userName)
  const [copied, setCopied] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState('')

  const { updateCategory, deleteCategory, addCategory } = useCategories(onCategoriesChange)

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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddParticipant = async () => {
    const n = newParticipantName.trim()
    if (!n) return
    // Case-insensitive duplicate check
    const exists = participants.find(p => p.name.toLowerCase() === n.toLowerCase())
    if (exists) {
      alert(`Teilnehmer "${exists.name}" existiert bereits!`)
      return
    }
    const { error } = await supabase.from('participants').insert({ list_id: listId, name: n })
    if (error) {
      alert(`Fehler: ${error.message}`)
      return
    }
    navigator.vibrate?.(10)
    setNewParticipantName('')
    setShowAddParticipant(false)
    onParticipantsChange()
  }

  const handleDeleteParticipant = async (p: Participant) => {
    if (!confirm(`Teilnehmer "${p.name}" entfernen?`)) return
    const { error } = await supabase.from('participants').delete().eq('id', p.id)
    if (error) {
      alert(`Fehler: ${error.message}`)
      return
    }
    navigator.vibrate?.(10)
    onParticipantsChange()
  }

  const handleAddCategory = (listType: ListType) => {
    const sortOrder = categories.filter((c) => c.list_type === listType).length + 1
    addCategory(listId, listType, sortOrder)
  }

  const renderCategoryEditor = (listType: ListType, title: string) => {
    const cats = categories.filter((c) => c.list_type === listType)
    return (
      <div className="settings-cat-subsection" key={listType}>
        <div className="settings-cat-subsection-header">
          <span className="settings-cat-subsection-title">{title}</span>
          <button
            className="settings-cat-add-btn"
            onClick={() => handleAddCategory(listType)}
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
              onClick={() => { if (confirm('Dieses Element wirklich löschen?')) deleteCategory(cat.id) }}
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
          <div className="settings-join-code-wrap">
            <span className="settings-info-value">{joinCode}</span>
            <button className="settings-copy-btn" onClick={handleCopyCode}>
              {copied ? '✓ Kopiert!' : '📋 Kopieren'}
            </button>
          </div>
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

      {/* ── Teilnehmer ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Teilnehmer</h3>
        <p className="settings-cat-hint">{participants.length} {participants.length === 1 ? 'Person' : 'Personen'} in dieser Liste.</p>
        {participants.map((p) => (
          <div key={p.id} className="settings-cat-item">
            <span className="settings-participant-name">{p.name}</span>
            <button
              className="settings-cat-delete-btn"
              onClick={() => handleDeleteParticipant(p)}
              aria-label="Teilnehmer entfernen"
            >
              🗑
            </button>
          </div>
        ))}
        {participants.length === 0 && (
          <p className="settings-cat-empty">Noch keine Teilnehmer</p>
        )}
        {showAddParticipant ? (
          <div className="settings-inline-form">
            <input
              className="settings-inline-input"
              type="text"
              placeholder="Name"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
              autoFocus
            />
            <button className="settings-btn settings-btn-primary" onClick={handleAddParticipant}>
              Hinzufügen
            </button>
            <button className="settings-btn settings-btn-secondary" onClick={() => { setShowAddParticipant(false); setNewParticipantName('') }}>
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            className="settings-btn settings-btn-secondary"
            style={{ marginTop: '0.6rem', width: '100%' }}
            onClick={() => setShowAddParticipant(true)}
          >
            + Teilnehmer hinzufügen
          </button>
        )}
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
          <div className="settings-app-version">Version {APP_VERSION}</div>
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