import { bookingConfig, getEmbedUrl, isBookingConfigured, isIClosedUrl } from "../../config/booking"
import { useIClosedScript } from "./useIClosedScript"

export function BookingWidget({ compact = false }: { compact?: boolean }) {
  const configured = isBookingConfigured()
  const useIClosed = configured && isIClosedUrl(bookingConfig.url)
  const widgetClass = `booking-widget mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 border-line${compact ? "" : " mt-12"}`

  useIClosedScript(useIClosed)

  if (!configured) {
    return (
      <div className={`${widgetClass} bg-surface`}>
        <div className="border-b border-line bg-elevated px-6 py-4">
          <p className="text-sm font-semibold text-text">Schedule your free threat report</p>
          <p className="mt-1 text-xs text-muted">15 minutes · No credit card required</p>
        </div>
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-muted">
            Add your iClosed or Calendly booking link to{" "}
            <code className="text-accent-light">.env</code>:
          </p>
          <pre className="mx-auto mt-4 max-w-md overflow-x-auto rounded-xl border border-line bg-base px-4 py-3 text-left font-mono text-[11px] text-muted">
            VITE_BOOKING_URL=https://app.iclosed.io/e/YourOrg/your-event
          </pre>
          <p className="mt-4 text-xs text-faint">
            Same setup as{" "}
            <a
              href="https://bustem.com/"
              className="text-accent-light underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bustem
            </a>{" "}
            — copy the inline embed URL from your iClosed event settings.
          </p>
        </div>
      </div>
    )
  }

  if (useIClosed) {
    return (
      <div className={`${widgetClass} bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]`}>
        <div
          className="iclosed-widget min-h-[720px] w-full"
          data-url={bookingConfig.url}
          title={bookingConfig.title}
        />
      </div>
    )
  }

  return (
    <div className={`${widgetClass} bg-white shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]`}>
      <iframe
        title={bookingConfig.title}
        src={getEmbedUrl(bookingConfig.url)}
        className="w-full border-0 bg-white"
        style={{ height: bookingConfig.inlineHeight }}
        allow="camera; microphone; autoplay; encrypted-media; fullscreen"
      />
    </div>
  )
}
