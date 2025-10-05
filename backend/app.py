# backend/app.py
"""
AirAware + CleanMap Backend Server
This Flask server fetches air quality and weather data from external APIs
and serves it to our React frontend in a simple, combined format.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS  # This handles Cross-Origin requests from React
import requests  # For making HTTP requests to external APIs
import os
from dotenv import load_dotenv  # For loading environment variables safely

# Load environment variables from .env file (if it exists)
load_dotenv()

# Create the Flask application
app = Flask(__name__)

# Enable CORS to allow our React app (running on port 5173) to talk to this Flask server
# Without CORS, the browser would block requests between different ports
CORS(app, origins=['http://localhost:5173', 'http://localhost:3000', '*'])

# API Configuration
# Get your free API key from: https://openweathermap.org/api
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'YOUR_API_KEY_HERE')

# API endpoints we'll be calling
OPENAQ_API_URL = 'https://api.openaq.org/v2/latest'
OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather'

def calculate_aqi_from_pm25(pm25):
    """
    Convert PM2.5 concentration (μg/m³) to AQI value
    Using simplified US EPA formula
    
    PM2.5 is one of the main pollutants measured
    AQI makes it easier for people to understand air quality
    """
    if pm25 <= 12.0:
        # Good air quality
        return round((50/12.0) * pm25)
    elif pm25 <= 35.4:
        # Moderate air quality
        return round(((100-51)/(35.4-12.1)) * (pm25-12.1) + 51)
    elif pm25 <= 55.4:
        # Unhealthy for sensitive groups
        return round(((150-101)/(55.4-35.5)) * (pm25-35.5) + 101)
    elif pm25 <= 150.4:
        # Unhealthy
        return round(((200-151)/(150.4-55.5)) * (pm25-55.5) + 151)
    else:
        # Very unhealthy or hazardous
        return round(((300-201)/(250.4-150.5)) * (pm25-150.5) + 201)

def get_aqi_category(aqi):
    """
    Convert AQI number to a category name
    This helps users quickly understand if air quality is safe
    """
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"

@app.route('/api/airquality', methods=['GET'])
def get_air_quality():
    """
    Main API endpoint that fetches and combines air quality and weather data
    
    Expected URL format: /api/airquality?lat=33.749&lon=-84.388
    Returns: JSON object with combined air quality and weather data
    """
    
    try:
        # Step 1: Get coordinates from the URL parameters
        lat = request.args.get('lat')
        lon = request.args.get('lon')
        
        # Check if both coordinates were provided
        if not lat or not lon:
            return jsonify({'error': 'Missing latitude or longitude'}), 400
        
        # Convert string coordinates to numbers
        lat = float(lat)
        lon = float(lon)
        
        print(f"📍 Fetching data for coordinates: {lat}, {lon}")
        
        # Initialize our response object with default values
        response_data = {
            'city': 'Unknown Location',
            'aqi': None,
            'pm25': None,
            'temperature': None,
            'humidity': None,
            'category': 'Unknown'
        }
        
        # Step 2: Fetch Weather Data from OpenWeatherMap
        try:
            print("☁️ Fetching weather data...")
            
            # Prepare the request to OpenWeatherMap
            weather_params = {
                'lat': lat,
                'lon': lon,
                'appid': OPENWEATHER_API_KEY,
                'units': 'metric'  # Get temperature in Celsius
            }
            
            # Make the API call
            weather_response = requests.get(
                OPENWEATHER_API_URL, 
                params=weather_params,
                timeout=5  # Wait max 5 seconds for response
            )
            
            # Check if the request was successful
            if weather_response.status_code == 200:
                weather_data = weather_response.json()
                
                # Extract the data we need
                response_data['city'] = weather_data.get('name', 'Unknown Location')
                response_data['temperature'] = round(
                    weather_data.get('main', {}).get('temp', 0), 1
                )
                response_data['humidity'] = weather_data.get('main', {}).get('humidity', 0)
                
                print(f"✅ Weather data retrieved for: {response_data['city']}")
            else:
                print(f"⚠️ Weather API error: {weather_response.status_code}")
                
        except Exception as e:
            print(f"❌ Error fetching weather: {str(e)}")
            # Continue even if weather fails - we might still get air quality
        
        # Step 3: Fetch Air Quality Data from OpenAQ
        try:
            print("🌫️ Fetching air quality data...")
            
            # OpenAQ requires a search radius (in meters)
            # We'll search within 25km of the coordinates
            openaq_params = {
                'coordinates': f"{lat},{lon}",
                'radius': 25000,  # 25 km radius
                'limit': 1,  # Get just the nearest station
                'parameter': 'pm25'  # We want PM2.5 data
            }
            
            # Make the API call
            air_response = requests.get(
                OPENAQ_API_URL,
                params=openaq_params,
                timeout=5
            )
            
            if air_response.status_code == 200:
                air_data = air_response.json()
                
                # Check if we got any results
                if air_data.get('results') and len(air_data['results']) > 0:
                    result = air_data['results'][0]
                    
                    # Look for PM2.5 measurement
                    measurements = result.get('measurements', [])
                    for measurement in measurements:
                        if measurement.get('parameter') == 'pm25':
                            pm25_value = measurement.get('value', 0)
                            
                            # Store PM2.5 and calculate AQI
                            response_data['pm25'] = round(pm25_value, 1)
                            response_data['aqi'] = calculate_aqi_from_pm25(pm25_value)
                            response_data['category'] = get_aqi_category(response_data['aqi'])
                            
                            print(f"✅ Air quality data found: AQI={response_data['aqi']}")
                            break
                else:
                    print("⚠️ No air quality stations found nearby")
                    # Use demo data if no stations found
                    response_data['pm25'] = 15.0
                    response_data['aqi'] = 55
                    response_data['category'] = "Moderate (Demo Data)"
            else:
                print(f"⚠️ OpenAQ API error: {air_response.status_code}")
                # Use demo data if API fails
                response_data['pm25'] = 10.0
                response_data['aqi'] = 42
                response_data['category'] = "Good (Demo Data)"
                
        except Exception as e:
            print(f"❌ Error fetching air quality: {str(e)}")
            # Provide demo data if there's an error
            response_data['pm25'] = 12.0
            response_data['aqi'] = 50
            response_data['category'] = "Good (Demo Data)"
        
        # Step 4: Return the combined data
        print(f"📊 Returning combined data: {response_data}")
        return jsonify(response_data), 200
        
    except ValueError as e:
        # Handle invalid coordinate format
        return jsonify({'error': 'Invalid coordinates format'}), 400
    except Exception as e:
        # Handle any other unexpected errors
        print(f"❌ Server error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """
    Simple endpoint to check if the server is running
    Visit http://localhost:5001/health to test
    """
    return jsonify({
        'status': 'healthy',
        'message': 'AirAware backend is running!'
    }), 200

# Run the Flask application
if __name__ == '__main__':
    # Run the Flask development server
    print("Starting AirAware + CleanMap Backend Server...")
    print("Make sure to set OPENAQ_API_KEY and OPENWEATHER_API_KEY in your .env file")
    app.run(debug=True, port=5001)
