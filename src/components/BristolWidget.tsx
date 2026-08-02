import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './BristolWidget.css'

interface BristolStats {
  totalEntries: number
  todayEntries: number
  avgValue: number | null
  mostCommonValue: number | null
  userEntries: number
  userAvgValue: number | null
  userLatestValue: number | null
}

interface BristolWidgetProps {
  listId: string
  userName: string
  onNavigate: () => void
}

export default function BristolWidget({ listId, userName, onNavigate }: BristolWidgetProps) {
  const [stats, setStats] = useState<BristolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Collapsible state from localStorage ──
  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem('bristol_widget_expanded') === 'true'
  })

  const toggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      localStorage.setItem('bristol_widget_expanded', String(next))
      return next
    })
  }

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: allEntries, error: err1 } = await supabase
        .from('bristol_entries')
        .select('value, participant_name, entry_date')
        .eq('list_id', listId)

      if (err1) throw err1

      const entries = allEntries as { value: number; participant_name: string; entry_date: string }[]
      const totalEntries = entries.length
      const todayEntries = entries.filter(e => e.entry_date === today).length

      const avgValue = totalEntries > 0
        ? entries.reduce((s, e) => s + e.value, 0) / totalEntries
        : null

      const valueCounts: Record<number, number> = {}
      entries.forEach(e => { valueCounts[e.value] = (valueCounts[e.value] ?? 0) + 1 })
      const mostCommonValue = Object.keys(valueCounts).length > 0
        ? Number(Object.entries(valueCounts).sort((a, b) => b[1] - a[1])[0][0])
        : null

      const userEntries = entries.filter(e => e.participant_name === userName)
      const userTotal = userEntries.length
      const userAvgValue = userTotal > 0
        ? userEntries.reduce((s, e) => s + e.value, 0) / userTotal
        : null
      const userLatestValue = userTotal > 0
        ? userEntries.sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0].value
        : null

      setStats({
        totalEntries,
        todayEntries,
        avgValue: avgValue !== null ? Number(avgValue.toFixed(1)) : null,
        mostCommonValue,
        userEntries: userTotal,
        userAvgValue: userAvgValue !== null ? Number(userAvgValue.toFixed(1)) : null,
        userLatestValue,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [listId, userName, today])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const BRISTOL_COLORS: Record<number, string> = {
    1: '#8B4513', 2: '#A0522D', 3: '#D2691E', 4: '#009246',
    5: '#9ACD32', 6: '#FFD700', 7: '#FF6347', 13: '#8B4513',
  }

  const BRISTOL_EMOJIS: Record<number, string> = {
    1: '🪨', 2: '🌭', 3: '🥨', 4: '🍌',
    5: '🍦', 6: '🥣', 7: '💧', 13: '💩',
  }

  return (
    <div className="bristol-widget" onClick={toggleExpanded}>
      {/* ── Compact row ── */}
      <div className="bristol-widget-compact-row">
        <span className="bristol-widget-emoji">💩</span>
        <span className="bristol-widget-title">Bristol</span>
        {loading ? (
          <span className="bristol-widget-loading">…</span>
        ) : stats ? (
          <span className="bristol-widget-summary">
            {stats.todayEntries > 0
              ? `${stats.todayEntries} heute`
              : 'Heute niente'}
            {stats.totalEntries > 0 && (
              <span className="bristol-widget-total"> · {stats.totalEntries} gesamt</span>
            )}
          </span>
        ) : error ? (
          <span className="bristol-widget-error">⚠️</span>
        ) : null}
        <span className="bristol-widget-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="bristol-widget-expanded">
          {loading && <p className="bristol-widget-loading-text">Lädt Bristol-Daten…</p>}
          {error && <p className="bristol-widget-error-text">{error}</p>}

          {stats && !loading && (
            <>
              {/* Allgemeine Statistiken */}
              <div className="bristol-widget-section">
                <div className="bristol-widget-section-title">Allgemein</div>
                <div className="bristol-widget-stats-row">
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">{stats.totalEntries}</span>
                    <span className="bristol-widget-stat-label">Einträge</span>
                  </div>
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">{stats.avgValue ?? '—'}</span>
                    <span className="bristol-widget-stat-label">Ø Wert</span>
                  </div>
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">
                      {stats.mostCommonValue !== null ? (
                        <span style={{ color: BRISTOL_COLORS[stats.mostCommonValue] }}>
                          {BRISTOL_EMOJIS[stats.mostCommonValue]} {stats.mostCommonValue}
                        </span>
                      ) : '—'}
                    </span>
                    <span className="bristol-widget-stat-label">Häufigster</span>
                  </div>
                </div>
              </div>

              {/* Deine Statistiken */}
              <div className="bristol-widget-section">
                <div className="bristol-widget-section-title">Deine Werte</div>
                <div className="bristol-widget-stats-row">
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">{stats.userEntries}</span>
                    <span className="bristol-widget-stat-label">Einträge</span>
                  </div>
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">{stats.userAvgValue ?? '—'}</span>
                    <span className="bristol-widget-stat-label">Ø Wert</span>
                  </div>
                  <div className="bristol-widget-stat-item">
                    <span className="bristol-widget-stat-num">
                      {stats.userLatestValue !== null ? (
                        <span style={{ color: BRISTOL_COLORS[stats.userLatestValue] }}>
                          {BRISTOL_EMOJIS[stats.userLatestValue]} {stats.userLatestValue}
                        </span>
                      ) : '—'}
                    </span>
                    <span className="bristol-widget-stat-label">Letzter</span>
                  </div>
                </div>
              </div>

              {/* Navigations-Button */}
              <button
                className="bristol-widget-open-btn"
                onClick={(e) => { e.stopPropagation(); onNavigate() }}
              >
                💩 Zur Bristol-Übersicht ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
