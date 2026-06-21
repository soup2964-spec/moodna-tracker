import { scoreLeadIntent } from "./leadFinderKeywords"
import type { VaJobLead } from "./leadFinderTypes"

type RedditListing = {
  data: {
    id: string
    title: string
    selftext?: string
    url: string
    permalink: string
    subreddit: string
    created_utc: number
  }
}

type RedditSearchResponse = {
  data?: {
    children?: RedditListing[]
  }
}

function createLeadId(sourceId: string) {
  return `reddit_${sourceId}`
}

export async function searchRedditLeads(query: string): Promise<VaJobLead[]> {
  const response = await fetch(
    `/api/reddit/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25&type=link`,
  )

  if (!response.ok) {
    throw new Error(`Reddit search failed (${response.status}). Try the external Reddit search link instead.`)
  }

  const payload = (await response.json()) as RedditSearchResponse
  const discoveredAt = new Date().toISOString()

  return (payload.data?.children ?? []).map(({ data }) => {
    const combined = `${data.title} ${data.selftext ?? ""} ${data.subreddit}`
    const { intentScore, matchedKeywords } = scoreLeadIntent(combined)

    return {
      id: createLeadId(data.id),
      source: "reddit" as const,
      title: data.title,
      snippet: data.selftext?.slice(0, 280) || `Posted in r/${data.subreddit}`,
      url: data.url.startsWith("http") ? data.url : `https://www.reddit.com${data.permalink}`,
      postedAt: new Date(data.created_utc * 1000).toISOString(),
      intentScore,
      matchedKeywords,
      status: "new" as const,
      notes: "",
      discoveredAt,
    }
  })
}
