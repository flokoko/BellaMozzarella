import { useState, useMemo } from 'react'
import type { ShoppingList } from '../types'
import { supabase } from '../lib/supabase'

import './JoinScreen.css'

// 🎵 Zitate von Roy Bianco & Die Abbrunzati Boys — bei jedem Aufruf ein anderes
const ROY_BIANCO_QUOTES = [
  'Träum mit mir diesen Traum, denn mein Herz schlägt Azzurro',
  'Ein Blick von dir und ich weiß, alles wird wieder gut',
  'Ein bisschen Glück liegt im Schatten des Vesuvs',
  'Hab\' dich gefunden, Traum von Neapel',
  'Eines weiß ich genau, meine Stadt liegt im Blau',
  'Ein Traum vom Glück im Licht des ersten Tags',
  'Auf dieser Insel, von der man sagt, dass hier das Leben so süß schmeckt',
  'Wir fuhr\'n in uns\'ren eig\'nen Sonn\'nuntergang',
  'Auf der Brennerautobahn, seh\' ich uns nach Süden fahr\'n',
  'Halte deine Hand und weiß, jetzt ist es gut',
  'Baby, gleich sind wir da, auf der Autostrada',
  'Ich will mit dir baden in der Adria',
  'Reiß\' das Verdeck nach hinten, schrei: Jetzt sind wir wieder frei!',
  'Ich fahr\' so schnell zurück zu dir',
  'Wie hab\' ich all die Jahre ohne dich gelebt',
  'Mein Herz schlägt Azzurro',
]

interface JoinScreenProps {
  onJoin: (name: string, list: ShoppingList) => void
}

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [joinCode, setJoinCode] = useState(() => localStorage.getItem('join_code') || '')
  const [name, setName] = useState(() => localStorage.getItem('user_name') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const subtitle = useMemo(
    () => ROY_BIANCO_QUOTES[Math.floor(Math.random() * ROY_BIANCO_QUOTES.length)],
    []
  )

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
      const { data, error: rpcError } = await supabase
        .rpc('verify_join_code', { code })
      if (rpcError || !data || data.length === 0) {
        setError('Liste nicht gefunden. Code korrekt?')
        return
      }
      const listData = data[0] as ShoppingList
      localStorage.setItem('user_name', n)
      localStorage.setItem('join_code', code)
      onJoin(n, listData)
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-icon">🇮🇹</div>
        <h1>Bella Mozzarella</h1>
        <p className="join-subtitle">{subtitle}</p>

        <label className="join-label">Join-Code</label>
        <input
          className="join-input"
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          placeholder="Join-Code"
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