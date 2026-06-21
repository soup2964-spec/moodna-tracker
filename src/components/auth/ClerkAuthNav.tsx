import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react"
import { Link } from "react-router-dom"

export function ClerkAuthNav() {
  return (
    <>
      <SignedOut>
        <Link
          to="/login"
          className="text-[13px] font-medium text-muted transition-colors hover:text-text"
        >
          Login
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </SignedIn>
    </>
  )
}
