import { useState, useEffect } from 'react'
import { Trash2, Palette, Sun, Moon, Check, Copy, Pencil, Crown, Lock, KeyRound, Bell, BellOff } from 'lucide-react'
import type { ItemCategory, ListType, Participant } from '../types'
import type { ThemeMode } from '../lib/theme'
import { getTheme, setTheme } from '../lib/theme'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../hooks/useCategories'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback'
import { APP_VERSION } from '../version'

import './SettingsScreen.css'

interface SettingsScreenProps {
  userName: string
  listName: string
  onLeave: () => void
  onRename: (newName: string) => void
  categories: ItemCategory[]
  listId: string
  onCategoriesChange: () => void
  participants: Participant[]
  onParticipantsChange: () => void
  isAdmin: boolean
  adminUnlocked: boolean
  hasAdminPassword: boolean
  onSetAdminPassword: (password: string) => void
  onUnlockAdmin: (password: string) => Promise<boolean>
  onChangeOwnPassword: (oldPassword: string, newPassword: string) => Promise<{ success?: boolean; error?: string }>
}

export default function SettingsScreen({
  userName,
  listName,
  onLeave,
  onRename,
  categories,
  listId,
  onCategoriesChange,
  participants,
  onParticipantsChange,
  isAdmin,
  adminUnlocked,
  hasAdminPassword,
  onSetAdminPassword,
  onUnlockAdmin,
  onChangeOwnPassword,
}: SettingsScreenProps) {
  const { toast, confirm } = useToast()
  const [theme, setThemeState] = useState<ThemeMode>('auto')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(userName)
  const [copied, setCopied] = useState(false)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState('')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [showSetPassword, setShowSetPassword] = useState(false)
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [localCatNames, setLocalCatNames] = useState<Record<string, string>>({})
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')

  const { updateCategory, deleteCategory, addCategory } = useCategories(onCategoriesChange)
  const debouncedUpdateCategory = useDebouncedCallback(updateCategory, 400)

  useEffect(() => {
    setThemeState(getTheme())
    setPushEnabled(localStorage.getItem('push_notifications_enabled') === 'true')
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeState(mode)
    setTheme(mode)
  }

  const handleTogglePush = async () => {
    if (pushEnabled) {
      localStorage.removeItem('push_notifications_enabled')
      setPushEnabled(false)
      return
    }
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission === 'granted') {
        localStorage.setItem('push_notifications_enabled', 'true')
        setPushEnabled(true)
      }
    }
  }

  const handleSaveName = () => {
    const trimmed = newName.trim()
    if (trimmed && trimmed !== userName) {
      onRename(trimmed)
    }
    setEditingName(false)
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText('BELLA26')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = 'BELLA26'
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const MAX_PARTICIPANTS = 14

  const handleAddParticipant = async () => {
    const n = newParticipantName.trim()
    if (!n) return
    if (participants.length >= MAX_PARTICIPANTS) {
      toast(`Maximal ${MAX_PARTICIPANTS} Teilnehmer erreicht.`, 'error')
      return
    }
    const exists = participants.find(p => p.name.toLowerCase() === n.toLowerCase())
    if (exists) {
      toast(`Teilnehmer "${exists.name}" existiert bereits!`, 'error')
      return
    }
    const { error } = await supabase.from('participants').insert({ list_id: listId, name: n })
    if (error) {
      toast(`Fehler: ${error.message}`, 'error')
      return
    }
    navigator.vibrate?.(10)
    setNewParticipantName('')
    setShowAddParticipant(false)
    onParticipantsChange()
  }

  const handleDeleteParticipant = (p: Participant) => {
    confirm(`Teilnehmer "${p.name}" entfernen?`, async () => {
      const { error } = await supabase.from('participants').delete().eq('id', p.id)
      if (error) {
        toast(`Fehler: ${error.message}`, 'error')
        return
      }
      navigator.vibrate?.(10)
      onParticipantsChange()
    })
  }

  const handleUnlock = async () => {
    setAdminError('')
    const ok = await onUnlockAdmin(adminPasswordInput)
    if (!ok) {
      setAdminError('Falsches Passwort.')
    }
    setAdminPasswordInput('')
  }

  const handleChangePassword = async () => {
    setAdminError('')
    const oldPw = oldPassword.trim()
    const newPw = newPassword.trim()
    if (!oldPw || !newPw) {
      setAdminError('Bitte altes und neues Passwort eingeben.')
      return
    }
    if (newPw.length < 3) {
      setAdminError('Neues Passwort muss mindestens 3 Zeichen lang sein.')
      return
    }
    const result = await onChangeOwnPassword(oldPw, newPw)
    if (result.error) {
      setAdminError(result.error)
    } else {
      toast('Passwort geändert!', 'success')
      setOldPassword('')
      setNewPassword('')
      setShowChangePassword(false)
    }
  }

  const handleSavePassword = () => {
    const pw = newAdminPassword.trim()
    if (pw.length < 3) {
      setAdminError('Passwort muss mindestens 3 Zeichen lang sein.')
      return
    }
    onSetAdminPassword(pw)
    setNewAdminPassword('')
    setShowSetPassword(false)
    setAdminError('')
  }

  const handleAddCategory = (listType: ListType) => {
    const cats = categories.filter((c) => c.list_type === listType)
    const maxOrder = cats.reduce((max, c) => Math.max(max, c.sort_order), 0)
    addCategory(listId, listType, maxOrder + 1)
  }

  const renderCategoryEditor = (listType: ListType, title: string) => {
    const cats = categories.filter((c) => c.list_type === listType)
    return (
      <div className="settings-cat-subsection" key={listType}>
        <div className="settings-cat-subsection-header">
          <span className="settings-cat-subsection-title">{title}</span>
          <button
            className="settings-cat-add-btn"
            onClick={() => handleAddCategory(listType)}
          >
            + Kategorie
          </button>
        </div>
        {cats.length === 0 && (
          <p className="settings-cat-empty">Keine Kategorien</p>
        )}
        {cats.map((cat) => (
          <div key={cat.id} className="settings-cat-item">
            <input
              className="settings-cat-name-input"
              type="text"
              value={localCatNames[cat.id] ?? cat.name}
              onChange={(e) => {
                setLocalCatNames(prev => ({ ...prev, [cat.id]: e.target.value }))
                debouncedUpdateCategory(cat.id, { name: e.target.value })
              }}
            />
            <button
              className="settings-cat-delete-btn"
              onClick={() => confirm('Dieses Element wirklich löschen?', () => deleteCategory(cat.id))}
              aria-label="Kategorie löschen"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="settings-screen">
      {/* ── Erscheinungsbild ────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Erscheinungsbild</h3>
        <div className="settings-item">
          <span className="settings-item-icon"><Palette size={18} strokeWidth={2} /></span>
          <span className="settings-item-label">Design</span>
          <div className="settings-item-control theme-toggle-group">
            <button
              className={`theme-toggle-btn ${theme === 'auto' ? 'active' : ''}`}
              onClick={() => handleThemeChange('auto')}
            >
              Auto
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={14} strokeWidth={2} /> Hell
            </button>
            <button
              className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={14} strokeWidth={2} /> Dunkel
            </button>
          </div>
        </div>
      </div>

      {/* ── Push-Benachrichtigungen ──────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Push-Benachrichtigungen</h3>
        <div className="settings-item" onClick={handleTogglePush} style={{ cursor: 'pointer' }}>
          <span className="settings-item-icon">
            {pushEnabled ? <Bell size={18} strokeWidth={2} /> : <BellOff size={18} strokeWidth={2} />}
          </span>
          <span className="settings-item-label">Benachrichtigungen bei neuen Items</span>
          <div className="settings-item-control">
            <span className={`settings-push-status ${pushEnabled ? 'on' : 'off'}`}>
              {pushEnabled
                ? 'Aktiviert'
                : pushPermission === 'denied'
                  ? 'Nicht erlaubt'
                  : 'Deaktiviert'}
            </span>
            <button
              className={`settings-push-toggle ${pushEnabled ? 'on' : ''}`}
              type="button"
              aria-label="Push-Benachrichtigungen umschalten"
            >
              <span className="settings-push-toggle-knob" />
            </button>
          </div>
        </div>
        {pushPermission === 'denied' && (
          <p className="settings-cat-hint" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
            Benachrichtigungen wurden im Browser blockiert. Bitte in den Browser-Einstellungen erlauben.
          </p>
        )}
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-info-row">
          <span className="settings-info-label">Name</span>
          <span className="settings-info-value">{userName}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Liste</span>
          <span className="settings-info-value">{listName}</span>
        </div>

        {editingName ? (
          <div className="settings-inline-form">
            <input
              className="settings-inline-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <button className="settings-btn settings-btn-primary" onClick={handleSaveName}>
              Speichern
            </button>
            <button className="settings-btn settings-btn-secondary" onClick={() => setEditingName(false)}>
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            className="settings-btn settings-btn-secondary"
            style={{ marginTop: '0.6rem', width: '100%' }}
            onClick={() => { setNewName(userName); setEditingName(true) }}
          >
            <Pencil size={16} strokeWidth={2} /> Namen ändern
          </button>
        )}

        {/* ── Eigenes Passwort ändern ──────────────────────────────── */}
        {showChangePassword ? (
          <div className="settings-inline-form" style={{ flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
            <input
              className="settings-inline-input"
              type="password"
              placeholder="Altes Passwort"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoFocus
            />
            <input
              className="settings-inline-input"
              type="password"
              placeholder="Neues Passwort"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
            />
            {adminError && <p className="settings-admin-error">{adminError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="settings-btn settings-btn-secondary" onClick={() => { setShowChangePassword(false); setOldPassword(''); setNewPassword(''); setAdminError('') }}>
                Abbrechen
              </button>
              <button className="settings-btn settings-btn-primary" onClick={handleChangePassword}>
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <button
            className="settings-btn settings-btn-secondary"
            style={{ marginTop: '0.6rem', width: '100%' }}
            onClick={() => setShowChangePassword(true)}
          >
            <KeyRound size={16} strokeWidth={2} /> Passwort ändern
          </button>
        )}

        <button className="settings-btn-danger" onClick={onLeave}>
          Liste verlassen
        </button>
      </div>

      {/* ── Teilnehmer ─────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">
          Teilnehmer
          {isAdmin && adminUnlocked && <span className="settings-admin-badge"><Crown size={12} strokeWidth={2} /> Admin</span>}
        </h3>
        <p className="settings-cat-hint">{participants.length} {participants.length === 1 ? 'Person' : 'Personen'} in dieser Liste.</p>

        {participants.map((p) => (
          <div key={p.id} className="settings-cat-item">
            <span className="settings-participant-name">
              {p.name}
              {p.is_admin && <span className="settings-participant-admin"><Crown size={12} strokeWidth={2} /></span>}
            </span>
            {isAdmin && adminUnlocked && (
              <button
                className="settings-cat-delete-btn"
                onClick={() => handleDeleteParticipant(p)}
                aria-label="Teilnehmer entfernen"
              >
              <Trash2 size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        ))}
        {participants.length === 0 && (
          <p className="settings-cat-empty">Noch keine Teilnehmer</p>
        )}

        {/* Admin-Bereich: Passwort-geschützte Teilnehmer-Verwaltung */}
        {isAdmin && !hasAdminPassword && !showSetPassword && (
          <button
            className="settings-btn settings-btn-secondary"
            style={{ marginTop: '0.6rem', width: '100%' }}
            onClick={() => setShowSetPassword(true)}
          >
            <Lock size={16} strokeWidth={2} /> Admin-Passwort festlegen
          </button>
        )}

        {isAdmin && !hasAdminPassword && showSetPassword && (
          <div className="settings-inline-form" style={{ flexDirection: 'column', gap: '0.5rem' }}>
            <p className="settings-cat-hint" style={{ marginBottom: 0 }}>
              Lege ein Passwort fest, um die Teilnehmer-Verwaltung zu schützen.
            </p>
            <input
              className="settings-inline-input"
              type="password"
              placeholder="Admin-Passwort"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
              autoFocus
            />
            {adminError && <p className="settings-admin-error">{adminError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="settings-btn settings-btn-secondary" onClick={() => { setShowSetPassword(false); setNewAdminPassword(''); setAdminError('') }}>
                Abbrechen
              </button>
              <button className="settings-btn settings-btn-primary" onClick={handleSavePassword}>
                Speichern
              </button>
            </div>
          </div>
        )}

        {isAdmin && hasAdminPassword && !adminUnlocked && (
          <div className="settings-inline-form" style={{ flexDirection: 'column', gap: '0.5rem' }}>
            <p className="settings-cat-hint" style={{ marginBottom: 0 }}>
              <Lock size={16} strokeWidth={2} /> Gib das Admin-Passwort ein, um Teilnehmer zu verwalten.
            </p>
            <input
              className="settings-inline-input"
              type="password"
              placeholder="Admin-Passwort"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              autoFocus
            />
            {adminError && <p className="settings-admin-error">{adminError}</p>}
            <button className="settings-btn settings-btn-primary" onClick={handleUnlock} style={{ width: '100%' }}>
              Entsperren
            </button>
          </div>
        )}

        {isAdmin && adminUnlocked && (
          <>
            {showAddParticipant ? (
              <div className="settings-inline-form">
                <input
                  className="settings-inline-input"
                  type="text"
                  placeholder="Name"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                  autoFocus
                />
                <button className="settings-btn settings-btn-primary" onClick={handleAddParticipant}>
                  Hinzufügen
                </button>
                <button className="settings-btn settings-btn-secondary" onClick={() => { setShowAddParticipant(false); setNewParticipantName('') }}>
                  Abbrechen
                </button>
              </div>
            ) : participants.length < MAX_PARTICIPANTS ? (
              <button
                className="settings-btn settings-btn-secondary"
                style={{ marginTop: '0.6rem', width: '100%' }}
                onClick={() => setShowAddParticipant(true)}
              >
                + Teilnehmer hinzufügen
              </button>
            ) : (
              <p className="settings-cat-hint" style={{ marginTop: '0.5rem' }}>
                Maximum von {MAX_PARTICIPANTS} Teilnehmern erreicht.
              </p>
            )}

            {/* Admin: Passwort ändern */}
            {showChangePassword ? (
              <div className="settings-inline-form" style={{ flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
                <input
                  className="settings-inline-input"
                  type="password"
                  placeholder="Altes Passwort"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoFocus
                />
                <input
                  className="settings-inline-input"
                  type="password"
                  placeholder="Neues Passwort"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                />
                {adminError && <p className="settings-admin-error">{adminError}</p>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="settings-btn settings-btn-secondary" onClick={() => { setShowChangePassword(false); setOldPassword(''); setNewPassword(''); setAdminError('') }}>
                    Abbrechen
                  </button>
                  <button className="settings-btn settings-btn-primary" onClick={handleChangePassword}>
                    Speichern
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="settings-btn settings-btn-secondary"
                style={{ marginTop: '0.6rem', width: '100%' }}
                onClick={() => setShowChangePassword(true)}
              >
                <KeyRound size={16} strokeWidth={2} /> Passwort ändern
              </button>
            )}
          </>
        )}

        {!isAdmin && (
          <p className="settings-cat-hint" style={{ marginTop: '0.5rem' }}>
            Nur der Admin kann Teilnehmer verwalten.
          </p>
        )}
      </div>

      {/* ── Kategorien ──────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Kategorien</h3>
        <p className="settings-cat-hint">Kategorien für Einkaufsliste und Mitbringen getrennt verwalten.</p>
        {renderCategoryEditor('shopping', 'Einkaufsliste')}
        {renderCategoryEditor('bring', 'Mitbringen')}
      </div>

      {/* ── Info ─────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <h3 className="settings-section-title">Info</h3>
        <div className="settings-info-block">
          <div className="settings-app-name">
            <span className="settings-flag-bar green"></span>
            <span className="settings-flag-bar white"></span>
            <span className="settings-flag-bar red"></span>
            Bella Mozzarella
          </div>
          <div className="settings-app-version">Version {APP_VERSION}</div>
          <p className="settings-app-desc">
            Gemeinsame Einkaufsliste mit Realtime-Sync. Built with React, Supabase &amp; Vite.
          </p>
          <a
            className="settings-link"
            href="https://github.com/flokoko/BellaMozzarella"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Repository →
          </a>
        </div>
      </div>
    </div>
  )
}
