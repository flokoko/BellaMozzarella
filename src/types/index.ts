export type Category = 'Essen' | 'Getraenke' | 'Snacks' | 'Equipment' | 'Sonstiges'

export const CATEGORIES: Category[] = ['Essen', 'Getraenke', 'Snacks', 'Equipment', 'Sonstiges']

export const CATEGORY_META: Record<Category, { icon: string; color: string; bg: string }> = {
  Essen:      { icon: '🍽️', color: '#e07856', bg: '#fde8dc' },
  Getraenke:  { icon: '🥤', color: '#4a90d9', bg: '#d4e8f7' },
  Snacks:     { icon: '🍿', color: '#e8a83a', bg: '#fdf2d6' },
  Equipment:  { icon: '🎒', color: '#6b8e5a', bg: '#dce8d2' },
  Sonstiges:  { icon: '📦', color: '#9b6dd9', bg: '#e8dcf7' },
}

export interface ListItem {
  id: string
  list_id: string
  name: string
  category: Category
  quantity: string
  assigned_to: string | null
  is_checked: boolean
  is_brought: boolean
  created_by: string | null
  created_at: string
}

export interface ShoppingList {
  id: string
  name: string
  join_code: string
  created_at: string
}

export type TabView = 'list' | 'bring'
export type BringFilter = 'all' | 'mine' | 'unfilled'