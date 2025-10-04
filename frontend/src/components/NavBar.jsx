import React from 'react';

const NavBar = () => {
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">🌍</div>
            <div>
              <h1 className="text-2xl font-bold">AirAware Map</h1>
              <p className="text-sm text-blue-100">See It, Breathe It, Know It</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm bg-blue-700 px-3 py-1 rounded-full">NASA Hackathon 2025</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;