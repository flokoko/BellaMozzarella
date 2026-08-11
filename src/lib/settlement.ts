import type { Expense, ExpenseSplit, ExpenseQuota } from '../types'

export interface SettlementTxn {
  from: string
  to: string
  amount: number
}

export interface BalanceEntry {
  name: string
  balance: number
}

export interface ExpenseMatrix {
  debtors: string[]
  creditors: string[]
  cells: Record<string, Record<string, number>>
}

/** Per-person balance: total paid minus total share */
export function computeBalances(
  expenses: Expense[],
  expenseSplits: ExpenseSplit[],
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of expenses) {
    map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount
  }
  for (const s of expenseSplits) {
    map[s.person_name] = (map[s.person_name] ?? 0) - s.share_amount
  }
  return map
}

/** Greedy minimized-transaction settlement from a balances map */
export function computeSettlement(balances: Record<string, number>): SettlementTxn[] {
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
}

/** Sorted balance entries (highest positive first) */
export function sortedBalanceEntries(balances: Record<string, number>): BalanceEntry[] {
  return Object.entries(balances)
    .map(([name, balance]) => ({ name, balance: Math.round(balance * 100) / 100 }))
    .sort((a, b) => b.balance - a.balance)
}

/**
 * Matrix: who owes whom (debtor × creditor grid).
 * Shows ORIGINAL (unnetted) debts — what each person owes each other person.
 */
export function computeMatrix(
  expenses: Expense[],
  expenseSplits: ExpenseSplit[],
): ExpenseMatrix {
  const debtGrid: Record<string, Record<string, number>> = {}

  for (const expense of expenses) {
    const splits = expenseSplits.filter(s => s.expense_id === expense.id)
    const payer = expense.paid_by
    for (const split of splits) {
      if (split.person_name === payer) continue
      if (!debtGrid[split.person_name]) debtGrid[split.person_name] = {}
      debtGrid[split.person_name][payer] = (debtGrid[split.person_name][payer] ?? 0) + split.share_amount
    }
  }

  const allDebtorNames = Object.keys(debtGrid)
  const allCreditorNames = new Set<string>()
  for (const d of allDebtorNames) {
    for (const c of Object.keys(debtGrid[d])) allCreditorNames.add(c)
  }

  const debtors = allDebtorNames.sort((a, b) => a.localeCompare(b))
  const creditors = Array.from(allCreditorNames).sort((a, b) => a.localeCompare(b))

  return { debtors, creditors, cells: debtGrid }
}

/** Calculate share amounts for saving an expense */
export function calculateShareAmounts(
  splitMode: 'equal' | 'exact',
  splitPeople: string[],
  amountNum: number,
  exactShares: Record<string, string>,
): { person_name: string; share_amount: number }[] {
  if (splitMode === 'equal') {
    if (splitPeople.length === 0) return []
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
}

/**
 * Calculate share amounts from quota percentages.
 * Same rounding logic as calculateShareAmounts: floor to cents,
 * remainder goes to the largest quota holders (by absolute cents).
 */
export function calculateQuotaShares(
  quotas: ExpenseQuota[],
  allPersons: string[],
  amountNum: number,
): { person_name: string; share_amount: number }[] {
  if (allPersons.length === 0 || amountNum <= 0) return []

  // Build person -> percent map from quotas (only persons in allPersons)
  const percentMap = new Map<string, number>()
  for (const q of quotas) {
    if (allPersons.includes(q.person_name)) {
      percentMap.set(q.person_name, (percentMap.get(q.person_name) ?? 0) + q.percent)
    }
  }

  // Only persons with a quota > 0 participate
  const participants = allPersons.filter(p => (percentMap.get(p) ?? 0) > 0)
  if (participants.length === 0) return []

  const totalCents = Math.round(amountNum * 100)

  // Calculate raw cents per person (floored)
  const rawCents = participants.map(p => {
    const pct = percentMap.get(p) ?? 0
    return { person_name: p, cents: Math.floor((totalCents * pct) / 100) }
  })

  // Remainder: distribute to those with the highest fractional part
  // (i.e. those whose floor cost them the most relative to their quota)
  const distributed = rawCents.reduce((s, r) => s + r.cents, 0)
  let remainder = totalCents - distributed

  if (remainder > 0) {
    // Sort by who lost the most to flooring (highest raw value before floor)
    const fractionalLoss = participants.map((p, i) => {
      const pct = percentMap.get(p) ?? 0
      const raw = (totalCents * pct) / 100
      return { person_name: p, loss: raw - rawCents[i].cents, idx: i }
    })
    fractionalLoss.sort((a, b) => b.loss - a.loss)
    for (let i = 0; i < remainder && i < fractionalLoss.length; i++) {
      rawCents[fractionalLoss[i].idx].cents += 1
    }
  }

  return rawCents.map(r => ({ person_name: r.person_name, share_amount: r.cents / 100 }))
}

/** Total expenses */
export function totalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
}

/** Group expenses by date (newest first), optionally filtered by search query */
export function groupExpensesByDate(
  expenses: Expense[],
  searchQuery: string,
): [string, Expense[]][] {
  const filtered = searchQuery.trim()
    ? expenses.filter((e) => e.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : expenses
  const groups: Record<string, Expense[]> = {}
  for (const e of filtered) {
    if (!groups[e.expense_date]) groups[e.expense_date] = []
    groups[e.expense_date].push(e)
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
}

/** Splits for a given expense */
export function getSplitInfo(
  expense: Expense,
  expenseSplits: ExpenseSplit[],
): string {
  const splits = expenseSplits.filter((s) => s.expense_id === expense.id)
  if (expense.split_mode === 'equal') {
    return `Geteilt durch ${splits.length} ${splits.length === 1 ? 'Person' : 'Personen'}`
  }
  return splits
    .map((s) => `${s.person_name}: ${fmtEUR(s.share_amount)}`)
    .join(', ')
}

// ── Format helpers ──────────────────────────────────────────────────

export function fmtEUR(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}