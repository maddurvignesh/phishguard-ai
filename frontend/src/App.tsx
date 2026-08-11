import { useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Background from './components/Background'
import CinematicIntro from './components/cinematic/CinematicIntro'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import ApiLab from './pages/ApiLab'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Insights from './pages/Insights'
import PhishingLab from './pages/PhishingLab'
import Playground from './pages/Playground'

export default function App() {
  const [showIntro, setShowIntro] = useState(true)

  function handleIntroComplete() {
    setShowIntro(false)
  }

  return (
    <HashRouter>
      {showIntro && <CinematicIntro onComplete={handleIntroComplete} />}
      <Background />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/lab" element={<PhishingLab />} />
            <Route path="/api" element={<ApiLab />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </HashRouter>
  )
}
