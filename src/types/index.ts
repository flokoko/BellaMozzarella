export type ListType = 'shopping' | 'bring'

export interface ItemCategory {
  id: string
  list_id: string
  list_type: ListType
  name: string
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
  sort_order: number
}

export interface ShoppingList {
  id: string
  name: string
  join_code: string
  created_at: string
}

export type TabView = 'list' | 'bring' | 'mealplan' | 'settings'
export type BringFilter = 'all' | 'mine' | 'unfilled'

export type DayOfWeek = 'Montag' | 'Dienstag' | 'Mittwoch' | 'Donnerstag' | 'Freitag' | 'Samstag' | 'Sonntag'
export type MealType = 'Frühstück' | 'Mittagessen' | 'Abendessen'

export interface Meal {
  id: string
  list_id: string
  day: DayOfWeek
  meal_type: MealType
  name: string
  note: string | null
  created_by: string | null
  created_at: string
}

export interface MealIdea {
  id: string
  list_id: string
  name: string
  tags: string | null
  created_by: string | null
  created_at: string
}