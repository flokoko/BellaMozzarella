import { useState, useMemo } from 'react'
import type { ShoppingList } from '../types'
import { supabase, setJoinCode as setSupabaseJoinCode } from '../lib/supabase'

import './JoinScreen.css'

// 🎵 Zitate von Roy Bianco & Die Abbrunzati Boys — bei jedem Aufruf ein anderes
const ROY_BIANCO_QUOTES = [
  // Bella Napoli
  'Träum mit mir diesen Traum, denn mein Herz schlägt Azzurro',
  'Ein Blick von dir und ich weiß, alles wird wieder gut',
  'Ein bisschen Glück liegt im Schatten des Vesuvs',
  'Hab\' dich gefunden, Traum von Neapel',
  'Eines weiß ich genau, meine Stadt liegt im Blau',
  'In bella blu will ich nur eins und das bist du',
  'Mein Herz schlägt Azzurro',
  // Santorin
  'Ein Traum vom Glück im Licht des ersten Tags',
  'Auf dieser Insel, von der man sagt, dass hier das Leben so süß schmeckt',
  'Ich nehm\' Reißaus, lass\' alles hinter mir',
  // Brennerautobahn
  'Auf der Brennerautobahn, seh\' ich uns nach Süden fahr\'n',
  'Halte deine Hand und weiß, jetzt ist es gut',
  'Baby, gleich sind wir da, auf der Autostrada',
  'Ich will mit dir baden in der Adria',
  'Reiß\' das Verdeck nach hinten, schrei: Jetzt sind wir wieder frei!',
  // MS Abbrunzatissima
  'Wir fuhr\'n in uns\'ren eig\'nen Sonn\'nuntergang',
  // Giro
  'Ich fahr\' so schnell zurück zu dir',
  'Ciao bella, schieß\' los',
  // Amore Mio
  'Wie hab\' ich all die Jahre ohne dich gelebt',
  'Denn dieses Mal bist du bei mir',
  // Velocità
  'Die Zeit fliegt vorbei, mit dir bin ich frei',
  'Ganz ohne große Worte, mit dir bin ich frei',
  // Goodbye, Arrivederci
  'Der Morgen frisst die Nacht wie das Feuer Papier',
  // Ich liebte die Musik
  'Dein Brief erreicht mich zum Sonnenuntergang',
  // Alitalia
  'Ich lehne träge hier am Fenster, Zigarette Light und ein Kaffee',
  // Quanto Costa
  'Ciao bella, schieß\' los, bleib vor mir als tête de la course',
  // Unter Palmen
  'Unter Palmen, wo die Zeit still steht',
  // Radio Ipanema
  'Radio Ipanema spielt unser Lied',
  // Sprizz
  'Ein Spritz am Abend macht alles leicht',
  // Tage am Pool
  'Tage am Pool, die Welt weit weg',
  // Dolce Vita
  'Das ist Dolce Vita, das süße Leben',
  // Capri '82
  'Auf Capri, wo die Sonne niemals untergeht',
  // Baci
  'Baci, und die Welt steht still',
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
    () => Math.random() < 0.1
      ? 'Gebiss'
      : ROY_BIANCO_QUOTES[Math.floor(Math.random() * ROY_BIANCO_QUOTES.length)],
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
      // Set join code header BEFORE any table queries (RLS needs it)
      setSupabaseJoinCode(listData.join_code)
      // Fetch existing participants for this list
      const { data: participants } = await supabase
        .from('participants')
        .select('name, is_admin')
        .eq('list_id', listData.id)
      const existing = (participants || []) as { name: string; is_admin: boolean }[]
      // Case-insensitive match: use exact stored name if one exists
      const match = existing.find(en => en.name.toLowerCase() === n.toLowerCase())
      const finalName = match ? match.name : n
      // If no match, insert new participant (max 14)
      if (!match) {
        if (existing.length >= 14) {
          setError('Maximum von 14 Teilnehmern erreicht.')
          return
        }
        // First participant becomes admin
        const isFirst = existing.length === 0
        await supabase.from('participants').insert({
          list_id: listData.id,
          name: finalName,
          is_admin: isFirst,
        })
      }
      localStorage.setItem('user_name', finalName)
      localStorage.setItem('join_code', code)
      onJoin(finalName, listData)
    } catch {
      setError('Verbindung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo">
          <svg viewBox="0 0 200 120" width="180" height="108" className="join-flag-svg" aria-label="Italienische Flagge mit Mozzarellakugeln">
            {/* ── Mozzarellakugel links ── */}
            <ellipse cx="22" cy="78" rx="14" ry="13" fill="#f8f4e8" stroke="#e0d8c0" strokeWidth="0.8" />
            <ellipse cx="18" cy="74" rx="4" ry="3" fill="#ffffff" opacity="0.7" />
            <circle cx="25" cy="82" r="1.5" fill="#d4c9a8" opacity="0.4" />

            {/* ── Flaggenmast ── */}
            <line x1="42" y1="10" x2="42" y2="110" stroke="#8B7355" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="42" cy="9" r="3" fill="#a08866" />

            {/* ── Wehende Flagge: grün ── */}
            <path d="M 42 20 Q 62 16 82 22 Q 102 28 122 22 L 122 52 Q 102 58 82 52 Q 62 46 42 50 Z"
              fill="#009246" />
            {/* ── Wehende Flagge: weiß ── */}
            <path d="M 42 50 Q 62 46 82 52 Q 102 58 122 52 L 122 82 Q 102 88 82 82 Q 62 76 42 80 Z"
              fill="#ffffff" />
            {/* ── Wehende Flagge: rot ── */}
            <path d="M 42 80 Q 62 76 82 82 Q 102 88 122 82 L 122 112 Q 102 118 82 112 Q 62 106 42 110 Z"
              fill="#ce2b37" />

            {/* ── Mozzarellakugel rechts ── */}
            <ellipse cx="148" cy="78" rx="14" ry="13" fill="#f8f4e8" stroke="#e0d8c0" strokeWidth="0.8" />
            <ellipse cx="144" cy="74" rx="4" ry="3" fill="#ffffff" opacity="0.7" />
            <circle cx="151" cy="82" r="1.5" fill="#d4c9a8" opacity="0.4" />
          </svg>
        </div>
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