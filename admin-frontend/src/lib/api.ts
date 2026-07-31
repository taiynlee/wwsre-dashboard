import axios from 'axios'
import type { FindingsResult, Site, SiteCategoryTarget, SiteCategoryTargetInput, SiteCreateInput, SiteUpdateInput } from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE_URL ?? 'http://localhost:8001',
})

export async function fetchSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>('/api/admin/sites')
  return data
}

export async function createSite(input: SiteCreateInput): Promise<Site> {
  const { data } = await api.post<Site>('/api/admin/sites', input)
  return data
}

export async function updateSite(code: string, input: SiteUpdateInput): Promise<Site> {
  const { data } = await api.patch<Site>(`/api/admin/sites/${code}`, input)
  return data
}

export async function deleteSite(code: string): Promise<void> {
  await api.delete(`/api/admin/sites/${code}`)
}

export async function fetchSiteCategories(code: string): Promise<SiteCategoryTarget[]> {
  const { data } = await api.get<SiteCategoryTarget[]>(`/api/admin/sites/${code}/categories`)
  return data
}

export async function replaceSiteCategories(code: string, items: SiteCategoryTargetInput[]): Promise<SiteCategoryTarget[]> {
  const { data } = await api.put<SiteCategoryTarget[]>(`/api/admin/sites/${code}/categories`, items)
  return data
}

export async function fetchFindings(): Promise<FindingsResult> {
  const { data } = await api.get<FindingsResult>('/api/admin/findings')
  return data
}
