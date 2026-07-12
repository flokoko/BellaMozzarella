import { useState, useEffect, useCallback } from 'react'
import type { ListItem, ShoppingList, TabView, ItemCategory, ListType, Meal, MealIdea, QuickNote } from './types'
import { supabase, setJoinCode } from './lib/supabase'
import { getResolvedTheme, toggleTheme, applyTheme, initThemeListener } from './lib/theme'
import JoinScreen from './components/JoinScreen'
import ListScreen from './components/ListScreen'
import BringScreen from './components/BringScreen'
import MealPlanScreen from './components/MealPlanScreen'
import SettingsScreen from './components/SettingsScreen'
import DashboardScreen from './components/DashboardScreen'

import './App.css'

export default function App() {
  const [userName, setUserName] = useState<string | null>(null)
  const [list, setList] = useState<ShoppingList | null>(null)
  const [shoppingItems, setShoppingItems] = useState<ListItem[]>([])
  const [bringItems, setBringItems] = useState<ListItem[]>([])
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [mealIdeas, setMealIdeas] = useState<MealIdea[]>([])
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [tab, setTab] = useState<TabView>('home')
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    applyTheme()
    setIsDark(getResolvedTheme() === 'dark')
    const cleanup = initThemeListener()
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setIsDark(getResolvedTheme() === 'dark')
    mql.addEventListener('change', handler)
    return () => {
      cleanup()
      mql.removeEventListener('change', handler)
    }
  }, [])

  const fetchItems = useCallback(async (listId: string, listType: ListType) => {
    const { data, error: err } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .eq('list_type', listType)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) return
    const items = (data || []) as ListItem[]
    if (listType === 'shopping') setShoppingItems(items)
    else setBringItems(items)
  }, [])

  const fetchCategories = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('categories')
      .select('*')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true })
    if (err) return
    setCategories((data || []) as ItemCategory[])
  }, [])

  const fetchMeals = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meals')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) return
    setMeals((data || []) as Meal[])
  }, [])

  const fetchMealIdeas = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meal_ideas')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) return
    setMealIdeas((data || []) as MealIdea[])
  }, [])

  const fetchNotes = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('notes')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (err) return
    setNotes((data || []) as QuickNote[])
  }, [])

  const fetchAll = useCallback(async (listId: string) => {
    await Promise.all([
      fetchItems(listId, 'shopping'),
      fetchItems(listId, 'bring'),
      fetchCategories(listId),
      fetchMeals(listId),
      fetchMealIdeas(listId),
      fetchNotes(listId),
    ])
  }, [fetchItems, fetchCategories, fetchMeals, fetchMealIdeas, fetchNotes])

  const handleJoin = (name: string, l: ShoppingList) => {
    setJoinCode(l.join_code)
    setUserName(name)
    setList(l)
    fetchAll(l.id)
  }

  useEffect(() => {
    if (!list) return
    const interval = setInterval(() => {
      fetchAll(list.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [list, fetchAll])

  useEffect(() => {
    if (!list) return
    const onVisible = () => {
      if (!document.hidden) fetchAll(list.id)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [list, fetchAll])

  useEffect(() => {
    const savedName = localStorage.getItem('user_name')
    const savedCode = localStorage.getItem('join_code')
    if (savedName && savedCode) {
      supabase
        .rpc('verify_join_code', { code: savedCode })
        .then(({ data }) => {
          if (data && data.length > 0) {
            const listData = data[0] as ShoppingList
            setJoinCode(listData.join_code)
            setUserName(savedName)
            setList(listData)
            fetchAll(listData.id)
          }
        })
    }
  }, [fetchAll])

  const reorderItems = useCallback(async (listType: ListType, newOrder: string[]) => {
    if (!list) return
    const updates = newOrder.map((id, index) =>
      supabase.from('items').update({ sort_order: index }).eq('id', id)
    )
    await Promise.all(updates)
    await fetchItems(list.id, listType)
  }, [list, fetchItems])

  if (!userName || !list) {
    return <JoinScreen onJoin={handleJoin} />
  }

  const handleLeave = () => {
    setJoinCode('')
    localStorage.removeItem('user_name')
    localStorage.removeItem('join_code')
    setUserName(null)
    setList(null)
    setShoppingItems([])
    setBringItems([])
    setCategories([])
    setMeals([])
    setMealIdeas([])
    setNotes([])
  }

  const handleRename = (newName: string) => {
    localStorage.setItem('user_name', newName)
    setUserName(newName)
  }

  const handleToggleTheme = () => {
    toggleTheme()
    setIsDark(getResolvedTheme() === 'dark')
  }

  const checkedCount = shoppingItems.filter((i) => i.is_checked).length

  const featureTitles: Record<Exclude<TabView, 'home'>, string> = {
    list: '🛒 Einkaufsliste',
    bring: '🎒 Mitbringen',
    mealplan: '🍝 Essensplan',
    settings: '⚙️ Einstellungen',
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          {tab === 'home' ? (
            <div className="header-info">
              <span className="header-name">🇮🇹 {list.name}</span>
              <span className="header-user">
                Angemeldet als: <strong>{userName}</strong>
              </span>
            </div>
          ) : (
            <button className="header-back" onClick={() => setTab('home')}>
              ← Zurück
            </button>
          )}
          <div className="header-actions">
            {tab !== 'home' && (
              <span className="header-feature-title">{featureTitles[tab as Exclude<TabView, 'home'>]}</span>
            )}
            <button className="header-theme-toggle" onClick={handleToggleTheme} aria-label="Theme wechseln">
              {isDark ? '☀️' : '🌙'}
            </button>
            <button className="header-leave" onClick={handleLeave}>Verlassen</button>
          </div>
        </div>
      </header>

      <main className="app-main" key={tab}>
        {tab === 'home' && (
          <DashboardScreen
            listId={list.id}
            userName={userName}
            listName={list.name}
            shoppingCount={shoppingItems.length}
            shoppingChecked={checkedCount}
            bringCount={bringItems.length}
            mealCount={meals.length}
            notes={notes}
            onNavigate={setTab}
            onNotesChange={() => fetchNotes(list.id)}
          />
        )}
        {tab === 'list' && (
          <ListScreen
            items={shoppingItems}
            categories={categories.filter((c) => c.list_type === 'shopping')}
            listId={list.id}
            userName={userName}
            onItemChange={() => fetchItems(list.id, 'shopping')}
            onReorder={reorderItems}
            onCategoriesChange={() => fetchCategories(list.id)}
          />
        )}
        {tab === 'bring' && (
          <BringScreen
            items={bringItems}
            categories={categories.filter((c) => c.list_type === 'bring')}
            listId={list.id}
            userName={userName}
            onItemChange={() => fetchItems(list.id, 'bring')}
            onReorder={reorderItems}
            onCategoriesChange={() => fetchCategories(list.id)}
          />
        )}
        {tab === 'mealplan' && (
          <MealPlanScreen
            meals={meals}
            mealIdeas={mealIdeas}
            listId={list.id}
            userName={userName}
            onMealsChange={() => fetchMeals(list.id)}
            onIdeasChange={() => fetchMealIdeas(list.id)}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            userName={userName}
            listName={list.name}
            joinCode={list.join_code}
            onLeave={handleLeave}
            onRename={handleRename}
            categories={categories}
            listId={list.id}
            onCategoriesChange={() => fetchCategories(list.id)}
          />
        )}
      </main>
    </div>
  )
}