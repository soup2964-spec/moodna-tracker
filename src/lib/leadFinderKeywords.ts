import type { LeadSearchTemplate, LeadSource, VaJobLead } from "./leadFinderTypes"

export const HIGH_INTENT_KEYWORDS = [
  "dmca",
  "takedown",
  "brand protection",
  "counterfeit",
  "copycat",
  "hijacker",
  "ip enforcement",
  "onlyfans",
  "leak",
  "leaks",
  "stolen content",
  "piracy",
  "virtual assistant",
  " va ",
  "hire",
  "hiring",
  "looking for",
  "need someone",
  "remove",
  "monitoring",
  "amazon seller",
  "marketplace",
  "infringement",
  "copyright",
  "trademark",
]

export const LOW_INTENT_KEYWORDS = [
  "data entry",
  "customer support",
  "bookkeeping",
  "social media posts",
  "instagram captions",
  "general admin",
]

export const leadSearchTemplates: LeadSearchTemplate[] = [
  {
    id: "dmca-va",
    label: "DMCA / takedown VA",
    description: "People hiring help to file takedowns and remove stolen listings.",
    query: "hire virtual assistant DMCA takedown",
  },
  {
    id: "brand-protection",
    label: "Brand protection VA",
    description: "Counterfeit monitoring and copycat hunting roles.",
    query: "virtual assistant brand protection counterfeit",
  },
  {
    id: "amazon-hijacker",
    label: "Amazon hijacker help",
    description: "Sellers looking for someone to fight unauthorized listings.",
    query: "hire VA amazon hijacker counterfeit listing",
  },
  {
    id: "onlyfans-leaks",
    label: "OnlyFans leak removal",
    description: "Creators trying to hire help removing leaked content.",
    query: "hire remove OnlyFans leaks DMCA",
  },
  {
    id: "creator-piracy",
    label: "Creator piracy monitoring",
    description: "Creators asking for leak monitoring across Reddit/Telegram.",
    query: "need someone monitor leaks telegram reddit creator",
  },
  {
    id: "ip-enforcement",
    label: "IP enforcement assistant",
    description: "Broader IP enforcement and infringement monitoring posts.",
    query: "IP enforcement virtual assistant infringement monitoring",
  },
]

const sourceLabels: Record<LeadSource, string> = {
  upwork: "Upwork",
  reddit: "Reddit",
  onlinejobs: "OnlineJobs.ph",
  linkedin: "LinkedIn",
  facebook: "Facebook Groups",
  google: "Google",
}

export function getLeadSourceLabel(source: LeadSource) {
  return sourceLabels[source]
}

export function buildSearchUrl(source: LeadSource, query: string) {
  const encoded = encodeURIComponent(query)

  switch (source) {
    case "upwork":
      return `https://www.upwork.com/nx/search/jobs/?q=${encoded}&sort=recency`
    case "reddit":
      return `https://www.reddit.com/search/?q=${encoded}&sort=new`
    case "onlinejobs":
      return `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${encoded}`
    case "linkedin":
      return `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/jobs OR site:linkedin.com/posts ${query}`)}`
    case "facebook":
      return `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com/groups ${query}`)}`
    case "google":
      return `https://www.google.com/search?q=${encoded}&tbs=qdr:w`
  }
}

export function scoreLeadIntent(text: string) {
  const normalized = ` ${text.toLowerCase()} `
  const matchedKeywords = HIGH_INTENT_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()))
  const lowIntentHits = LOW_INTENT_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()))

  let score = 35 + matchedKeywords.length * 9
  if (normalized.includes("hire") || normalized.includes("hiring") || normalized.includes("looking for")) {
    score += 12
  }
  if (normalized.includes("virtual assistant") || normalized.includes(" va ")) {
    score += 10
  }
  score -= lowIntentHits.length * 15

  return {
    intentScore: Math.max(0, Math.min(100, score)),
    matchedKeywords,
  }
}

export function buildOutreachMessage(lead: VaJobLead) {
  const taskHint = lead.matchedKeywords.includes("onlyfans") || lead.matchedKeywords.includes("leak")
    ? "leak monitoring and DMCA takedowns"
    : lead.matchedKeywords.includes("amazon") || lead.matchedKeywords.includes("counterfeit")
      ? "counterfeit monitoring and marketplace takedowns"
      : "brand protection and takedown work"

  return [
    `Saw your post about hiring help with ${taskHint}.`,
    "",
    "We run this on autopilot with Moodna — paste your brand or creator link, we scan marketplaces and piracy sources, human-review hits, then file takedowns.",
    "",
    "Usually faster and cheaper than training a VA. Happy to run a free threat scan if useful.",
  ].join("\n")
}

export function leadIntentLabel(score: number) {
  if (score >= 80) return "Hot"
  if (score >= 60) return "Warm"
  if (score >= 40) return "Maybe"
  return "Low"
}

export function leadIntentClass(score: number) {
  if (score >= 80) return "bg-red-50 text-red-700"
  if (score >= 60) return "bg-amber-50 text-amber-800"
  if (score >= 40) return "bg-neutral-100 text-neutral-700"
  return "bg-neutral-50 text-neutral-500"
}
