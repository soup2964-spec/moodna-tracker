import type { ReactNode } from "react"
import { Link } from "react-router-dom"

type AuthPageShellProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  return (
    <div className="auth-page min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 py-10 sm:px-8">
        <Link to="/" className="mb-10 flex items-center justify-center gap-2">
          <img src="/logo.png" alt="Moodna" className="h-11 w-auto object-contain" />
          <span className="text-lg font-semibold tracking-tight text-neutral-900">Moodna</span>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{subtitle}</p>
        </div>

        <div className="flex flex-1 flex-col justify-center">{children}</div>

        <p className="mt-10 text-center text-xs text-neutral-400">
          <Link to="/" className="hover:text-neutral-600">
            ← Back to moodna.com
          </Link>
        </p>
      </div>
    </div>
  )
}
