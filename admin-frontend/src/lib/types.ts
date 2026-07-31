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

export interface Finding {
  severity: 'warn' | 'crit'
  category: 'no_data' | 'breach' | 'category_issue' | 'grafana_mapping'
  message: string
  site_code: string | null
  cluster_id: string | null
  potential_uplift_pct: number
}

export interface FindingsResult {
  findings: Finding[]
  last_run: string | null
}
