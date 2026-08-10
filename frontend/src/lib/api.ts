import type { HistoryItem, ModelInfo, PredictionResult, Stats } from './types'

// The dev server proxies /api -> http://127.0.0.1:8000 (see vite.config.ts).
// In production set VITE_API_BASE to the backend URL.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed with status ${res.status}`
    throw new Error(detail)
  }

  return body as T
}

export function predictUrl(url: string): Promise<PredictionResult> {
  return request<PredictionResult>('/api/v1/predict', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export function getModelInfo(): Promise<ModelInfo> {
  return request<ModelInfo>('/api/v1/model-info')
}

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/v1/statistics')
}

export function getHistory(limit = 20): Promise<{ results: HistoryItem[] }> {
  return request<{ results: HistoryItem[] }>(`/api/v1/history?limit=${limit}`)
}

export function clearHistory(): Promise<{ cleared: number }> {
  return request<{ cleared: number }>('/api/v1/history', { method: 'DELETE' })
}

export function getHealth(): Promise<{ status: string; model_name: string | null; model_loaded: boolean }> {
  return request<{ status: string; model_name: string | null; model_loaded: boolean }>('/api/v1/health')
}