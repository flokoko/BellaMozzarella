import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ListItem, ItemCategory, ListType, ShoppingList, TabView, Meal, MealIdea, QuickNote } from './types'
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
  const [isOnline, setIsOnline] = useState(navigator.onLine)

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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Fetch functions ──────────────────────────────────────────────
  const fetchItems = useCallback(async (listId: string, listType: ListType) => {
    const { data, error: err } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .eq('list_type', listType)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) { console.error('fetchItems error:', err); return }
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
    if (err) { console.error('fetchCategories error:', err); return }
    setCategories((data || []) as ItemCategory[])
  }, [])

  const fetchMeals = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meals')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) { console.error('fetchMeals error:', err); return }
    setMeals((data || []) as Meal[])
  }, [])

  const fetchMealIdeas = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meal_ideas')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) { console.error('fetchMealIdeas error:', err); return }
    setMealIdeas((data || []) as MealIdea[])
  }, [])

  const fetchNotes = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('notes')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: false })
    if (err) { console.error('fetchNotes error:', err); return }
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

  // ── Polling (5000ms, only when visible) ───────────────────────────
  const lastFetchTime = useRef(0)

  useEffect(() => {
    if (!list) return
    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        fetchAll(list.id)
      }, 5000)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    if (!document.hidden) start()
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        const now = Date.now()
        if (now - lastFetchTime.current > 3000) {
          lastFetchTime.current = now
          fetchAll(list.id)
        }
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [list, fetchAll])

  // ── Auto-restore session ──────────────────────────────────────────
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

  // ── Optimistic update helpers ────────────────────────────────────
  const toggleShoppingItem = useCallback((item: ListItem) => {
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i))
    supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id).then()
  }, [])

  const deleteShoppingItem = useCallback((item: ListItem) => {
    setShoppingItems(prev => prev.filter(i => i.id !== item.id))
    supabase.from('items').delete().eq('id', item.id).then()
  }, [])

  const toggleBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: !i.is_brought } : i))
    supabase.from('items').update({ is_brought: !item.is_brought }).eq('id', item.id).then()
  }, [])

  const deleteBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.filter(i => i.id !== item.id))
    supabase.from('items').delete().eq('id', item.id).then()
  }, [])

  // ── Batch reorder (single RPC) ────────────────────────────────────
  const reorderItems = useCallback(async (listType: ListType, newOrder: string[]) => {
    if (!list) return
    // Optimistic: update local state immediately
    if (listType === 'shopping') {
      setShoppingItems(prev => {
        const map = new Map(prev.map(i => [i.id, i]))
        return newOrder.map((id, idx) => {
          const item = map.get(id)
          return item ? { ...item, sort_order: idx } : item!
        }).filter(Boolean)
      })
    } else {
      setBringItems(prev => {
        const map = new Map(prev.map(i => [i.id, i]))
        return newOrder.map((id, idx) => {
          const item = map.get(id)
          return item ? { ...item, sort_order: idx } : item!
        }).filter(Boolean)
      })
    }
    await supabase.rpc('batch_reorder_items', { item_ids: newOrder })
  }, [list])

  // ── Memoized category filters ────────────────────────────────────
  const shoppingCategories = useMemo(() => categories.filter((c) => c.list_type === 'shopping'), [categories])
  const bringCategories = useMemo(() => categories.filter((c) => c.list_type === 'bring'), [categories])

  const handleJoin = (name: string, l: ShoppingList) => {
    setJoinCode(l.join_code)
    setUserName(name)
    setList(l)
    fetchAll(l.id)
  }

  if (!userName || !list) {
    return <JoinScreen onJoin={handleJoin} />
  }

  // ── Event handlers (after hooks, before JSX) ─────────────────────

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

      {!isOnline && (
        <div className="offline-banner">
          📡 Du bist offline — Änderungen werden synchronisiert wenn du wieder online bist.
        </div>
      )}

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
            categories={shoppingCategories}
            listId={list.id}
            userName={userName}
            onItemToggle={toggleShoppingItem}
            onItemDelete={deleteShoppingItem}
            onItemChange={() => fetchItems(list.id, 'shopping')}
            onReorder={reorderItems}
            onCategoriesChange={() => fetchCategories(list.id)}
          />
        )}
        {tab === 'bring' && (
          <BringScreen
            items={bringItems}
            categories={bringCategories}
            listId={list.id}
            userName={userName}
            onItemToggle={toggleBringItem}
            onItemDelete={deleteBringItem}
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