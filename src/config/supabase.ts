export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? "",
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
} as const

export function isSupabaseConfigured() {
  return supabaseConfig.url.startsWith("https://") && supabaseConfig.publishableKey.length > 20
}
