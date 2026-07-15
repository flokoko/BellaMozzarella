import { useCallback } from 'react'
import type { ItemCategory, ListType } from '../types'
import { supabase } from '../lib/supabase'

export function useCategories(onChange: () => void) {
  const updateCategory = useCallback(async (id: string, fields: Partial<ItemCategory>) => {
    const { error } = await supabase.from('categories').update(fields).eq('id', id)
    if (error) {
      console.error('updateCategory error:', error)
      alert(`Fehler beim Speichern: ${error.message}`)
      return
    }
    onChange()
  }, [onChange])

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      console.error('deleteCategory error:', error)
      alert(`Fehler beim Löschen: ${error.message}`)
      return
    }
    onChange()
  }, [onChange])

  const addCategory = useCallback(async (listId: string, listType: ListType, sortOrder: number) => {
    const { error } = await supabase.from('categories').insert({
      list_id: listId,
      list_type: listType,
      name: 'Neue Kategorie',
      color: '#9b6dd9',
      bg: '#e8dcf7',
      sort_order: sortOrder,
    })
    if (error) {
      console.error('addCategory error:', error)
      alert(`Fehler beim Hinzufügen: ${error.message}`)
      return
    }
    onChange()
  }, [onChange])

  return { updateCategory, deleteCategory, addCategory }
}