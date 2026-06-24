import { env, hasPublicWww } from "./env.js"

const PUBLICWWW_BASE = "https://publicwww.com/websites"

export type PublicWwwResult = {
  site: string
  rank: number
  snippet?: string
}

function parseCsvLine(line: string, withSnippets: boolean): PublicWwwResult | null {
  const parts = line.split(";")
  if (parts.length < 2) return null

  const site = parts[0]?.trim()
  const rank = Number(parts[1])
  if (!site || Number.isNaN(rank)) return null

  return {
    site,
    rank,
    snippet: withSnippets ? parts.slice(2).join(";").trim() || undefined : undefined,
  }
}

export async function searchPublicWww(
  query: string,
  options: { snippets?: boolean; maxResults?: number } = {},
): Promise<PublicWwwResult[]> {
  if (!hasPublicWww()) {
    throw new Error("PUBLICWWW_API_KEY is not configured")
  }

  const encodedQuery = encodeURIComponent(query)
  const exportFormat = options.snippets ? "csvsnippets" : "csv"
  const url = `${PUBLICWWW_BASE}/${encodedQuery}/?key=${encodeURIComponent(env.publicWwwApiKey)}&export=${exportFormat}`

  const response = await fetch(url, {
    headers: { Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `PublicWWW request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    )
  }

  const text = await response.text()
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const withSnippets = Boolean(options.snippets)
  const maxResults = options.maxResults ?? 100

  const results: PublicWwwResult[] = []
  for (const line of lines) {
    const parsed = parseCsvLine(line, withSnippets)
    if (!parsed) continue
    results.push(parsed)
    if (results.length >= maxResults) break
  }

  return results
}
