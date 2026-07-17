import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface QueuedOp {
  id: string
  type: 'insert' | 'update' | 'delete' | 'rpc'
  table: string
  payload: Record<string, unknown>
  /** For update/delete: the filter column (usually 'id') */
  filterColumn?: string
  /** For update/delete: the filter value */
  filterValue?: string | string[]
  /** For rpc: the rpc function name */
  rpcName?: string
  timestamp: number
}

const STORAGE_KEY = 'offline_queue'

function loadQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as QueuedOp[] : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedOp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

let opIdCounter = 0

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueLength, setQueueLength] = useState(() => loadQueue().length)
  const isFlushingRef = useRef(false)

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const updateQueueLength = useCallback(() => {
    setQueueLength(loadQueue().length)
  }, [])

  const flushQueue = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (isFlushingRef.current) return { success: 0, failed: 0 }
    isFlushingRef.current = true

    let success = 0
    let failed = 0

    try {
      let queue = loadQueue()

      while (queue.length > 0) {
        const op = queue[0]
        let opError = false

        try {
          if (op.type === 'rpc') {
            const { error } = await supabase.rpc(op.rpcName!, op.payload)
            if (error) opError = true
          } else if (op.type === 'insert') {
            const { error } = await supabase.from(op.table).insert(op.payload)
            if (error) opError = true
          } else if (op.type === 'update') {
            const { error } = await supabase
              .from(op.table)
              .update(op.payload)
              .eq(op.filterColumn!, op.filterValue!)
            if (error) opError = true
          } else if (op.type === 'delete') {
            const { error } = await supabase
              .from(op.table)
              .delete()
              .eq(op.filterColumn!, op.filterValue!)
            if (error) opError = true
          }
        } catch {
          opError = true
        }

        if (opError) {
          failed++
          break // Stop on first failure — keep remaining in queue
        }

        success++
        queue = queue.slice(1)
        saveQueue(queue)
      }

      updateQueueLength()
      return { success, failed }
    } finally {
      isFlushingRef.current = false
    }
  }, [updateQueueLength])

  const enqueue = useCallback((op: Omit<QueuedOp, 'id' | 'timestamp'>) => {
    const fullOp: QueuedOp = {
      ...op,
      id: `op-${++opIdCounter}-${Date.now()}`,
      timestamp: Date.now(),
    }
    const queue = loadQueue()
    queue.push(fullOp)
    saveQueue(queue)
    updateQueueLength()
  }, [updateQueueLength])

  // Auto-flush when coming back online
  useEffect(() => {
    if (isOnline && loadQueue().length > 0) {
      flushQueue()
    }
  }, [isOnline, flushQueue])

  return {
    isOnline,
    enqueue,
    flushQueue,
    queueLength,
  }
}