import { useMemo } from 'react'
import { Wallet, ArrowRight } from 'lucide-react'
import type { Expense, ExpenseSplit } from '../types'
import {
  computeBalances,
  computeSettlement,
  sortedBalanceEntries,
  totalExpenses,
  fmtEUR,
} from '../lib/settlement'
import ExpenseCharts from './ExpenseCharts'

interface ExpenseSettlementProps {
  expenses: Expense[]
  expenseSplits: ExpenseSplit[]
}

export default function ExpenseSettlement({ expenses, expenseSplits }: ExpenseSettlementProps) {
  const total = useMemo(() => totalExpenses(expenses), [expenses])
  const balances = useMemo(() => computeBalances(expenses, expenseSplits), [expenses, expenseSplits])
  const settlement = useMemo(() => computeSettlement(balances), [balances])
  const sortedBalances = useMemo(() => sortedBalanceEntries(balances), [balances])

  return (
    <div key="settlement">
      <div className="expense-total-banner">
        <Wallet size={18} strokeWidth={2} /> Gesamtausgaben: {fmtEUR(total)}
      </div>

      <ExpenseCharts expenses={expenses} />

      {expenses.length === 0 ? (
        <p className="expense-empty">Noch keine Ausgaben zur Abrechnung.</p>
      ) : (
        <>
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
  )
}