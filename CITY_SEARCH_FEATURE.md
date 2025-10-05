# 🔍 City Search Feature

## Overview
The city search feature allows users to search for any city worldwide and view its air quality data instantly, without needing to manually input coordinates.

## Features

### 🌐 Global City Search
- Search for any city, town, or location worldwide
- Results powered by OpenStreetMap's Nominatim geocoding API
- Free to use, no API key required

### ⚡ Smart Search
- **Debounced search**: Waits 500ms after you stop typing before searching
- **Minimum 3 characters**: Prevents unnecessary API calls
- **Real-time results**: See suggestions as you type
- **Auto-complete dropdown**: Shows up to 5 matching locations

### 📍 Location Features
- Display full location names (city, state, country)
- Show precise coordinates (latitude, longitude)
- Click any result to instantly jump to that location
- Fetches air quality data automatically for selected location

### 🎨 User Interface
- Clean, modern search bar in the header
- Dropdown results with hover effects
- Loading indicator while searching
- "No results" message for invalid searches
- Click outside to close dropdown

## How to Use

### Basic Search
1. Type a city name in the search bar (e.g., "New York", "London", "Tokyo")
2. Wait for search results to appear
3. Click on the desired location from the dropdown
4. The map will update with air quality data for that location

### Switch Back to Your Location
- Click the **"📍 My Location"** button to return to your current GPS location
- This will request browser location permissions if not already granted

### Refresh Data
- Click the **"🔄 Refresh"** button to get the latest air quality data
- Data automatically refreshes every 5 minutes

## Examples

### Search Examples
- **Cities**: "San Francisco", "Paris", "Mumbai"
- **Neighborhoods**: "Brooklyn", "Shibuya", "Soho"
- **Landmarks**: "Eiffel Tower", "Times Square", "Big Ben"
- **Airports**: "JFK Airport", "Heathrow", "LAX"

### Result Format
Each search result displays:
```
📍 New York, New York, United States
   40.7128, -74.0060
```

## Technical Details

### API Endpoint
```
https://nominatim.openstreetmap.org/search
```

### Parameters
- `q`: Query string (city name)
- `format`: json
- `limit`: 5 (maximum results)

### Response Format
```javascript
{
  display_name: "New York, New York, United States",
  lat: "40.7127281",
  lon: "-74.0060152",
  type: "city",
  importance: 0.987
}
```

### Code Structure

**API Function** (`utils/api.js`):
```javascript
export const searchCity = async (cityName) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=5`
  );
  // ... transforms results to user-friendly format
};
```

**React Component** (`App.jsx`):
- `searchQuery`: Current search input
- `searchResults`: Array of location results
- `isSearching`: Loading state
- `showResults`: Controls dropdown visibility
- `handleCitySearch()`: Performs the search
- `handleCitySelect()`: Updates location when result is clicked

### State Management
```javascript
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);
const [showResults, setShowResults] = useState(false);
```

## Performance Optimizations

### Debouncing
Search is debounced by 500ms to avoid excessive API calls:
```javascript
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (searchQuery) {
      handleCitySearch(searchQuery);
    }
  }, 500);
  return () => clearTimeout(timeoutId);
}, [searchQuery]);
```

### Click Outside Detection
Automatically closes dropdown when clicking outside:
```javascript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
      setShowResults(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### Minimum Query Length
Only searches when query is 3+ characters:
```javascript
if (!query || query.length < 3) {
  setSearchResults([]);
  return;
}
```

## Styling

### CSS Classes
Defined in `App.css`:
- `.search-container`: Search bar wrapper
- `.search-input`: Input field styling
- `.search-results`: Dropdown container
- `.search-result-item`: Individual result styling
- `.search-result-name`: Location name
- `.search-result-coords`: Coordinates display

### Inline Styles
Some styles are inline for dynamic behavior:
- Gradient header background
- Hover effects on results
- Loading indicator positioning

## Browser Compatibility

### Supported Browsers
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Required Features
- Fetch API
- ES6+ JavaScript
- CSS Grid/Flexbox
- Event listeners

## Privacy & Data

### OpenStreetMap Policy
- Free geocoding service
- No API key required
- Rate limited to prevent abuse
- See [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)

### User Data
- No search queries are stored
- Location data not shared with third parties
- Browser geolocation requires user permission

## Troubleshooting

### No Results Found
- Check spelling
- Try broader search (e.g., "Paris" instead of "Paris, 5th arrondissement")
- Verify internet connection

### Search Not Working
- Ensure minimum 3 characters entered
- Check browser console for errors
- Verify Nominatim API is accessible

### Dropdown Won't Close
- Click outside the search box
- Press Escape key (future enhancement)
- Select a result

## Future Enhancements

### Planned Features
- 🔍 Search history
- 📌 Favorite locations
- 🗺️ Recent searches
- ⌨️ Keyboard navigation (arrow keys, Enter, Escape)
- 🌍 Detect current city name
- 🔄 Autocomplete suggestions
- 📱 Mobile-optimized search

### Advanced Features
- Multiple location comparison
- Search by coordinates
- Search by ZIP/postal code
- Filter by location type (city, state, country)

## Code Examples

### Simple Search
```javascript
import { searchCity } from './utils/api';

const results = await searchCity('New York');
console.log(results);
// [{ name: 'New York, NY, USA', lat: 40.7128, lon: -74.0060, ... }]
```

### Handle Selected Location
```javascript
const handleCitySelect = (result) => {
  const coords = {
    lat: result.lat,
    lng: result.lon
  };
  setUserLocation(coords);
  fetchAirQualityData(coords.lat, coords.lng);
};
```

## Credits
- Geocoding: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/)
- Maps: [Leaflet.js](https://leafletjs.com/)
- UI: Custom React components

---

**Last Updated**: October 4, 2025  
**Version**: 1.0.0
