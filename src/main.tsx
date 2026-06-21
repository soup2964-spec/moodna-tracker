import { ClerkProvider } from "@clerk/clerk-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App.tsx"
import { clerkConfig, isClerkConfigured } from "./config/clerk"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isClerkConfigured() ? (
      <ClerkProvider publishableKey={clerkConfig.publishableKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
