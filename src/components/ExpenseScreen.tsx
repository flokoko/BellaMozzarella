import { useState, useMemo, useCallback } from 'react'
import { Wallet, Receipt, Pencil, Trash2, ArrowRight, Pizza, Table2, MessageSquare, Plus } from 'lucide-react'
import type { Expense, ExpenseSplit, ItemCategory } from '../types'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { SkeletonExpenseCard } from './Skeleton'
import ExpenseCharts from './ExpenseCharts'
import './ExpenseScreen.css'

interface ExpenseScreenProps {
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
  listId: string
  userName: string
  knownPersons: string[]
  expenseCategories: ItemCategory[]
  isLoading?: boolean
  onExpensesChange: () => void
  onCategoriesChange: () => void
}

const fmtEUR = (amount: number) =>
  amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

const fmtDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface SettlementTxn {
  from: string
  to: string
  amount: number
}

export default function ExpenseScreen({
  expenses,
  expenseSplits,
  listId,
  userName,
  knownPersons,
  expenseCategories,
  isLoading,
  onExpensesChange,
  onCategoriesChange,
}: ExpenseScreenProps) {
  const { toast, confirm } = useToast()
  const [section, setSection] = useState<'expenses' | 'settlement' | 'matrix'>('expenses')
  const [formExpanded, setFormExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(userName)
  const [splitPeople, setSplitPeople] = useState<string[]>([])
  const [splitMode, setSplitMode] = useState<'equal' | 'exact'>('equal')
  const [exactShares, setExactShares] = useState<Record<string, string>>({})
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expenseNote, setExpenseNote] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [catEditorOpen, setCatEditorOpen] = useState(false)
  const [catLocalNames, setCatLocalNames] = useState<Record<string, string>>({})
  const [newCatName, setNewCatName] = useState('')

  // ── All known persons (from props + current form state) ──
  const allPersons = useMemo(() => {
    const names = new Set<string>(knownPersons)
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [knownPersons])

  // ── Splits for a given expense ──
  const getSplitsForExpense = useCallback(
    (expenseId: string): ExpenseSplit[] =>
      expenseSplits.filter((s) => s.expense_id === expenseId),
    [expenseSplits],
  )

  // ── Group expenses by date (newest first) ──
  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {}
    for (const e of expenses) {
      if (!groups[e.expense_date]) groups[e.expense_date] = []
      groups[e.expense_date].push(e)
    }
    return Object.entries(groups).sort((a, b) =>
      b[0].localeCompare(a[0]),
    )
  }, [expenses])

  // ── Total expenses ──
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  )

  // ── Per-person balance: paid - share ──
  const balances = useMemo(() => {
    const map: Record<string, number> = {}
    // total paid
    for (const e of expenses) {
      map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount
    }
    // total share
    for (const s of expenseSplits) {
      map[s.person_name] = (map[s.person_name] ?? 0) - s.share_amount
    }
    return map
  }, [expenses, expenseSplits])

  // ── Settlement: greedy minimized transactions ──
  const settlement = useMemo<SettlementTxn[]>(() => {
    const creditors: { name: string; amount: number }[] = []
    const debtors: { name: string; amount: number }[] = []

    for (const [name, balance] of Object.entries(balances)) {
      const rounded = Math.round(balance * 100) / 100
      if (rounded > 0.01) creditors.push({ name, amount: rounded })
      else if (rounded < -0.01) debtors.push({ name, amount: -rounded })
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    const txns: SettlementTxn[] = []
    let ci = 0
    let di = 0

    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci]
      const d = debtors[di]
      const payment = Math.round(Math.min(c.amount, d.amount) * 100) / 100
      if (payment > 0) {
        txns.push({ from: d.name, to: c.name, amount: payment })
      }
      c.amount = Math.round((c.amount - payment) * 100) / 100
      d.amount = Math.round((d.amount - payment) * 100) / 100
      if (c.amount < 0.01) ci++
      if (d.amount < 0.01) di++
    }

    return txns
  }, [balances])

  // ── Matrix: who owes whom (debtor × creditor grid) ──
  // Shows ORIGINAL (unnetted) debts: what each person owes each other person
  const matrix = useMemo<{ debtors: string[]; creditors: string[]; cells: Record<string, Record<string, number>> }>(() => {
    // For each expense, record what each non-payer owes the payer
    const debtGrid: Record<string, Record<string, number>> = {}

    for (const expense of expenses) {
      const splits = expenseSplits.filter(s => s.expense_id === expense.id)
      const payer = expense.paid_by
      for (const split of splits) {
        if (split.person_name === payer) continue // doesn't owe themselves
        if (!debtGrid[split.person_name]) debtGrid[split.person_name] = {}
        debtGrid[split.person_name][payer] = (debtGrid[split.person_name][payer] ?? 0) + split.share_amount
      }
    }

    // Collect all names that appear as either debtor or creditor
    const allDebtorNames = Object.keys(debtGrid)
    const allCreditorNames = new Set<string>()
    for (const d of allDebtorNames) {
      for (const c of Object.keys(debtGrid[d])) allCreditorNames.add(c)
    }

    const debtors = allDebtorNames.sort((a, b) => a.localeCompare(b))
    const creditors = Array.from(allCreditorNames).sort((a, b) => a.localeCompare(b))

    return { debtors, creditors, cells: debtGrid }
  }, [expenses, expenseSplits])

  // ── Exact shares sum ──
  const exactSum = useMemo(() => {
    return splitPeople.reduce((sum, p) => {
      const val = parseFloat(exactShares[p] ?? '0')
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [splitPeople, exactShares])

  const amountNum = parseFloat(amount) || 0
  const exactSumOk =
    splitMode === 'equal' ||
    Math.abs(exactSum - amountNum) < 0.01

  // ── Form helpers ──
  const resetForm = useCallback(() => {
    setDescription('')
    setAmount('')
    setPaidBy(userName)
    setSplitPeople([])
    setSplitMode('equal')
    setExactShares({})
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setExpenseNote('')
    setExpenseCategory('')
    setEditingId(null)
    setFormExpanded(false)
  }, [userName])

  const startAdd = useCallback(() => {
    navigator.vibrate?.(8)
    setEditingId(null)
    setDescription('')
    setAmount('')
    setPaidBy(userName)
    setSplitPeople(allPersons.slice()) // default: all selected
    setSplitMode('equal')
    setExactShares({})
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setExpenseNote('')
    setExpenseCategory('')
    setFormExpanded(true)
  }, [userName, allPersons])

  const startEdit = useCallback(
    (expense: Expense) => {
      const splits = getSplitsForExpense(expense.id)
      setEditingId(expense.id)
      setDescription(expense.description)
      setAmount(expense.amount.toString())
      setPaidBy(expense.paid_by)
      setSplitMode(expense.split_mode)
      setExpenseDate(expense.expense_date)
      setExpenseNote(expense.note ?? '')
      setExpenseCategory(expense.category ?? '')
      const people = splits.map((s) => s.person_name)
      setSplitPeople(people)
      const shares: Record<string, string> = {}
      if (expense.split_mode === 'exact') {
        for (const s of splits) {
          shares[s.person_name] = s.share_amount.toString()
        }
      }
      setExactShares(shares)
      setFormExpanded(true)
    },
    [getSplitsForExpense],
  )

  const togglePerson = (name: string) => {
    setSplitPeople((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name],
    )
  }

  // ── Calculate share amounts for saving ──
  const calculateShares = useCallback((): { person_name: string; share_amount: number }[] => {
    if (splitMode === 'equal') {
      if (splitPeople.length === 0) return []
      // Distribute rounding remainder to first N people so shares sum to total
      const totalCents = Math.round(amountNum * 100)
      const perCents = Math.floor(totalCents / splitPeople.length)
      const remainder = totalCents - perCents * splitPeople.length
      return splitPeople.map((p, i) => ({
        person_name: p,
        share_amount: (perCents + (i < remainder ? 1 : 0)) / 100,
      }))
    }
    return splitPeople.map((p) => {
      const val = parseFloat(exactShares[p] ?? '0')
      return { person_name: p, share_amount: isNaN(val) ? 0 : val }
    })
  }, [splitMode, splitPeople, amountNum, exactShares])

  // ── Save (insert or update) ──
  const handleSave = async () => {
    const desc = description.trim()
    if (!desc || amountNum <= 0 || splitPeople.length === 0) return
    if (!exactSumOk) return

    const shares = calculateShares()

    if (editingId) {
      // ── Update existing expense ──
      const { error: updErr } = await supabase
        .from('expenses')
        .update({
          description: desc,
          amount: amountNum,
          paid_by: paidBy,
          split_mode: splitMode,
          expense_date: expenseDate,
          note: expenseNote.trim() || null,
          category: expenseCategory || null,
        })
        .eq('id', editingId)
      if (updErr) {
        toast(`Fehler beim Speichern: ${updErr.message}`, 'error')
        return
      }
      // ── Diff-basiertes Splits-Update: nur geänderte Splits anpassen ──
      const oldSplits = getSplitsForExpense(editingId)
      const oldMap = new Map(oldSplits.map(s => [s.person_name, s.share_amount]))
      const newMap = new Map(shares.map(s => [s.person_name, s.share_amount]))

      // Zu löschende Splits (in old, nicht in new)
      const toDelete = oldSplits.filter(s => !newMap.has(s.person_name))
      // Hinzuzufügende Splits (in new, nicht in old)
      const toInsert = shares.filter(s => !oldMap.has(s.person_name))
      // Zu aktualisierende Splits (unterschiedlicher Betrag)
      const toUpdate = shares.filter(s => oldMap.has(s.person_name) && oldMap.get(s.person_name) !== s.share_amount)

      const ops: PromiseLike<any>[] = []
      if (toDelete.length > 0) {
        ops.push(
          supabase.from('expense_splits').delete().eq('expense_id', editingId).in('person_name', toDelete.map(s => s.person_name))
        )
      }
      if (toInsert.length > 0) {
        ops.push(
          supabase.from('expense_splits').insert(
            toInsert.map(s => ({ expense_id: editingId, person_name: s.person_name, share_amount: s.share_amount }))
          )
        )
      }
      for (const s of toUpdate) {
        ops.push(
          supabase.from('expense_splits').update({ share_amount: s.share_amount }).eq('expense_id', editingId).eq('person_name', s.person_name)
        )
      }

      if (ops.length > 0) {
        const results = await Promise.allSettled(ops)
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error))
        if (failed.length > 0) {
          toast('Fehler beim Aktualisieren der Aufteilung. Bitte erneut versuchen.', 'error')
          return
        }
      }
    } else {
      // ── Insert new expense ──
      const { data, error: insErr } = await supabase
        .from('expenses')
        .insert({
          list_id: listId,
          description: desc,
          amount: amountNum,
          paid_by: paidBy,
          split_mode: splitMode,
          expense_date: expenseDate,
          note: expenseNote.trim() || null,
          category: expenseCategory || null,
          created_by: userName,
        })
        .select('id')
        .single()
      if (insErr) {
        toast(`Fehler beim Speichern: ${insErr.message}`, 'error')
        return
      }
      const expenseId = data.id
      // Insert splits
      if (shares.length > 0) {
        const { error: splitErr } = await supabase.from('expense_splits').insert(
          shares.map((s) => ({
            expense_id: expenseId,
            person_name: s.person_name,
            share_amount: s.share_amount,
          })),
        )
        if (splitErr) {
          toast(`Fehler beim Speichern der Aufteilung: ${splitErr.message}`, 'error')
          // Clean up: delete the orphaned expense
          await supabase.from('expenses').delete().eq('id', expenseId)
          return
        }
      }
    }

    navigator.vibrate?.(10)
    resetForm()
    onExpensesChange()
  }

  // ── Delete ──
  const handleDelete = (expense: Expense) => {
    confirm(`"${expense.description}" wirklich löschen?`, async () => {
      // Delete splits first, then the expense — avoids orphaned split rows
      await supabase.from('expense_splits').delete().eq('expense_id', expense.id)
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
      if (error) {
        toast(`Fehler beim Löschen: ${error.message}`, 'error')
        return
      }
      navigator.vibrate?.(10)
      onExpensesChange()
    })
  }

  // ── Preview for equal split (shows the actual saved amount per person) ──
  const equalPreview = useMemo(() => {
    if (splitMode !== 'equal' || splitPeople.length === 0 || amountNum <= 0) return null
    // Use the same rounding logic as calculateShares for accurate preview
    const totalCents = Math.round(amountNum * 100)
    const perCents = Math.floor(totalCents / splitPeople.length)
    const remainder = totalCents - perCents * splitPeople.length
    if (remainder === 0) {
      return `${splitPeople.length} Personen à ${fmtEUR(perCents / 100)}`
    }
    // Uneven split — show the range (first N pay 1 cent more)
    const lower = perCents / 100
    const higher = (perCents + 1) / 100
    return `${splitPeople.length} Personen à ${fmtEUR(lower)}–${fmtEUR(higher)}`
  }, [splitMode, splitPeople, amountNum])

  const canSave =
    description.trim() !== '' &&
    amountNum > 0 &&
    splitPeople.length > 0 &&
    exactSumOk

  // ── Split info text for an expense card ──
  const getSplitInfo = (expense: Expense): string => {
    const splits = getSplitsForExpense(expense.id)
    if (expense.split_mode === 'equal') {
      return `Geteilt durch ${splits.length} ${splits.length === 1 ? 'Person' : 'Personen'}`
    }
    return splits
      .map((s) => `${s.person_name}: ${fmtEUR(s.share_amount)}`)
      .join(', ')
  }

  // ── Sorted balance entries ──
  const sortedBalances = useMemo(() => {
    return Object.entries(balances)
      .map(([name, balance]) => ({ name, balance: Math.round(balance * 100) / 100 }))
      .sort((a, b) => b.balance - a.balance)
  }, [balances])

  return (
    <div className="expense-screen">
      {/* ── Sub-Toggle ── */}
      <div className="expense-toggle">
        <button
          className={`expense-toggle-btn ${section === 'expenses' ? 'active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); setSection('expenses') }}
        >
          <Wallet size={16} strokeWidth={2} /> Ausgaben{expenses.length > 0 && <span className="expense-toggle-badge">{expenses.length}</span>}
        </button>
        <button
          className={`expense-toggle-btn ${section === 'settlement' ? 'active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); setSection('settlement') }}
        >
          <Receipt size={16} strokeWidth={2} /> Abrechnung
        </button>
        <button
          className={`expense-toggle-btn ${section === 'matrix' ? 'active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); setSection('matrix') }}
        >
          <Table2 size={16} strokeWidth={2} /> Matrix
        </button>
      </div>

      {/* ── Ausgaben Section ── */}
      {section === 'expenses' && (
        <div key="expenses">
          {/* Add form */}
          {!formExpanded ? (
            <button className="expense-add-trigger" onClick={startAdd}>
              + Ausgabe hinzufügen
            </button>
          ) : (
            <div className="expense-form">
              <input
                className="expense-input"
                type="text"
                placeholder="Beschreibung (z.B. Supermarkt)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <div className="expense-form-row">
                <input
                  className="expense-input"
                  type="number"
                  step="0.01"
                  placeholder="Betrag (€)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select
                  className="expense-select"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                >
                  {allPersons.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Datum */}
              <input
                className="expense-input"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />

              {/* Kategorie */}
              <div className="expense-category-row">
                {expenseCategories.map(cat => (
                  <button
                    key={cat.id}
                    className={`expense-cat-chip ${expenseCategory === cat.name ? 'active' : ''}`}
                    onClick={() => setExpenseCategory(expenseCategory === cat.name ? '' : cat.name)}
                    type="button"
                    style={expenseCategory === cat.name ? { borderColor: cat.color, background: cat.bg, color: cat.color } : {}}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
                <button
                  className="expense-cat-chip expense-cat-edit-btn"
                  onClick={() => setCatEditorOpen(v => !v)}
                  type="button"
                >
                  ✏️
                </button>
              </div>

              {/* Inline Category Editor */}
              {catEditorOpen && (
                <div className="expense-cat-editor">
                  <div className="expense-cat-editor-list">
                    {expenseCategories.map(cat => (
                      <div key={cat.id} className="expense-cat-editor-row">
                        <span className="expense-cat-editor-icon">{cat.icon}</span>
                        <input
                          className="expense-cat-editor-input"
                          type="text"
                          value={catLocalNames[cat.id] ?? cat.name}
                          onChange={(e) => {
                            setCatLocalNames(prev => ({ ...prev, [cat.id]: e.target.value }))
                          }}
                          onBlur={async () => {
                            const newName = catLocalNames[cat.id]?.trim()
                            if (newName && newName !== cat.name) {
                              await supabase.from('categories').update({ name: newName }).eq('id', cat.id)
                              onCategoriesChange()
                            }
                            setCatLocalNames(prev => { const n = { ...prev }; delete n[cat.id]; return n })
                          }}
                        />
                        <button
                          className="expense-cat-editor-del"
                          onClick={async () => {
                            confirm(`Kategorie "${cat.name}" wirklich löschen?`, async () => {
                              await supabase.from('categories').delete().eq('id', cat.id)
                              // Entferne Kategorie von allen Ausgaben die sie nutzen
                              await supabase.from('expenses').update({ category: null }).eq('list_id', listId).eq('category', cat.name)
                              onCategoriesChange()
                              onExpensesChange()
                            })
                          }}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="expense-cat-editor-add-row">
                    <input
                      className="expense-cat-editor-input"
                      type="text"
                      placeholder="Neue Kategorie…"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                    />
                    <button
                      className="expense-cat-editor-add-btn"
                      onClick={async () => {
                        const name = newCatName.trim()
                        if (!name) return
                        const maxOrder = expenseCategories.reduce((m, c) => Math.max(m, c.sort_order), 0)
                        await supabase.from('categories').insert({
                          list_id: listId,
                          list_type: 'expense',
                          name,
                          icon: '📦',
                          color: '#9b6dd9',
                          bg: '#e8dcf7',
                          sort_order: maxOrder + 1,
                        })
                        setNewCatName('')
                        onCategoriesChange()
                      }}
                    >
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}

              {/* Notiz */}
              <input
                className="expense-input"
                type="text"
                placeholder="Notiz (optional) — z.B. 'Für den Strandtag'"
                value={expenseNote}
                onChange={(e) => setExpenseNote(e.target.value)}
              />

              {/* Split among chips */}
              <div>
                <div className="expense-chips-label">Geteilt durch</div>
                <div className="expense-chips">
                  {allPersons.map((p) => (
                    <button
                      key={p}
                      className={`expense-chip ${splitPeople.includes(p) ? 'active' : ''}`}
                      onClick={() => togglePerson(p)}
                      type="button"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Split mode toggle */}
              <div className="expense-mode-toggle">
                <button
                  className={`expense-mode-btn ${splitMode === 'equal' ? 'active' : ''}`}
                  onClick={() => setSplitMode('equal')}
                  type="button"
                >
                  Gleichmäßig
                </button>
                <button
                  className={`expense-mode-btn ${splitMode === 'exact' ? 'active' : ''}`}
                  onClick={() => setSplitMode('exact')}
                  type="button"
                >
                  Exakt
                </button>
              </div>

              {/* Exact split inputs */}
              {splitMode === 'exact' && splitPeople.length > 0 && (
                <div className="expense-exact-splits">
                  {splitPeople.map((p) => (
                    <div key={p} className="expense-exact-row">
                      <span className="expense-exact-name">{p}</span>
                      <input
                        className="expense-exact-input"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={exactShares[p] ?? ''}
                        onChange={(e) =>
                          setExactShares((prev) => ({ ...prev, [p]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                  <div className={`expense-exact-sum ${exactSumOk ? 'ok' : 'warn'}`}>
                    <span>Summe: {fmtEUR(exactSum)}</span>
                    <span>Betrag: {fmtEUR(amountNum)}</span>
                  </div>
                </div>
              )}

              {/* Equal preview */}
              {equalPreview && (
                <div className="expense-form-preview">{equalPreview}</div>
              )}

              {/* Actions */}
              <div className="expense-form-actions">
                <button className="expense-btn-cancel" onClick={resetForm}>
                  Abbrechen
                </button>
                <button
                  className="expense-btn-save"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {editingId ? 'Aktualisieren' : 'Speichern'}
                </button>
              </div>
            </div>
          )}

          {/* Expense list grouped by date */}
          {isLoading ? (
            <div className="expense-list">
              <SkeletonExpenseCard />
              <SkeletonExpenseCard />
              <SkeletonExpenseCard />
            </div>
          ) : (
          <>
          {expenses.length === 0 && !formExpanded && (
            <p className="expense-empty"><Pizza size={24} strokeWidth={1.5} /> Noch keine Ausgaben — füge die erste hinzu!</p>
          )}

          <div className="expense-list">
            {groupedExpenses.map(([date, items]) => (
              <div key={date} className="expense-date-group">
                <div className="expense-date-header">{fmtDate(date)}</div>
                {items.map((expense) => (
                  <div key={expense.id} className="expense-card">
                    <div className="expense-card-top">
                      <div className="expense-card-info">
                        <div className="expense-card-desc">{expense.description}</div>
                        <div className="expense-card-amount">{fmtEUR(expense.amount)}</div>
                      </div>
                      <div className="expense-card-buttons">
                        <button
                          className="expense-card-btn"
                          onClick={() => startEdit(expense)}
                          aria-label="Bearbeiten"
                        >
                          <Pencil size={16} strokeWidth={2} />
                        </button>
                        <button
                          className="expense-card-btn"
                          onClick={() => handleDelete(expense)}
                          aria-label="Löschen"
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div className="expense-card-meta">
                      {expense.category && (
                        <span className="expense-card-category">
                          {expenseCategories.find(c => c.name === expense.category)?.icon ?? '📦'} {expense.category}
                        </span>
                      )}
                      Bezahlt von {expense.paid_by}
                    </div>
                    <div className="expense-card-split">{getSplitInfo(expense)}</div>
                    {expense.note && (
                      <div className="expense-card-note">
                        <MessageSquare size={12} strokeWidth={2} /> {expense.note}
                      </div>
                    )}
                    {expense.created_by && (
                      <div className="expense-card-by">von {expense.created_by}</div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      )}

      {/* ── Abrechnung Section ── */}
      {section === 'settlement' && (
        <div key="settlement">
          <div className="expense-total-banner">
            <Wallet size={18} strokeWidth={2} /> Gesamtausgaben: {fmtEUR(totalExpenses)}
          </div>

          {/* ── Charts ── */}
          <ExpenseCharts
            expenses={expenses}
            expenseSplits={expenseSplits}
            knownPersons={knownPersons}
          />

          {expenses.length === 0 ? (
            <p className="expense-empty">Noch keine Ausgaben zur Abrechnung.</p>
          ) : (
            <>
              {/* Per-person balances */}
              <div className="expense-balance-list">
                {sortedBalances.map(({ name, balance }) => {
                  const cls = balance > 0.01 ? 'positive' : balance < -0.01 ? 'negative' : 'neutral'
                  return (
                    <div key={name} className={`expense-balance-card ${cls}`}>
                      <span className="expense-balance-name">{name}</span>
                      <span className={`expense-balance-amount ${cls}`}>
                        {balance > 0.01
                          ? `+${fmtEUR(balance)}`
                          : balance < -0.01
                            ? `-${fmtEUR(-balance)}`
                            : '0,00 €'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Settlement transactions */}
              <h3 className="expense-settlement-title"><ArrowRight size={16} strokeWidth={2} /> Ausgleichszahlungen</h3>
              {settlement.length === 0 ? (
                <p className="expense-settlement-empty">
                  Alle ausgeglichen — nichts zu überweisen!
                </p>
              ) : (
                <div className="expense-settlement-list">
                  {settlement.map((txn, i) => (
                    <div key={i} className="expense-txn">
                      <span className="expense-txn-from">{txn.from}</span>
                      <span className="expense-txn-arrow">→</span>
                      <span className="expense-txn-to">{txn.to}</span>
                      <span className="expense-txn-amount">{fmtEUR(txn.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Matrix Section ── */}
      {section === 'matrix' && (
        <div key="matrix">
          <div className="expense-total-banner">
            <Wallet size={18} strokeWidth={2} /> Gesamtausgaben: {fmtEUR(totalExpenses)}
          </div>

          {expenses.length === 0 ? (
            <p className="expense-empty">Noch keine Ausgaben für die Matrix.</p>
          ) : matrix.debtors.length === 0 ? (
            <p className="expense-settlement-empty">Alle ausgeglichen — keine offenen Schulden!</p>
          ) : (
            <div className="expense-matrix-wrapper">
              <table className="expense-matrix">
                <thead>
                  <tr>
                    <th className="expense-matrix-corner">schuldet →<br />↓ bekommt</th>
                    {matrix.creditors.map(c => (
                      <th key={c} className="expense-matrix-header">{c}</th>
                    ))}
                    <th className="expense-matrix-total-header">Σ Schulden</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.debtors.map(debtor => {
                    const totalOwed = matrix.creditors.reduce((sum, c) => sum + ((matrix.cells[debtor]?.[c]) ?? 0), 0)
                    return (
                      <tr key={debtor}>
                        <td className="expense-matrix-label">{debtor}</td>
                        {matrix.creditors.map(c => {
                          const val = matrix.cells[debtor]?.[c] ?? 0
                          return (
                            <td key={c} className={`expense-matrix-cell ${val > 0 ? 'has-debt' : ''}`}>
                              {val > 0 ? fmtEUR(val) : '—'}
                            </td>
                          )
                        })}
                        <td className="expense-matrix-total">{totalOwed > 0 ? fmtEUR(totalOwed) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="expense-matrix-hint">
                <strong>So liest du die Matrix:</strong> {matrix.debtors.join(', ')} schulden Geld an {matrix.creditors.join(', ')}.
                Jede Zelle zeigt, was der Schuldner (Zeile) dem Gläubiger (Spalte) zahlen muss.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}