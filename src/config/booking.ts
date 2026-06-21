/**
 * Booking widget config.
 *
 * Bustem uses iClosed inline embed:
 * https://app.iclosed.io/e/YourOrg/your-event-slug
 *
 * Set VITE_BOOKING_URL in `.env` to your public scheduler link.
 */
export const bookingConfig = {
  url: import.meta.env.VITE_BOOKING_URL ?? "",
  title:
    import.meta.env.VITE_BOOKING_TITLE ??
    "Free 15-Min 360° Threat Report",
  mode: (import.meta.env.VITE_BOOKING_MODE ?? "popup") as "popup" | "link",
  inlineHeight: 780,
} as const

export function isBookingConfigured() {
  return bookingConfig.url.length > 0
}

export function isIClosedUrl(url: string) {
  return url.includes("iclosed.io")
}

export function isCalendlyUrl(url: string) {
  return url.includes("calendly.com")
}

export function getEmbedUrl(url: string) {
  if (isCalendlyUrl(url)) {
    const parsed = new URL(url)
    parsed.searchParams.set("embed_type", "Inline")
    return parsed.toString()
  }
  return url
}
