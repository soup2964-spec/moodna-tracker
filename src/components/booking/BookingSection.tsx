import { BookingWidget } from "./BookingWidget"

export function BookingSection() {
  return (
    <section id="cta" className="border-t border-line py-16 md:py-20">
      <div className="section-container">
        <BookingWidget compact />
      </div>
    </section>
  )
}
