import { BookingSection } from "../components/booking/BookingSection"
import { BookingProvider } from "../components/booking/BookingProvider"
import { ScrollToHash } from "../components/ScrollToHash"
import { ComparisonSection } from "../components/ComparisonSection"
import { CostSection } from "../components/CostSection"
import { DetectionSection } from "../components/DetectionSection"
import { FAQ } from "../components/FAQ"
import { Footer } from "../components/Footer"
import { Hero } from "../components/Hero"
import { Navbar } from "../components/Navbar"
import { PlatformsSection } from "../components/PlatformsSection"
import { PathSection } from "../components/Testimonials"

export function MarketingSite() {
  return (
    <BookingProvider>
      <ScrollToHash />
      <div className="relative min-h-screen bg-base">
        <div className="relative z-10">
          <Navbar />
          <main>
            <Hero />
            <BookingSection />
            <CostSection />
            <DetectionSection />
            <ComparisonSection />
            <PlatformsSection />
            <PathSection />
            <FAQ />
          </main>
          <Footer />
        </div>
      </div>
    </BookingProvider>
  )
}
