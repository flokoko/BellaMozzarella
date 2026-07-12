import { useCallback } from 'react'
import type { ItemCategory, ListType } from '../types'
import { supabase } from '../lib/supabase'

export function useCategories(onChange: () => void) {
  const updateCategory = useCallback(async (id: string, fields: Partial<ItemCategory>) => {
    await supabase.from('categories').update(fields).eq('id', id)
    onChange()
  }, [onChange])

  const deleteCategory = useCallback(async (id: string) => {
    await supabase.from('categories').delete().eq('id', id)
    onChange()
  }, [onChange])

  const addCategory = useCallback(async (listId: string, listType: ListType, sortOrder: number) => {
    await supabase.from('categories').insert({
      list_id: listId,
      list_type: listType,
      name: 'Neue Kategorie',
      color: '#9b6dd9',
      bg: '#e8dcf7',
      sort_order: sortOrder,
    })
    onChange()
  }, [onChange])

  return { updateCategory, deleteCategory, addCategory }
}