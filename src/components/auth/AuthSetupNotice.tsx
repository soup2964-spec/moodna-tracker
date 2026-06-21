type AuthSetupNoticeProps = {
  mode: "login" | "sign-up"
}

export function AuthSetupNotice({ mode }: AuthSetupNoticeProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
      <p className="text-sm font-medium text-neutral-900">
        Clerk {mode === "login" ? "sign-in" : "sign-up"} is not configured yet
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Add your publishable key to <code className="text-[#b89415]">.env</code>:
      </p>
      <pre className="mx-auto mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left font-mono text-[11px] text-neutral-600">
        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
      </pre>
      <p className="mt-4 text-xs text-neutral-400">
        Create a free app at{" "}
        <a
          href="https://dashboard.clerk.com"
          className="text-[#b89415] underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          dashboard.clerk.com
        </a>
        , then enable Email and Google sign-in.
      </p>
    </div>
  )
}
