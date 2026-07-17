import { useState, useEffect, Suspense, lazy } from 'react'
import { ArrowLeft, Settings, Sun, Moon, WifiOff, ShoppingCart, Backpack, Pizza, Wallet, type LucideIcon } from 'lucide-react'
import type { TabView } from './types'
import { getResolvedTheme, toggleTheme, applyTheme, initThemeListener } from './lib/theme'
import { supabase } from './lib/supabase'
import JoinScreen from './components/JoinScreen'
import DashboardScreen from './components/DashboardScreen'
import { useListData } from './hooks/useListData'

// Code splitting: lazy-load screens that aren't needed on first paint
const ListScreen = lazy(() => import('./components/ListScreen'))
const BringScreen = lazy(() => import('./components/BringScreen'))
const MealPlanScreen = lazy(() => import('./components/MealPlanScreen'))
const ExpenseScreen = lazy(() => import('./components/ExpenseScreen'))
const SettingsScreen = lazy(() => import('./components/SettingsScreen'))

import './App.css'

export default function App() {
  const {
    userName, list, shoppingItems, bringItems, categories, meals, mealIdeas,
    notes, expenses, expenseSplits, participants, adminUnlocked,
    isAdmin, shoppingCategories, bringCategories, knownPersons, userBalance,
    expenseTotal, checkedCount,
    setList, setAdminUnlocked,
    fetchItems, fetchCategories, fetchMeals, fetchMealIdeas, fetchNotes, fetchExpenses, fetchParticipants,
    toggleShoppingItem, deleteShoppingItem, toggleBringItem, deleteBringItem, reorderItems,
    handleJoin, handleLeave, handleRename,
  } = useListData()

  // ── Tab state ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabView>('home')

  // ── Theme ──────────────────────────────────────────────────────────
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

  // ── Online / offline status ────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine)

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

  // ── beforeinstallprompt: capture for custom install UI ─────────────
  const [installPrompt, setInstallPrompt] = useState<any>(null)

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

  // ── Early return (after all hooks) ─────────────────────────────────
  if (!userName || !list) {
    return <JoinScreen onJoin={handleJoin} />
  }

  // ── Event handlers ─────────────────────────────────────────────────
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
    const { data, error } = await supabase
      .from('lists')
      .select('admin_password')
      .eq('id', list.id)
      .single()
    if (error || !data || !data.admin_password) return false
    if (oldPassword !== data.admin_password) return false
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
    if (list.admin_password && password === list.admin_password) {
      setAdminUnlocked(true)
      navigator.vibrate?.(10)
      return true
    }
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

  const featureTitles: Record<Exclude<TabView, 'home'>, { icon: LucideIcon; label: string }> = {
    list: { icon: ShoppingCart, label: 'Einkaufsliste' },
    bring: { icon: Backpack, label: 'Mitbringen' },
    mealplan: { icon: Pizza, label: 'Essensplan' },
    expenses: { icon: Wallet, label: 'Ausgaben' },
    settings: { icon: Settings, label: 'Einstellungen' },
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          {tab === 'home' ? (
            <div className="header-info">
              <span className="header-name">
                <span className="header-flag-bar green"></span>
                <span className="header-flag-bar white"></span>
                <span className="header-flag-bar red"></span>
                {list.name}
              </span>
              <span className="header-user">
                Angemeldet als: <strong>{userName}</strong>
              </span>
            </div>
          ) : (
            <button className="header-back" onClick={() => setTab('home')}>
              <ArrowLeft size={18} strokeWidth={2} /> Zurück
            </button>
          )}
          <div className="header-actions">
            {tab !== 'home' && tab !== 'settings' && (
              <span className="header-feature-title">
                {(() => {
                  const ft = featureTitles[tab as Exclude<TabView, 'home' | 'settings'>]
                  const Icon = ft.icon
                  return <Icon size={16} strokeWidth={2} />
                })()}
                {featureTitles[tab as Exclude<TabView, 'home' | 'settings'>].label}
              </span>
            )}
            <button className="header-settings-btn" onClick={() => setTab('settings')} aria-label="Einstellungen">
              <Settings size={20} strokeWidth={2} />
            </button>
            <button className="header-theme-toggle" onClick={handleToggleTheme} aria-label="Theme wechseln">
              {isDark ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
            </button>
            <button className="header-leave" onClick={handleLeave}>Verlassen</button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={16} strokeWidth={2} /> Du bist offline — Änderungen können momentan nicht gespeichert werden.
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
          <Suspense fallback={null}>
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
          </Suspense>
        )}
        {tab === 'bring' && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}
        {tab === 'mealplan' && (
          <Suspense fallback={null}>
            <MealPlanScreen
              meals={meals}
              mealIdeas={mealIdeas}
              listId={list.id}
              userName={userName}
              onMealsChange={() => fetchMeals(list.id)}
              onIdeasChange={() => fetchMealIdeas(list.id)}
            />
          </Suspense>
        )}
        {tab === 'expenses' && (
          <Suspense fallback={null}>
            <ExpenseScreen
              expenses={expenses}
              expenseSplits={expenseSplits}
              listId={list.id}
              userName={userName}
              knownPersons={knownPersons}
              onExpensesChange={() => fetchExpenses(list.id)}
            />
          </Suspense>
        )}
        {tab === 'settings' && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}
      </main>
    </div>
  )
}