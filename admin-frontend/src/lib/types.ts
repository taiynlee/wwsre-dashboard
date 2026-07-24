export interface Site {
  code: string
  display_name: string
  country: string
  latitude: number
  longitude: number
  cluster_prefix: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface SiteCreateInput {
  code: string
  display_name: string
  country: string
  latitude: number
  longitude: number
  cluster_prefix: string
  enabled: boolean
}

export interface SiteUpdateInput {
  display_name?: string
  country?: string
  latitude?: number
  longitude?: number
  cluster_prefix?: string
  enabled?: boolean
}

export interface SiteCategoryTarget {
  site_code: string
  category: string
  target_pct: number
  included: boolean
}

export interface SiteCategoryTargetInput {
  category: string
  target_pct: number
  included: boolean
}
