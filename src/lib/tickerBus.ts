// ── Ticker-Bus ─────────────────────────────────────────────────────
// Zentraler Publisher für Dashboard-Ticker-Meldungen (Marquee).
// Wird von Add-Formularen (AddItemForm, MealPlanScreen, ExpenseForm) und
// von useListData (Toggle / Realtime) benutzt, um Meldungen zu feuern —
// unabhängig davon, ob das Realtime-Echo der EIGENEN Aktion ankommt.
//
// Zusätzlich: "eigene Aktion"-Marker zur Echo-Unterdrückung. Wenn eine
// Komponente eine Aktion lokal feuert, markiert sie den Schlüssel. Der
// Realtime-Handler konsumiert denselben Schlüssel und überspringt das Echo
// (sonst stünde die Meldung doppelt drin: lokal + Realtime-Echo mit anderem
// Zufalls-Spruch).

type Listener = (msg: string) => void

let listener: Listener | null = null

// ── Own-Action marker (Echo-Suppression) ──────────────────────────────
interface OwnMarker {
  key: string
  at: number
}
let ownAction: OwnMarker | null = null

const ECHO_WINDOW_MS = 3000

/** Registriert den Ticker-Listener (genau einer, zuletzt gewinnt). */
export function subscribeTicker(fn: Listener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

/** Feuert eine Ticker-Meldung an den aktuellen Listener. */
export function publishTicker(msg: string): void {
  listener?.(msg)
}

/**
 * Markiert eine Aktion, die lokal ausgeführt wurde (eigener Client).
 * Der Schlüssel sollte so aufgebaut sein, dass der Realtime-Handler ihn
 * exakt reproduzieren kann, z.B. `items:${name}`.
 */
export function markOwnAction(key: string): void {
  ownAction = { key, at: Date.now() }
}

/**
 * Prüft, ob eine lokal ausgeführte Aktion mit diesem Schlüssel im
 * Echo-Fenster liegt. Wenn ja: konsumiert sie (löscht Marker) und gibt
 * true zurück — der Realtime-Handler soll das Echo dann überspringen.
 */
export function consumeOwnAction(key: string): boolean {
  const own = ownAction
  if (!own) return false
  if (own.key !== key || Date.now() - own.at > ECHO_WINDOW_MS) {
    return false
  }
  ownAction = null
  return true
}
