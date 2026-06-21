import { SignIn } from "@clerk/clerk-react"
import { AuthPageShell } from "../components/auth/AuthPageShell"
import { AuthSetupNotice } from "../components/auth/AuthSetupNotice"
import { isClerkConfigured } from "../config/clerk"
import { moodnaClerkAppearance } from "../lib/clerkAppearance"

export function LoginPage() {
  return (
    <AuthPageShell
      title="Welcome back"
      subtitle="Sign in to your Moodna account to track takedowns and protect your brand."
    >
      {isClerkConfigured() ? (
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/sign-up"
          appearance={moodnaClerkAppearance}
        />
      ) : (
        <AuthSetupNotice mode="login" />
      )}
    </AuthPageShell>
  )
}
