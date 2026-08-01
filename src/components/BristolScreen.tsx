import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import type { BristolEntry } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import './BristolScreen.css'

const BRISTOL_ADJECTIVES: Record<number, string> = {
  1: 'klumpig',
  2: 'wurstartig',
  3: 'rissig',
  4: 'glatt',
  5: 'weich',
  6: 'breiig',
  7: 'flüssig',
  13: 'explosiv',
}

const BRISTOL_COLORS: Record<number, string> = {
  1: '#8B4513',
  2: '#A0522D',
  3: '#D2691E',
  4: '#009246',
  5: '#9ACD32',
  6: '#FFD700',
  7: '#FF6347',
  13: '#FFE4E1',
}

const BRISTOL_EMOJIS: Record<number, string> = {
  1: '🪨',
  2: '🌭',
  3: '🥨',
  4: '🍌',
  5: '🍦',
  6: '🥣',
  7: '💧',
  13: '💥',
}

const BRISTOL_VALUES = [1, 2, 3, 4, 5, 6, 7, 13]

interface BristolScreenProps {
  listId: string
  userName: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function BristolScreen({ listId, userName }: BristolScreenProps) {
  const { toast } = useToast()

  const [entries, setEntries] = useState<BristolEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const today = todayStr()

  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('bristol_entries')
      .select('*')
      .eq('list_id', listId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('fetchEntries error:', error)
      return
    }
    setEntries(data as BristolEntry[] ?? [])
    setLoadingEntries(false)
  }, [listId])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleSubmitEntry = useCallback(async (value: number) => {
    setSubmitting(true)
    const { error } = await supabase
      .from('bristol_entries')
      .upsert(
        {
          list_id: listId,
          participant_name: userName,
          value,
          entry_date: today,
        },
        { onConflict: 'list_id,participant_name,entry_date' }
      )
    setSubmitting(false)
    if (error) {
      toast(`Fehler: ${error.message}`, 'error')
      return
    }
    toast(`Bristol-Wert ${value} (${BRISTOL_ADJECTIVES[value]}) eingetragen!`, 'success')
    navigator.vibrate?.(20)
    fetchEntries()
  }, [listId, userName, today, toast, fetchEntries])

  const handleUpdateEntry = useCallback(async (entryId: string, value: number) => {
    setSubmitting(true)
    const { error } = await supabase
      .from('bristol_entries')
      .update({ value })
      .eq('id', entryId)
    setSubmitting(false)
    if (error) {
      toast(`Fehler: ${error.message}`, 'error')
      return
    }
    toast(`Bristol-Wert auf ${value} (${BRISTOL_ADJECTIVES[value]}) geändert!`, 'success')
    navigator.vibrate?.(20)
    setEditingEntryId(null)
    fetchEntries()
  }, [toast, fetchEntries])

  const myTodayEntry = useMemo(
    () => entries.find(e => e.participant_name === userName && e.entry_date === today),
    [entries, userName, today]
  )

  const todayEntries = useMemo(
    () => entries.filter(e => e.entry_date === today),
    [entries, today]
  )

  const stats = useMemo(() => {
    if (entries.length === 0) return null
    const values = entries.map(e => e.value)
    const total = values.length
    const avg = values.reduce((a, b) => a + b, 0) / total
    const min = Math.min(...values)
    const max = Math.max(...values)
    const counts: Record<number, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    const mode = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
    return { total, avg, min, max, mode }
  }, [entries])

  const distributionData = useMemo(() => {
    const counts: Record<number, number> = {}
    BRISTOL_VALUES.forEach(v => { counts[v] = 0 })
    entries.forEach(e => { counts[e.value] = (counts[e.value] ?? 0) + 1 })
    return BRISTOL_VALUES.map(v => ({
      value: v,
      label: `${v}`,
      count: counts[v],
      adjective: BRISTOL_ADJECTIVES[v],
      fill: BRISTOL_COLORS[v],
    }))
  }, [entries])

  const trendData = useMemo(() => {
    const days: { date: string; label: string; avg: number | null; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayEntries = entries.filter(e => e.entry_date === dateStr)
      const avg = dayEntries.length > 0
        ? dayEntries.reduce((s, e) => s + e.value, 0) / dayEntries.length
        : null
      days.push({
        date: dateStr,
        label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
        avg: avg !== null ? Number(avg.toFixed(2)) : null,
        count: dayEntries.length,
      })
    }
    return days
  }, [entries])

  const hasData = entries.length > 0

  return (
    <div className="bristol-screen">
      {/* ── Hero: Today's Entry ── */}
      <div className="bristol-hero">
        <div className="bristol-hero-label">Dein heutiger Wert</div>
        {myTodayEntry ? (
          <div className="bristol-hero-value-wrap">
            <div
              className="bristol-hero-circle"
              style={{ background: BRISTOL_COLORS[myTodayEntry.value] }}
            >
              <span className="bristol-hero-emoji">{BRISTOL_EMOJIS[myTodayEntry.value]}</span>
              <span className="bristol-hero-number">{myTodayEntry.value}</span>
            </div>
            <div className="bristol-hero-text">
              <span className="bristol-hero-adjective">{BRISTOL_ADJECTIVES[myTodayEntry.value]}</span>
              <span className="bristol-hero-change-hint">Tippe unten, um zu ändern</span>
            </div>
          </div>
        ) : (
          <div className="bristol-hero-prompt">
            <span className="bristol-hero-question">❓</span>
            <span>Noch nicht eingetragen</span>
          </div>
        )}
      </div>

      {/* ── Value Picker (Grid) ── */}
      <div className="bristol-picker">
        <div className="bristol-picker-label">Bristol-Skala 1–7 + 13</div>
        <div className="bristol-picker-grid">
          {BRISTOL_VALUES.map(v => (
            <button
              key={v}
              className={`bristol-picker-btn ${v === 13 ? 'bristol-picker-btn-bonus' : ''} ${myTodayEntry?.value === v ? 'selected' : ''}`}
              style={{ '--bristol-color': BRISTOL_COLORS[v] } as React.CSSProperties}
              disabled={submitting}
              onClick={() => handleSubmitEntry(v)}
            >
              <span className="bristol-picker-emoji">{BRISTOL_EMOJIS[v]}</span>
              <span className="bristol-picker-num">{v}</span>
              <span className="bristol-picker-adj">{BRISTOL_ADJECTIVES[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Today's Overview ── */}
      <div className="bristol-card">
        <div className="bristol-card-header">
          <span className="bristol-card-title">Heute</span>
          {todayEntries.length > 0 && (
            <span className="bristol-card-badge">{todayEntries.length} {todayEntries.length === 1 ? 'Eintrag' : 'Einträge'}</span>
          )}
        </div>
        {todayEntries.length === 0 ? (
          <p className="bristol-empty-state">Noch niemand hat heute einen Wert eingetragen.</p>
        ) : (
          <div className="bristol-today-grid">
            {todayEntries.map(e => (
              <div key={e.id} className="bristol-today-chip">
                <span className="bristol-today-dot" style={{ background: BRISTOL_COLORS[e.value] }} />
                <span className="bristol-today-name">
                  {e.participant_name}
                  {e.participant_name === userName && <span className="bristol-today-me"> (du)</span>}
                </span>
                <span className="bristol-today-val">{e.value}</span>
                <span className="bristol-today-adj">{BRISTOL_ADJECTIVES[e.value]}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Statistics ── */}
      {stats && (
        <div className="bristol-card">
          <div className="bristol-card-header">
            <span className="bristol-card-title">Statistik</span>
          </div>

          <div className="bristol-stats-row">
            <div className="bristol-stat-item">
              <span className="bristol-stat-num">{stats.total}</span>
              <span className="bristol-stat-label">Einträge</span>
            </div>
            <div className="bristol-stat-item">
              <span className="bristol-stat-num">{stats.avg.toFixed(1)}</span>
              <span className="bristol-stat-label">Ø Wert</span>
            </div>
            <div className="bristol-stat-item">
              <span className="bristol-stat-num">{stats.min}</span>
              <span className="bristol-stat-label">Min</span>
            </div>
            <div className="bristol-stat-item">
              <span className="bristol-stat-num">{stats.max}</span>
              <span className="bristol-stat-label">Max</span>
            </div>
            <div className="bristol-stat-item">
              <span className="bristol-stat-num">{stats.mode}</span>
              <span className="bristol-stat-label">Häufigster</span>
            </div>
          </div>

          {/* Distribution */}
          <div className="bristol-chart-box">
            <div className="bristol-chart-label">Verteilung</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distributionData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card-bg-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  }}
                  formatter={(val: any) => [`${val} Einträge`, 'Anzahl']}
                  labelFormatter={(label: any) => `Wert ${label}`}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={24} fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trend */}
          <div className="bristol-chart-box">
            <div className="bristol-chart-label">Trend (14 Tage)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 13]} ticks={[1, 3, 5, 7, 9, 11, 13]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card-bg-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  }}
                  formatter={(val: any) => val !== null ? [`Ø ${val}`, 'Durchschnitt'] : ['—', '']}
                  labelFormatter={(label: any) => label}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem', marginTop: '4px' }} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Durchschnitt"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--accent)' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── History ── */}
      <div className="bristol-card">
        <div className="bristol-card-header">
          <span className="bristol-card-title">Verlauf</span>
          {hasData && <span className="bristol-card-badge">{entries.length} gesamt</span>}
        </div>
        {loadingEntries ? (
          <p className="bristol-empty-state">Lädt…</p>
        ) : !hasData ? (
          <p className="bristol-empty-state">Noch keine Einträge. Tippe oben einen Wert, um zu starten!</p>
        ) : (
          <div className="bristol-history-list">
            {entries.map(e => {
              const isOwn = e.participant_name === userName
              const isEditing = editingEntryId === e.id
              return (
                <div key={e.id} className={`bristol-history-row ${isOwn ? 'bristol-history-own' : ''}`}>
                  <span className="bristol-history-date">
                    {new Date(e.entry_date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </span>
                  <span className="bristol-history-name">
                    {e.participant_name}
                    {isOwn && <span className="bristol-today-me"> (du)</span>}
                  </span>
                  {isEditing ? (
                    <div className="bristol-history-edit-picker">
                      {BRISTOL_VALUES.map(v => (
                        <button
                          key={v}
                          className={`bristol-history-edit-btn ${e.value === v ? 'selected' : ''}`}
                          style={{ '--bristol-color': BRISTOL_COLORS[v] } as React.CSSProperties}
                          disabled={submitting}
                          onClick={() => handleUpdateEntry(e.id, v)}
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        className="bristol-history-edit-cancel"
                        onClick={() => setEditingEntryId(null)}
                        disabled={submitting}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="bristol-history-badge" style={{ background: BRISTOL_COLORS[e.value] }}>
                        {e.value}
                      </span>
                      <span className="bristol-history-adj">{BRISTOL_ADJECTIVES[e.value]}</span>
                      {isOwn && (
                        <button
                          className="bristol-history-edit-trigger"
                          onClick={() => setEditingEntryId(e.id)}
                          aria-label="Wert bearbeiten"
                        >
                          ✏️
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
