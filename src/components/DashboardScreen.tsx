import { useState } from 'react'
import type { QuickNote, TabView } from '../types'
import { supabase } from '../lib/supabase'
import './DashboardScreen.css'

interface DashboardScreenProps {
  listId: string
  userName: string
  listName: string
  shoppingCount: number
  shoppingChecked: number
  bringCount: number
  mealCount: number
  notes: QuickNote[]
  onNavigate: (tab: TabView) => void
  onNotesChange: () => void
}

export default function DashboardScreen({
  listId,
  userName,
  shoppingCount,
  shoppingChecked,
  bringCount,
  mealCount,
  notes,
  onNavigate,
  onNotesChange,
}: DashboardScreenProps) {
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const handleSave = async () => {
    const content = formContent.trim()
    if (!content) return
    const { error } = await supabase.from('notes').insert({
      list_id: listId,
      title: formTitle.trim() || null,
      content,
      created_by: userName,
    })
    if (error) {
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }
    setFormTitle('')
    setFormContent('')
    setShowForm(false)
    onNotesChange()
  }

  const handleDelete = async (note: QuickNote) => {
    const { error } = await supabase.from('notes').delete().eq('id', note.id)
    if (error) {
      alert(`Fehler beim Löschen: ${error.message}`)
      return
    }
    onNotesChange()
  }

  const startEdit = (note: QuickNote) => {
    setEditingId(note.id)
    setEditTitle(note.title ?? '')
    setEditContent(note.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  const handleUpdate = async (note: QuickNote) => {
    const content = editContent.trim()
    if (!content) return
    const { error } = await supabase
      .from('notes')
      .update({
        title: editTitle.trim() || null,
        content,
      })
      .eq('id', note.id)
    if (error) {
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }
    cancelEdit()
    onNotesChange()
  }

  const shoppingStatus = shoppingCount > 0 ? `${shoppingChecked}/${shoppingCount} erledigt` : 'Keine Items'
  const bringStatus = bringCount > 0 ? `${bringCount} Items` : 'Nichts zu mitbringen'
  const mealStatus = mealCount > 0 ? `${mealCount} Gerichte` : 'Noch nichts geplant'

  return (
    <div className="dashboard-screen">
      {/* ── Feature Cards ── */}
      <div className="dashboard-cards">
        <button className="dash-card" onClick={() => onNavigate('list')}>
          <div className="dash-card-icon">🛒</div>
          <div className="dash-card-body">
            <div className="dash-card-title">Einkaufsliste</div>
            <div className="dash-card-sub">{shoppingStatus}</div>
          </div>
          {shoppingCount > 0 && (
            <span className="dash-card-badge">{shoppingChecked}/{shoppingCount}</span>
          )}
        </button>

        <button className="dash-card" onClick={() => onNavigate('bring')}>
          <div className="dash-card-icon">🎒</div>
          <div className="dash-card-body">
            <div className="dash-card-title">Mitbringen</div>
            <div className="dash-card-sub">{bringStatus}</div>
          </div>
          {bringCount > 0 && (
            <span className="dash-card-badge">{bringCount}</span>
          )}
        </button>

        <button className="dash-card" onClick={() => onNavigate('mealplan')}>
          <div className="dash-card-icon">🍝</div>
          <div className="dash-card-body">
            <div className="dash-card-title">Essensplan</div>
            <div className="dash-card-sub">{mealStatus}</div>
          </div>
          {mealCount > 0 && (
            <span className="dash-card-badge">{mealCount}</span>
          )}
        </button>

        <button className="dash-card" onClick={() => onNavigate('settings')}>
          <div className="dash-card-icon">⚙️</div>
          <div className="dash-card-body">
            <div className="dash-card-title">Einstellungen</div>
            <div className="dash-card-sub">Profil, Kategorien, Design</div>
          </div>
        </button>
      </div>

      {/* ── Quick Notes ── */}
      <section className="dash-notes-section">
        <h2 className="dash-section-title">📝 Kurznotizen</h2>

        {!showForm && (
          <button className="dash-add-btn" onClick={() => setShowForm(true)}>
            + Notiz hinzufügen
          </button>
        )}

        {showForm && (
          <div className="dash-note-form">
            <input
              className="dash-note-input"
              type="text"
              placeholder="Titel (z.B. Hausadresse)"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
            <textarea
              className="dash-note-textarea"
              placeholder="Notiz eingeben…"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={3}
            />
            <div className="dash-note-form-actions">
              <button className="dash-btn-cancel" onClick={() => { setShowForm(false); setFormTitle(''); setFormContent('') }}>
                Abbrechen
              </button>
              <button className="dash-btn-save" onClick={handleSave} disabled={!formContent.trim()}>
                Speichern
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 && !showForm && (
          <p className="dash-notes-empty">Noch keine Notizen — füre Infos wie die Hausadresse hinzu! 📝</p>
        )}

        <div className="dash-notes-list">
          {notes.map((note) => {
            const isEditing = editingId === note.id
            if (isEditing) {
              return (
                <div key={note.id} className="dash-note-card dash-note-card-editing">
                  <input
                    className="dash-note-input"
                    type="text"
                    placeholder="Titel (optional)"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <textarea
                    className="dash-note-textarea"
                    placeholder="Notiz eingeben…"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                  <div className="dash-note-form-actions">
                    <button className="dash-btn-cancel" onClick={cancelEdit}>Abbrechen</button>
                    <button className="dash-btn-save" onClick={() => handleUpdate(note)} disabled={!editContent.trim()}>
                      Speichern
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div key={note.id} className="dash-note-card" onClick={() => startEdit(note)}>
                <div className="dash-note-card-top">
                  <div className="dash-note-card-content">
                    {note.title && <div className="dash-note-title">{note.title}</div>}
                    <div className="dash-note-text">{note.content}</div>
                  </div>
                  <button
                    className="dash-note-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(note) }}
                    aria-label="Löschen"
                  >
                    🗑
                  </button>
                </div>
                {note.created_by && <div className="dash-note-by">von {note.created_by}</div>}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}