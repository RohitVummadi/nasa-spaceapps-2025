// frontend/src/App.jsx
/**
 * AirAware + CleanMap Frontend
 * This React app displays a map with real-time air quality and weather data
 */

import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// L.Marker.prototype.options.icon = DefaultIcon; // Removed to prevent white border on custom markers

/**
 * Component to update map view when location changes
 */
function MapUpdater({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, map]);
  
  return null;
}

/**
 * Create pollutant overlay with large base area and "acne-like" high pollution spots
 * Like spots on a face where pollution is highest
 */
const createPollutantHeatMap = (lat, lon, pollutantData, activeLayer) => {
  console.log('createPollutantHeatMap called with:', { lat, lon, pollutantData, activeLayer });
  
  if (!pollutantData) {
    console.log('No pollutant data provided');
    return null;
  }

  const overlays = [];
  const baseValue = pollutantData[activeLayer] || 0;
  
  // Get pollutant-specific colors that match the button colors
  const getPollutantColor = (layer) => {
    const colors = {
      pm25: '#ff6b6b', // red
      pm10: '#ffa726', // orange  
      no2: '#42a5f5',  // blue
      o3: '#66bb6a',   // green
      so2: '#ab47bc',  // purple
      co: '#8d6e63'    // brown
    };
    return colors[layer] || '#778da9';
  };

  const baseColor = getPollutantColor(activeLayer);
  
  // Create a large base area (like the face)
  const baseRadius = 0.05; // degrees (about 5.5km radius)
  const baseCircle = L.circle([lat, lon], {
    radius: baseRadius * 111000, // Convert to meters
    color: baseColor,
    fillColor: baseColor,
    fillOpacity: 0.3, // Light base opacity
    weight: 2,
    className: `pollutant-base-${activeLayer}`
  });
  overlays.push(baseCircle);

  // Define thresholds for each pollutant to determine "acne" spots
  const thresholds = {
    pm25: { low: 12, medium: 35, high: 55 },
    no2: { low: 40, medium: 80, high: 180 },
    o3: { low: 100, medium: 160, high: 240 },
    so2: { low: 20, medium: 80, high: 250 },
    co: { low: 4, medium: 9, high: 15 }
  };
  
  const threshold = thresholds[activeLayer] || thresholds.pm25;
  
  // Determine number of "acne" spots based on pollution level (deterministic)
  const spotSeed = Math.floor(lat * 1000) + Math.floor(lon * 1000) + activeLayer.charCodeAt(0);
  const seededRandom = (index) => {
    const x = Math.sin(spotSeed + index) * 10000;
    return x - Math.floor(x);
  };

  let numSpots = 0;
  if (baseValue <= threshold.low) {
    numSpots = Math.floor(seededRandom(0) * 3); // 0-2 spots
  } else if (baseValue <= threshold.medium) {
    numSpots = 3 + Math.floor(seededRandom(1) * 4); // 3-6 spots
  } else if (baseValue <= threshold.high) {
    numSpots = 6 + Math.floor(seededRandom(2) * 4); // 6-9 spots
  } else {
    numSpots = 8 + Math.floor(seededRandom(3) * 5); // 8-12 spots
  }

  // Create "acne" spots (smaller circles for high pollution areas)
  // Use deterministic positioning based on pollutant type and location for consistency
  for (let i = 0; i < numSpots; i++) {
    // Deterministic position within the base area
    const angle = seededRandom(i) * 2 * Math.PI;
    const distance = seededRandom(i + 100) * baseRadius * 0.8; // Within 80% of base radius
    
    const spotLat = lat + Math.cos(angle) * distance;
    const spotLon = lon + Math.sin(angle) * distance;
    
    // Deterministic spot size (like different sized acne)
    const spotRadius = (0.002 + seededRandom(i + 200) * 0.008) * 111000; // 200m to 1km
    
    // Intensity-based opacity (darker spots = higher pollution)
    const intensity = Math.min(1, baseValue / threshold.high);
    const opacity = 0.4 + intensity * 0.5; // 0.4 to 0.9 opacity
    
    const spot = L.circle([spotLat, spotLon], {
      radius: spotRadius,
      color: baseColor,
      fillColor: baseColor,
      fillOpacity: opacity,
      weight: 1,
      className: `pollutant-spot-${activeLayer}`
    });
    
    overlays.push(spot);
  }

  // Add a center marker to show exact location
  const centerMarker = L.circleMarker([lat, lon], {
    radius: 8,
    color: '#ffffff',
    fillColor: '#ffffff',
    fillOpacity: 0.9,
    weight: 2,
    className: `pollutant-center-${activeLayer}`
  });

  overlays.push(centerMarker);

  console.log(`Created base area + ${numSpots} pollution spots for ${activeLayer}`);
  return overlays;
};

/**
 * Component to render pollutant overlay circles
 */
function PollutantOverlay({ userLocation, pollutantData, activeLayer }) {
  const map = useMap();
  
  useEffect(() => {
    if (!userLocation || !pollutantData) {
      console.log('PollutantOverlay: Missing data', { userLocation, pollutantData });
      return;
    }
    
    console.log('PollutantOverlay: Creating overlays', { userLocation, pollutantData, activeLayer });
    
    // Clear existing overlays
    map.eachLayer(layer => {
      if (layer.options.className && (layer.options.className.includes('pollutant-base') || layer.options.className.includes('pollutant-spot') || layer.options.className.includes('pollutant-center'))) {
        map.removeLayer(layer);
      }
    });
    
    // Create new heat map overlays
    const overlays = createPollutantHeatMap(userLocation.lat, userLocation.lng, pollutantData, activeLayer);
    console.log('PollutantOverlay: Generated heat map overlays', overlays);
    if (overlays) {
      overlays.forEach(overlay => map.addLayer(overlay));
    }
    
    // Cleanup function
    return () => {
      map.eachLayer(layer => {
        if (layer.options.className && (layer.options.className.includes('pollutant-base') || layer.options.className.includes('pollutant-spot') || layer.options.className.includes('pollutant-center'))) {
          map.removeLayer(layer);
        }
      });
    };
  }, [userLocation, pollutantData, activeLayer, map]);
  
  return null;
}

function App() {
  // State variables to manage our app's data
  const [userLocation, setUserLocation] = useState(null); // Stores user's coordinates
  const [airQualityData, setAirQualityData] = useState(null); // Stores API response
  const [pollutantData, setPollutantData] = useState(null); // Stores comprehensive pollutant data
  const [activeLayer, setActiveLayer] = useState('aqi'); // Currently selected pollutant layer
  const [dataAvailability, setDataAvailability] = useState({}); // Tracks data availability for each pollutant
  const [clickedLocation, setClickedLocation] = useState(null); // Stores clicked location coordinates
  const [loading, setLoading] = useState(true); // Shows loading state
  const [error, setError] = useState(null); // Stores error messages
  const [lastUpdate, setLastUpdate] = useState(null); // Tracks last refresh time
  const [searchQuery, setSearchQuery] = useState(''); // Stores city search input
  const [searchResults, setSearchResults] = useState([]); // Stores search results
  const [isSearching, setIsSearching] = useState(false); // Loading state for search
  const [showResults, setShowResults] = useState(false); // Show/hide search dropdown
  
  // FIRMS wildfire data state
  const [fireData, setFireData] = useState(null); // Stores wildfire data
  const [showFires, setShowFires] = useState(false); // Toggle fire layer visibility
  const [fireLoading, setFireLoading] = useState(false); // Loading state for fire data
  
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
        `http://localhost:5001/api/airquality?lat=${lat}&lon=${lon}`
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
      setError('Could not fetch air quality data. Make sure the Flask server is running on port 5001.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch comprehensive air quality data for multiple pollutants
   */
  const fetchPollutantData = async (lat, lon) => {
    try {
      console.log(`🌫️ Fetching comprehensive pollutant data for: ${lat}, ${lon}`);
      
      const response = await fetch(`http://localhost:5001/api/pollutants?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Pollutant data received:', data);
      
      // Check data availability for each pollutant
      const availability = {
        pm25: data.pm25 && data.pm25 > 0,
        pm10: data.pm10 && data.pm10 > 0,
        no2: data.no2 && data.no2 > 0,
        o3: data.o3 && data.o3 > 0,
        so2: data.so2 && data.so2 > 0,
        co: data.co && data.co > 0,
        aqi: data.aqi && data.aqi > 0 // AQI should always be available
      };
      
      setDataAvailability(availability);
      setPollutantData(data);
      return data;
      
    } catch (err) {
      console.error('❌ Error fetching pollutant data:', err);
      setError(`Failed to load pollutant data: ${err.message}`);
      return null;
    }
  };

  /**
   * Fetch wildfire data from NASA FIRMS
   */
  const fetchFireData = async (mapBounds) => {
    if (!showFires || !mapBounds) return;
    
    try {
      setFireLoading(true);
      console.log('🔥 Fetching wildfire data...');
      
      // Convert map bounds to bbox format (minLon,minLat,maxLon,maxLat)
      const bbox = `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`;
      
      const response = await fetch(`http://localhost:5001/api/fires?bbox=${bbox}&days=7`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔥 Fire data received:', data.features?.length || 0, 'fires');
      
      setFireData(data);
      
    } catch (err) {
      console.error('❌ Error fetching fire data:', err);
      setError(`Failed to load wildfire data: ${err.message}`);
    } finally {
      setFireLoading(false);
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
        // Also fetch comprehensive pollutant data
        fetchPollutantData(coords.lat, coords.lng);
      },
      
      // Error callback - something went wrong
      (error) => {
        console.error('❌ Location error:', error);
        setError('Could not get your location. Please enable location services.');
        
        // Use a default location (Atlanta, GA) as fallback
        const defaultCoords = { lat: 33.749, lng: -84.388 };
        setUserLocation(defaultCoords);
        fetchAirQualityData(defaultCoords.lat, defaultCoords.lng);
        // Also fetch comprehensive pollutant data
        fetchPollutantData(defaultCoords.lat, defaultCoords.lng);
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
        // Also refresh comprehensive pollutant data
        fetchPollutantData(userLocation.lat, userLocation.lng);
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
   * Fetch fire data when fire layer is toggled or map bounds change
   */
  useEffect(() => {
    if (showFires && userLocation) {
      // Get current map bounds (approximate based on zoom level)
      const zoom = 13; // Default zoom level
      const lat = userLocation.lat;
      const lng = userLocation.lng;
      
      // Calculate approximate bounds (rough estimation)
      const latRange = 0.1; // ~11km at this latitude
      const lngRange = 0.1;
      
      const bounds = {
        getWest: () => lng - lngRange,
        getEast: () => lng + lngRange,
        getSouth: () => lat - latRange,
        getNorth: () => lat + latRange
      };
      
      fetchFireData(bounds);
    }
  }, [showFires, userLocation]);

  /**
   * Manual refresh button handler
   */
  const handleManualRefresh = () => {
    if (userLocation) {
      console.log('🔄 Manual refresh triggered');
      fetchAirQualityData(userLocation.lat, userLocation.lng);
      // Also refresh comprehensive pollutant data
      fetchPollutantData(userLocation.lat, userLocation.lng);
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
    // Also fetch comprehensive pollutant data
    fetchPollutantData(coords.lat, coords.lng);
    
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%)',
        color: '#e0e1dd',
        padding: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
          AirAware
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
              placeholder="Search for a city..."
              style={{
                width: '100%',
                padding: '0.75rem 2.5rem 0.75rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '1rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                outline: 'none',
                color: '#374151',
                backgroundColor: 'white'
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
                ...
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
              background: '#1b263b',
              color: '#e0e1dd',
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
                    borderBottom: index < searchResults.length - 1 ? '1px solid #415a77' : 'none',
                    color: '#e0e1dd',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#415a77'}
                  onMouseLeave={(e) => e.target.style.background = '#1b263b'}
                >
                  <div style={{ fontWeight: '500' }}>{result.name}</div>
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
              background: '#1b263b',
              borderRadius: '0.5rem',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '1rem',
              color: '#778da9',
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
            {loading && <span>Loading...</span>}
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
                background: '#415a77',
                color: '#e0e1dd',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontWeight: '500'
              }}
            >
              My Location
            </button>
            
            <button
              onClick={handleManualRefresh}
              disabled={loading || !userLocation}
              style={{
                padding: '0.5rem 1rem',
                background: '#778da9',
                color: '#0d1b2a',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontWeight: '500'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* Auto-refresh indicator */}
        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>
          Auto-refreshes every 5 minutes
        </div>
        
        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '0.5rem',
            marginTop: '0.5rem',
            borderRadius: '0.25rem'
          }}>
            {error}
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
            className="custom-map-style"
            eventHandlers={{
              click: (e) => {
                try {
                  const { lat, lng } = e.latlng;
                  console.log('🎯 Map clicked at:', lat, lng);
                  // Store clicked location and fetch data
                  setClickedLocation({ lat, lng });
                  fetchAirQualityData(lat, lng);
                  fetchPollutantData(lat, lng);
                  console.log('✅ Click handler executed successfully');
                } catch (error) {
                  console.error('❌ Error handling map click:', error);
                }
              }
            }}
          >
            {/* Component to update map view when location changes */}
            <MapUpdater center={[userLocation.lat, userLocation.lng]} zoom={13} />
            
            {/* OpenStreetMap tiles */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {/* Pollutant Overlay Circles */}
            {pollutantData && activeLayer !== 'aqi' && (
              <PollutantOverlay 
                userLocation={userLocation}
                pollutantData={pollutantData}
                activeLayer={activeLayer}
              />
            )}
            
            {/* Marker at user location */}
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={getColoredIcon(airQualityData?.category)}
            >
              {/* Popup with air quality and weather data */}
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>
                    {airQualityData?.city || 'Loading...'}
                  </h3>
                  
                  {airQualityData ? (
                    <>
                      {/* Air Quality Section */}
                      <div style={{ marginBottom: '10px' }}>
                        <strong>Air Quality</strong>
                        <div style={{ fontSize: '0.9rem' }}>
                          <div>AQI: <strong>{airQualityData.aqi || 'N/A'}</strong> ({airQualityData.category})</div>
                          <div>PM2.5: {airQualityData.pm25 || 'N/A'} μg/m³</div>
                        </div>
                      </div>
                      
                      {/* Comprehensive Pollutant Data */}
                      {pollutantData && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Pollutants</strong>
                          <div style={{ fontSize: '0.8rem' }}>
                            <div>PM2.5: <strong>{pollutantData.pm25 || 'N/A'}</strong> μg/m³</div>
                            <div>PM10: <strong>{pollutantData.pm10 || 'N/A'}</strong> μg/m³</div>
                            <div>NO₂: <strong>{pollutantData.no2 || 'N/A'}</strong> μg/m³</div>
                            <div>O₃: <strong>{pollutantData.o3 || 'N/A'}</strong> μg/m³</div>
                            <div>SO₂: <strong>{pollutantData.so2 || 'N/A'}</strong> μg/m³</div>
                            <div>CO: <strong>{pollutantData.co || 'N/A'}</strong> mg/m³</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Weather Section */}
                      <div>
                        <strong>Weather</strong>
                        <div style={{ fontSize: '0.9rem' }}>
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
            
            {/* Marker for clicked location */}
            {clickedLocation && (
              <Marker 
                position={[clickedLocation.lat, clickedLocation.lng]}
                icon={L.divIcon({
                  html: `<div style="
                    width: 20px; 
                    height: 20px; 
                    background: #ff6b6b; 
                    border: 3px solid #ffffff; 
                    border-radius: 50%; 
                    box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
                  "></div>`,
                  className: 'custom-clicked-marker',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>
                      Clicked Location
                    </h3>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                      <strong>Coordinates:</strong> {clickedLocation.lat.toFixed(4)}, {clickedLocation.lng.toFixed(4)}
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#778da9' }}>
                      Air quality data loading...
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
            
            {/* Fire Markers */}
            {showFires && fireData && fireData.features && fireData.features.map((fire, index) => {
              const [lon, lat] = fire.geometry.coordinates;
              const props = fire.properties;
              
              // Style fire marker based on confidence
              const getFireIcon = (confidence) => {
                let color = '#ff4444'; // Default red
                let size = 12;
                
                if (confidence === 'high') {
                  color = '#ff0000';
                  size = 16;
                } else if (confidence === 'medium') {
                  color = '#ff6666';
                  size = 14;
                } else if (confidence === 'low') {
                  color = '#ff9999';
                  size = 10;
                }
                
                return L.divIcon({
                  html: `<div style="
                    background-color: ${color};
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50%;
                    box-shadow: 0 0 8px rgba(255, 68, 68, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "></div>`,
                  className: 'fire-marker',
                  iconSize: [size, size],
                  iconAnchor: [size/2, size/2]
                });
              };
              
              return (
                <Marker
                  key={`fire-${index}`}
                  position={[lat, lon]}
                  icon={getFireIcon(props.confidence)}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#e0e1dd' }}>
                        Active Fire
                      </h3>
                      
                      <div style={{ fontSize: '0.9rem' }}>
                        <div><strong>Confidence:</strong> {props.confidence || 'Unknown'}</div>
                        <div><strong>Brightness:</strong> {props.brightness || 'N/A'} K</div>
                        <div><strong>Fire Radiative Power:</strong> {props.frp || 'N/A'} MW</div>
                        <div><strong>Date:</strong> {props.acq_date || 'N/A'}</div>
                        <div><strong>Time:</strong> {props.acq_time || 'N/A'}</div>
                        <div><strong>Satellite:</strong> {props.satellite || 'N/A'}</div>
                        <div><strong>Instrument:</strong> {props.instrument || 'N/A'}</div>
                        <div><strong>Day/Night:</strong> {props.daynight || 'N/A'}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%' 
          }}>
            <div>Getting your location...</div>
          </div>
        )}
      </div>

      {/* Pollutant Layer Controls */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: '#1b263b',
        color: '#e0e1dd',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: 1000,
        minWidth: '200px'
      }}>
        <strong>Pollutant Layers</strong>
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { key: 'pm25', label: 'PM2.5 (μg/m³)', color: '#ff6b6b' },
            { key: 'pm10', label: 'PM10 (μg/m³)', color: '#ffa726' },
            { key: 'no2', label: 'NO₂ (μg/m³)', color: '#42a5f5' },
            { key: 'o3', label: 'O₃ (μg/m³)', color: '#66bb6a' },
            { key: 'so2', label: 'SO₂ (μg/m³)', color: '#ab47bc' },
            { key: 'co', label: 'CO (mg/m³)', color: '#8d6e63' }
          ].map(pollutant => (
            <button
              key={pollutant.key}
              onClick={() => setActiveLayer(pollutant.key)}
              style={{
                background: activeLayer === pollutant.key ? '#415a77' : 'transparent',
                color: '#e0e1dd',
                border: `1px solid ${pollutant.color}`,
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: pollutant.color,
                borderRadius: '50%'
              }}></div>
              {pollutant.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fire Layer Toggle */}
      <div style={{
        position: 'absolute',
        bottom: '170px',
        right: '20px',
        background: '#1b263b',
        color: '#e0e1dd',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: 1000,
        minWidth: '150px',
        textAlign: 'center'
      }}>
        <strong>Wildfire Data</strong>
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setShowFires(!showFires)}
            style={{
              background: showFires ? '#ff4444' : 'transparent',
              color: '#e0e1dd',
              border: '1px solid #ff4444',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center'
            }}
          >
            {showFires ? 'Hide Fires' : 'Show Fires'}
            {fireLoading && <span style={{ fontSize: '0.7rem' }}>(Loading...)</span>}
          </button>
        </div>
      </div>

      {/* Data Availability Notification */}
      {!dataAvailability[activeLayer] && pollutantData && activeLayer !== 'aqi' && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: '#ff6b6b',
          color: '#ffffff',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          zIndex: 1000,
          maxWidth: '200px',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          ⚠️ {activeLayer.toUpperCase()} data not available for this location
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        background: '#1b263b',
        color: '#e0e1dd',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        zIndex: 1000
      }}>
        <strong>AQI Scale</strong>
        <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#00e400', borderRadius: '50%', marginRight: '8px' }}></div>
            Good (0-50)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ffff00', borderRadius: '50%', marginRight: '8px' }}></div>
            Moderate (51-100)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ff7e00', borderRadius: '50%', marginRight: '8px' }}></div>
            Unhealthy for Sensitive (101-150)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: '#ff0000', borderRadius: '50%', marginRight: '8px' }}></div>
            Unhealthy (151-200)
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;