import { DispatcherDashboard } from "@/components/dispatcher-dashboard"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function Index() {
  return (
    <div className="dark">
      <Navbar />
      <main>
        <DispatcherDashboard />
      </main>
      <Footer />
    </div>
  )
}
