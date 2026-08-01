// Einfaches Error-Logging ohne externe Dependencies
// Erweitert console.error um strukturierte Logs

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: unknown
  stack?: string
}

const MAX_LOGS = 50
const STORAGE_KEY = 'app_logs'

function getLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLogs(logs: LogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)))
  } catch {
    // localStorage full — ignore
  }
}

export function logError(message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    data,
    stack: new Error().stack,
  }
  console.error(`[${entry.timestamp}] ${message}`, data)
  const logs = getLogs()
  logs.push(entry)
  saveLogs(logs)
}

export function logWarn(message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    message,
    data,
  }
  console.warn(`[${entry.timestamp}] ${message}`, data)
  const logs = getLogs()
  logs.push(entry)
  saveLogs(logs)
}

export function getErrorLogs(): LogEntry[] {
  return getLogs()
}

export function clearErrorLogs() {
  localStorage.removeItem(STORAGE_KEY)
}