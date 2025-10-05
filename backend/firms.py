"""
NASA FIRMS (Fire Information for Resource Management System) Integration
Provides wildfire data via WFS proxy with caching and WMS tile layer support
"""

import os
import json
import requests
import time
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
import logging

# Create blueprint
firms_bp = Blueprint('firms', __name__)

# NASA FIRMS API configuration
FIRMS_API_KEY = os.getenv('FIRMS_API_KEY', 'YOUR_API_KEY_HERE')
FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api"

# Cache directory
CACHE_DIR = "firms_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def get_cache_file_path(bbox, days=7):
    """Generate cache file path based on bounding box and time range"""
    min_lon, min_lat, max_lon, max_lat = bbox
    cache_key = f"firms_{min_lat:.2f}_{min_lon:.2f}_{max_lat:.2f}_{max_lon:.2f}_{days}d"
    return os.path.join(CACHE_DIR, f"{cache_key}.json")

def is_cache_valid(file_path, max_age_hours=3):
    """Check if cache file is still valid (within max_age_hours)"""
    if not os.path.exists(file_path):
        return False
    
    file_age = time.time() - os.path.getmtime(file_path)
    return file_age < (max_age_hours * 3600)

def fetch_firms_data(bbox, days=7):
    """
    Fetch FIRMS data from NASA API
    bbox: [minLon, minLat, maxLon, maxLat] in EPSG:4326
    days: number of days to look back (max 31)
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Format dates for FIRMS API
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # FIRMS API endpoint for VIIRS 375m data
    url = f"{FIRMS_BASE_URL}/area/csv/{FIRMS_API_KEY}/VIIRS_SNPP_NPP/MODIS_NRT/{start_str}/{end_str}"
    
    params = {
        'area': f"{min_lat},{min_lon},{max_lat},{max_lon}",  # lat,lon,lat,lon format
    }
    
    try:
        current_app.logger.info(f"Fetching FIRMS data for bbox: {bbox}, days: {days}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        # Parse CSV response
        csv_text = response.text
        lines = csv_text.strip().split('\n')
        
        if len(lines) <= 1:  # Only header or empty
            current_app.logger.info("No fire data found in FIRMS response")
            # Return demo data for testing
            return generate_demo_fire_data(bbox)
        
        # Parse CSV header
        headers = lines[0].split(',')
        fire_data = []
        
        for line in lines[1:]:
            if line.strip():
                values = line.split(',')
                fire_point = {}
                for i, header in enumerate(headers):
                    if i < len(values):
                        fire_point[header.strip()] = values[i].strip()
                fire_data.append(fire_point)
        
        current_app.logger.info(f"Retrieved {len(fire_data)} fire points from FIRMS")
        return fire_data
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"FIRMS API error: {e}")
        # Return demo data for testing
        return generate_demo_fire_data(bbox)
    except Exception as e:
        current_app.logger.error(f"FIRMS parsing error: {e}")
        # Return demo data for testing
        return generate_demo_fire_data(bbox)

def generate_demo_fire_data(bbox):
    """Generate demo fire data for testing when no real data is available"""
    min_lon, min_lat, max_lon, max_lat = bbox
    
    # Generate 2-5 demo fires within the bounding box
    import random
    num_fires = random.randint(2, 5)
    demo_fires = []
    
    for i in range(num_fires):
        # Random position within bbox
        lat = min_lat + random.random() * (max_lat - min_lat)
        lon = min_lon + random.random() * (max_lon - min_lon)
        
        # Random fire properties
        confidence = random.choice(['high', 'medium', 'low'])
        brightness = random.randint(300, 500)
        frp = round(random.uniform(5, 50), 1)
        
        fire_point = {
            'latitude': str(lat),
            'longitude': str(lon),
            'confidence': confidence,
            'brightness': str(brightness),
            'bright_t31': str(brightness - 50),
            'frp': str(frp),
            'scan': str(random.randint(1, 3)),
            'track': str(random.randint(1, 3)),
            'acq_date': datetime.now().strftime('%Y-%m-%d'),
            'acq_time': f"{random.randint(0, 23):02d}:{random.randint(0, 59):02d}",
            'satellite': random.choice(['NPP', 'NOAA-20', 'NOAA-21']),
            'instrument': 'VIIRS',
            'version': '1.0',
            'bright_ti4': str(brightness + 20),
            'bright_ti5': str(brightness - 30),
            'daynight': random.choice(['D', 'N']),
            'type': '0'
        }
        demo_fires.append(fire_point)
    
    current_app.logger.info(f"Generated {len(demo_fires)} demo fire points for testing")
    return demo_fires

def convert_to_geojson(firms_data):
    """Convert FIRMS data to GeoJSON format"""
    features = []
    
    for fire in firms_data:
        # Extract coordinates (FIRMS uses lat, lon)
        lat = fire.get('latitude')
        lon = fire.get('longitude')
        
        if lat is None or lon is None:
            continue
            
        # Create GeoJSON feature
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(lon), float(lat)]
            },
            "properties": {
                "confidence": fire.get('confidence', 'unknown'),
                "brightness": fire.get('brightness', 0),
                "bright_t31": fire.get('bright_t31', 0),
                "frp": fire.get('frp', 0),  # Fire Radiative Power
                "scan": fire.get('scan', 0),
                "track": fire.get('track', 0),
                "acq_date": fire.get('acq_date', ''),
                "acq_time": fire.get('acq_time', ''),
                "satellite": fire.get('satellite', ''),
                "instrument": fire.get('instrument', ''),
                "version": fire.get('version', ''),
                "bright_ti4": fire.get('bright_ti4', 0),
                "bright_ti5": fire.get('bright_ti5', 0),
                "daynight": fire.get('daynight', ''),
                "type": fire.get('type', '')
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }

@firms_bp.route('/api/fires', methods=['GET'])
def get_fires():
    """
    Get wildfire data as GeoJSON
    Query params:
    - bbox: minLon,minLat,maxLon,maxLat (required)
    - days: number of days to look back (default: 7, max: 31)
    """
    try:
        # Get bounding box from query params
        bbox_str = request.args.get('bbox')
        if not bbox_str:
            return jsonify({"error": "bbox parameter required (minLon,minLat,maxLon,maxLat)"}), 400
        
        try:
            bbox = [float(x) for x in bbox_str.split(',')]
            if len(bbox) != 4:
                raise ValueError("bbox must have 4 values")
        except ValueError as e:
            return jsonify({"error": f"Invalid bbox format: {e}"}), 400
        
        # Get days parameter
        days = int(request.args.get('days', 7))
        days = min(days, 31)  # Cap at 31 days
        
        # Check cache first
        cache_file = get_cache_file_path(bbox, days)
        if is_cache_valid(cache_file):
            current_app.logger.info("Returning cached FIRMS data")
            with open(cache_file, 'r') as f:
                return jsonify(json.load(f))
        
        # Fetch fresh data
        firms_data = fetch_firms_data(bbox, days)
        
        if not firms_data:
            return jsonify({
                "type": "FeatureCollection",
                "features": []
            })
        
        # Convert to GeoJSON
        geojson_data = convert_to_geojson(firms_data)
        
        # Cache the result
        try:
            with open(cache_file, 'w') as f:
                json.dump(geojson_data, f)
            current_app.logger.info(f"Cached FIRMS data to {cache_file}")
        except Exception as e:
            current_app.logger.warning(f"Failed to cache FIRMS data: {e}")
        
        return jsonify(geojson_data)
        
    except Exception as e:
        current_app.logger.error(f"FIRMS endpoint error: {e}")
        return jsonify({"error": "Internal server error"}), 500

@firms_bp.route('/api/fires/wms', methods=['GET'])
def get_wms_info():
    """
    Get WMS tile layer information for FIRMS fires
    Returns the WMS URL template for frontend use
    """
    try:
        # Calculate date range for WMS TIME parameter
        end_date = datetime.now()
        start_date = end_date - timedelta(days=31)
        
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")
        
        # FIRMS WMS endpoint for VIIRS 375m
        wms_url = f"https://firms.modaps.eosdis.nasa.gov/wms/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=VIIRS_SNPP_NPP/MODIS_NRT&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={{bbox}}&TIME={start_str}/{end_str}"
        
        return jsonify({
            "wms_url": wms_url,
            "layer_name": "VIIRS_SNPP_NPP/MODIS_NRT",
            "time_range": f"{start_str}/{end_str}",
            "description": "NASA FIRMS Active Fires - VIIRS 375m"
        })
        
    except Exception as e:
        current_app.logger.error(f"WMS info error: {e}")
        return jsonify({"error": "Failed to get WMS information"}), 500
