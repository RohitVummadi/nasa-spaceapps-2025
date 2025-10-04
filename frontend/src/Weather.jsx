import React from 'react'

function Weather({ temperature = '-', humidity = '-', wind = '-', description = 'Unknown' }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: 'white', border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Current Weather</h3>
      <div style={{ marginTop: 8, fontSize: 14 }}>
        <div>🌡️ Temp: <strong>{temperature}°C</strong></div>
        <div>💧 Humidity: <strong>{humidity}%</strong></div>
        <div>💨 Wind: <strong>{wind} m/s</strong></div>
        <div style={{ marginTop: 6 }}>Condition: <strong>{description}</strong></div>
      </div>
    </div>
  )
}

export default Weather
