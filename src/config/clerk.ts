export const clerkConfig = {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
} as const

export function isClerkConfigured() {
  const key = clerkConfig.publishableKey.trim()
  if (!key.startsWith("pk_test_") && !key.startsWith("pk_live_")) return false
  if (key.includes("...")) return false
  return key.length > 20
}
