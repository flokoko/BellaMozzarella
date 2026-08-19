/**
 * Bella Mozzarella — italienischer Flair.
 * Zentrale Sprüche/Toasts für Begrüßung, Erfolge und Motto.
 */

/** Begrüßung je nach Tageszeit. */
export function greetByTime(userName: string): string {
  const h = new Date().getHours()
  if (h < 11) return `Buongiorno, ${userName}! ☕`
  if (h < 18) return `Ciao, ${userName}! 🍕`
  return `Buonasera, ${userName}! 🍷`
}

/** Rotierende Erfolgs-Toasts (per App-Aufruf ein anderer). */
const SUCCESS_QUOTES = [
  'Perfetto! ✓',
  'Ecco fatto! 🎉',
  'Forza! 💪',
  'Che bello! 🥳',
  'Molto bene! ✨',
  'Bellissimo! 🇮🇹',
  'Dolce vittoria! 🍰',
  'Andiamo! 🛵',
]

/** Zufälligen Erfolgs-Spruch liefern. */
export function italianSuccess(): string {
  return SUCCESS_QUOTES[Math.floor(Math.random() * SUCCESS_QUOTES.length)]
}

/** Rotierende Mottos für die Info-Sektion (Settings). */
const MOTTO_QUOTES = [
  'La vita è bella — Bella Mozzarella!',
  'Dolce vita, dolce lista!',
  'Mangia bene, ridi spesso!',
  'Fatto in Italia, gedeiht überall!',
  'Famiglia & Mozzarella!',
  'Il gruppo perfetto!',
]

/** Zufälliges Motto für die App. */
export function italianMotto(): string {
  return MOTTO_QUOTES[Math.floor(Math.random() * MOTTO_QUOTES.length)]
}

/** Sprüche für "hinzugefügt"-Aktionen (Ticker). */
const ADD_QUOTES = [
  'Mamma mia! 🍅',
  'Ecco fatto! 🎉',
  'Forza! 💪',
  'Bellissimo! ✨',
  'Che bello! 🥳',
  'Magnifico! 🌟',
  'Bravissimo! 👏',
]

/** Sprüche für "abgehakt/mitgebracht"-Aktionen (Ticker). */
const CHECK_QUOTES = [
  'Ecco fatto! ✓',
  'Perfetto! ✓',
  'Dolce vittoria! 🍰',
  'Andiamo! 🛵',
  'Molto bene! ✨',
  'Bravo! 🎓',
  'Tutto fatto! ✅',
]

/** Zufälligen Ticker-Spruch liefern — 'add' für Inserts, 'check' für Abhaken/Mitbringen. */
export function italianTickerPhrase(kind: 'add' | 'check'): string {
  const pool = kind === 'add' ? ADD_QUOTES : CHECK_QUOTES
  return pool[Math.floor(Math.random() * pool.length)]
}
