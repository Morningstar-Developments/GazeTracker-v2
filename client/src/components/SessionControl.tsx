import React, { useState } from 'react';
import { startTracking, stopTracking } from '../lib/gazecloud';

const SessionControl: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [calibrationComplete, setCalibrationComplete] = useState(false);

  const handleStartTracking = () => {
    startTracking(
      (gazeData) => {
        // Handle gaze data
        console.log('Gaze data:', gazeData);
      },
      () => {
        // Handle calibration complete
        setCalibrationComplete(true);
      }
    );
    setIsTracking(true);
  };

  const handleStopTracking = () => {
    stopTracking();
    setIsTracking(false);
    setCalibrationComplete(false);
  };

  return (
    <div className="session-control">
      <h2>Gaze Tracking Session</h2>
      <div className="button-group">
        {!isTracking ? (
          <button onClick={handleStartTracking}>
            Start Tracking
          </button>
        ) : (
          <button onClick={handleStopTracking}>
            Stop Tracking
          </button>
        )}
      </div>
      {calibrationComplete && (
        <div className="success-message">
          Calibration complete! Tracking in progress...
        </div>
      )}
    </div>
  );
};

export default SessionControl;