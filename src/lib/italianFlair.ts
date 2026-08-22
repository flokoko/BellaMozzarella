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

/** Zitate von Roy Bianco & Die Abbrunzati Boys — für den Ticker. */
export const ABRUZZANTI_QUOTES = [
  'Träum mit mir diesen Traum, denn mein Herz schlägt Azzurro',
  'Ein Blick von dir und ich weiß, alles wird wieder gut',
  'Ein bisschen Glück liegt im Schatten des Vesuvs',
  "Hab' dich gefunden, Traum von Neapel",
  'Eines weiß ich genau, meine Stadt liegt im Blau',
  'In bella blu will ich nur eins und das bist du',
  'Mein Herz schlägt Azzurro',
  'Ein Traum vom Glück im Licht des ersten Tags',
  'Auf dieser Insel, von der man sagt, dass hier das Leben so süß schmeckt',
  "Ich nehm' Reißaus, lass' alles hinter mir",
  "Auf der Brennerautobahn, seh' ich uns nach Süden fahr'n",
  'Halte deine Hand und weiß, jetzt ist es gut',
  'Baby, gleich sind wir da, auf der Autostrada',
  'Ich will mit dir baden in der Adria',
  "Reiß' das Verdeck nach hinten, schrei: Jetzt sind wir wieder frei!",
  "Wir fuhr'n in uns'ren eig'nen Sonn'nuntergang",
  "Ich fahr' so schnell zurück zu dir",
  "Ciao bella, schieß' los",
  "Wie hab' ich all die Jahre ohne dich gelebt",
  'Denn dieses Mal bist du bei mir',
  'Die Zeit fliegt vorbei, mit dir bin ich frei',
  'Ganz ohne große Worte, mit dir bin ich frei',
  'Der Morgen frisst die Nacht wie das Feuer Papier',
  'Dein Brief erreicht mich zum Sonnenuntergang',
  'Ich lehne träge hier am Fenster, Zigarette Light und ein Kaffee',
  "Ciao bella, schieß' los, bleib vor mir als tête de la course",
  'Unter Palmen, wo die Zeit still steht',
  'Radio Ipanema spielt unser Lied',
  'Ein Spritz am Abend macht alles leicht',
  'Tage am Pool, die Welt weit weg',
  'Das ist Dolce Vita, das süße Leben',
  'Auf Capri, wo die Sonne niemals untergeht',
  'Baci, und die Welt steht still',
  'Du raubst mir die Nächte und verschwendest mein Herz',
  "Du gibst mir das Beste und ich vergess' all' die Welt",
  "Du bist die Einzige für mich — so jemand wie dich, das gab's noch nicht",
  'An jedem Haus lauf ich entlang, auf jedes schreib ich deinen Namen',
  'Du und ich, so wie im Film — was niemand hat, doch jeder will',
  'Für immer — Sophia Loren!',
  'Ich will nie wieder Bardolino sehn',
  "Uns're Tage des Glücks liegen hier am Grund des Gardasees",
  'Mit Netzen aus Verlangen hast du mich eingefangn',
  'Ich will heim, kann nicht gehn, nie wieder Bardolino sehn',
  'Kann nicht gehn, ich will heim, zu viel billiger Wein',
  'In Rimini, wo die Nächte nie enden',
  'Die Diskokugel dreht sich, der Sommer gehört uns',
  'Im August, als die Sonne uns verriet',
  'Es war ein Sommer, der nie enden sollte',
  "Schneeflocken in Calabria, so kalt war's nie in Neapel",
  'Weiße Rosen auf dem Wasser, der Abend gehört uns beiden',
  'Mille grazie, tausend Dank für jede Nacht',
  'Es beginnt, wie es endet — mit einem Lied',
]

/**
 * Zufälligen Ticker-Spruch liefern — 'add' für Inserts, 'check' für Abhaken/Mitbringen.
 * ~18 % der Meldungen bekommen ein Abbrunzati-Zitat statt des Standard-Spruchs;
 * gelegentlich (hier und da) wird das Wort "Gebiss" eingestreut.
 */
export function italianTickerPhrase(kind: 'add' | 'check'): string {
  const base = (kind === 'add' ? ADD_QUOTES : CHECK_QUOTES)[Math.floor(Math.random() * (kind === 'add' ? ADD_QUOTES : CHECK_QUOTES).length)]
  // In ~18 % der Meldungen ein Abbrunzati-Zitat voranstellen
  if (Math.random() < 0.18) {
    const q = ABRUZZANTI_QUOTES[Math.floor(Math.random() * ABRUZZANTI_QUOTES.length)]
    return Math.random() < 0.15 ? `${q} — Gebiss` : q
  }
  // Ansonsten Standard-Spruch, hin und wieder mit "Gebiss"
  return Math.random() < 0.12 ? `${base} Gebiss` : base
}
