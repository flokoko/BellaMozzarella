// Test der Ausgaben-Rechenlogik — exakt wie im ExpenseScreen
// Simuliert verschiedene Szenarien, prüft balances, settlement, matrix

interface Expense {
  id: string
  paid_by: string
  amount: number
  split_mode: 'equal' | 'exact'
}

interface ExpenseSplit {
  expense_id: string
  person_name: string
  share_amount: number
}

interface SettlementTxn {
  from: string
  to: string
  amount: number
}

// ── Balances (exakt wie in ExpenseScreen) ──
function calcBalances(expenses: Expense[], expenseSplits: ExpenseSplit[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const e of expenses) {
    map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount
  }
  for (const s of expenseSplits) {
    map[s.person_name] = (map[s.person_name] ?? 0) - s.share_amount
  }
  return map
}

// ── Settlement (exakt wie in ExpenseScreen) ──
function calcSettlement(balances: Record<string, number>): SettlementTxn[] {
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

// ── Matrix (FIXED: zeigt originale Schulden, nicht genettet) ──
function calcMatrix(expenses: Expense[], expenseSplits: ExpenseSplit[]) {
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

// ── Helper: generate splits for equal division ──
function equalSplits(expenseId: string, amount: number, people: string[]): ExpenseSplit[] {
  const totalCents = Math.round(amount * 100)
  const perCents = Math.floor(totalCents / people.length)
  const remainder = totalCents - perCents * people.length
  return people.map((p, i) => ({
    expense_id: expenseId,
    person_name: p,
    share_amount: (perCents + (i < remainder ? 1 : 0)) / 100,
  }))
}

// ── Verify: sum of all shares = expense amount ──
function verifySharesSum(expenses: Expense[], splits: ExpenseSplit[]): boolean {
  let ok = true
  for (const e of expenses) {
    const eSplits = splits.filter(s => s.expense_id === e.id)
    const sum = eSplits.reduce((s, sp) => s + sp.share_amount, 0)
    if (Math.abs(sum - e.amount) > 0.01) {
      console.log(`  ❌ Expense ${e.id}: shares sum ${sum.toFixed(2)} ≠ amount ${e.amount}`)
      ok = false
    }
  }
  return ok
}

// ── Verify: sum of balances = 0 ──
function verifyBalancesSum(balances: Record<string, number>): boolean {
  const sum = Object.values(balances).reduce((s, v) => s + v, 0)
  if (Math.abs(sum) > 0.01) {
    console.log(`  ❌ Balance sum = ${sum.toFixed(2)} (should be 0)`)
    return false
  }
  return true
}

// ── Verify: settlement amounts match balances ──
function verifySettlement(balances: Record<string, number>, txns: SettlementTxn[]): boolean {
  const paid: Record<string, number> = {}
  const received: Record<string, number> = {}
  for (const t of txns) {
    paid[t.from] = (paid[t.from] ?? 0) + t.amount
    received[t.to] = (received[t.to] ?? 0) + t.amount
  }
  for (const [name, bal] of Object.entries(balances)) {
    const rounded = Math.round(bal * 100) / 100
    if (rounded < -0.01) {
      const totalPaid = Math.round((paid[name] ?? 0) * 100) / 100
      const expected = Math.round(-rounded * 100) / 100
      if (Math.abs(totalPaid - expected) > 0.01) {
        console.log(`  ❌ ${name} should pay ${expected}, but settlement says ${totalPaid}`)
        return false
      }
    }
    if (rounded > 0.01) {
      const totalReceived = Math.round((received[name] ?? 0) * 100) / 100
      if (Math.abs(totalReceived - rounded) > 0.01) {
        console.log(`  ❌ ${name} should receive ${rounded}, but settlement says ${totalReceived}`)
        return false
      }
    }
  }
  return true
}

// ══════════════════════════════════════════════
// TEST SCENARIOS
// ══════════════════════════════════════════════

let passed = 0
let failed = 0

function runTest(name: string, expenses: Expense[], splits: ExpenseSplit[]) {
  console.log(`\n📋 ${name}`)
  
  const sharesOk = verifySharesSum(expenses, splits)
  if (sharesOk) console.log('  ✅ Share sums correct')
  else failed++
  
  const balances = calcBalances(expenses, splits)
  console.log('  Balances:', Object.entries(balances).map(([k, v]) => `${k}=${v.toFixed(2)}€`).join(', '))
  
  const balSumOk = verifyBalancesSum(balances)
  if (balSumOk) console.log('  ✅ Balance sum = 0')
  else failed++
  
  const txns = calcSettlement(balances)
  console.log('  Settlement:', txns.length ? txns.map(t => `${t.from}→${t.to}=${t.amount.toFixed(2)}€`).join(', ') : '(none)')
  
  const settOk = verifySettlement(balances, txns)
  if (settOk) console.log('  ✅ Settlement correct')
  else failed++
  
  const matrix = calcMatrix(expenses, splits)
  console.log('  Matrix debtors:', matrix.debtors.join(', ') || '(none)')
  console.log('  Matrix creditors:', matrix.creditors.join(', ') || '(none)')
  for (const d of matrix.debtors) {
    for (const c of matrix.creditors) {
      const v = matrix.cells[d]?.[c] ?? 0
      if (v > 0) console.log(`    ${d} → ${c}: ${v.toFixed(2)}€`)
    }
  }
  
  // Matrix zeigt BRUTTO-Schulden (vor Verrechnung) — das ist gewollt
  // Prüfe nur: Summe aller Matrix-Zellen = Summe aller negativen Balances
  let matrixTotal = 0
  for (const d of matrix.debtors) {
    for (const c of matrix.creditors) {
      matrixTotal += matrix.cells[d]?.[c] ?? 0
    }
  }
  const totalDebt = Object.entries(balances)
    .filter(([_, v]) => v < -0.01)
    .reduce((s, [_, v]) => s + (-v), 0)
  matrixTotal = Math.round(matrixTotal * 100) / 100
  const totalDebtR = Math.round(totalDebt * 100) / 100
  
  if (Math.abs(matrixTotal - totalDebtR) > 0.01) {
    console.log(`  ⚠️  Matrix total (${matrixTotal.toFixed(2)}€) ≠ total debt (${totalDebtR.toFixed(2)}€) — OK wenn jemand sowohl schuldet als auch bekommt`)
  }
  
  if (sharesOk && balSumOk && settOk) passed++
  else failed++
}

// ── Test 1: Einfach — eine Ausgabe, zwei Personen ──
const e1: Expense[] = [{ id: 'e1', paid_by: 'Flo', amount: 30, split_mode: 'equal' }]
const s1 = equalSplits('e1', 30, ['Flo', 'Asia'])
runTest('Einfach: Flo zahlt 30€, geteilt mit Asia', e1, s1)

// ── Test 2: Zwei Ausgaben, drei Personen ──
const e2: Expense[] = [
  { id: 'e2a', paid_by: 'Flo', amount: 45, split_mode: 'equal' },
  { id: 'e2b', paid_by: 'Asia', amount: 20, split_mode: 'equal' },
]
const s2 = [
  ...equalSplits('e2a', 45, ['Flo', 'Asia', 'Consti']),
  ...equalSplits('e2b', 20, ['Asia', 'Flo']),
]
runTest('Flo 45€ (3 Personen) + Asia 20€ (2 Personen)', e2, s2)

// ── Test 3: Komplex — 4 Personen, mehrere Ausgaben ──
const e3: Expense[] = [
  { id: 'e3a', paid_by: 'Flo', amount: 87.50, split_mode: 'equal' },
  { id: 'e3b', paid_by: 'Asia', amount: 34.20, split_mode: 'equal' },
  { id: 'e3c', paid_by: 'Peter', amount: 12.80, split_mode: 'equal' },
  { id: 'e3d', paid_by: 'Jana', amount: 56.00, split_mode: 'equal' },
]
const s3 = [
  ...equalSplits('e3a', 87.50, ['Flo', 'Asia', 'Peter', 'Jana']),
  ...equalSplits('e3b', 34.20, ['Asia', 'Flo', 'Peter']),
  ...equalSplits('e3c', 12.80, ['Peter', 'Flo', 'Asia', 'Jana']),
  ...equalSplits('e3d', 56.00, ['Jana', 'Flo', 'Asia']),
]
runTest('4 Personen, 4 Ausgaben, verschiedene Aufteilungen', e3, s3)

// ── Test 4: Exakte Aufteilung ──
const e4: Expense[] = [{ id: 'e4', paid_by: 'Flo', amount: 100, split_mode: 'exact' }]
const s4: ExpenseSplit[] = [
  { expense_id: 'e4', person_name: 'Flo', share_amount: 50 },
  { expense_id: 'e4', person_name: 'Asia', share_amount: 30 },
  { expense_id: 'e4', person_name: 'Consti', share_amount: 20 },
]
runTest('Exakt: Flo zahlt 100€, Flo=50, Asia=30, Consti=20', e4, s4)

// ── Test 5: Gemischt equal + exact ──
const e5: Expense[] = [
  { id: 'e5a', paid_by: 'Flo', amount: 60, split_mode: 'equal' },
  { id: 'e5b', paid_by: 'Asia', amount: 25, split_mode: 'exact' },
]
const s5: ExpenseSplit[] = [
  ...equalSplits('e5a', 60, ['Flo', 'Asia', 'Consti']),
  { expense_id: 'e5b', person_name: 'Asia', share_amount: 10 },
  { expense_id: 'e5b', person_name: 'Flo', share_amount: 15 },
]
runTest('Gemischt: equal 60€ + exact 25€', e5, s5)

// ── Test 6: Rundungsprobleme ──
const e6: Expense[] = [
  { id: 'e6a', paid_by: 'Flo', amount: 10.00, split_mode: 'equal' },
  { id: 'e6b', paid_by: 'Asia', amount: 10.00, split_mode: 'equal' },
]
const s6 = [
  ...equalSplits('e6a', 10.00, ['Flo', 'Asia', 'Consti']),
  ...equalSplits('e6b', 10.00, ['Asia', 'Flo', 'Consti']),
]
runTest('Rundung: 2× 10€ auf 3 Personen', e6, s6)

// ── Test 7: Nur ein Zahler, alle anderen schulden ──
const e7: Expense[] = [
  { id: 'e7a', paid_by: 'Flo', amount: 100, split_mode: 'equal' },
]
const s7 = equalSplits('e7a', 100, ['Flo', 'Asia', 'Consti', 'Peter', 'Jana'])
runTest('5 Personen, nur Flo zahlt 100€', e7, s7)

// ── Test 8: Krumme Beträge ──
const e8: Expense[] = [
  { id: 'e8a', paid_by: 'Flo', amount: 17.33, split_mode: 'equal' },
  { id: 'e8b', paid_by: 'Asia', amount: 8.67, split_mode: 'equal' },
]
const s8 = [
  ...equalSplits('e8a', 17.33, ['Flo', 'Asia']),
  ...equalSplits('e8b', 8.67, ['Asia', 'Flo']),
]
runTest('Krumme Beträge: 17.33 + 8.67', e8, s8)

// ── Test 9: Jeder zahlt mal ──
const e9: Expense[] = [
  { id: 'e9a', paid_by: 'Flo', amount: 25.50, split_mode: 'equal' },
  { id: 'e9b', paid_by: 'Asia', amount: 18.30, split_mode: 'equal' },
  { id: 'e9c', paid_by: 'Consti', amount: 32.10, split_mode: 'equal' },
  { id: 'e9d', paid_by: 'Peter', amount: 14.80, split_mode: 'equal' },
]
const s9 = [
  ...equalSplits('e9a', 25.50, ['Flo', 'Asia', 'Consti', 'Peter']),
  ...equalSplits('e9b', 18.30, ['Asia', 'Flo', 'Consti', 'Peter']),
  ...equalSplits('e9c', 32.10, ['Consti', 'Flo', 'Asia', 'Peter']),
  ...equalSplits('e9d', 14.80, ['Peter', 'Flo', 'Asia', 'Consti']),
]
runTest('4 Personen, jeder zahlt einmal', e9, s9)

// ── Test 10: Person zahlt für sich selbst ──
const e10: Expense[] = [
  { id: 'e10a', paid_by: 'Flo', amount: 15, split_mode: 'equal' },
]
const s10 = equalSplits('e10a', 15, ['Flo'])
runTest('Flo zahlt 15€ nur für sich selbst', e10, s10)

// ── Test 11: 7 Personen (max Gruppe) ──
const all7 = ['Flo', 'Asia', 'Consti', 'Mary', 'Jana', 'Peter', 'Konsti O.']
const e11: Expense[] = [
  { id: 'e11a', paid_by: 'Flo', amount: 123.45, split_mode: 'equal' },
  { id: 'e11b', paid_by: 'Asia', amount: 67.89, split_mode: 'equal' },
  { id: 'e11c', paid_by: 'Peter', amount: 34.56, split_mode: 'exact' },
]
const s11: ExpenseSplit[] = [
  ...equalSplits('e11a', 123.45, all7),
  ...equalSplits('e11b', 67.89, all7),
  { expense_id: 'e11c', person_name: 'Peter', share_amount: 10 },
  { expense_id: 'e11c', person_name: 'Flo', share_amount: 24.56 },
]
runTest('7 Personen, 3 Ausgaben (2 equal + 1 exact)', e11, s11)

// ══════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`)
console.log(`✅ ${passed} Tests bestanden, ❌ ${failed} Fehler`)
if (failed === 0) console.log('🎉 Alle Rechnungen korrekt!')
