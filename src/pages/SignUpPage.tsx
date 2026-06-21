import { SignUp } from "@clerk/clerk-react"
import { AuthPageShell } from "../components/auth/AuthPageShell"
import { AuthSetupNotice } from "../components/auth/AuthSetupNotice"
import { isClerkConfigured } from "../config/clerk"
import { moodnaClerkAppearance } from "../lib/clerkAppearance"

export function SignUpPage() {
  return (
    <AuthPageShell
      title="Create your account"
      subtitle="Start protecting your brand with Moodna — sign up in under a minute."
    >
      {isClerkConfigured() ? (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/login"
          appearance={moodnaClerkAppearance}
        />
      ) : (
        <AuthSetupNotice mode="sign-up" />
      )}
    </AuthPageShell>
  )
}
