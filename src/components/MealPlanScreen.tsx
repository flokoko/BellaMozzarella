import { useState, useEffect, useCallback, useMemo } from 'react'
import { Coffee, Sandwich, UtensilsCrossed, Calendar, Pizza, X, Check, Pencil, Trash2, Carrot, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { Meal, MealIdea, DayOfWeek, MealType } from '../types'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import './MealPlanScreen.css'

interface MealIngredient {
  id: string
  meal_id: string
  name: string
  quantity: string | null
  created_at: string
}

interface MealPlanScreenProps {
  meals: Meal[]
  mealIdeas: MealIdea[]
  listId: string
  userName: string
  onMealsChange: () => void
  onIdeasChange: () => void
  onAddToShoppingList?: (ingredients: { name: string; quantity: string | null }[]) => void
}

const DAYS: DayOfWeek[] = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const DAY_SHORT: Record<DayOfWeek, string> = {
  Montag: 'Mo', Dienstag: 'Di', Mittwoch: 'Mi', Donnerstag: 'Do',
  Freitag: 'Fr', Samstag: 'Sa', Sonntag: 'So',
}
const MEAL_TYPES: MealType[] = ['Frühstück', 'Mittagessen', 'Abendessen']
const MEAL_ICONS: Record<MealType, LucideIcon> = {
  Frühstück: Coffee,
  Mittagessen: Sandwich,
  Abendessen: UtensilsCrossed,
}
const MEAL_EMOJI: Record<MealType, string> = {
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
  onAddToShoppingList,
}: MealPlanScreenProps) {
  const { toast, confirm } = useToast()
  const { isOnline, enqueue } = useOfflineQueue()
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
  const [searchQuery, setSearchQuery] = useState('')

  // ── Ingredient state ──
  const [ingredientsByMeal, setIngredientsByMeal] = useState<Record<string, MealIngredient[]>>({})
  const [ingredientEditorFor, setIngredientEditorFor] = useState<string | null>(null)
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientQty, setNewIngredientQty] = useState('')
  const [ingredientsLoading, setIngredientsLoading] = useState(false)

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
      if (isOnline) {
        const { error } = await supabase
          .from('meals')
          .update({ name: n, note: editNote.trim() || null })
          .eq('id', editingMealId)
        if (error) {
          toast(`Fehler beim Speichern: ${error.message}`, 'error')
          return
        }
      } else {
        enqueue({
          type: 'update',
          table: 'meals',
          payload: { name: n, note: editNote.trim() || null },
          filterColumn: 'id',
          filterValue: editingMealId,
        })
      }
    } else {
      if (isOnline) {
        const { error } = await supabase.from('meals').insert({
          list_id: listId,
          day,
          meal_type: type,
          name: n,
          note: editNote.trim() || null,
          created_by: userName,
        })
        if (error) {
          toast(`Fehler beim Speichern: ${error.message}`, 'error')
          return
        }
      } else {
        enqueue({
          type: 'insert',
          table: 'meals',
          payload: {
            list_id: listId,
            day,
            meal_type: type,
            name: n,
            note: editNote.trim() || null,
            created_by: userName,
          },
        })
      }
    }
    navigator.vibrate?.(10)
    cancelEdit()
    onMealsChange()
  }

  const deleteMeal = (meal: Meal) => {
    confirm('Dieses Element wirklich löschen?', async () => {
      if (isOnline) {
        const { error } = await supabase.from('meals').delete().eq('id', meal.id)
        if (error) {
          toast(`Fehler beim Löschen: ${error.message}`, 'error')
          return
        }
      } else {
        enqueue({
          type: 'delete',
          table: 'meals',
          payload: {},
          filterColumn: 'id',
          filterValue: meal.id,
        })
      }
      navigator.vibrate?.(10)
      onMealsChange()
    })
  }

  const addIdea = async () => {
    const n = newIdeaName.trim()
    if (!n) return
    if (isOnline) {
      const { error } = await supabase.from('meal_ideas').insert({
        list_id: listId,
        name: n,
        tags: newIdeaTags.trim() || null,
        created_by: userName,
      })
      if (error) {
        toast(`Fehler beim Speichern: ${error.message}`, 'error')
        return
      }
    } else {
      enqueue({
        type: 'insert',
        table: 'meal_ideas',
        payload: {
          list_id: listId,
          name: n,
          tags: newIdeaTags.trim() || null,
          created_by: userName,
        },
      })
    }
    setNewIdeaName('')
    setNewIdeaTags('')
    navigator.vibrate?.(10)
    onIdeasChange()
  }

  const deleteIdea = (idea: MealIdea) => {
    confirm('Dieses Element wirklich löschen?', async () => {
      if (isOnline) {
        const { error } = await supabase.from('meal_ideas').delete().eq('id', idea.id)
        if (error) {
          toast(`Fehler beim Löschen: ${error.message}`, 'error')
          return
        }
      } else {
        enqueue({
          type: 'delete',
          table: 'meal_ideas',
          payload: {},
          filterColumn: 'id',
          filterValue: idea.id,
        })
      }
      navigator.vibrate?.(10)
      onIdeasChange()
    })
  }

  const planIdea = async (idea: MealIdea) => {
    const existing = getMeal(planDay, planMealType)
    const doInsert = async () => {
      if (isOnline) {
        const { error } = await supabase.from('meals').insert({
          list_id: listId,
          day: planDay,
          meal_type: planMealType,
          name: idea.name,
          note: idea.tags ?? null,
          created_by: userName,
        })
        if (error) {
          toast(`Fehler beim Eintragen: ${error.message}`, 'error')
          return
        }
      } else {
        enqueue({
          type: 'insert',
          table: 'meals',
          payload: {
            list_id: listId,
            day: planDay,
            meal_type: planMealType,
            name: idea.name,
            note: idea.tags ?? null,
            created_by: userName,
          },
        })
      }
      setPlanPickerFor(null)
      navigator.vibrate?.(10)
      onMealsChange()
    }

    if (existing) {
      confirm(`Für ${planDay} ${planMealType} gibt es schon "${existing.name}". Ersetzen?`, async () => {
        if (isOnline) {
          const { error: delErr } = await supabase.from('meals').delete().eq('id', existing.id)
          if (delErr) {
            toast(`Fehler: ${delErr.message}`, 'error')
            return
          }
        } else {
          enqueue({
            type: 'delete',
            table: 'meals',
            payload: {},
            filterColumn: 'id',
            filterValue: existing.id,
          })
        }
        await doInsert()
      })
    } else {
      await doInsert()
    }
  }

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return []
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  // ── Ingredient functions ──
  const fetchIngredients = useCallback(async (mealId: string) => {
    if (!isOnline) return
    setIngredientsLoading(true)
    const { data, error } = await supabase
      .from('meal_ingredients')
      .select('*')
      .eq('meal_id', mealId)
      .order('created_at', { ascending: true })
    if (error) {
      toast(`Fehler beim Laden der Zutaten: ${error.message}`, 'error')
    } else {
      setIngredientsByMeal((prev) => ({ ...prev, [mealId]: data as MealIngredient[] }))
    }
    setIngredientsLoading(false)
  }, [isOnline, toast])

  const toggleIngredientEditor = (mealId: string) => {
    if (ingredientEditorFor === mealId) {
      setIngredientEditorFor(null)
    } else {
      setIngredientEditorFor(mealId)
      if (!ingredientsByMeal[mealId]) {
        fetchIngredients(mealId)
      }
    }
    setNewIngredientName('')
    setNewIngredientQty('')
  }

  const addIngredient = async (mealId: string) => {
    const n = newIngredientName.trim()
    if (!n) return
    const q = newIngredientQty.trim() || null
    if (isOnline) {
      const { data, error } = await supabase
        .from('meal_ingredients')
        .insert({ meal_id: mealId, name: n, quantity: q })
        .select()
      if (error) {
        toast(`Fehler beim Hinzufügen: ${error.message}`, 'error')
        return
      }
      setIngredientsByMeal((prev) => ({
        ...prev,
        [mealId]: [...(prev[mealId] || []), ...(data as MealIngredient[])],
      }))
    } else {
      enqueue({
        type: 'insert',
        table: 'meal_ingredients',
        payload: { meal_id: mealId, name: n, quantity: q },
      })
      setIngredientsByMeal((prev) => ({
        ...prev,
        [mealId]: [...(prev[mealId] || []), {
          id: crypto.randomUUID(),
          meal_id: mealId,
          name: n,
          quantity: q,
          created_at: new Date().toISOString(),
        }],
      }))
    }
    setNewIngredientName('')
    setNewIngredientQty('')
    navigator.vibrate?.(10)
  }

  const deleteIngredient = async (mealId: string, ingredientId: string) => {
    if (isOnline) {
      const { error } = await supabase
        .from('meal_ingredients')
        .delete()
        .eq('id', ingredientId)
      if (error) {
        toast(`Fehler beim Löschen: ${error.message}`, 'error')
        return
      }
    } else {
      enqueue({
        type: 'delete',
        table: 'meal_ingredients',
        payload: {},
        filterColumn: 'id',
        filterValue: ingredientId,
      })
    }
    setIngredientsByMeal((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).filter((i) => i.id !== ingredientId),
    }))
    navigator.vibrate?.(10)
  }

  const addToShoppingList = async (mealId: string) => {
    const ingredients = ingredientsByMeal[mealId] || []
    if (ingredients.length === 0) {
      toast('Keine Zutaten vorhanden — füge zuerst Zutaten hinzu!', 'error')
      return
    }
    const rows = ingredients.map((i) => ({
      list_type: 'shopping' as const,
      name: i.name,
      quantity: i.quantity,
      category: 'Essen',
      assigned_to: null,
      is_checked: false,
      is_brought: false,
      created_by: userName,
    }))
    if (isOnline) {
      const { error } = await supabase.from('items').insert(rows)
      if (error) {
        toast(`Fehler: ${error.message}`, 'error')
        return
      }
    } else {
      for (const row of rows) {
        enqueue({ type: 'insert', table: 'items', payload: row })
      }
    }
    navigator.vibrate?.(10)
    toast('Zutaten zur Einkaufsliste hinzugefügt!', 'success')
    onAddToShoppingList?.(ingredients.map((i) => ({ name: i.name, quantity: i.quantity })))
  }

  // ── Search filtering ──
  const searchLower = searchQuery.trim().toLowerCase()
  const filteredMeals = useMemo(() => {
    if (!searchLower) return meals
    return meals.filter((m) =>
      m.name.toLowerCase().includes(searchLower) ||
      (m.note != null && m.note.toLowerCase().includes(searchLower))
    )
  }, [meals, searchLower])

  const filteredMealIdeas = useMemo(() => {
    if (!searchLower) return mealIdeas
    return mealIdeas.filter((idea) => {
      const nameMatch = idea.name.toLowerCase().includes(searchLower)
      if (nameMatch) return true
      const tags = parseTags(idea.tags)
      return tags.some((t) => t.toLowerCase().includes(searchLower))
    })
  }, [mealIdeas, searchLower])

  // Days that have at least one matching meal (for hiding empty days during search)
  const visibleDays = useMemo(() => {
    if (!searchLower) return DAYS
    return DAYS.filter((day) =>
      MEAL_TYPES.some((type) => {
        const meal = filteredMeals.find((m) => m.day === day && m.meal_type === type)
        return meal != null
      })
    )
  }, [filteredMeals, searchLower])

  const mealCount = meals.length
  const ideaCount = mealIdeas.length

  return (
    <div className="mealplan-screen">
      {/* ── Sub-Toggle ── */}
      <div className="mealplan-toggle">
        <button
          className={`mealplan-toggle-btn ${section === 'week' ? 'active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); setSection('week') }}
        >
          <Calendar size={16} strokeWidth={2} /> Wochenplan{mealCount > 0 && <span className="mealplan-toggle-badge">{mealCount}</span>}
        </button>
        <button
          className={`mealplan-toggle-btn ${section === 'ideas' ? 'active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); setSection('ideas') }}
        >
          <Pizza size={16} strokeWidth={2} /> Ideen{ideaCount > 0 && <span className="mealplan-toggle-badge">{ideaCount}</span>}
        </button>
      </div>

      {/* ── Suche ── */}
      <input
        type="text"
        className="mealplan-search-input"
        placeholder="🔍 Suchen…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* ── Wochenplan ── */}
      {section === 'week' && (
        <section className="mealplan-section" key="week">
          {visibleDays.length === 0 && searchLower && (
            <p className="mealplan-empty"><Pizza size={28} strokeWidth={1.5} /> Keine Treffer im Wochenplan!</p>
          )}
          <div className="mealplan-week">
            {visibleDays.map((day) => {
              const dayMeals = MEAL_TYPES.map((t) => filteredMeals.find((m) => m.day === day && m.meal_type === t)).filter(Boolean)
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
                      const meal = filteredMeals.find((m) => m.day === day && m.meal_type === type)
                      const isEditing = editingCell === cellKey

                      if (isEditing) {
                        return (
                          <div key={type} className="meal-cell meal-cell-editing">
                            <div className={`meal-cell-icon meal-icon-${type}`}>{(() => { const Icon = MEAL_ICONS[type]; return <Icon size={14} strokeWidth={2} /> })()}</div>
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
                                <X size={14} strokeWidth={2} />
                              </button>
                              <button
                                className="meal-btn-save"
                                onClick={() => saveMeal(day, type)}
                                disabled={!editName.trim()}
                              >
                                <Check size={14} strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        )
                      }

                      if (meal) {
                        return (
                          <div key={type} className="meal-cell meal-cell-filled">
                            <div className="meal-cell-top">
                              <span className={`meal-cell-icon meal-icon-${type}`} title={type}>{(() => { const Icon = MEAL_ICONS[type]; return <Icon size={14} strokeWidth={2} /> })()}</span>
                              <div className="meal-cell-buttons">
                                <button
                                  className="meal-cell-btn"
                                  onClick={() => toggleIngredientEditor(meal.id)}
                                  aria-label="Zutaten"
                                  title="Zutaten"
                                >
                                  <Carrot size={14} strokeWidth={2} />
                                </button>
                                <button
                                  className="meal-cell-btn"
                                  onClick={() => startEdit(meal)}
                                  aria-label="Bearbeiten"
                                >
                                  <Pencil size={14} strokeWidth={2} />
                                </button>
                                <button
                                  className="meal-cell-btn"
                                  onClick={() => deleteMeal(meal)}
                                  aria-label="Löschen"
                                >
                                  <Trash2 size={14} strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                            <div className="meal-cell-name">{meal.name}</div>
                            {meal.note && <div className="meal-cell-note">{meal.note}</div>}

                            {ingredientEditorFor === meal.id && (
                              <div className="ingredient-editor">
                                <div className="ingredient-editor-header">🥕 Zutaten</div>
                                {ingredientsLoading && <div className="ingredient-loading">Lade…</div>}
                                {!ingredientsLoading && (ingredientsByMeal[meal.id] || []).length === 0 && (
                                  <div className="ingredient-empty">Noch keine Zutaten</div>
                                )}
                                {(ingredientsByMeal[meal.id] || []).map((ing) => (
                                  <div key={ing.id} className="ingredient-row">
                                    <span className="ingredient-name">{ing.name}</span>
                                    {ing.quantity && <span className="ingredient-qty">{ing.quantity}</span>}
                                    <button
                                      className="ingredient-delete-btn"
                                      onClick={() => deleteIngredient(meal.id, ing.id)}
                                      aria-label="Zutat löschen"
                                    >
                                      <X size={12} strokeWidth={2} />
                                    </button>
                                  </div>
                                ))}
                                <div className="ingredient-add-form">
                                  <input
                                    className="meal-input ingredient-input-name"
                                    type="text"
                                    placeholder="Zutat"
                                    value={newIngredientName}
                                    onChange={(e) => setNewIngredientName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addIngredient(meal.id)
                                      if (e.key === 'Escape') setIngredientEditorFor(null)
                                    }}
                                  />
                                  <input
                                    className="meal-input ingredient-input-qty"
                                    type="text"
                                    placeholder="Menge"
                                    value={newIngredientQty}
                                    onChange={(e) => setNewIngredientQty(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addIngredient(meal.id)
                                      if (e.key === 'Escape') setIngredientEditorFor(null)
                                    }}
                                  />
                                  <button
                                    className="ingredient-add-btn"
                                    onClick={() => addIngredient(meal.id)}
                                    disabled={!newIngredientName.trim()}
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  className="ingredient-to-shopping-btn"
                                  onClick={() => addToShoppingList(meal.id)}
                                >
                                  <ShoppingCart size={14} strokeWidth={2} /> Zur Einkaufsliste
                                </button>
                              </div>
                            )}
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
                          <span className={`meal-cell-icon meal-icon-${type}`}>{(() => { const Icon = MEAL_ICONS[type]; return <Icon size={14} strokeWidth={2} /> })()}</span>
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

          {mealIdeas.length === 0 && !searchLower && (
            <p className="mealplan-empty"><Pizza size={28} strokeWidth={1.5} /> Noch keine Ideen — füge welche hinzu!</p>
          )}
          {filteredMealIdeas.length === 0 && searchLower && (
            <p className="mealplan-empty"><Pizza size={28} strokeWidth={1.5} /> Keine Treffer bei den Ideen!</p>
          )}

          <div className="mealplan-idea-list">
            {filteredMealIdeas.map((idea) => {
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
                        <Trash2 size={14} strokeWidth={2} />
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
                            {MEAL_EMOJI[t]} {t}
                          </option>
                        ))}
                      </select>
                      <div className="meal-cell-actions">
                        <button
                          className="meal-btn-cancel"
                          onClick={() => setPlanPickerFor(null)}
                        >
                          <X size={14} strokeWidth={2} />
                        </button>
                        <button className="meal-btn-save" onClick={() => planIdea(idea)}>
                          <Check size={14} strokeWidth={2} />
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