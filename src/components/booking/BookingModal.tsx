import { useEffect } from "react"
import { bookingConfig, isBookingConfigured } from "../../config/booking"

type BookingModalProps = {
  open: boolean
  onClose: () => void
}

export function BookingModal({ open, onClose }: BookingModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onClose])

  if (!open || !isBookingConfigured()) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Book a sales call"
      onClick={onClose}
    >
      <div
        className="premium-card premium-card-glow relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden sm:h-[85vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-sm font-medium">Book a free strategy call</p>
            <p className="text-xs text-faint">15 minutes · No credit card</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-hover hover:text-text"
          >
            Close
          </button>
        </div>

        <iframe
          title="Book a sales call"
          src={bookingConfig.url}
          className="min-h-0 flex-1 w-full border-0 bg-white"
          allow="camera; microphone; autoplay; encrypted-media; fullscreen"
        />
      </div>
    </div>
  )
}
