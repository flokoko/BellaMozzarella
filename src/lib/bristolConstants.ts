// ── Shared Bristol constants (Fix #4) ────────────────────────────────
// Extracted from BristolScreen.tsx and BristolWidget.tsx to eliminate
// duplication of BRISTOL_COLORS / BRISTOL_EMOJIS / BRISTOL_ADJECTIVES.

export const BRISTOL_ADJECTIVES: Record<number, string> = {
  1: 'klumpig',
  2: 'wurstartig',
  3: 'rissig',
  4: 'glatt',
  5: 'weich',
  6: 'breiig',
  7: 'flüssig',
  13: 'Plasma',
}

export const BRISTOL_COLORS: Record<number, string> = {
  1: '#8B4513',
  2: '#A0522D',
  3: '#D2691E',
  4: '#009246',
  5: '#9ACD32',
  6: '#FFD700',
  7: '#FF6347',
  13: '#8B4513',
}

export const BRISTOL_EMOJIS: Record<number, string> = {
  1: '🪨',
  2: '🌭',
  3: '🥨',
  4: '🍌',
  5: '🍦',
  6: '🥣',
  7: '💧',
  13: '💩',
}

export const BRISTOL_VALUES = [1, 2, 3, 4, 5, 6, 7, 13]