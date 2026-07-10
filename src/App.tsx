import { useState, useEffect, useCallback } from 'react'
import type { ListItem, ShoppingList, TabView } from './types'
import { supabase, setJoinCode } from './lib/supabase'
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
      return
    }
    setItems((data || []) as ListItem[])
  }, [])

  const handleJoin = (name: string, l: ShoppingList) => {
    setJoinCode(l.join_code)
    setUserName(name)
    setList(l)
    fetchItems(l.id)
  }

  // Polling: fetch items every 3 seconds (Realtime WebSocket doesn't support custom headers for RLS)
  useEffect(() => {
    if (!list) return
    const interval = setInterval(() => {
      fetchItems(list.id)
    }, 3000)
    return () => clearInterval(interval)
  }, [list, fetchItems])

  // Also re-fetch when the tab becomes visible again (user switches back to the app)
  useEffect(() => {
    if (!list) return
    const onVisible = () => {
      if (!document.hidden) fetchItems(list.id)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [list, fetchItems])

  // Restore session from localStorage
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
            fetchItems(listData.id)
          }
        })
    }
  }, [fetchItems])

  if (!userName || !list) {
    return <JoinScreen onJoin={handleJoin} />
  }

  const handleLeave = () => {
    setJoinCode('')
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
        {tab === 'list' && (
          <ListScreen items={items} listId={list.id} userName={userName} onItemChange={() => fetchItems(list.id)} />
        )}
        {tab === 'bring' && (
          <BringScreen items={items} userName={userName} onItemChange={() => fetchItems(list.id)} />
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