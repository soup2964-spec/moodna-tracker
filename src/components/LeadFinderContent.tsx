import { useMemo, useState } from "react"
import {
  buildOutreachMessage,
  buildSearchUrl,
  getLeadSourceLabel,
  leadIntentClass,
  leadIntentLabel,
  leadSearchTemplates,
} from "../lib/leadFinderKeywords"
import { useLeadFinderStore } from "../lib/leadFinderStore"
import type { LeadSource, LeadStatus, VaJobLead } from "../lib/leadFinderTypes"

const prospectSources: LeadSource[] = ["upwork", "reddit", "onlinejobs", "linkedin", "facebook", "google"]

const statusOptions: LeadStatus[] = ["new", "saved", "contacted", "disqualified"]

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function LeadCard({
  lead,
  onStatusChange,
  onNotesChange,
}: {
  lead: VaJobLead
  onStatusChange: (status: LeadStatus) => void
  onNotesChange: (notes: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const outreach = useMemo(() => buildOutreachMessage(lead), [lead])

  async function copyOutreach() {
    await navigator.clipboard.writeText(outreach)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
              {getLeadSourceLabel(lead.source)}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${leadIntentClass(lead.intentScore)}`}>
              {leadIntentLabel(lead.intentScore)} · {lead.intentScore}
            </span>
            <span className="text-[11px] text-neutral-400">{formatWhen(lead.postedAt)}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-neutral-900">{lead.title}</h3>
          <p className="mt-1 text-sm text-neutral-600">{lead.snippet}</p>
          {lead.matchedKeywords.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              Matched: {lead.matchedKeywords.slice(0, 6).join(", ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={lead.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300"
          >
            Open post
          </a>
          <button
            type="button"
            onClick={copyOutreach}
            className="rounded-full bg-[#e2c523] px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-[#c9a818]"
          >
            {copied ? "Copied" : "Copy outreach"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={lead.status}
          onChange={(event) => onStatusChange(event.target.value as LeadStatus)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <input
          value={lead.notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Notes (budget, reply sent, follow-up date...)"
          className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400"
        />
      </div>
    </article>
  )
}

export function LeadFinderContent() {
  const leadFinder = useLeadFinderStore()
  const [query, setQuery] = useState(leadFinder.lastQuery)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all")
  const [minScore, setMinScore] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const filteredLeads = leadFinder.leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status !== statusFilter) return false
    return lead.intentScore >= minScore
  })

  async function runRedditSearch(searchQuery = query) {
    setLoading(true)
    setError("")
    try {
      await leadFinder.fetchRedditLeads(searchQuery.trim())
      setQuery(searchQuery)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Reddit search failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">VA job lead finder</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-500">
          Find people already trying to hire a VA for DMCA work, brand protection, or leak removal.
          Run live Reddit scans here, then open one-click searches on Upwork, OnlineJobs.ph, LinkedIn, and Facebook groups.
        </p>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="hire virtual assistant DMCA takedown"
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="button"
            disabled={loading || !query.trim()}
            onClick={() => runRedditSearch()}
            className="rounded-xl bg-[#e2c523] px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition-colors hover:bg-[#c9a818] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Scanning Reddit..." : "Scan Reddit live"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {leadFinder.lastFetchedAt && (
          <p className="mt-3 text-xs text-neutral-400">
            Last Reddit scan: {formatWhen(leadFinder.lastFetchedAt)} · Query: {leadFinder.lastQuery}
          </p>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-900">Quick searches</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {leadSearchTemplates.map((template) => (
              <div key={template.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-900">{template.label}</p>
                <p className="mt-1 text-xs text-neutral-500">{template.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(template.query)
                      runRedditSearch(template.query)
                    }}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300"
                  >
                    Scan Reddit
                  </button>
                  {prospectSources.slice(0, 3).map((source) => (
                    <a
                      key={source}
                      href={buildSearchUrl(source, template.query)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300"
                    >
                      {getLeadSourceLabel(source)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900">Open searches on every platform</h3>
        <p className="mt-1 text-xs text-neutral-500">Uses your current query: “{query || leadFinder.lastQuery}”</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {prospectSources.map((source) => (
            <a
              key={source}
              href={buildSearchUrl(source, query || leadFinder.lastQuery)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-300"
            >
              Search {getLeadSourceLabel(source)}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Lead inbox</h3>
            <p className="mt-1 text-xs text-neutral-500">
              {filteredLeads.length} leads · sorted by intent score
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-neutral-600">
              Min score: <span className="font-semibold text-neutral-900">{minScore}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(event) => setMinScore(Number(event.target.value))}
                className="mt-1 block w-40"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as LeadStatus | "all")}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs outline-none focus:border-amber-400"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredLeads.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              No leads match your filters. Run a Reddit scan or open Upwork/LinkedIn searches above.
            </p>
          ) : (
            filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onStatusChange={(status) => leadFinder.updateLeadStatus(lead.id, status)}
                onNotesChange={(notes) => leadFinder.updateLeadNotes(lead.id, notes)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
