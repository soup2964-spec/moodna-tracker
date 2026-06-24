export const env = {
  port: Number(process.env.PORT ?? 8787),
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  organizationId: process.env.MOODNA_ORG_ID ?? "",
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
  schedulerSecret: process.env.SCHEDULER_SECRET ?? "",
  scanAmTime: process.env.SCAN_AM_TIME ?? "09:00",
  scanPmTime: process.env.SCAN_PM_TIME ?? "21:00",
  scanTimezone: process.env.SCAN_TIMEZONE ?? "UTC",
  firecrawlIntakeMaxPages: Number(process.env.FIRECRAWL_INTAKE_MAX_PAGES ?? 12),
  kieAiApiKey: process.env.KIE_AI_API_KEY ?? "",
  kieGeminiModel: process.env.KIE_GEMINI_MODEL ?? "gemini-3-5-flash",
  publicWwwApiKey: process.env.PUBLICWWW_API_KEY ?? "",
  serperApiKey: process.env.SERPER_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  dmcaFromEmail: process.env.DMCA_FROM_EMAIL ?? "Moodna DMCA <dmca@moodna.local>",
  dmcaReplyToEmail: process.env.DMCA_REPLY_TO_EMAIL ?? "",
  dmcaAutoSubmit: process.env.DMCA_AUTO_SUBMIT === "true",
}

export function hasPublicWww() {
  return env.publicWwwApiKey.length > 10
}

export function hasSerper() {
  return env.serperApiKey.length > 10
}

export function hasKieAi() {
  return env.kieAiApiKey.length > 10
}

export function hasSupabase() {
  return env.supabaseUrl.startsWith("https://") && env.supabaseServiceRoleKey.length > 20
}

export function hasFirecrawl() {
  return env.firecrawlApiKey.length > 10
}

export function hasCopycatSearch() {
  return hasPublicWww() || hasSerper()
}

export function hasResend() {
  return env.resendApiKey.length > 10 && env.dmcaFromEmail.includes("@")
}
