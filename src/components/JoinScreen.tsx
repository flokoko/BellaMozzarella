import { useState, useMemo } from 'react'
import type { ShoppingList } from '../types'
import { supabase, setJoinCode as setSupabaseJoinCode } from '../lib/supabase'
import MozzaScene from './MozzaScene'

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
  // Sophia Loren
  'Du raubst mir die Nächte und verschwendest mein Herz',
  'Du gibst mir das Beste und ich vergess\' alle Welt',
  'Du bist die Einzige für mich — so jemand wie dich, das gab\'s noch nicht',
  'An jedem Haus lauf\' ich entlang, auf jedes schreib\' ich deinen Namen',
  'Du und ich, so wie im Film — was niemand hat, doch jeder will',
  'Für immer — Sophia Loren!',
  // Bardolino
  'Ich will nie wieder Bardolino seh\'n',
  'Uns\'re Tage des Glücks liegen hier am Grund des Gardasees',
  'Mit Netzen aus Verlang\'n hast du mich eingefang\'n',
  'Ich will heim, kann nicht geh\'n, nie wieder Bardolino seh\'n',
  'Kann nicht geh\'n, ich will heim, zu viel billiger Wein',
  // Rimini Disco
  'In Rimini, wo die Nächte nie enden',
  'Die Diskokugel dreht sich, der Sommer gehört uns',
  // Agosto 83
  'Im August, als die Sonne uns verriet',
  'Es war ein Sommer, der nie enden sollte',
  // Schneeflocken in Calabria
  'Schneeflocken in Calabria, so kalt war\'s nie in Neapel',
  // Weiße Rosen
  'Weiße Rosen auf dem Wasser, der Abend gehört uns beiden',
  // Mille Grazie
  'Mille grazie, tausend Dank für jede Nacht',
  // Ouvertüre
  'Es beginnt, wie es endet — mit einem Lied',
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
          <div className="join-orbit">
            {/* ── Wehende Flagge als SVG (vertikale Streifen = korrekte Italia) ── */}
            <svg viewBox="0 0 200 160" width="160" height="128" className="join-flag-svg" aria-label="Italienische Flagge">
              <defs>
                {/* Wellenform der Flagge als Clip — eine zusammenhängende Form */}
                <clipPath id="flagWave">
                  <path d="M 12 8 Q 40 4 70 10 Q 100 16 130 10 Q 160 4 190 10 L 190 124 Q 160 130 130 124 Q 100 118 70 124 Q 40 118 12 122 Z" />
                </clipPath>
              </defs>

              {/* ── Flaggenmast ── */}
              <line x1="12" y1="2" x2="12" y2="158" stroke="#8B7355" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="12" cy="2" r="4" fill="#a08866" />

              {/* ── 3 vertikale Streifen (grün | weiß | rot), geclippt durch Wellenform ── */}
              <g clipPath="url(#flagWave)">
                <rect x="0"  y="0" width="64"  height="160" fill="#009246" />
                <rect x="64" y="0" width="64"  height="160" fill="#ffffff" />
                <rect x="128" y="0" width="64" height="160" fill="#ce2b37" />
              </g>
            </svg>
            {/* ── 3D Mozzarellakugeln kreisen um die Flagge ── */}
            <div className="mozza-3d-canvas">
              <MozzaScene />
            </div>
          </div>
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