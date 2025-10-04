import React from 'react';
import Map from './components/Map';
import PollutantCard from './PollutantCard';
import Weather from './Weather';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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
      
      {/* Main Map Component with right sidebar for pollutant cards */}
      <main className="h-[calc(100vh-80px)] container mx-auto px-4">
        <div className="flex h-full gap-4">
          {/* Map area - flex-grow */}
          <div className="flex-1 rounded-lg overflow-hidden shadow">
            <Map />
          </div>

          {/* Sidebar with pollutant cards */}
          <aside className="w-80 bg-white/80 rounded-lg p-4 shadow-md overflow-auto">
            <h2 className="text-lg font-semibold mb-3">Local Pollutants</h2>
            {/* sample cards - replace with real data later */}
            <PollutantCard name="PM2.5" value={12} unit="µg/m³" status="Good" />
            <PollutantCard name="PM10" value={45} unit="µg/m³" status="Moderate" />
            <PollutantCard name="O3" value={0.070} unit="ppm" status="Moderate" />
          </aside>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white p-2 text-center text-xs">
        <p>NASA Hackathon Project | Data updates every 5 minutes</p>
      </footer>
    </div>
  )
}

export default App