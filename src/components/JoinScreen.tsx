import { useState, useMemo } from 'react'
import type { ShoppingList } from '../types'
import { supabase } from '../lib/supabase'

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
      // Fetch existing participants for this list
      const { data: participants } = await supabase
        .from('participants')
        .select('name')
        .eq('list_id', listData.id)
      const existingNames = (participants || []).map(p => p.name)
      // Case-insensitive match: use exact stored name if one exists
      const match = existingNames.find(en => en.toLowerCase() === n.toLowerCase())
      const finalName = match || n
      // If no match, insert new participant
      if (!match) {
        await supabase.from('participants').insert({ list_id: listData.id, name: finalName })
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
        <p className="join-hint">Tipp: Gib deinen exakten Namen ein, damit du in der Abrechnung richtig zugeordnet wirst.</p>

        {error && <p className="join-error">{error}</p>}

        <button className="join-btn" onClick={handleJoin} disabled={loading}>
          {loading ? 'Verbinde…' : 'Beitreten →'}
        </button>
      </div>
    </div>
  )
}