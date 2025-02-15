import React, { useCallback, useState } from 'react';
import { startTracking, stopTracking } from '../lib/gazecloud';
import type { GazeData } from '../types/gazeData';

export default function GazeTracker() {
  const [isTracking, setIsTracking] = useState(false);

  const handleStartTracking = useCallback(() => {
    startTracking((data: GazeData) => {
      // Send gaze data to the server
      fetch('/api/sessions/current/gaze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }).catch(console.error);
    });
    setIsTracking(true);
  }, []);

  const handleStopTracking = useCallback(() => {
    stopTracking();
    setIsTracking(false);
  }, []);

  return (
    <div className="gaze-tracker-controls">
      <h2>Eye Tracking Controls</h2>
      <div className="button-group">
        <button 
          onClick={handleStartTracking} 
          disabled={isTracking}
        >
          Start Tracking
        </button>
        <button 
          onClick={handleStopTracking} 
          disabled={!isTracking}
        >
          Stop Tracking
        </button>
      </div>
      <div id="gaze" className="gaze-point" style={{ display: 'none' }} />
    </div>
  );
} 