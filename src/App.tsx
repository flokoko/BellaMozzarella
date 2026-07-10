import { useState, useEffect, useCallback } from 'react'
import type { ListItem, ShoppingList, TabView } from './types'
import { supabase } from './lib/supabase'
import JoinScreen from './components/JoinScreen'
import ListScreen from './components/ListScreen'
import BringScreen from './components/BringScreen'
import './App.css'

export default function App() {
  const [userName, setUserName] = useState<string | null>(null)
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [tab, setTab] = useState<TabView>('list')
  const [error, setError] = useState('')

  const fetchItems = useCallback(async (listId: string) => {
    const { data, error: err } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
    if (err) {
      setError('Fehler beim Laden der Items.')
      return
    }
    setItems((data || []) as ListItem[])
  }, [])

  const handleJoin = (name: string, l: ShoppingList) => {
    setUserName(name)
    setList(l)
    fetchItems(l.id)
  }

  // Realtime subscription
  useEffect(() => {
    if (!list) return
    const channel = supabase
      .channel(`items:${list.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${list.id}` },
        () => fetchItems(list.id)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [list, fetchItems])

  // Restore session from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('user_name')
    const savedCode = localStorage.getItem('join_code')
    if (savedName && savedCode) {
      supabase
        .from('lists')
        .select('*')
        .eq('join_code', savedCode)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserName(savedName)
            setList(data as ShoppingList)
            fetchItems((data as ShoppingList).id)
          }
        })
    }
  }, [fetchItems])

  if (!userName || !list) {
    return <JoinScreen onJoin={handleJoin} />
  }

  const handleLeave = () => {
    localStorage.removeItem('user_name')
    localStorage.removeItem('join_code')
    setUserName(null)
    setList(null)
    setItems([])
  }

  const checkedCount = items.filter((i) => i.is_checked).length

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div className="header-info">
            <span className="header-name">📋 {list.name}</span>
            <span className="header-user">
              Angemeldet als: <strong>{userName}</strong>
            </span>
          </div>
          <button className="header-leave" onClick={handleLeave}>Verlassen</button>
        </div>
        <div className="header-tabs">
          <button
            className={`header-tab ${tab === 'list' ? 'active' : ''}`}
            onClick={() => setTab('list')}
          >
            🛒 Einkaufsliste
            {checkedCount > 0 && <span className="tab-badge">{checkedCount}/{items.length}</span>}
          </button>
          <button
            className={`header-tab ${tab === 'bring' ? 'active' : ''}`}
            onClick={() => setTab('bring')}
          >
            🎒 Mitbringen
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && <p className="app-error">{error}</p>}
        {tab === 'list' ? (
          <ListScreen items={items} listId={list.id} userName={userName} />
        ) : (
          <BringScreen items={items} userName={userName} />
        )}
      </main>
    </div>
  )
}