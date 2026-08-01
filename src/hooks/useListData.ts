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
import { useRealtimeSync } from './useRealtimeSync'
import { logError } from '../lib/logger'

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

  // ── Fetch guard for realtime sync debounce ─────────────────────────
  const isFetchingRef = useRef(false)

  // ── Track previous shopping items for push notifications ───────────
  const prevShoppingItemsRef = useRef<ListItem[]>([])

  // ── Undo state for delete operations ───────────────────────────────
  const [undoState, setUndoState] = useState<{
    items: ListItem[]
    timeout: ReturnType<typeof setTimeout> | null
  } | null>(null)

  // ── Fetch functions ────────────────────────────────────────────────
  const fetchItems = useCallback(async (listId: string, listType: ListType) => {
    const { data, error: err } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .eq('list_type', listType)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) { logError('fetchItems error:', err); return }
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
    if (err) { logError('fetchCategories error:', err); return }
    setCategories((data || []) as ItemCategory[])
  }, [])

  const fetchMeals = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meals')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) { logError('fetchMeals error:', err); return }
    setMeals((data || []) as Meal[])
  }, [])

  const fetchMealIdeas = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('meal_ideas')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) { logError('fetchMealIdeas error:', err); return }
    setMealIdeas((data || []) as MealIdea[])
  }, [])

  const fetchNotes = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('notes')
      .select('*')
      .eq('list_id', listId)
      .order('is_favorite', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (err) { logError('fetchNotes error:', err); return }
    setNotes((data || []) as QuickNote[])
  }, [])

  const fetchExpenses = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('expenses')
      .select('*')
      .eq('list_id', listId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (err) { logError('fetchExpenses error:', err); return }
    setExpenses((data || []) as Expense[])
  }, [])

  const fetchParticipants = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('participants')
      .select('*')
      .eq('list_id', listId)
      .order('name', { ascending: true })
    if (err) { logError('fetchParticipants error:', err); return }
    setParticipants((data || []) as Participant[])
  }, [])

  const fetchAll = useCallback(async (listId: string, force = false) => {
    // Guard against overlapping fetches — Mutation-Refetches können mit force=true
    // den Guard umgehen, damit sie nicht vom Realtime-Sync blockiert werden.
    if (!force && isFetchingRef.current) return
    isFetchingRef.current = true
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
  // ── Realtime sync (replaces adaptive polling) ──────────────────────
  const handleRealtimeChange = useCallback((table: string) => {
    if (!list) return
    // Debounce: nur refetchen wenn nicht gerade ein fetch läuft
    if (!isFetchingRef.current) {
      if (table === 'items') {
        fetchItems(list.id, 'shopping')
        fetchItems(list.id, 'bring')
      } else if (table === 'categories') {
        fetchCategories(list.id)
      } else if (table === 'meals') {
        fetchMeals(list.id)
        fetchMealIdeas(list.id)
      } else if (table === 'notes') {
        fetchNotes(list.id)
      } else if (table === 'expenses') {
        fetchExpenses(list.id)
      } else if (table === 'participants') {
        fetchParticipants(list.id)
      }
    }
  }, [list, fetchItems, fetchCategories, fetchMeals, fetchMealIdeas, fetchNotes, fetchExpenses, fetchParticipants])

  useRealtimeSync({
    listId: list?.id ?? null,
    onTableChange: handleRealtimeChange,
  })

  // ── Fetch expense splits whenever expenses change ──────────────────
  useEffect(() => {
    if (expenses.length === 0) { setExpenseSplits([]); return }
    const expenseIds = expenses.map(e => e.id)
    supabase
      .from('expense_splits')
      .select('*')
      .in('expense_id', expenseIds)
      .then(({ data, error }) => {
        if (error) { logError('fetchSplits error:', error); return }
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

  // ── Optimistic update helpers ──────────────────────────────────────
  // NOTE: refetch happens AFTER the server write completes, not immediately,
  // to avoid the fetch racing with the write and overwriting optimistic state.

  /** Toggle all items in a group at once (single API call instead of N). */
  const batchToggleShoppingItems = useCallback((items: ListItem[], checked: boolean) => {
    if (items.length === 0) return
    const ids = items.map(i => i.id)
    setShoppingItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_checked: checked } : i))
    if (isOnline) {
      supabase.from('items').update({ is_checked: checked }).in('id', ids).then(({ error }) => {
        if (error) {
          logError('batchToggleShoppingItems error:', error)
          // Rollback: restore original checked states
          setShoppingItems(prev => prev.map(i => {
            const orig = items.find(o => o.id === i.id)
            return orig ? { ...i, is_checked: orig.is_checked } : i
          }))
        }
        if (list) fetchAll(list.id, true)
      })
    } else {
      // Enqueue one op per item for offline (Supabase RLS needs per-row)
      for (const item of items) {
        enqueue({ type: 'update', table: 'items', payload: { is_checked: checked }, filterColumn: 'id', filterValue: item.id })
      }
    }
  }, [isOnline, enqueue, list, fetchAll])

  const toggleShoppingItem = useCallback((item: ListItem) => {
    setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i))
    if (isOnline) {
      supabase.from('items').update({ is_checked: !item.is_checked }).eq('id', item.id).then(({ error }) => {
        if (error) {
          logError('toggleShoppingItem error:', error)
          setShoppingItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: item.is_checked } : i))
        }
        // Refetch AFTER server write completes — prevents race with optimistic state
        if (list) fetchAll(list.id, true)
      })
    } else {
      enqueue({ type: 'update', table: 'items', payload: { is_checked: !item.is_checked }, filterColumn: 'id', filterValue: item.id })
    }
  }, [isOnline, enqueue, list, fetchAll])

  // ── Undo helper ─────────────────────────────────────────────────────
  const withUndo = useCallback((items: ListItem[], doAction: () => void) => {
    // Clear previous undo timeout
    if (undoState?.timeout) {
      clearTimeout(undoState.timeout)
    }
    // Store items for undo
    const timeout = setTimeout(() => {
      setUndoState(null)
    }, 5000)
    setUndoState({ items, timeout })
    // Execute the action
    doAction()
  }, [undoState])

  const deleteShoppingItem = useCallback((item: ListItem) => {
    withUndo([item], () => {
      setShoppingItems(prev => prev.filter(i => i.id !== item.id))
      if (isOnline) {
        supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
          if (error) {
            logError('deleteShoppingItem error:', error)
            setShoppingItems(prev => [item, ...prev])
          }
          if (list) fetchAll(list.id, true)
        })
      } else {
        enqueue({ type: 'delete', table: 'items', payload: {}, filterColumn: 'id', filterValue: item.id })
      }
    })
  }, [withUndo, isOnline, enqueue, list, fetchAll])

  const undoDelete = useCallback(() => {
    if (!undoState) return
    if (undoState.timeout) clearTimeout(undoState.timeout)
    // Re-insert the deleted items
    for (const item of undoState.items) {
      if (isOnline) {
        supabase.from('items').insert(item as any).then(() => {
          if (list) fetchAll(list.id, true)
        })
      } else {
        enqueue({ type: 'insert', table: 'items', payload: item as unknown as Record<string, unknown> })
      }
    }
    setShoppingItems(prev => [...undoState.items, ...prev])
    setUndoState(null)
  }, [undoState, isOnline, enqueue, list, fetchAll])

  const toggleBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: !i.is_brought } : i))
    if (isOnline) {
      supabase.from('items').update({ is_brought: !item.is_brought }).eq('id', item.id).then(({ error }) => {
        if (error) {
          logError('toggleBringItem error:', error)
          setBringItems(prev => prev.map(i => i.id === item.id ? { ...i, is_brought: item.is_brought } : i))
        }
        if (list) fetchAll(list.id, true)
      })
    } else {
      enqueue({ type: 'update', table: 'items', payload: { is_brought: !item.is_brought }, filterColumn: 'id', filterValue: item.id })
    }
  }, [isOnline, enqueue, list, fetchAll])

  const deleteBringItem = useCallback((item: ListItem) => {
    setBringItems(prev => prev.filter(i => i.id !== item.id))
    if (isOnline) {
      supabase.from('items').delete().eq('id', item.id).then(({ error }) => {
        if (error) {
          logError('deleteBringItem error:', error)
          setBringItems(prev => [item, ...prev])
        }
        if (list) fetchAll(list.id, true)
      })
    } else {
      enqueue({ type: 'delete', table: 'items', payload: {}, filterColumn: 'id', filterValue: item.id })
    }
  }, [isOnline, enqueue, list, fetchAll])

  const reorderItems = useCallback(async (listType: ListType, newOrder: string[]) => {
    if (!list) return
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
    // Refetch after reorder completes
    if (list) fetchAll(list.id)
  }, [list, fetchAll, isOnline, enqueue])

  const reorderNotes = useCallback(async (newOrder: string[]) => {
    if (!list) return
    // Optimistic update
    setNotes(prev => {
      const map = new Map(prev.map(n => [n.id, n]))
      return newOrder.map((id, idx) => {
        const note = map.get(id)
        return note ? { ...note, sort_order: idx } : note!
      }).filter(Boolean)
    })
    if (isOnline) {
      await supabase.rpc('batch_reorder_notes', { note_ids: newOrder })
    } else {
      enqueue({ type: 'rpc', table: '', payload: { note_ids: newOrder }, rpcName: 'batch_reorder_notes' })
    }
    if (list) fetchAll(list.id)
  }, [list, fetchAll, isOnline, enqueue])

  const toggleNoteFavorite = useCallback(async (noteId: string) => {
    if (!list) return
    const { error } = await supabase.rpc('toggle_note_favorite', { note_id: noteId })
    if (error) {
      logError('toggleNoteFavorite error:', error)
      return
    }
    fetchAll(list.id, true)
  }, [list, fetchAll])

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
    setIsLoading(true)
    fetchAll(l.id)
    const { data: fullList } = await supabase
      .from('lists')
      .select('*')
      .eq('id', l.id)
      .single()
    if (fullList) setList(fullList as ShoppingList)
  }, [fetchAll])

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
    setUndoState(null)
    prevShoppingItemsRef.current = []
  }, [])

  const handleRename = useCallback(async (newName: string): Promise<string | null> => {
    const trimmed = newName.trim()
    if (!trimmed || !list || trimmed === userName) return null

    const { data, error } = await supabase.rpc('rename_participant', {
      p_list_id: list.id,
      p_old_name: userName,
      p_new_name: trimmed,
    })

    if (error || data?.error) {
      return data?.error || 'Fehler beim Umbenennen.'
    }

    localStorage.setItem('user_name', trimmed)
    setUserName(trimmed)
    fetchAll(list.id, true)
    return null
  }, [list, userName, fetchAll])

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
    undoState,
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
    batchToggleShoppingItems,
    deleteShoppingItem,
    undoDelete,
    toggleBringItem,
    deleteBringItem,
    reorderItems,
    reorderNotes,
    toggleNoteFavorite,
    // join/leave/rename
    handleJoin,
    handleLeave,
    handleRename,
  }
}