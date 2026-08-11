import { useState, useMemo, useCallback } from 'react'
import type { ExpenseQuota, ItemCategory } from '../types'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

interface ExpenseQuotaManagerProps {
  listId: string
  expenseCategories: ItemCategory[]
  knownPersons: string[]
  expenseQuotas: ExpenseQuota[]
  onQuotasChange: () => void
}

export default function ExpenseQuotaManager({
  listId,
  expenseCategories,
  knownPersons,
  expenseQuotas,
  onQuotasChange,
}: ExpenseQuotaManagerProps) {
  const { toast } = useToast()
  const [editingCategory, setEditingCategory] = useState<string | null>(null)

  // ── Build a map: category -> { personName -> percent } ──
  const quotaMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const q of expenseQuotas) {
      if (!map[q.category]) map[q.category] = {}
      map[q.category][q.person_name] = q.percent
    }
    return map
  }, [expenseQuotas])

  // ── Local draft state for the category being edited ──
  const [draft, setDraft] = useState<Record<string, string>>({})

  // ── Start editing a category: load existing quotas into draft ──
  const startEdit = useCallback((category: string) => {
    const existing = quotaMap[category] ?? {}
    const newDraft: Record<string, string> = {}
    for (const person of knownPersons) {
      const val = existing[person] ?? 0
      newDraft[person] = String(val)
    }
    setDraft(newDraft)
    setEditingCategory(category)
  }, [quotaMap, knownPersons])

  // ── Draft sum for the current category ──
  const draftSum = useMemo(() => {
    if (!editingCategory) return 0
    return knownPersons.reduce((sum, p) => {
      const val = parseFloat(draft[p] ?? '0')
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [editingCategory, draft, knownPersons])

  const sumOk = Math.abs(draftSum - 100) < 0.01

  // ── Save quotas for the current category ──
  const handleSave = useCallback(async () => {
    if (!editingCategory || !sumOk) return

    // Build upsert rows
    const rows = knownPersons.map(person => ({
      list_id: listId,
      category: editingCategory,
      person_name: person,
      percent: parseFloat(draft[person] ?? '0') || 0,
    }))

    // Delete existing quotas for this list+category, then insert
    const { error: delError } = await supabase
      .from('expense_quotas')
      .delete()
      .eq('list_id', listId)
      .eq('category', editingCategory)

    if (delError) {
      toast(`Fehler beim Aktualisieren: ${delError.message}`, 'error')
      return
    }

    // Only insert rows where percent > 0 OR the person had a previous quota
    // (We keep all persons so 0% is explicitly stored)
    const { error: insError } = await supabase
      .from('expense_quotas')
      .insert(rows)

    if (insError) {
      toast(`Fehler beim Speichern: ${insError.message}`, 'error')
      return
    }

    navigator.vibrate?.(10)
    toast('Quoten gespeichert', 'success')
    setEditingCategory(null)
    setDraft({})
    onQuotasChange()
  }, [editingCategory, sumOk, knownPersons, draft, listId, toast, onQuotasChange])

  const handleCancel = useCallback(() => {
    setEditingCategory(null)
    setDraft({})
  }, [])

  // ── Check if a category has a quota config ──
  const hasConfig = useCallback((category: string) => {
    return (quotaMap[category] && Object.keys(quotaMap[category]).length > 0) ?? false
  }, [quotaMap])

  if (expenseCategories.length === 0) {
    return (
      <div className="expense-empty">
        <span>Keine Ausgaben-Kategorien vorhanden.</span>
        <span style={{ fontSize: '0.78rem' }}>Erstelle zuerst Kategorien im Ausgaben-Tab.</span>
      </div>
    )
  }

  return (
    <div className="quota-manager">
      <div className="quota-info-banner">
        Konfiguriere feste Prozent-Quoten pro Kategorie. Ausgaben in einer Kategorie mit Quoten werden automatisch nach diesen Prozentsätzen aufgeteilt — die manuelle Auswahl wird überschrieben.
      </div>

      {expenseCategories.map(cat => {
        const isEditing = editingCategory === cat.name
        const configured = hasConfig(cat.name)
        const existing = quotaMap[cat.name] ?? {}

        return (
          <div key={cat.id} className="quota-category-card">
            <div className="quota-category-header">
              <span className="quota-category-title">
                {cat.icon} {cat.name}
                {configured && <span className="quota-badge-active">Aktiv</span>}
              </span>
              {!isEditing ? (
                <button
                  className="quota-edit-btn"
                  onClick={() => startEdit(cat.name)}
                  type="button"
                >
                  {configured ? 'Bearbeiten' : 'Festlegen'}
                </button>
              ) : null}
            </div>

            {isEditing && (
              <div className="quota-edit-section">
                <div className="quota-person-list">
                  {knownPersons.map(person => (
                    <div key={person} className="quota-person-row">
                      <span className="quota-person-name">{person}</span>
                      <div className="quota-person-input-wrap">
                        <input
                          className="quota-percent-input"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={draft[person] ?? '0'}
                          onChange={(e) => {
                            setDraft(prev => ({ ...prev, [person]: e.target.value }))
                          }}
                        />
                        <span className="quota-percent-sign">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`quota-sum-row ${sumOk ? 'ok' : 'warn'}`}>
                  <span>Summe: {draftSum.toFixed(1)}%</span>
                  <span>
                    {sumOk
                      ? '✓ Bereit zum Speichern'
                      : `Muss 100% ergeben (noch ${(100 - draftSum).toFixed(1)}%)`}
                  </span>
                </div>

                <div className="quota-actions">
                  <button className="expense-btn-cancel" onClick={handleCancel} type="button">
                    Abbrechen
                  </button>
                  <button
                    className="expense-btn-save"
                    onClick={handleSave}
                    disabled={!sumOk}
                    type="button"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}

            {!isEditing && configured && (
              <div className="quota-summary">
                {knownPersons
                  .filter(p => (existing[p] ?? 0) > 0)
                  .map(p => (
                    <span key={p} className="quota-summary-chip">
                      {p}: {existing[p]}%
                    </span>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}