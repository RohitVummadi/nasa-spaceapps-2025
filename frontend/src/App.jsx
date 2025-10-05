// frontend/src/App.jsx
/**
 * AirAware + CleanMap Frontend
 * This React app displays a map with real-time air quality and weather data
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix Leaflet default marker icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function App() {
  // State variables to manage our app's data
  const [userLocation, setUserLocation] = useState(null); // Stores user's coordinates
  const [airQualityData, setAirQualityData] = useState(null); // Stores API response
  const [loading, setLoading] = useState(true); // Shows loading state
  const [error, setError] = useState(null); // Stores error messages
  const [lastUpdate, setLastUpdate] = useState(null); // Tracks last refresh time
  const [searchQuery, setSearchQuery] = useState(''); // Stores city search input
  const [searchResults, setSearchResults] = useState([]); // Stores search results
  const [isSearching, setIsSearching] = useState(false); // Loading state for search
  const [showResults, setShowResults] = useState(false); // Show/hide search dropdown
  
  // useRef to store the interval ID so we can clear it later
  const refreshIntervalRef = useRef(null);
  const searchBoxRef = useRef(null);

  /**
   * Create a colored marker icon based on AQI category
   * Green = Good, Yellow = Moderate, Orange = Unhealthy, Red = Very Unhealthy
   */
  const getColoredIcon = (category) => {
    // Choose color based on air quality category
    let color = '#808080'; // Default gray
    
    if (category) {
      if (category.includes('Good')) color = '#00e400';
      else if (category.includes('Moderate')) color = '#ffff00';
      else if (category.includes('Unhealthy for')) color = '#ff7e00';
      else if (category.includes('Very Unhealthy')) color = '#ff0000';
      else if (category.includes('Unhealthy')) color = '#ff7e00';
      else if (category.includes('Hazardous')) color = '#7e0023';
    }

    // Create a custom HTML marker with the chosen color
    const markerHtmlStyles = `
      background-color: ${color};
      width: 2.5rem;
      height: 2.5rem;
      display: block;
      left: -1.25rem;
      top: -1.25rem;
      position: relative;
      border-radius: 2.5rem 2.5rem 0;
      transform: rotate(45deg);
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
    `;

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<span style="${markerHtmlStyles}" />`,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });
  };

  /**
   * Fetch air quality and weather data from our Flask backend
   * This function calls our API endpoint with the user's coordinates
   */
  const fetchAirQualityData = async (lat, lon) => {
    console.log(`🔍 Fetching data for coordinates: ${lat}, ${lon}`);
    setLoading(true);
    setError(null);
    
    try {
      // Call our Flask backend API
      // The backend will fetch data from OpenAQ and OpenWeatherMap
      const response = await fetch(
        `http://localhost:5000/api/airquality?lat=${lat}&lon=${lon}`
      );

      // Check if the request was successful
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Parse the JSON response
      const data = await response.json();
      console.log('📊 Data received:', data);
      
      // Store the data in state
      setAirQualityData(data);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setError('Could not fetch air quality data. Make sure the Flask server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get the user's current location using the browser's Geolocation API
   */
  const getUserLocation = () => {
    console.log('📍 Getting user location...');
    
    // Check if the browser supports geolocation
    if (!navigator.geolocation) {
      setError('Your browser does not support geolocation');
      setLoading(false);
      return;
    }

    // Request the user's current position
    navigator.geolocation.getCurrentPosition(
      // Success callback - we got the location!
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log('✅ Location found:', coords);
        setUserLocation(coords);
        
        // Now fetch air quality data for this location
        fetchAirQualityData(coords.lat, coords.lng);
      },
      
      // Error callback - something went wrong
      (error) => {
        console.error('❌ Location error:', error);
        setError('Could not get your location. Please enable location services.');
        
        // Use a default location (Atlanta, GA) as fallback
        const defaultCoords = { lat: 33.749, lng: -84.388 };
        setUserLocation(defaultCoords);
        fetchAirQualityData(defaultCoords.lat, defaultCoords.lng);
      }
    );
  };

  /**
   * Set up the component when it first loads
   * This runs once when the app starts
   */
  useEffect(() => {
    // Get initial location and data
    getUserLocation();

    // Set up automatic refresh every 5 minutes (300,000 milliseconds)
    console.log('⏰ Setting up 5-minute auto-refresh...');
    
    refreshIntervalRef.current = setInterval(() => {
      console.log('🔄 Auto-refreshing data (5-minute interval)');
      
      // If we have a location, refresh the data
      if (userLocation) {
        fetchAirQualityData(userLocation.lat, userLocation.lng);
      }
    }, 300000); // 300,000 ms = 5 minutes

    // Cleanup function - runs when component unmounts
    return () => {
      console.log('🧹 Cleaning up refresh interval');
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []); // Empty array means this runs once on mount

  /**
   * Manual refresh button handler
   */
  const handleManualRefresh = () => {
    if (userLocation) {
      console.log('🔄 Manual refresh triggered');
      fetchAirQualityData(userLocation.lat, userLocation.lng);
    }
  };

  /**
   * Handle city search
   */
  const handleCitySearch = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Import the searchCity function
      const { searchCity } = await import('./utils/api');
      const results = await searchCity(query);
      setSearchResults(results);
      setShowResults(true);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handle selecting a city from search results
   */
  const handleCitySelect = (result) => {
    const coords = {
      lat: result.lat,
      lng: result.lon
    };
    
    console.log('📍 Selected city:', result.name, coords);
    setUserLocation(coords);
    fetchAirQualityData(coords.lat, coords.lng);
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  /**
   * Handle search input changes with debouncing
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleCitySearch(searchQuery);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  /**
   * Close search results when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          🌍 AirAware + CleanMap
        </h1>
        
        {/* Search Bar */}
        <div style={{ 
          marginTop: '1rem', 
          position: 'relative',
          maxWidth: '500px'
        }} ref={searchBoxRef}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search for a city..."
              style={{
                width: '100%',
                padding: '0.75rem 2.5rem 0.75rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '1rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                outline: 'none'
              }}
            />
            {isSearching && (
              <div style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.2rem'
              }}>
                ⏳
              </div>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              borderRadius: '0.5rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxHeight: '300px',
              overflowY: 'auto',
              zIndex: 1000
            }}>
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  onClick={() => handleCitySelect(result)}
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderBottom: index < searchResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                    color: '#374151',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
                  onMouseLeave={(e) => e.target.style.background = 'white'}
                >
                  <div style={{ fontWeight: '500' }}>📍 {result.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {result.lat.toFixed(4)}, {result.lon.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {showResults && searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              borderRadius: '0.5rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '1rem',
              color: '#6b7280',
              textAlign: 'center',
              zIndex: 1000
            }}>
              No cities found. Try a different search.
            </div>
          )}
        </div>
        
        {/* Status and controls */}
        <div style={{ 
          marginTop: '0.75rem', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {loading && <span>⏳ Loading...</span>}
            {!loading && lastUpdate && (
              <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={getUserLocation}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#667eea',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontWeight: '500'
              }}
            >
              📍 My Location
            </button>
            
            <button
              onClick={handleManualRefresh}
              disabled={loading || !userLocation}
              style={{
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontWeight: '500'
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        
        {/* Auto-refresh indicator */}
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
          ⏰ Auto-refreshes every 5 minutes
        </div>
        
        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '0.5rem',
            marginTop: '0.5rem',
            borderRadius: '0.25rem'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div style={{ flex: 1, position: 'relative' }}>
        {userLocation ? (
          <MapContainer 
            center={[userLocation.lat, userLocation.lng]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
          >
            {/* OpenStreetMap tiles */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* Marker at user location */}
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={getColoredIcon(airQualityData?.category)}
            >
              {/* Popup with air quality and weather data */}
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>
                    📍 {airQualityData?.city || 'Loading...'}
                  </h3>
                  
                  {airQualityData ? (
                    <>
                      {/* Air Quality Section */}
                      <div style={{ marginBottom: '10px' }}>
                        <strong>🌫️ Air Quality</strong>
                        <div style={{ marginLeft: '10px', fontSize: '0.9rem' }}>
                          <div>AQI: <strong>{airQualityData.aqi || 'N/A'}</strong> ({airQualityData.category})</div>
                          <div>PM2.5: {airQualityData.pm25 || 'N/A'} μg/m³</div>
                        </div>
                      </div>
                      
                      {/* Weather Section */}
                      <div>
                        <strong>☁️ Weather</strong>
                        <div style={{ marginLeft: '10px', fontSize: '0.9rem' }}>
                          <div>Temp: {airQualityData.temperature || 'N/A'}°C</div>
                          <div>Humidity: {airQualityData.humidity || 'N/A'}%</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>Loading data...</div>
                  )}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <div>📍 Getting your location...</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        <strong>AQI Scale</strong>
        <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>
          <div>🟢 Good (0-50)</div>
          <div>🟡 Moderate (51-100)</div>
          <div>🟠 Unhealthy for Sensitive (101-150)</div>
          <div>🔴 Unhealthy (151-200)</div>
        </div>
      </div>
    </div>
  );
}

export default App;