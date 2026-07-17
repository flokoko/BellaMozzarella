import { useMemo } from 'react'
import type { Expense, ExpenseSplit } from '../types'
import './ExpenseCharts.css'

interface ExpenseChartsProps {
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
  knownPersons: string[]
}

const fmtEUR = (amount: number) =>
  amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const fmtDay = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

interface BarData {
  label: string
  amount: number
}

export default function ExpenseCharts({
  expenses,
  expenseSplits,
  knownPersons,
}: ExpenseChartsProps) {
  // ── Ausgaben pro Tag (newest first, max 7) ──
  const dailyData = useMemo<BarData[]>(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      map[e.expense_date] = (map[e.expense_date] ?? 0) + e.amount
    }
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([date, amount]) => ({ label: fmtDay(date), amount }))
  }, [expenses])

  // ── Ausgaben pro Person ──
  const personData = useMemo<BarData[]>(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ label: name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  // suppress unused warning — expenseSplits and knownPersons are part of the
  // public API but not needed for the current chart derivations
  void expenseSplits
  void knownPersons

  if (expenses.length === 0) {
    return (
      <div className="expense-charts">
        <p className="expense-charts-empty">Noch keine Daten für Charts</p>
      </div>
    )
  }

  const maxDaily = Math.max(...dailyData.map((d) => d.amount), 1)
  const maxPerson = Math.max(...personData.map((d) => d.amount), 1)

  return (
    <div className="expense-charts">
      {/* ── Ausgaben pro Tag ── */}
      {dailyData.length > 0 && (
        <div className="expense-chart-group">
          <h4 className="expense-chart-title">Ausgaben pro Tag</h4>
          <div className="expense-chart-bars">
            {dailyData.map((d, i) => (
              <div key={i} className="expense-chart-row">
                <span className="expense-chart-label">{d.label}</span>
                <div className="expense-chart-bar-track">
                  <div
                    className="expense-chart-bar expense-chart-bar-red"
                    style={{ width: `${(d.amount / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="expense-chart-amount">{fmtEUR(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ausgaben pro Person ── */}
      {personData.length > 0 && (
        <div className="expense-chart-group">
          <h4 className="expense-chart-title">Ausgaben pro Person</h4>
          <div className="expense-chart-bars">
            {personData.map((d, i) => (
              <div key={i} className="expense-chart-row">
                <span className="expense-chart-label">{d.label}</span>
                <div className="expense-chart-bar-track">
                  <div
                    className="expense-chart-bar expense-chart-bar-green"
                    style={{ width: `${(d.amount / maxPerson) * 100}%` }}
                  />
                </div>
                <span className="expense-chart-amount">{fmtEUR(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}