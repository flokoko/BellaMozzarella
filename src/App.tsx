import { useState, useEffect, useCallback } from 'react'
import type { ListItem, ShoppingList, TabView } from './types'
import { supabase } from './lib/supabase'
import { getResolvedTheme, toggleTheme, applyTheme, initThemeListener } from './lib/theme'
import JoinScreen from './components/JoinScreen'
import ListScreen from './components/ListScreen'
import BringScreen from './components/BringScreen'
import SettingsScreen from './components/SettingsScreen'
import './App.css'

export default function App() {
  const [userName, setUserName] = useState<string | null>(null)
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [tab, setTab] = useState<TabView>('list')
  const [error, setError] = useState('')
  const [isDark, setIsDark] = useState(false)

  // ── Theme: apply on mount, listen for system changes ──────────────
  useEffect(() => {
    applyTheme()
    setIsDark(getResolvedTheme() === 'dark')
    const cleanup = initThemeListener()
    // Update icon when system changes while in 'auto' mode
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setIsDark(getResolvedTheme() === 'dark')
    mql.addEventListener('change', handler)
    return () => {
      cleanup()
      mql.removeEventListener('change', handler)
    }
  }, [])

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

  const handleRename = (newName: string) => {
    localStorage.setItem('user_name', newName)
    setUserName(newName)
  }

  const handleToggleTheme = () => {
    toggleTheme()
    setIsDark(getResolvedTheme() === 'dark')
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
          <div className="header-actions">
            <button className="header-theme-toggle" onClick={handleToggleTheme} aria-label="Theme wechseln">
              {isDark ? '☀️' : '🌙'}
            </button>
            <button className="header-leave" onClick={handleLeave}>Verlassen</button>
          </div>
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
          <button
            className={`header-tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && <p className="app-error">{error}</p>}
        {tab === 'list' && (
          <ListScreen items={items} listId={list.id} userName={userName} />
        )}
        {tab === 'bring' && (
          <BringScreen items={items} userName={userName} />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            userName={userName}
            listName={list.name}
            joinCode={list.join_code}
            onLeave={handleLeave}
            onRename={handleRename}
          />
        )}
      </main>
    </div>
  )
}