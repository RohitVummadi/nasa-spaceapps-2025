import React from 'react';
import { getAQICategory } from '../utils/api';

const AlertsPopup = ({ aqi, show }) => {
  if (!show || !aqi) return null;

  const category = getAQICategory(aqi);
  
  const getAlertMessage = () => {
    if (aqi > 200) return "🚨 Health Alert! Air quality is very unhealthy.";
    if (aqi > 150) return "⚠️ Caution! Air quality is unhealthy.";
    if (aqi > 100) return "⚡ Sensitive groups should take precautions.";
    return "✅ Air quality is good!";
  };

  const borderColor = aqi > 150 ? 'border-red-500' : aqi > 100 ? 'border-orange-500' : 'border-green-500';

  return (
    <div className={`fixed top-20 right-4 z-[2000] max-w-sm animate-fade-in`}>
      <div className={`${category.bgColor} border-l-4 ${borderColor} p-4 rounded-lg shadow-xl`}>
        <div className="flex items-start space-x-3">
          <div className="flex-1">
            <p className={`font-semibold ${category.textColor}`}>
              {getAlertMessage()}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Current AQI: <strong>{aqi}</strong> ({category.level})
            </p>
          </div>
          <button className="text-gray-500 hover:text-gray-700">×</button>
        </div>
      </div>
    </div>
  );
};

export default AlertsPopup;