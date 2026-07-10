import { useState } from 'react'
import type { ShoppingList } from '../types'
import { supabase } from '../lib/supabase'
import './JoinScreen.css'

interface JoinScreenProps {
  onJoin: (name: string, list: ShoppingList) => void
}

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [joinCode, setJoinCode] = useState(() => localStorage.getItem('join_code') || 'BELLA26')
  const [name, setName] = useState(() => localStorage.getItem('user_name') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    const n = name.trim()
    if (!code || !n) {
      setError('Bitte Join-Code und Namen eingeben.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase
        .from('lists')
        .select('*')
        .eq('join_code', code)
        .single()
      if (dbError || !data) {
        setError('Liste nicht gefunden. Code korrekt?')
        return
      }
      localStorage.setItem('user_name', n)
      localStorage.setItem('join_code', code)
      onJoin(n, data as ShoppingList)
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-icon">🧀</div>
        <h1>Bella Mozzarella</h1>
        <p className="join-subtitle">Gemeinsam planen, zusammenpacken.</p>

        <label className="join-label">Join-Code</label>
        <input
          className="join-input"
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="z.B. BELLA26"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />

        <label className="join-label">Dein Name</label>
        <input
          className="join-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Florian"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />

        {error && <p className="join-error">{error}</p>}

        <button className="join-btn" onClick={handleJoin} disabled={loading}>
          {loading ? 'Verbinde…' : 'Beitreten →'}
        </button>
      </div>
    </div>
  )
}