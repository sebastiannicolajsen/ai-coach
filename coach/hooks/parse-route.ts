import type { RouteEffort, RouteModel } from '../types'

const FAMILIES: readonly RouteModel[] = ['fable', 'opus', 'sonnet', 'haiku']
export const EFFORTS: readonly RouteEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const REASON_CHARS = 28

export const isRouteModel = (v: unknown): v is RouteModel => typeof v === 'string' && (FAMILIES as readonly string[]).includes(v)
export const isRouteEffort = (v: unknown): v is RouteEffort => typeof v === 'string' && (EFFORTS as readonly string[]).includes(v)

// A step's effort as a level: the five names, or a number of thinking tokens read on the same scale.
export function effortOf(v: unknown): RouteEffort | null {
  if (isRouteEffort(v)) return v
  if (typeof v !== 'number') return null
  return v < 4000 ? 'low' : v < 12000 ? 'medium' : v < 32000 ? 'high' : v < 64000 ? 'xhigh' : 'max'
}

export function parseRoute(json: unknown): { model: RouteModel; reason: string; effort?: RouteEffort } | null {
  const j = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
  if (!isRouteModel(j.model) || typeof j.reason !== 'string') return null
  const reason = j.reason.replace(/[.!]+$/, '').trim().toLowerCase().slice(0, REASON_CHARS)
  if (!reason) return null
  return isRouteEffort(j.effort) ? { model: j.model, reason, effort: j.effort } : { model: j.model, reason }
}
