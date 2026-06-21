import { Route, Routes } from "react-router-dom"
import { LoginPage } from "./pages/LoginPage"
import { MarketingSite } from "./pages/MarketingSite"
import { SignUpPage } from "./pages/SignUpPage"
import { TrackerDashboardPage } from "./pages/TrackerDashboardPage"

export default function App() {
  return (
    <Routes>
      <Route path="/dashboard/*" element={<TrackerDashboardPage />} />
      <Route path="/login/*" element={<LoginPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/*" element={<MarketingSite />} />
    </Routes>
  )
}
