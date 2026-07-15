import { useState, useEffect } from 'react'
import type { Meal, MealIdea, DayOfWeek, MealType } from '../types'
import { supabase } from '../lib/supabase'
import './MealPlanScreen.css'

interface MealPlanScreenProps {
  meals: Meal[]
  mealIdeas: MealIdea[]
  listId: string
  userName: string
  onMealsChange: () => void
  onIdeasChange: () => void
}

const DAYS: DayOfWeek[] = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const DAY_SHORT: Record<DayOfWeek, string> = {
  Montag: 'Mo', Dienstag: 'Di', Mittwoch: 'Mi', Donnerstag: 'Do',
  Freitag: 'Fr', Samstag: 'Sa', Sonntag: 'So',
}
const MEAL_TYPES: MealType[] = ['Frühstück', 'Mittagessen', 'Abendessen']
const MEAL_ICONS: Record<MealType, string> = {
  Frühstück: '☕',
  Mittagessen: '🥪',
  Abendessen: '🍝',
}
const MEAL_SHORT: Record<MealType, string> = {
  Frühstück: 'Früh',
  Mittagessen: 'Mittag',
  Abendessen: 'Abend',
}

export default function MealPlanScreen({
  meals,
  mealIdeas,
  listId,
  userName,
  onMealsChange,
  onIdeasChange,
}: MealPlanScreenProps) {
  const [section, setSection] = useState<'week' | 'ideas'>('week')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [newIdeaName, setNewIdeaName] = useState('')
  const [newIdeaTags, setNewIdeaTags] = useState('')
  const [planPickerFor, setPlanPickerFor] = useState<string | null>(null)
  const [planDay, setPlanDay] = useState<DayOfWeek>('Montag')
  const [planMealType, setPlanMealType] = useState<MealType>('Abendessen')

  // Track "today" so it stays correct if the app stays open past midnight
  const [todayName, setTodayName] = useState<DayOfWeek>(() =>
    new Date().toLocaleDateString('de-DE', { weekday: 'long' }) as DayOfWeek
  )
  useEffect(() => {
    const check = () => {
      const current = new Date().toLocaleDateString('de-DE', { weekday: 'long' }) as DayOfWeek
      setTodayName(prev => prev !== current ? current : prev)
    }
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  const getMeal = (day: DayOfWeek, type: MealType) =>
    meals.find((m) => m.day === day && m.meal_type === type)

  const startAdd = (day: DayOfWeek, type: MealType) => {
    const cellKey = `${day}-${type}`
    setEditingCell(cellKey)
    setEditName('')
    setEditNote('')
    setEditingMealId(null)
  }

  const startEdit = (meal: Meal) => {
    const cellKey = `${meal.day}-${meal.meal_type}`
    setEditingCell(cellKey)
    setEditingMealId(meal.id)
    setEditName(meal.name)
    setEditNote(meal.note ?? '')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditingMealId(null)
    setEditName('')
    setEditNote('')
  }

  const saveMeal = async (day: DayOfWeek, type: MealType) => {
    const n = editName.trim()
    if (!n) return
    if (editingMealId) {
      const { error } = await supabase
        .from('meals')
        .update({ name: n, note: editNote.trim() || null })
        .eq('id', editingMealId)
      if (error) {
        alert(`Fehler beim Speichern: ${error.message}`)
        return
      }
    } else {
      const { error } = await supabase.from('meals').insert({
        list_id: listId,
        day,
        meal_type: type,
        name: n,
        note: editNote.trim() || null,
        created_by: userName,
      })
      if (error) {
        alert(`Fehler beim Speichern: ${error.message}`)
        return
      }
    }
    navigator.vibrate?.(10)
    cancelEdit()
    onMealsChange()
  }

  const deleteMeal = async (meal: Meal) => {
    if (!confirm('Dieses Element wirklich löschen?')) return
    const { error } = await supabase.from('meals').delete().eq('id', meal.id)
    if (error) {
      alert(`Fehler beim Löschen: ${error.message}`)
      return
    }
    navigator.vibrate?.(10)
    onMealsChange()
  }

  const addIdea = async () => {
    const n = newIdeaName.trim()
    if (!n) return
    const { error } = await supabase.from('meal_ideas').insert({
      list_id: listId,
      name: n,
      tags: newIdeaTags.trim() || null,
      created_by: userName,
    })
    if (error) {
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }
    setNewIdeaName('')
    setNewIdeaTags('')
    navigator.vibrate?.(10)
    onIdeasChange()
  }

  const deleteIdea = async (idea: MealIdea) => {
    if (!confirm('Dieses Element wirklich löschen?')) return
    const { error } = await supabase.from('meal_ideas').delete().eq('id', idea.id)
    if (error) {
      alert(`Fehler beim Löschen: ${error.message}`)
      return
    }
    navigator.vibrate?.(10)
    onIdeasChange()
  }

  const planIdea = async (idea: MealIdea) => {
    const existing = getMeal(planDay, planMealType)
    if (existing) {
      if (!confirm(`Für ${planDay} ${planMealType} gibt es schon "${existing.name}". Ersetzen?`)) return
      // Delete existing meal first
      const { error: delErr } = await supabase.from('meals').delete().eq('id', existing.id)
      if (delErr) {
        alert(`Fehler: ${delErr.message}`)
        return
      }
    }
    const { error } = await supabase.from('meals').insert({
      list_id: listId,
      day: planDay,
      meal_type: planMealType,
      name: idea.name,
      note: idea.tags ?? null,
      created_by: userName,
    })
    if (error) {
      alert(`Fehler beim Eintragen: ${error.message}`)
      return
    }
    setPlanPickerFor(null)
    navigator.vibrate?.(10)
    onMealsChange()
  }

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return []
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  const mealCount = meals.length
  const ideaCount = mealIdeas.length

  return (
    <div className="mealplan-screen">
      {/* ── Sub-Toggle ── */}
      <div className="mealplan-toggle">
        <button
          className={`mealplan-toggle-btn ${section === 'week' ? 'active' : ''}`}
          onClick={() => setSection('week')}
        >
          📅 Wochenplan{mealCount > 0 && <span className="mealplan-toggle-badge">{mealCount}</span>}
        </button>
        <button
          className={`mealplan-toggle-btn ${section === 'ideas' ? 'active' : ''}`}
          onClick={() => setSection('ideas')}
        >
          💡 Ideen{ideaCount > 0 && <span className="mealplan-toggle-badge">{ideaCount}</span>}
        </button>
      </div>

      {/* ── Wochenplan ── */}
      {section === 'week' && (
        <section className="mealplan-section" key="week">
          <div className="mealplan-week">
            {DAYS.map((day) => {
              const dayMeals = MEAL_TYPES.map((t) => getMeal(day, t)).filter(Boolean)
              const hasMeals = dayMeals.length > 0
              return (
                <div key={day} className={`meal-day-card ${hasMeals ? 'has-meals' : ''} ${day === todayName ? 'today' : ''}`}>
                  <div className="meal-day-header">
                    <span className="meal-day-abbr">{DAY_SHORT[day]}</span>
                    <span className="meal-day-full">{day}</span>
                    {day === todayName && <span className="meal-day-today-badge">Heute</span>}
                    {hasMeals && (
                      <span className="meal-day-count">{dayMeals.length}/3</span>
                    )}
                  </div>
                  <div className="meal-day-grid">
                    {MEAL_TYPES.map((type) => {
                      const cellKey = `${day}-${type}`
                      const meal = getMeal(day, type)
                      const isEditing = editingCell === cellKey

                      if (isEditing) {
                        return (
                          <div key={type} className="meal-cell meal-cell-editing">
                            <div className="meal-cell-icon">{MEAL_ICONS[type]}</div>
                            <input
                              className="meal-input"
                              type="text"
                              placeholder="Gerichtname"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveMeal(day, type)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              autoFocus
                            />
                            <input
                              className="meal-input meal-input-note"
                              type="text"
                              placeholder="Notiz (optional)"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveMeal(day, type)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                            />
                            <div className="meal-cell-actions">
                              <button className="meal-btn-cancel" onClick={cancelEdit}>
                                ✕
                              </button>
                              <button
                                className="meal-btn-save"
                                onClick={() => saveMeal(day, type)}
                                disabled={!editName.trim()}
                              >
                                ✓
                              </button>
                            </div>
                          </div>
                        )
                      }

                      if (meal) {
                        return (
                          <div key={type} className="meal-cell meal-cell-filled">
                            <div className="meal-cell-top">
                              <span className="meal-cell-icon" title={type}>{MEAL_ICONS[type]}</span>
                              <div className="meal-cell-buttons">
                                <button
                                  className="meal-cell-btn"
                                  onClick={() => startEdit(meal)}
                                  aria-label="Bearbeiten"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="meal-cell-btn"
                                  onClick={() => deleteMeal(meal)}
                                  aria-label="Löschen"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                            <div className="meal-cell-name">{meal.name}</div>
                            {meal.note && <div className="meal-cell-note">{meal.note}</div>}
                          </div>
                        )
                      }

                      return (
                        <button
                          key={type}
                          className="meal-cell meal-cell-empty"
                          onClick={() => startAdd(day, type)}
                          title={`${type} hinzufügen`}
                        >
                          <span className="meal-cell-icon">{MEAL_ICONS[type]}</span>
                          <span className="meal-cell-type-short">{MEAL_SHORT[type]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Ideen ── */}
      {section === 'ideas' && (
        <section className="mealplan-section" key="ideas">
          <div className="mealplan-idea-form">
            <input
              className="meal-input"
              type="text"
              placeholder="Gerichtname"
              value={newIdeaName}
              onChange={(e) => setNewIdeaName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
            />
            <input
              className="meal-input meal-input-tags"
              type="text"
              placeholder="Tags (z.B. vegan, schnell, italienisch)"
              value={newIdeaTags}
              onChange={(e) => setNewIdeaTags(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
            />
            <button className="meal-btn-save meal-btn-add" onClick={addIdea} disabled={!newIdeaName.trim()}>
              + Hinzufügen
            </button>
          </div>

          {mealIdeas.length === 0 && (
            <p className="mealplan-empty">Noch keine Ideen — füge welche hinzu! 🍕</p>
          )}

          <div className="mealplan-idea-list">
            {mealIdeas.map((idea) => {
              const tags = parseTags(idea.tags)
              const isPickerOpen = planPickerFor === idea.id
              return (
                <div key={idea.id} className="meal-idea-card">
                  <div className="meal-idea-top">
                    <span className="meal-idea-name">{idea.name}</span>
                    <div className="meal-idea-buttons">
                      <button
                        className="meal-idea-plan-btn"
                        onClick={() => {
                          setPlanPickerFor(isPickerOpen ? null : idea.id)
                          setPlanDay('Montag')
                          setPlanMealType('Abendessen')
                        }}
                      >
                        → Plan
                      </button>
                      <button
                        className="meal-cell-btn"
                        onClick={() => deleteIdea(idea)}
                        aria-label="Löschen"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  {tags.length > 0 && (
                    <div className="meal-idea-tags">
                      {tags.map((tag, i) => (
                        <span key={i} className="meal-tag-badge">{tag}</span>
                      ))}
                    </div>
                  )}
                  {idea.created_by && (
                    <div className="meal-cell-by">von {idea.created_by}</div>
                  )}
                  {isPickerOpen && (
                    <div className="meal-plan-picker">
                      <select
                        className="meal-select"
                        value={planDay}
                        onChange={(e) => setPlanDay(e.target.value as DayOfWeek)}
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <select
                        className="meal-select"
                        value={planMealType}
                        onChange={(e) => setPlanMealType(e.target.value as MealType)}
                      >
                        {MEAL_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {MEAL_ICONS[t]} {t}
                          </option>
                        ))}
                      </select>
                      <div className="meal-cell-actions">
                        <button
                          className="meal-btn-cancel"
                          onClick={() => setPlanPickerFor(null)}
                        >
                          ✕
                        </button>
                        <button className="meal-btn-save" onClick={() => planIdea(idea)}>
                          ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}