import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your values.'
  )
}

// Module-level variable for the current join code
let currentJoinCode = ''

export function setJoinCode(code: string) {
  currentJoinCode = code
}

export function getJoinCode() {
  return currentJoinCode
}

// Custom fetch that injects the x-join-code header on every request
const customFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  if (currentJoinCode) {
    headers.set('x-join-code', currentJoinCode)
  }
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: customFetch },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
})