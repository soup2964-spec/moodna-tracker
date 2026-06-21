import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { LeadFinderState, LeadStatus, VaJobLead } from "./leadFinderTypes"
import { searchRedditLeads } from "./redditLeadSearch"

const STORAGE_KEY = "moodna-lead-finder-v1"

const demoLeads: VaJobLead[] = [
  {
    id: "demo_upwork_1",
    source: "upwork",
    title: "Need VA for DMCA takedowns on Amazon & eBay listings",
    snippet: "Looking for someone experienced with brand protection and filing copyright claims on marketplaces.",
    url: "https://www.upwork.com/nx/search/jobs/?q=DMCA%20takedown",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    intentScore: 88,
    matchedKeywords: ["dmca", "takedown", "brand protection", "virtual assistant"],
    status: "new",
    notes: "",
    discoveredAt: new Date().toISOString(),
  },
  {
    id: "demo_reddit_1",
    source: "reddit",
    title: "Hiring VA to remove OnlyFans leaks from Reddit/Telegram?",
    snippet: "Tired of doing DMCAs manually. Need someone to monitor and send takedowns weekly.",
    url: "https://www.reddit.com/r/onlyfansadvice/search/?q=hire%20va%20leaks",
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    intentScore: 92,
    matchedKeywords: ["onlyfans", "leak", "dmca", "virtual assistant", "hire"],
    status: "new",
    notes: "",
    discoveredAt: new Date().toISOString(),
  },
]

function mergeLeads(existing: VaJobLead[], incoming: VaJobLead[]) {
  const byId = new Map(existing.map((lead) => [lead.id, lead]))

  for (const lead of incoming) {
    const current = byId.get(lead.id)
    byId.set(lead.id, current ? { ...lead, status: current.status, notes: current.notes } : lead)
  }

  return [...byId.values()].sort(
    (left, right) =>
      right.intentScore - left.intentScore ||
      new Date(right.postedAt).getTime() - new Date(left.postedAt).getTime(),
  )
}

function loadState(): LeadFinderState {
  if (typeof window === "undefined") {
    return { leads: demoLeads, lastQuery: "hire virtual assistant DMCA takedown" }
  }

  const storedRaw = window.localStorage.getItem(STORAGE_KEY)
  if (!storedRaw) {
    return { leads: demoLeads, lastQuery: "hire virtual assistant DMCA takedown" }
  }

  try {
    const stored = JSON.parse(storedRaw) as LeadFinderState
    return {
      ...stored,
      leads: mergeLeads(demoLeads, stored.leads),
    }
  } catch {
    return { leads: demoLeads, lastQuery: "hire virtual assistant DMCA takedown" }
  }
}

let state = loadState()
const listeners = new Set<() => void>()

function persist(nextState: LeadFinderState) {
  state = nextState
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function useLeadFinderStore() {
  const leadState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const fetchRedditLeads = useCallback(async (query: string) => {
    const results = await searchRedditLeads(query)
    persist({
      ...state,
      leads: mergeLeads(state.leads, results),
      lastQuery: query,
      lastFetchedAt: new Date().toISOString(),
    })
    return results
  }, [])

  const importLead = useCallback((lead: VaJobLead) => {
    persist({
      ...state,
      leads: mergeLeads(state.leads, [lead]),
    })
  }, [])

  const updateLeadStatus = useCallback((leadId: string, status: LeadStatus) => {
    persist({
      ...state,
      leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)),
    })
  }, [])

  const updateLeadNotes = useCallback((leadId: string, notes: string) => {
    persist({
      ...state,
      leads: state.leads.map((lead) => (lead.id === leadId ? { ...lead, notes } : lead)),
    })
  }, [])

  return useMemo(
    () => ({
      ...leadState,
      fetchRedditLeads,
      importLead,
      updateLeadStatus,
      updateLeadNotes,
    }),
    [leadState, fetchRedditLeads, importLead, updateLeadStatus, updateLeadNotes],
  )
}
