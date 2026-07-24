import axios from 'axios'
import type { CategoryHealth, ClusterStatus, LiveClusterMetrics, SiteStatus, TrendPoint } from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
})

export interface SitesResult {
  sites: SiteStatus[]
  stale: boolean
}

export async function fetchSites(): Promise<SitesResult> {
  const { data, headers } = await api.get<SiteStatus[]>('/api/public/sites')
  return { sites: data, stale: headers['x-stale-data'] === 'true' }
}

export async function fetchSiteClusters(code: string): Promise<ClusterStatus[]> {
  const { data } = await api.get<ClusterStatus[]>(`/api/public/sites/${code}/clusters`)
  return data
}

export async function fetchCategories(): Promise<CategoryHealth[]> {
  const { data } = await api.get<CategoryHealth[]>('/api/public/categories')
  return data
}

export async function fetchSiteCategories(code: string): Promise<CategoryHealth[]> {
  const { data } = await api.get<CategoryHealth[]>(`/api/public/sites/${code}/categories`)
  return data
}

export async function fetchTrend(): Promise<TrendPoint[]> {
  const { data } = await api.get<TrendPoint[]>('/api/public/trend')
  return data
}

export async function fetchClusterLive(clusterId: string): Promise<LiveClusterMetrics> {
  const { data } = await api.get<LiveClusterMetrics>(`/api/public/clusters/${clusterId}/live`)
  return data
}

export async function fetchClusterCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/api/public/clusters/count')
  return data.count
}
