import { useState, useMemo } from 'react'
import type { ShoppingList } from '../types'
import { supabase, setJoinCode as setSupabaseJoinCode, loginParticipant } from '../lib/supabase'
import MozzaScene from './MozzaScene'

import './JoinScreen.css'

// 🎵 Zitate von Roy Bianco & Die Abbrunzati Boys — bei jedem Aufruf ein anderes
const ROY_BIANCO_QUOTES = [
  'Träum mit mir diesen Traum, denn mein Herz schlägt Azzurro',
  'Ein Blick von dir und ich weiß, alles wird wieder gut',
  'Ein bisschen Glück liegt im Schatten des Vesuvs',
  'Hab\' dich gefunden, Traum von Neapel',
  'Eines weiß ich genau, meine Stadt liegt im Blau',
  'In bella blu will ich nur eins und das bist du',
  'Mein Herz schlägt Azzurro',
  'Ein Traum vom Glück im Licht des ersten Tags',
  'Auf dieser Insel, von der man sagt, dass hier das Leben so süß schmeckt',
  'Ich nehm\' Reißaus, lass\' alles hinter mir',
  'Auf der Brennerautobahn, seh\' ich uns nach Süden fahr\'n',
  'Halte deine Hand und weiß, jetzt ist es gut',
  'Baby, gleich sind wir da, auf der Autostrada',
  'Ich will mit dir baden in der Adria',
  'Reiß\' das Verdeck nach hinten, schrei: Jetzt sind wir wieder frei!',
  'Wir fuhr\'n in uns\'ren eig\'nen Sonn\'nuntergang',
  'Ich fahr\' so schnell zurück zu dir',
  'Ciao bella, schieß\' los',
  'Wie hab\' ich all die Jahre ohne dich gelebt',
  'Denn dieses Mal bist du bei mir',
  'Die Zeit fliegt vorbei, mit dir bin ich frei',
  'Ganz ohne große Worte, mit dir bin ich frei',
  'Der Morgen frisst die Nacht wie das Feuer Papier',
  'Dein Brief erreicht mich zum Sonnenuntergang',
  'Ich lehne träge hier am Fenster, Zigarette Light und ein Kaffee',
  'Ciao bella, schieß\' los, bleib vor mir als tête de la course',
  'Unter Palmen, wo die Zeit still steht',
  'Radio Ipanema spielt unser Lied',
  'Ein Spritz am Abend macht alles leicht',
  'Tage am Pool, die Welt weit weg',
  'Das ist Dolce Vita, das süße Leben',
  'Auf Capri, wo die Sonne niemals untergeht',
  'Baci, und die Welt steht still',
  'Du raubst mir die Nächte und verschwendest mein Herz',
  'Du gibst mir das Beste und ich vergess\' alle Welt',
  'Du bist die Einzige für mich — so jemand wie dich, das gab\'s noch nicht',
  'An jedem Haus lauf\' ich entlang, auf jedes schreib\' ich deinen Namen',
  'Du und ich, so wie im Film — was niemand hat, doch jeder will',
  'Für immer — Sophia Loren!',
  'Ich will nie wieder Bardolino seh\'n',
  'Uns\'re Tage des Glücks liegen hier am Grund des Gardasees',
  'Mit Netzen aus Verlang\'n hast du mich eingefang\'n',
  'Ich will heim, kann nicht geh\'n, nie wieder Bardolino seh\'n',
  'Kann nicht geh\'n, ich will heim, zu viel billiger Wein',
  'In Rimini, wo die Nächte nie enden',
  'Die Diskokugel dreht sich, der Sommer gehört uns',
  'Im August, als die Sonne uns verriet',
  'Es war ein Sommer, der nie enden sollte',
  'Schneeflocken in Calabria, so kalt war\'s nie in Neapel',
  'Weiße Rosen auf dem Wasser, der Abend gehört uns beiden',
  'Mille grazie, tausend Dank für jede Nacht',
  'Es beginnt, wie es endet — mit einem Lied',
]

interface JoinScreenProps {
  onJoin: (name: string, list: ShoppingList, participantId: string) => void
}

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [joinCode, setJoinCode] = useState(() => localStorage.getItem('join_code') || '')
  const [name, setName] = useState(() => localStorage.getItem('user_name') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const subtitle = useMemo(
    () => Math.random() < 0.1
      ? 'Gebiss'
      : ROY_BIANCO_QUOTES[Math.floor(Math.random() * ROY_BIANCO_QUOTES.length)],
    []
  )

  const handleLogin = async () => {
    const code = joinCode.trim().toUpperCase()
    const n = name.trim()
    const pw = password.trim()
    if (!code || !n) {
      setError('Bitte Join-Code und Namen eingeben.')
      return
    }
    if (!pw) {
      setError('Bitte Passwort eingeben.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await loginParticipant(code, n, pw)
      if (result.error) {
        setError(result.error)
        return
      }
      // Set join code header BEFORE any table queries (RLS needs it)
      setSupabaseJoinCode(result.join_code)

      // Fetch full list data
      const { data: fullList } = await supabase
        .from('lists')
        .select('*')
        .eq('id', result.list_id)
        .single()

      if (!fullList) {
        setError('Liste nicht gefunden.')
        return
      }

      localStorage.setItem('user_name', result.participant_name)
      localStorage.setItem('join_code', code)
      localStorage.setItem('participant_id', result.participant_id)

      onJoin(result.participant_name, fullList as ShoppingList, result.participant_id)
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
            <svg viewBox="0 0 200 160" width="160" height="128" className="join-flag-svg" aria-label="Italienische Flagge">
              <defs>
                <clipPath id="flagWave">
                  <path d="M 12 8 Q 40 4 70 10 Q 100 16 130 10 Q 160 4 190 10 L 190 124 Q 160 130 130 124 Q 100 118 70 124 Q 40 118 12 122 Z" />
                </clipPath>
              </defs>
              <line x1="12" y1="2" x2="12" y2="158" stroke="#8B7355" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="12" cy="2" r="4" fill="#a08866" />
              <g clipPath="url(#flagWave)">
                <rect x="0"  y="0" width="64"  height="160" fill="#009246" />
                <rect x="64" y="0" width="64"  height="160" fill="#ffffff" />
                <rect x="128" y="0" width="64" height="160" fill="#ce2b37" />
              </g>
            </svg>
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
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />

        <label className="join-label">Dein Name</label>
        <input
          className="join-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z.B. Florian"
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />

        <label className="join-label">Passwort</label>
        <input
          className="join-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Initial: BELLA26"
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />

        <p className="join-hint">
          Beim ersten Mal mit dem Initial-Passwort <strong>BELLA26</strong> anmelden.
          Danach in den Einstellungen ein eigenes Passwort setzen.
        </p>

        {error && <p className="join-error">{error}</p>}

        <button className="join-btn" onClick={handleLogin} disabled={loading}>
          {loading ? 'Verbinde…' : 'Anmelden →'}
        </button>
      </div>
    </div>
  )
}
