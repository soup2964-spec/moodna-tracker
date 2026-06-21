export type LeadSource = "upwork" | "reddit" | "onlinejobs" | "linkedin" | "facebook" | "google"

export type LeadStatus = "new" | "saved" | "contacted" | "disqualified"

export type VaJobLead = {
  id: string
  source: LeadSource
  title: string
  snippet: string
  url: string
  postedAt: string
  intentScore: number
  matchedKeywords: string[]
  status: LeadStatus
  notes: string
  discoveredAt: string
}

export type LeadSearchTemplate = {
  id: string
  label: string
  description: string
  query: string
}

export type LeadFinderState = {
  leads: VaJobLead[]
  lastQuery: string
  lastFetchedAt?: string
}
