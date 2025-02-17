import React, { useState, useCallback } from 'react';
import { startTracking, stopTracking } from '../lib/gazecloud';
import type { GazeData } from '../types/gazeData';
import RecordingSession from './RecordingSession';

const SessionControl: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [gazeData, setGazeData] = useState<GazeData[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);

  const handleGazeData = useCallback((data: GazeData) => {
    setGazeData(prev => [...prev, data]);
  }, []);

  const handleStartTracking = () => {
    setGazeData([]);
    setStartTime(Date.now());
    startTracking(
      handleGazeData,
      () => {
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

  const handleExport = () => {
    const exportData = {
      sessionInfo: {
        startTime: startTime,
        endTime: Date.now(),
        duration: startTime ? Date.now() - startTime : 0,
        totalDataPoints: gazeData.length
      },
      gazeData: gazeData
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gaze-tracking-session-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="session-control" style={{ marginBottom: '20px' }}>
      <h2>Gaze Tracking Session</h2>
      <div className="button-group" style={{ marginTop: '10px' }}>
        {!isTracking ? (
          <button
            onClick={handleStartTracking}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Start Tracking
          </button>
        ) : (
          <button
            onClick={handleStopTracking}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Stop Tracking
          </button>
        )}
      </div>
      {calibrationComplete && (
        <div
          className="success-message"
          style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#dff0d8',
            color: '#3c763d',
            borderRadius: '4px'
          }}
        >
          Calibration complete! Tracking in progress...
        </div>
      )}

      <RecordingSession
        isRecording={isTracking}
        startTime={startTime}
        gazeData={gazeData}
        onExport={handleExport}
      />
    </div>
  );
};

export default SessionControl;