import React, { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom hook to handle map center updates
function MapUpdater({ center }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

// Custom hook for auto-refresh functionality
function useAutoRefresh(refreshFunction, interval = 300000) { // 5 minutes = 300,000 ms
  const intervalRef = useRef(null)
  
  useEffect(() => {
    // Set up the interval
    intervalRef.current = setInterval(refreshFunction, interval)
    
    // Clean up on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshFunction, interval])
  
  return intervalRef
}

const Map = () => {
  // State for user's location and data
  const [userLocation, setUserLocation] = useState([51.505, -0.09]) // Default to London
  const [airQualityData, setAirQualityData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  // Function to fetch air quality data
  const fetchAirQualityData = async (lat, lon) => {
    try {
      setLoading(true)
      console.log(`Fetching data for: ${lat}, ${lon}`)
      
      const response = await fetch(`/api/airquality?lat=${lat}&lon=${lon}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setAirQualityData(data)
      setError('')
      setLastUpdated(new Date())
      console.log('Data fetched successfully:', data)
      
    } catch (err) {
      console.error('Error fetching air quality data:', err)
      setError(`Failed to load data: ${err.message}`)
      setAirQualityData(null)
    } finally {
      setLoading(false)
    }
  }

  // Get user's location when component mounts
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          console.log(`User location found: ${latitude}, ${longitude}`)
          setUserLocation([latitude, longitude])
          fetchAirQualityData(latitude, longitude)
        },
        (err) => {
          console.error('Error getting location:', err)
          setError('Please enable location services for accurate data')
          // Try with default location
          fetchAirQualityData(userLocation[0], userLocation[1])
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    } else {
      setError('Geolocation is not supported by this browser')
      // Try with default location
      fetchAirQualityData(userLocation[0], userLocation[1])
    }
  }, [])

  // Set up auto-refresh every 5 minutes
  useAutoRefresh(() => {
    if (userLocation) {
      console.log('Auto-refreshing data...')
      fetchAirQualityData(userLocation[0], userLocation[1])
    }
  }, 300000) // 5 minutes

  // Function to get marker color based on AQI
  const getMarkerColor = (aqi) => {
    if (aqi <= 50) return 'green'
    if (aqi <= 100) return 'yellow'
    if (aqi <= 150) return 'orange'
    return 'red'
  }

  // Create custom icon based on AQI
  const createCustomIcon = (aqi) => {
    const color = getMarkerColor(aqi)
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
  }

  if (loading && !airQualityData) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your location and air quality data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      {/* Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-2">
            {error}
          </div>
        )}
        {lastUpdated && (
          <div className="bg-white bg-opacity-90 px-4 py-2 rounded shadow text-sm">
            Last updated: {lastUpdated.toLocaleTimeString()} | Auto-refresh every 5 minutes
          </div>
        )}
      </div>

      {/* Map Container */}
      <MapContainer
        center={userLocation}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <MapUpdater center={userLocation} />
        
        {/* OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User Location Marker */}
        {airQualityData && (
          <Marker 
            position={userLocation}
            icon={createCustomIcon(airQualityData.air_quality.aqi)}
          >
            <Popup className="custom-popup">
              <div className="min-w-[200px]">
                <h3 className="font-bold text-lg mb-2 border-b pb-1">
                  📍 {airQualityData.location.city}
                </h3>
                
                {/* Air Quality Info */}
                <div className="mb-3">
                  <h4 className="font-semibold text-gray-700">Air Quality</h4>
                  <div className="flex items-center justify-between mt-1">
                    <span>AQI: <strong>{airQualityData.air_quality.aqi}</strong></span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      airQualityData.air_quality.aqi <= 50 ? 'bg-green-100 text-green-800' :
                      airQualityData.air_quality.aqi <= 100 ? 'bg-yellow-100 text-yellow-800' :
                      airQualityData.air_quality.aqi <= 150 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {airQualityData.air_quality.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    PM2.5: {airQualityData.air_quality.pm25} µg/m³
                  </p>
                </div>
                
                {/* Weather Info */}
                <div>
                  <h4 className="font-semibold text-gray-700">Weather</h4>
                  <div className="grid grid-cols-2 gap-2 mt-1 text-sm">
                    <div>🌡️ Temp: <strong>{airQualityData.weather.temperature}°C</strong></div>
                    <div>💧 Humidity: <strong>{airQualityData.weather.humidity}%</strong></div>
                    <div>💨 Wind: <strong>{airQualityData.weather.wind_speed} m/s</strong></div>
                    <div className="col-span-2">
                      Condition: <strong>{airQualityData.weather.description}</strong>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 pt-2 border-t text-xs text-gray-500 text-center">
                  Updated: {airQualityData.air_quality.last_updated}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Refresh Button */}
      <button
        onClick={() => userLocation && fetchAirQualityData(userLocation[0], userLocation[1])}
        className="absolute bottom-4 right-4 z-[1000] bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg transition-colors"
        disabled={loading}
      >
        {loading ? 'Refreshing...' : 'Refresh Now'}
      </button>
    </div>
  )
}

export default Map