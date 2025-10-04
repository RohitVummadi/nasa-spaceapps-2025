import React from 'react'
import Map from './components/Map'

function App() {
  return (
    <div className="h-screen w-screen">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">🌍 AirAware + CleanMap</h1>
          <p className="text-sm opacity-90">Real-time Air Quality & Weather Monitoring</p>
        </div>
      </header>
      
      {/* Main Map Component */}
      <main className="h-[calc(100vh-80px)]">
        <Map />
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white p-2 text-center text-xs">
        <p>NASA Hackathon Project | Data updates every 5 minutes</p>
      </footer>
    </div>
  )
}

export default App