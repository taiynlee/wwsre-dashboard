export type Tier = 'good' | 'warn' | 'crit' | 'unknown'

export interface SiteStatus {
  code: string
  display_name: string
  country: string
  latitude: number
  longitude: number
  target_pct: number
  history: number[]
  current_pct: number | null
  tier: Tier
  cluster_count: number
}

export interface ClusterStatus {
  cluster_id: string
  current_pct: number | null
  tier: Tier
}

export interface CategoryHealth {
  category: string
  avg_pct: number
  worst_pct: number
  tier: Tier
}

export interface TrendPoint {
  date: number // epoch milliseconds
  avg_pct: number
}

export interface LiveClusterMetrics {
  available: boolean
  metrics: Record<string, number | null> | null
  external_url: string | null
}
