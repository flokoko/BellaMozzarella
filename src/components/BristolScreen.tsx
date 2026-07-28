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
}

const BRISTOL_COLORS: Record<number, string> = {
  1: '#8B4513',
  2: '#A0522D',
  3: '#D2691E',
  4: '#009246',
  5: '#9ACD32',
  6: '#FFD700',
  7: '#FF6347',
}

interface BristolScreenProps {
  listId: string
  userName: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function BristolScreen({ listId, userName }: BristolScreenProps) {
  const { toast } = useToast()

  // ── Bristol entries state ──
  const [entries, setEntries] = useState<BristolEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const today = todayStr()

  // ── Fetch bristol entries ──
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

  // ── Submit bristol entry ──
  const handleSubmitEntry = useCallback(async (value: number) => {
    setSubmitting(true)
    // Upsert: insert or update if entry for today already exists
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

  // ── Derived data ──
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
    // Most common value (mode)
    const counts: Record<number, number> = {}
    values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
    const mode = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0])
    return { total, avg, min, max, mode }
  }, [entries])

  const distributionData = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
    entries.forEach(e => { counts[e.value] = (counts[e.value] ?? 0) + 1 })
    return Array.from({ length: 7 }, (_, i) => ({
      value: i + 1,
      label: `${i + 1}`,
      count: counts[i + 1],
      adjective: BRISTOL_ADJECTIVES[i + 1],
    }))
  }, [entries])

  const trendData = useMemo(() => {
    // Last 14 days
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

  // ── Render ──
  return (
    <div className="bristol-screen">
      {/* ── Daily Entry ── */}
      <div className="bristol-section">
        <h3 className="bristol-section-title">Heutiger Eintrag</h3>
        {myTodayEntry ? (
          <div className="bristol-already-entered">
            <div className="bristol-already-value" style={{ background: BRISTOL_COLORS[myTodayEntry.value] }}>
              {myTodayEntry.value}
            </div>
            <p className="bristol-already-text">
              Heute bereits eingetragen: <strong>{myTodayEntry.value}</strong> — {BRISTOL_ADJECTIVES[myTodayEntry.value]}
            </p>
            <p className="bristol-already-hint">Tippe einen anderen Wert, um ihn zu ändern.</p>
          </div>
        ) : (
          <p className="bristol-hint">Wähle deinen Bristol-Wert für heute:</p>
        )}
        <div className="bristol-value-grid">
          {Array.from({ length: 7 }, (_, i) => i + 1).map(v => (
            <button
              key={v}
              className={`bristol-value-btn ${myTodayEntry?.value === v ? 'selected' : ''}`}
              style={{ '--bristol-color': BRISTOL_COLORS[v] } as React.CSSProperties}
              disabled={submitting}
              onClick={() => handleSubmitEntry(v)}
            >
              <span className="bristol-value-num">{v}</span>
              <span className="bristol-value-adj">{BRISTOL_ADJECTIVES[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Today's Overview ── */}
      <div className="bristol-section">
        <h3 className="bristol-section-title">Heute Übersicht</h3>
        {todayEntries.length === 0 ? (
          <p className="bristol-empty">Noch keine Einträge heute.</p>
        ) : (
          <table className="bristol-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Wert</th>
                <th>Typ</th>
              </tr>
            </thead>
            <tbody>
              {todayEntries.map(e => (
                <tr key={e.id}>
                  <td className="bristol-td-name">
                    {e.participant_name}
                    {e.participant_name === userName && <span className="bristol-td-me"> (du)</span>}
                  </td>
                  <td className="bristol-td-value">
                    <span className="bristol-value-badge" style={{ background: BRISTOL_COLORS[e.value] }}>
                      {e.value}
                    </span>
                  </td>
                  <td className="bristol-td-adj">{BRISTOL_ADJECTIVES[e.value]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Statistics ── */}
      {stats && (
        <div className="bristol-section">
          <h3 className="bristol-section-title">Statistik</h3>

          <div className="bristol-stats-cards">
            <div className="bristol-stat-card">
              <div className="bristol-stat-value">{stats.total}</div>
              <div className="bristol-stat-label">Einträge</div>
            </div>
            <div className="bristol-stat-card">
              <div className="bristol-stat-value">{stats.avg.toFixed(1)}</div>
              <div className="bristol-stat-label">Ø Wert</div>
            </div>
            <div className="bristol-stat-card">
              <div className="bristol-stat-value">{stats.min}</div>
              <div className="bristol-stat-label">Min</div>
            </div>
            <div className="bristol-stat-card">
              <div className="bristol-stat-value">{stats.max}</div>
              <div className="bristol-stat-label">Max</div>
            </div>
            <div className="bristol-stat-card">
              <div className="bristol-stat-value">{stats.mode}</div>
              <div className="bristol-stat-label">Häufigster</div>
            </div>
          </div>

          {/* Distribution BarChart */}
          <div className="bristol-chart-container">
            <h4 className="bristol-chart-title">Verteilung der Werte</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card-bg-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                  formatter={(val: any) => [`${val} Einträge`, 'Anzahl']}
                  labelFormatter={(label: any) => `Wert ${label}`}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trend LineChart */}
          <div className="bristol-chart-container">
            <h4 className="bristol-chart-title">Ø Wert Trend (14 Tage)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                <YAxis domain={[1, 7]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--card-bg-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                  formatter={(val: any) => val !== null && val !== undefined ? [`Ø ${val}`, 'Durchschnitt'] : ['Keine Daten', '']}
                  labelFormatter={(label: any) => label}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Durchschnitt"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Full History ── */}
      <div className="bristol-section">
        <h3 className="bristol-section-title">Verlauf</h3>
        {loadingEntries ? (
          <p className="bristol-empty">Lädt…</p>
        ) : entries.length === 0 ? (
          <p className="bristol-empty">Noch keine Einträge.</p>
        ) : (
          <div className="bristol-history-wrap">
            <table className="bristol-table bristol-history-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Person</th>
                  <th>Wert</th>
                  <th>Typ</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="bristol-td-date">
                      {new Date(e.entry_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="bristol-td-name">
                      {e.participant_name}
                      {e.participant_name === userName && <span className="bristol-td-me"> (du)</span>}
                    </td>
                    <td className="bristol-td-value">
                      <span className="bristol-value-badge" style={{ background: BRISTOL_COLORS[e.value] }}>
                        {e.value}
                      </span>
                    </td>
                    <td className="bristol-td-adj">{BRISTOL_ADJECTIVES[e.value]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}