import type { HistoryItem, ModelHealth, ModelInfo, ModelListItem, PredictionResult, Stats } from './types'

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

export function predictWithModel(model: string, url: string): Promise<PredictionResult> {
  return request<PredictionResult>(`/api/v1/predict/model/${encodeURIComponent(model)}`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

export function simulateFeatures(
  features: Record<string, number>,
  model?: string,
): Promise<PredictionResult & { hypothetical: boolean }> {
  return request<PredictionResult & { hypothetical: boolean }>('/api/v1/predict/simulate', {
    method: 'POST',
    body: JSON.stringify({ features, model }),
  })
}

export function getModelInfo(): Promise<ModelInfo> {
  return request<ModelInfo>('/api/v1/model-info')
}

export function getModels(): Promise<{ best_model: string; models: ModelListItem[] }> {
  return request<{ best_model: string; models: ModelListItem[] }>('/api/v1/models')
}

export function getModelHealth(): Promise<ModelHealth> {
  return request<ModelHealth>('/api/v1/model-health')
}

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/v1/statistics')
}

export function getHistory(limit = 20, q = '', prediction = ''): Promise<{ results: HistoryItem[] }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (q) params.set('q', q)
  if (prediction) params.set('prediction', prediction)
  return request<{ results: HistoryItem[] }>(`/api/v1/history?${params.toString()}`)
}

export function clearHistory(): Promise<{ cleared: number }> {
  return request<{ cleared: number }>('/api/v1/history', { method: 'DELETE' })
}

export function deleteAnalysis(analysisId: string): Promise<{ deleted: string }> {
  return request<{ deleted: string }>(`/api/v1/history/${encodeURIComponent(analysisId)}`, { method: 'DELETE' })
}

export function getHealth(): Promise<{ status: string; model_name: string | null; model_loaded: boolean }> {
  return request<{ status: string; model_name: string | null; model_loaded: boolean }>('/api/v1/health')
}