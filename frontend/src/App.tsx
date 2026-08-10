import { HashRouter, Route, Routes } from 'react-router-dom'
import Background from './components/Background'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Insights from './pages/Insights'

export default function App() {
  return (
    <HashRouter>
      <Background />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </HashRouter>
  )
}