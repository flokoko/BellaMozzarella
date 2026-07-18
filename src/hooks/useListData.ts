import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  ListItem,
  ItemCategory,
  ListType,
  ShoppingList,
  Meal,
  MealIdea,
  QuickNote,
  Expense,
  ExpenseSplit,
  Participant,
} from '../types'
import { supabase } from '../lib/supabase'
import { useOfflineQueue } from './useOfflineQueue'

export function useListData() {
  // ── Offline queue ──────────────────────────────────────────────────
  const { isOnline, enqueue, flushQueue, queueLength } = useOfflineQueue()

  // ── State ──────────────────────────────────────────────────────────
  const [userName, setUserName] = useState<string | null>(null)
  const [list, setList] = useState<ShoppingList | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
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
  const [isLoading, setIsLoading] = useState(false)

  // ── Activity + fetch guards for adaptive polling ───────────────────
  const lastActivityRef = useRef(Date.now())
  const lastFetchTime = useRef(0)
  const isFetchingRef = useRef(false)

  // ── Track previous shopping items for push notifications ───────────
  const prevShoppingItemsRef = useRef<ListItem[]>([])

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  // ── Fetch functions ────────────────────────────────────────────────
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
    if (listType === 'shopping') {
      // ── Push notification: check for new items added by others ──
      const prevIds = new Set(prevShoppingItemsRef.current.map(i => i.id))
      const newItems = items.filter(i => !prevIds.has(i.id) && i.created_by !== userName)
      if (
        newItems.length > 0 &&
        document.hidden &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        localStorage.getItem('push_notifications_enabled') === 'true'
      ) {
        new Notification('Neue Items in der Einkaufsliste', {
          body: `🛒 ${newItems.length} neue(s) Item(s) in der Einkaufsliste`,
          tag: 'shopping-update',
        })
      }
      prevShoppingItemsRef.current = items
      setShoppingItems(items)
    } else {
      setBringItems(items)
    }
  }, [userName])

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
    // Guard against overlapping fetches (instant re-fetch from mutations)
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    lastFetchTime.current = Date.now()
    try {
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
    } finally {
      isFetchingRef.current = false
      setIsLoading(false)
    }
  }, [fetchItems, fetchCategories, fetchMeals, fetchMealIdeas, fetchNotes, fetchExpenses, fetchParticipants])

  // ── Adaptive polling ───────────────────────────────────────────────
  useEffect(() => {
    if (!list) return
    // Don't poll when offline — optimistic updates stay in local state.
    if (!navigator.onLine) return

    let interval: ReturnType<typeof setInterval> | null = null

    const getInterval = () => {
      // 3s when active (interaction in last 30s), 8s when idle
      return Date.now() - lastActivityRef.current < 30000 ? 3000 : 8000
    }

    const start = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(() => {
        fetchAll(list.id)
      }, getInterval())
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

  // ── Fetch expense splits whenever expenses change ──────────────────
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

  // ── Auto-restore session ───────────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem('user_name')
    const savedParticipantId = localStorage.getItem('participant_id')
    if (savedName && savedParticipantId) {
      import('../lib/supabase').then(({ restoreParticipantSession }) => {
        restoreParticipantSession(savedParticipantId).then((result) => {
          if (result.error || !result.list_id) return
          setUserName(result.participant_name)
          setParticipantId(result.participant_id)
          setIsLoading(true)
          supabase
            .from('lists')
            .select('*')
            .eq('id', result.list_id)
            .single()
            .then(({ data }) => {
              if (data) {
                setList(data as ShoppingList)
                fetchAll(result.list_id)
              }
            })
        })
      })
    }
  }, [fetchAll])

  // ── Instant re-fetch helper ────────────────────────────────────────
  const instantRefetch = useCallback(() => {
    if (!list) return
    markActivity()
    fetchAll(list.id)
  }, [list, fetchAll, markActivity])

  // ── Optimistic update helpers ──────────────────────────────────────
  const toggleShoppingItem = useCallback((item: ListItem) => {
    markActivity()
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i))
    if (isOnline) {
      supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id).then(({ error }) => {
        if (error) {
          console.error('toggleShoppingItem error:', error)
          setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: item.is_checked } : i))
        }
      })
    } else {
      enqueue({ type: 'update', table: 'items', payload: { is_checked: !item.is_checked }, filterColumn: 'id', filterValue: item.id })
    }
    instantRefetch()
  }, [markActivity, instantRefetch, isOnline, enqueue])

  const deleteShoppingItem = useCallback((item: ListItem) => {
    markActivity()
    setShoppingItems(prev => prev.filter(i => i.id !== item.id))
    if (isOnline) {
      supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
        if (error) {
          console.error('deleteShoppingItem error:', error)
          setShoppingItems(prev => [item, ...prev])
        }
      })
    } else {
      enqueue({ type: 'delete', table: 'items', payload: {}, filterColumn: 'id', filterValue: item.id })
    }
    instantRefetch()
  }, [markActivity, instantRefetch, isOnline, enqueue])

  const toggleBringItem = useCallback((item: ListItem) => {
    markActivity()
    setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: !i.is_brought } : i))
    if (isOnline) {
      supabase.from('items').update({ is_brought: !item.is_brought }).eq('id', item.id).then(({ error }) => {
        if (error) {
          console.error('toggleBringItem error:', error)
          setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: item.is_brought } : i))
        }
      })
    } else {
      enqueue({ type: 'update', table: 'items', payload: { is_brought: !item.is_brought }, filterColumn: 'id', filterValue: item.id })
    }
    instantRefetch()
  }, [markActivity, instantRefetch, isOnline, enqueue])

  const deleteBringItem = useCallback((item: ListItem) => {
    markActivity()
    setBringItems(prev => prev.filter(i => i.id !== item.id))
    if (isOnline) {
      supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
        if (error) {
          console.error('deleteBringItem error:', error)
          setBringItems(prev => [item, ...prev])
        }
      })
    } else {
      enqueue({ type: 'delete', table: 'items', payload: {}, filterColumn: 'id', filterValue: item.id })
    }
    instantRefetch()
  }, [markActivity, instantRefetch, isOnline, enqueue])

  const reorderItems = useCallback(async (listType: ListType, newOrder: string[]) => {
    if (!list) return
    markActivity()
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
    if (isOnline) {
      await supabase.rpc('batch_reorder_items', { item_ids: newOrder })
    } else {
      enqueue({ type: 'rpc', table: '', payload: { item_ids: newOrder }, rpcName: 'batch_reorder_items' })
    }
    instantRefetch()
  }, [list, markActivity, instantRefetch, isOnline, enqueue])

  // ── Derived values ─────────────────────────────────────────────────
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

  const checkedCount = useMemo(() =>
    shoppingItems.filter((i) => i.is_checked).length,
    [shoppingItems],
  )

  // ── Join / Leave / Rename ──────────────────────────────────────────
  const handleJoin = useCallback(async (name: string, l: ShoppingList, pid: string) => {
    setUserName(name)
    setParticipantId(pid)
    setList(l)
    markActivity()
    setIsLoading(true)
    fetchAll(l.id)
    const { data: fullList } = await supabase
      .from('lists')
      .select('*')
      .eq('id', l.id)
      .single()
    if (fullList) setList(fullList as ShoppingList)
  }, [fetchAll, markActivity])

  const handleLeave = useCallback(() => {
    localStorage.removeItem('user_name')
    localStorage.removeItem('participant_id')
    setUserName(null)
    setList(null)
    setParticipantId(null)
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
    prevShoppingItemsRef.current = []
  }, [])

  const handleRename = useCallback(async (newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || !list || trimmed === userName) return
    const existing = participants.find(p => p.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      localStorage.setItem('user_name', existing.name)
      setUserName(existing.name)
      return
    }
    await supabase.from('participants').insert({ list_id: list.id, name: trimmed })
    await Promise.all([
      supabase.from('expenses').update({ paid_by: trimmed }).eq('list_id', list.id).eq('paid_by', userName),
      supabase.from('items').update({ assigned_to: trimmed }).eq('list_id', list.id).eq('assigned_to', userName),
      supabase.from('expense_splits').update({ person_name: trimmed }).eq('person_name', userName),
    ])
    await supabase.from('participants').delete().eq('list_id', list.id).eq('name', userName)
    localStorage.setItem('user_name', trimmed)
    setUserName(trimmed)
    fetchAll(list.id)
  }, [list, participants, userName, fetchAll])

  return {
    // state
    userName,
    list,
    participantId,
    shoppingItems,
    bringItems,
    categories,
    meals,
    mealIdeas,
    notes,
    expenses,
    expenseSplits,
    participants,
    adminUnlocked,
    isLoading,
    // offline
    isOnline,
    queueLength,
    flushQueue,
    // derived
    isAdmin,
    shoppingCategories,
    bringCategories,
    knownPersons,
    userBalance,
    expenseTotal,
    checkedCount,
    // setters (needed by App.tsx for admin handlers)
    setUserName,
    setList,
    setAdminUnlocked,
    // fetch
    fetchAll,
    fetchItems,
    fetchCategories,
    fetchMeals,
    fetchMealIdeas,
    fetchNotes,
    fetchExpenses,
    fetchParticipants,
    // mutations
    toggleShoppingItem,
    deleteShoppingItem,
    toggleBringItem,
    deleteBringItem,
    reorderItems,
    // join/leave/rename
    handleJoin,
    handleLeave,
    handleRename,
  }
}