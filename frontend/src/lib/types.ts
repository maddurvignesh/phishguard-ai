export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Prediction = 'legitimate' | 'phishing'
export type CardStatus = 'safe' | 'warning' | 'suspicious'

export interface SecurityCard {
  feature: string
  status: CardStatus
  icon: string
  message: string
  value: string
}

export interface ExplanationItem {
  feature: string
  value: number
  typical_legit: number
  typical_phish: number
  direction: 'higher' | 'lower'
}

export interface AnatomyComponent {
  name: 'protocol' | 'subdomain' | 'domain' | 'port' | 'path' | 'query' | 'fragment'
  value: string
  suspicious: boolean
  note: string
}

export interface UrlAnatomy {
  host: string
  tld: string
  protocol: string
  components: AnatomyComponent[]
}

export interface ThreatDna {
  categories: Record<string, number>
  max: number
}

export interface PredictionResult {
  url: string
  analysis_id: string
  model_name: string
  prediction: Prediction
  label: number
  probability: number
  risk_score: number
  risk_score_percent: number
  confidence: number
  confidence_percent: number
  risk_level: RiskLevel
  risk_description: string
  features: Record<string, number>
  security_analysis: SecurityCard[]
  explanation: ExplanationItem[]
  url_anatomy: UrlAnatomy
  threat_dna: ThreatDna
}

export interface ModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1: number
  roc_auc: number
}

export interface RocCurve {
  fpr: number[]
  tpr: number[]
  auc: number
}

export interface ModelEntry {
  metrics: ModelMetrics
  roc: RocCurve
  confusion_matrix: number[][]
}

export interface ModelInfo {
  dataset: {
    raw_rows_total: number
    rows_after_clean: number
    duplicates_dropped: number
    unparseable_dropped: number
    legitimate_count: number
    phishing_count: number
    num_features: number
    feature_columns: string[]
  }
  best_model: string
  best_metrics: ModelMetrics
  models: Record<string, ModelEntry>
  feature_importance: { name: string; importance: number }[]
  train_size: number
  test_size: number
}

export interface Stats {
  total_analyzed: number
  phishing_detected: number
  legitimate_detected: number
  high_risk_analyses: number
  average_risk_score: number
  average_risk_percent: number
}

export interface HistoryItem {
  url: string
  prediction: Prediction
  risk_score: number
  risk_level: RiskLevel
  created_at: string
  model: string
  analysis_id: string
}

export interface ModelListItem {
  name: string
  available: boolean
  metrics: ModelMetrics | null
}

export interface ModelHealth {
  model_loaded: boolean
  status: 'READY' | 'UNAVAILABLE'
  model_name: string
  model_version: string
  trained_at: string
  random_state: number | null
  dataset_size: number | null
  num_features: number
  train_size: number | null
  test_size: number | null
  models_available: string[]
  metrics: ModelMetrics | null
}

export interface ApiError {
  detail?: string | { msg: string }[]
}