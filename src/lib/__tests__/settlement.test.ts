import { describe, it, expect } from 'vitest'
import { computeMatrix } from '../settlement'
import type { Expense, ExpenseSplit, Settlement } from '../../types'

const makeExpense = (id: string, paidBy: string, amount = 100): Expense => ({
  id,
  list_id: 'list',
  description: `Ausgabe ${id}`,
  amount,
  paid_by: paidBy,
  expense_date: '2026-01-01',
  split_mode: 'equal',
  note: null,
  category: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
})

const makeSplit = (expenseId: string, personName: string, shareAmount = 100): ExpenseSplit => ({
  id: `${expenseId}-${personName}`,
  expense_id: expenseId,
  person_name: personName,
  share_amount: shareAmount,
  created_at: '2026-01-01T00:00:00Z',
})

describe('computeMatrix', () => {
  it('zeigt ursprüngliche Schulden ohne beglichene Zahlungen', () => {
    // Alice zahlt 100€, Bob ist der einzige Split-Anteil → Bob schuldet Alice 100€.
    const expenses = [makeExpense('e1', 'Alice')]
    const splits = [makeSplit('e1', 'Bob', 100)]

    const m = computeMatrix(expenses, splits)

    expect(m.debtors).toEqual(['Bob'])
    expect(m.creditors).toEqual(['Alice'])
    expect(m.cells['Bob']?.['Alice']).toBe(100)
  })

  it('zieht beglichene Beträge von der jeweiligen Zelle ab', () => {
    const expenses = [makeExpense('e1', 'Alice')]
    const splits = [makeSplit('e1', 'Bob', 100)]
    // Bob hat bereits 40€ an Alice beglichen.
    const settlements: Settlement[] = [
      {
        id: 's1',
        list_id: 'list',
        payer: 'Bob',
        payee: 'Alice',
        amount: 40,
        settled_at: '2026-01-02',
        created_by: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]

    const m = computeMatrix(expenses, splits, settlements)

    expect(m.cells['Bob']?.['Alice']).toBe(60)
  })

  it('entfernt die Zelle bei vollständig beglichener Schuld', () => {
    const expenses = [makeExpense('e1', 'Alice')]
    const splits = [makeSplit('e1', 'Bob', 100)]
    const settlements: Settlement[] = [
      {
        id: 's1',
        list_id: 'list',
        payer: 'Bob',
        payee: 'Alice',
        amount: 100,
        settled_at: '2026-01-02',
        created_by: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]

    const m = computeMatrix(expenses, splits, settlements)

    // Zelle vollständig abgezogen → Bob taucht nicht mehr als Schuldner auf.
    expect(m.cells['Bob']).toBeUndefined()
    expect(m.debtors).toEqual([])
    expect(m.creditors).toEqual([])
  })

  it('übernimmt Begleichungen ohne bestehende Schuld nicht negativ (Überzahlung)', () => {
    const expenses = [makeExpense('e1', 'Alice')]
    const splits = [makeSplit('e1', 'Bob', 50)]
    const settlements: Settlement[] = [
      {
        id: 's1',
        list_id: 'list',
        payer: 'Bob',
        payee: 'Alice',
        amount: 80,
        settled_at: '2026-01-02',
        created_by: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ]

    const m = computeMatrix(expenses, splits, settlements)

    // Überzahlung deckelt bei 0 — keine negative Zelle.
    expect(m.cells['Bob']?.['Alice']).toBeUndefined()
    expect(m.debtors).toEqual([])
  })
})
