export type ListType = 'shopping' | 'bring'

export interface ItemCategory {
  id: string
  list_id: string
  list_type: ListType
  name: string
  icon: string
  color: string
  bg: string
  sort_order: number
  created_at: string
}

export interface ListItem {
  id: string
  list_id: string
  name: string
  category: string
  quantity: string
  assigned_to: string | null
  is_checked: boolean
  is_brought: boolean
  created_by: string | null
  created_at: string
  list_type: ListType
}

export interface ShoppingList {
  id: string
  name: string
  join_code: string
  created_at: string
}

export type TabView = 'list' | 'bring' | 'settings'
export type BringFilter = 'all' | 'mine' | 'unfilled'