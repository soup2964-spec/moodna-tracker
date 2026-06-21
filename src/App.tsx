import { Route, Routes } from "react-router-dom"
import { LoginPage } from "./pages/LoginPage"
import { MarketingSite } from "./pages/MarketingSite"
import { SignUpPage } from "./pages/SignUpPage"

export default function App() {
  return (
    <Routes>
      <Route path="/login/*" element={<LoginPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/*" element={<MarketingSite />} />
    </Routes>
  )
}
