import type { MouseEvent, ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { bookingConfig, isBookingConfigured, isIClosedUrl } from "../../config/booking"
import { useBooking } from "./BookingProvider"
import { useIClosedScript } from "./useIClosedScript"

type BookCallButtonProps = {
  children: ReactNode
  className?: string
}

export function BookCallButton({ children, className }: BookCallButtonProps) {
  const { openBooking } = useBooking()
  const configured = isBookingConfigured()
  const iClosed = configured && isIClosedUrl(bookingConfig.url)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useIClosedScript(iClosed && bookingConfig.mode === "popup")

  function scrollToCta() {
    if (pathname !== "/") {
      navigate("/#cta")
      return
    }

    document.getElementById("cta")?.scrollIntoView({ behavior: "smooth" })
    window.history.replaceState(null, "", "#cta")
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!configured) {
      event.preventDefault()
      scrollToCta()
      return
    }

    if (bookingConfig.mode === "popup" && !iClosed) {
      event.preventDefault()
      openBooking()
    }
    // iClosed popup is handled by widget.js via data attributes
  }

  return (
    <a
      href={configured ? bookingConfig.url : "/#cta"}
      onClick={handleClick}
      target={bookingConfig.mode === "link" && configured ? "_blank" : undefined}
      rel={bookingConfig.mode === "link" && configured ? "noopener noreferrer" : undefined}
      className={className}
      {...(iClosed && bookingConfig.mode === "popup"
        ? {
            "data-iclosed-link": bookingConfig.url,
            "data-embed-type": "popup",
          }
        : {})}
    >
      {children}
    </a>
  )
}
