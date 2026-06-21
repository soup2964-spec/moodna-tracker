import { useEffect } from "react"

const ICLOSED_SCRIPT = "https://app.iclosed.io/assets/widget.js"

let scriptPromise: Promise<void> | null = null

export function loadIClosedScript() {
  if (typeof window === "undefined") return Promise.resolve()

  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${ICLOSED_SCRIPT}"]`)
    if (existing) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = ICLOSED_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load iClosed widget script"))
    document.body.appendChild(script)
  })

  return scriptPromise
}

export function useIClosedScript(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    loadIClosedScript().catch(() => {
      // Widget script failed — iframe fallback still available in BookingWidget
    })
  }, [enabled])
}
