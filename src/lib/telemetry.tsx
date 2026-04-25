"use client";

import { useEffect } from 'react';
import { db } from './db';

export function TelemetryProvider() {
  useEffect(() => {
    // Prevent multiple initializations in development strict mode
    if (window.hasOwnProperty('__telemetryInitialized')) return;
    Object.defineProperty(window, '__telemetryInitialized', { value: true });

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
        
        // Only track our internal /api/ routes
        if (url.includes('/api/')) {
          const endpoint = url.split('?')[0].replace(window.location.origin, '');
          
          db.telemetry.add({
            endpoint,
            latencyMs: Math.round(endTime - startTime),
            status: response.ok ? 'success' : 'error',
            timestamp: new Date()
          }).catch(err => console.error("Failed to log telemetry:", err));
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
        
        if (url.includes('/api/')) {
          const endpoint = url.split('?')[0].replace(window.location.origin, '');
          
          db.telemetry.add({
            endpoint,
            latencyMs: Math.round(endTime - startTime),
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          }).catch(err => console.error("Failed to log telemetry:", err));
        }
        
        throw error;
      }
    };
  }, []);

  return null;
}
