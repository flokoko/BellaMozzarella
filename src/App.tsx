import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { ListItem, ItemCategory, ListType, ShoppingList, TabView, Meal, MealIdea, QuickNote, Expense, ExpenseSplit, Participant } from './types'
import { supabase, setJoinCode } from './lib/supabase'
import { getResolvedTheme, toggleTheme, applyTheme, initThemeListener } from './lib/theme'
import JoinScreen from './components/JoinScreen'
import ListScreen from './components/ListScreen'
import BringScreen from './components/BringScreen'
import MealPlanScreen from './components/MealPlanScreen'
import SettingsScreen from './components/SettingsScreen'
import DashboardScreen from './components/DashboardScreen'
import ExpenseScreen from './components/ExpenseScreen'

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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [tab, setTab] = useState<TabView>('home')
  const [isDark, setIsDark] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<any>(null)

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

  // ── beforeinstallprompt: capture for custom install UI ──
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
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

  const fetchExpenses = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('expenses')
      .select('*')
      .eq('list_id', listId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { console.error('fetchExpenses error:', err); return }
    setExpenses((data || []) as Expense[])
  }, [])

  const fetchParticipants = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('participants')
      .select('*')
      .eq('list_id', listId)
      .order('name', { ascending: true })
    if (err) { console.error('fetchParticipants error:', err); return }
    setParticipants((data || []) as Participant[])
  }, [])

  const fetchAll = useCallback(async (listId: string) => {
    await Promise.all([
      fetchItems(listId, 'shopping'),
      fetchItems(listId, 'bring'),
      fetchCategories(listId),
      fetchMeals(listId),
      fetchMealIdeas(listId),
      fetchNotes(listId),
      fetchExpenses(listId),
      fetchParticipants(listId),
    ])
  }, [fetchItems, fetchCategories, fetchMeals, fetchMealIdeas, fetchNotes, fetchExpenses, fetchParticipants])

  // ── Polling (5000ms, only when visible) ───────────────────────────
  const lastFetchTime = useRef(0)

  useEffect(() => {
    if (!list) return
    // Don't poll when offline — optimistic updates stay in local state and
    // won't be overwritten by a failed poll. Polling resumes when back online.
    if (!isOnline) return
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
  }, [list, fetchAll, isOnline])

  // ── Fetch expense splits whenever expenses change ─────────────────
  useEffect(() => {
    if (expenses.length === 0) { setExpenseSplits([]); return }
    const expenseIds = expenses.map(e => e.id)
    supabase
      .from('expense_splits')
      .select('*')
      .in('expense_id', expenseIds)
      .then(({ data, error }) => {
        if (error) { console.error('fetchSplits error:', error); return }
        setExpenseSplits((data || []) as ExpenseSplit[])
      })
  }, [expenses])

  // ── Auto-restore session ──────────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem('user_name')
    const savedCode = localStorage.getItem('join_code')
    if (savedName && savedCode) {
      supabase
        .rpc('verify_join_code', { code: savedCode })
        .then(async ({ data }) => {
          if (data && data.length > 0) {
            const listData = data[0] as ShoppingList
            setJoinCode(listData.join_code)
            setUserName(savedName)
            // Fetch full list data (including admin_password) before setting list
            const { data: fullList } = await supabase
              .from('lists')
              .select('*')
              .eq('id', listData.id)
              .single()
            setList((fullList as ShoppingList) ?? listData)
            fetchAll(listData.id)
          }
        })
    }
  }, [fetchAll])

  // ── Optimistic update helpers ────────────────────────────────────
  const toggleShoppingItem = useCallback((item: ListItem) => {
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i))
    supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id).then(({ error }) => {
      if (error) {
        console.error('toggleShoppingItem error:', error)
        setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: item.is_checked } : i))
      }
    })
  }, [])

  const deleteShoppingItem = useCallback((item: ListItem) => {
    setShoppingItems(prev => prev.filter(i => i.id !== item.id))
    supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
      if (error) {
        console.error('deleteShoppingItem error:', error)
        setShoppingItems(prev => [item, ...prev])
      }
    })
  }, [])

  const toggleBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: !i.is_brought } : i))
    supabase.from('items').update({ is_brought: !item.is_brought }).eq('id', item.id).then(({ error }) => {
      if (error) {
        console.error('toggleBringItem error:', error)
        setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: item.is_brought } : i))
      }
    })
  }, [])

  const deleteBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.filter(i => i.id !== item.id))
    supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
      if (error) {
        console.error('deleteBringItem error:', error)
        setBringItems(prev => [item, ...prev])
      }
    })
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

  const knownPersons = useMemo(() => {
    const names = new Set<string>()
    if (userName) names.add(userName)
    participants.forEach(p => names.add(p.name))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [userName, participants])

  const userBalance = useMemo(() => {
    const paid = expenses.filter(e => e.paid_by === userName).reduce((s, e) => s + e.amount, 0)
    const share = expenseSplits.filter(s => s.person_name === userName).reduce((s, s2) => s + s2.share_amount, 0)
    return paid - share
  }, [expenses, expenseSplits, userName])

  const expenseTotal = useMemo(() =>
    expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  )

  const isAdmin = useMemo(() =>
    participants.some(p => p.name === userName && p.is_admin),
    [participants, userName],
  )

  const handleJoin = async (name: string, l: ShoppingList) => {
    setJoinCode(l.join_code)
    setUserName(name)
    setList(l)
    fetchAll(l.id)
    // Fetch full list data (including admin_password) — RPC doesn't return it
    const { data: fullList } = await supabase
      .from('lists')
      .select('*')
      .eq('id', l.id)
      .single()
    if (fullList) setList(fullList as ShoppingList)
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
    setExpenses([])
    setExpenseSplits([])
    setParticipants([])
    setAdminUnlocked(false)
  }

  const handleRename = async (newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || !list || trimmed === userName) return
    // Check if new name already exists (case-insensitive)
    const existing = participants.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      // Just switch to the existing participant name
      localStorage.setItem('user_name', existing.name)
      setUserName(existing.name)
      return
    }
    // Insert new participant with new name
    await supabase.from('participants').insert({ list_id: list.id, name: trimmed })
    // Update all references from old name to new name
    await Promise.all([
      supabase.from('expenses').update({ paid_by: trimmed }).eq('list_id', list.id).eq('paid_by', userName),
      supabase.from('items').update({ assigned_to: trimmed }).eq('list_id', list.id).eq('assigned_to', userName),
      // Note: expense_splits doesn't have list_id, so we update by person_name only.
      // This could affect splits in other lists if the same name exists, but since
      // this is a personal vacation app with one active list, this is acceptable.
      supabase.from('expense_splits').update({ person_name: trimmed }).eq('person_name', userName),
    ])
    // Delete old participant
    await supabase.from('participants').delete().eq('list_id', list.id).eq('name', userName)
    localStorage.setItem('user_name', trimmed)
    setUserName(trimmed)
    fetchAll(list.id)
  }

  const handleToggleTheme = () => {
    toggleTheme()
    setIsDark(getResolvedTheme() === 'dark')
  }

  const handleSetAdminPassword = async (password: string) => {
    if (!list) return
    const { error } = await supabase
      .from('lists')
      .update({ admin_password: password })
      .eq('id', list.id)
    if (error) {
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }
    setList({ ...list, admin_password: password })
    setAdminUnlocked(true)
    navigator.vibrate?.(10)
  }

  const handleChangeAdminPassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    if (!list) return false
    // Verify old password against DB
    const { data, error } = await supabase
      .from('lists')
      .select('admin_password')
      .eq('id', list.id)
      .single()
    if (error || !data || !data.admin_password) return false
    if (oldPassword !== data.admin_password) return false
    // Update to new password
    const { error: updateError } = await supabase
      .from('lists')
      .update({ admin_password: newPassword })
      .eq('id', list.id)
    if (updateError) return false
    setList({ ...list, admin_password: newPassword })
    navigator.vibrate?.(10)
    return true
  }

  const handleUnlockAdmin = async (password: string): Promise<boolean> => {
    if (!list) return false
    // Try list state first (should be loaded by now)
    if (list.admin_password && password === list.admin_password) {
      setAdminUnlocked(true)
      navigator.vibrate?.(10)
      return true
    }
    // Fallback: query from DB
    const { data, error } = await supabase
      .from('lists')
      .select('admin_password')
      .eq('id', list.id)
      .single()
    if (error || !data) {
      return false
    }
    if (data.admin_password && password === data.admin_password) {
      setAdminUnlocked(true)
      setList(prev => prev ? { ...prev, admin_password: data.admin_password } : prev)
      navigator.vibrate?.(10)
      return true
    }
    return false
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const checkedCount = shoppingItems.filter((i) => i.is_checked).length

  const featureTitles: Record<Exclude<TabView, 'home'>, string> = {
    list: '🛒 Einkaufsliste',
    bring: '🎒 Mitbringen',
    mealplan: '🍝 Essensplan',
    expenses: '💰 Ausgaben',
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
          📡 Du bist offline — Änderungen können momentan nicht gespeichert werden.
        </div>
      )}

      <main className="app-main">
        {tab === 'home' && (
          <DashboardScreen
            listId={list.id}
            userName={userName}
            listName={list.name}
            shoppingCount={shoppingItems.length}
            shoppingChecked={checkedCount}
            bringCount={bringItems.length}
            mealCount={meals.length}
            expenseCount={expenses.length}
            expenseTotal={expenseTotal}
            userBalance={userBalance}
            notes={notes}
            onNavigate={setTab}
            onNotesChange={() => fetchNotes(list.id)}
            installPrompt={installPrompt}
            onInstall={handleInstall}
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
            persons={participants.map(p => p.name)}
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
        {tab === 'expenses' && (
          <ExpenseScreen
            expenses={expenses}
            expenseSplits={expenseSplits}
            listId={list.id}
            userName={userName}
            knownPersons={knownPersons}
            onExpensesChange={() => fetchExpenses(list.id)}
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
            participants={participants}
            onParticipantsChange={() => fetchParticipants(list.id)}
            isAdmin={isAdmin}
            adminUnlocked={adminUnlocked}
            hasAdminPassword={!!list.admin_password}
            onSetAdminPassword={handleSetAdminPassword}
            onUnlockAdmin={handleUnlockAdmin}
            onChangeAdminPassword={handleChangeAdminPassword}
          />
        )}
      </main>
    </div>
  )
}