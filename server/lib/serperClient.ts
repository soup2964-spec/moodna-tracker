import { env, hasSerper } from "./env.js"

const SERPER_SEARCH_URL = "https://google.serper.dev/search"
const SERPER_LENS_URL = "https://google.serper.dev/lens"

export type SerperOrganicResult = {
  title: string
  link: string
  snippet?: string
}

export type SerperLensResult = {
  title: string
  link: string
  source?: string
  imageUrl?: string
  thumbnailUrl?: string
}

export type SerperLensSearchResult = {
  imageUrl: string
  organic: SerperLensResult[]
}

export type SerperSearchResult = {
  query: string
  organic: SerperOrganicResult[]
}

export async function searchSerper(query: string, num = 10): Promise<SerperSearchResult> {
  if (!hasSerper()) {
    throw new Error("SERPER_API_KEY is not configured")
  }

  const response = await fetch(SERPER_SEARCH_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": env.serperApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: Math.min(Math.max(num, 1), 20) }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Serper request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    )
  }

  const payload = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>
  }

  return {
    query,
    organic: (payload.organic ?? [])
      .filter((row) => row.title && row.link)
      .map((row) => ({
        title: row.title!,
        link: row.link!,
        snippet: row.snippet,
      })),
  }
}

export async function searchSerperLens(
  imageUrl: string,
  options?: { gl?: string; hl?: string; num?: number },
): Promise<SerperLensSearchResult> {
  if (!hasSerper()) {
    throw new Error("SERPER_API_KEY is not configured")
  }

  const response = await fetch(SERPER_LENS_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": env.serperApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: imageUrl,
      gl: options?.gl ?? "us",
      hl: options?.hl ?? "en",
      num: Math.min(Math.max(options?.num ?? 10, 1), 20),
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Serper Lens request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    )
  }

  const payload = (await response.json()) as {
    organic?: Array<{
      title?: string
      link?: string
      source?: string
      imageUrl?: string
      thumbnailUrl?: string
    }>
  }

  return {
    imageUrl,
    organic: (payload.organic ?? [])
      .filter((row) => row.title && row.link)
      .map((row) => ({
        title: row.title!,
        link: row.link!,
        source: row.source,
        imageUrl: row.imageUrl,
        thumbnailUrl: row.thumbnailUrl,
      })),
  }
}
