// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This configuration helps React communicate with the Flask backend
export default defineConfig({
  plugins: [react()],
  
  // Development server settings
  server: {
    port: 5173, // React will run on this port
    
    // Optional: Set up a proxy to avoid CORS issues
    // Uncomment this if you have CORS problems
    /*
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
    */
  }
})