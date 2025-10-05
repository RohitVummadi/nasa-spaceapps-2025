from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Get API keys from environment variables
OPENAQ_API_KEY = os.getenv('OPENAQ_API_KEY', '')  # Get your free key from platform.openaq.org
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'your_openweather_api_key_here')

@app.route('/api/airquality', methods=['GET'])
def get_air_quality():
    """
    Main API endpoint that fetches both air quality and weather data
    URL format: /api/airquality?lat=40.7128&lon=-74.0060
    """
    try:
        # Get latitude and longitude from URL parameters
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        
        # Validate coordinates
        if lat is None or lon is None:
            return jsonify({'error': 'Missing latitude or longitude parameters'}), 400
        
        if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
            return jsonify({'error': 'Invalid coordinates'}), 400
        
        print(f"Fetching data for coordinates: {lat}, {lon}")
        
        # Fetch air quality data from OpenAQ
        air_quality_data = fetch_air_quality(lat, lon)
        
        # Fetch weather data from OpenWeatherMap
        weather_data = fetch_weather(lat, lon)
        
        # Combine both datasets
        combined_data = {
            'location': {
                'latitude': lat,
                'longitude': lon,
                'city': weather_data.get('city', 'Unknown Location')
            },
            'air_quality': {
                'aqi': air_quality_data.get('aqi', 0),
                'pm25': air_quality_data.get('pm25', 0),
                'category': air_quality_data.get('category', 'Unknown'),
                'last_updated': air_quality_data.get('last_updated', 'Unknown')
            },
            'weather': {
                'temperature': weather_data.get('temperature', 0),
                'humidity': weather_data.get('humidity', 0),
                'wind_speed': weather_data.get('wind_speed', 0),
                'description': weather_data.get('description', 'Unknown')
            }
        }
        
        return jsonify(combined_data)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def fetch_air_quality(lat, lon):
    """
    Fetch air quality data from OpenAQ API with API key for better rate limits
    """
    try:
        # OpenAQ API endpoint for latest measurements
        url = f"https://api.openaq.org/v3/latest?coordinates={lat},{lon}"
        
        # Headers with API key for authenticated requests
        headers = {
            'X-API-Key': OPENAQ_API_KEY,
            'User-Agent': 'AirAware-CleanMap/1.0 (NASA Hackathon Project)',
            'Accept': 'application/json'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract PM2.5 data from the response
        pm25 = None
        aqi = 0
        
        if data.get('results'):
            # Look for PM2.5 measurements in the results
            for result in data['results']:
                if result.get('measurements'):
                    for measurement in result['measurements']:
                        if measurement.get('parameter') == 'pm25':
                            pm25 = measurement.get('value')
                            # Calculate simple AQI from PM2.5
                            aqi = calculate_aqi_from_pm25(pm25)
                            break
                    if pm25:
                        break
        
        # If no PM2.5 data found, try to get US AQI if available
        if pm25 is None:
            pm25, aqi = extract_aqi_from_measurements(data)
        
        return {
            'pm25': pm25 or 0,
            'aqi': aqi,
            'category': get_aqi_category(aqi),
            'last_updated': 'Recent'
        }
        
    except requests.RequestException as e:
        print(f"OpenAQ API error: {e}")
        # Return default values if API fails
        return {
            'pm25': 0,
            'aqi': 0,
            'category': 'Unknown',
            'last_updated': 'Unknown'
        }

def extract_aqi_from_measurements(data):
    """
    Alternative method to extract AQI data if PM2.5 is not available
    """
    pm25 = None
    aqi = 0
    
    if data.get('results'):
        for result in data['results']:
            if result.get('measurements'):
                for measurement in result['measurements']:
                    parameter = measurement.get('parameter', '').lower()
                    value = measurement.get('value')
                    
                    # Look for PM2.5
                    if parameter == 'pm25' and value is not None:
                        pm25 = value
                        aqi = calculate_aqi_from_pm25(value)
                        return pm25, aqi
                    
                    # Look for direct AQI measurements
                    elif parameter in ['aqi', 'us-aqi'] and value is not None:
                        aqi = value
                        # Estimate PM2.5 from AQI (rough approximation)
                        pm25 = estimate_pm25_from_aqi(value)
                        return pm25, aqi
    
    return pm25, aqi

def estimate_pm25_from_aqi(aqi):
    """
    Rough estimation of PM2.5 from AQI (simplified)
    """
    if aqi <= 50:
        return aqi * 12 / 50
    elif aqi <= 100:
        return 12 + (aqi - 50) * (35.4 - 12) / 50
    elif aqi <= 150:
        return 35.4 + (aqi - 100) * (55.4 - 35.4) / 50
    else:
        return 55.4 + (aqi - 150) * (150.4 - 55.4) / 50

def calculate_aqi_from_pm25(pm25):
    """
    Calculate AQI from PM2.5 concentration using US EPA breakpoints
    This performs linear interpolation across standard breakpoints.
    """
    try:
        if pm25 is None:
            return 0
        c = float(pm25)
    except (TypeError, ValueError):
        return 0

    # Breakpoints for PM2.5 (µg/m3) and corresponding AQI
    breakpoints = [
        (0.0, 12.0, 0, 50),
        (12.1, 35.4, 51, 100),
        (35.5, 55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 350.4, 301, 400),
        (350.5, 500.4, 401, 500),
    ]

    for (clow, chigh, ilow, ihigh) in breakpoints:
        if clow <= c <= chigh:
            # linear interpolation
            aqi = ((ihigh - ilow) / (chigh - clow)) * (c - clow) + ilow
            return int(round(aqi))

    # If outside known range, cap it
    if c > 500.4:
        return 500
    return 0


def get_aqi_category(aqi):
    """Return AQI category name for a numeric AQI value."""
    try:
        a = int(aqi)
    except (TypeError, ValueError):
        return 'Unknown'

    if a <= 50:
        return 'Good'
    if a <= 100:
        return 'Moderate'
    if a <= 150:
        return 'Unhealthy for Sensitive Groups'
    if a <= 200:
        return 'Unhealthy'
    if a <= 300:
        return 'Very Unhealthy'
    return 'Hazardous'


def fetch_weather(lat, lon):
    """
    Fetch basic current weather from OpenWeatherMap.
    Returns a dict with temperature (C), humidity (%), wind_speed (m/s), description, and city name.
    """
    try:
        if not OPENWEATHER_API_KEY:
            print('Warning: OPENWEATHER_API_KEY not set')
            return {
                'temperature': 0,
                'humidity': 0,
                'wind_speed': 0,
                'description': 'Unknown',
                'city': 'Unknown Location'
            }

        url = 'https://api.openweathermap.org/data/2.5/weather'
        params = {
            'lat': lat,
            'lon': lon,
            'units': 'metric',
            'appid': OPENWEATHER_API_KEY
        }

        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        w = resp.json()

        temperature = w.get('main', {}).get('temp', 0)
        humidity = w.get('main', {}).get('humidity', 0)
        wind_speed = w.get('wind', {}).get('speed', 0)
        description = ''
        if w.get('weather') and isinstance(w.get('weather'), list) and len(w.get('weather')) > 0:
            description = w['weather'][0].get('description', '')

        city = w.get('name') or 'Unknown Location'

        return {
            'temperature': temperature,
            'humidity': humidity,
            'wind_speed': wind_speed,
            'description': description,
            'city': city
        }

    except requests.RequestException as e:
        print(f'OpenWeather API error: {e}')
        return {
            'temperature': 0,
            'humidity': 0,
            'wind_speed': 0,
            'description': 'Unknown',
            'city': 'Unknown Location'
        }

# Rest of the functions remain the same (calculate_aqi_from_pm25, get_aqi_category, fetch_weather)

if __name__ == '__main__':
    # Run the Flask development server
    print("Starting AirAware + CleanMap Backend Server...")
    print("Make sure to set OPENAQ_API_KEY and OPENWEATHER_API_KEY in your .env file")
    app.run(debug=True, port=5000)