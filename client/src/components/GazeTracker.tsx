import React, { useCallback, useState } from 'react';
import { startTracking, stopTracking } from '../lib/gazecloud';
import { fetchApi } from '../lib/api';
import type { GazeData, SessionConfig } from '../types/gazeData';

export default function SessionControl() {
  const [isTracking, setIsTracking] = useState(false);
  const [config, setConfig] = useState<SessionConfig>({
    participantId: '',
    isPilot: false
  });

  const handleStartSession = useCallback(async () => {
    // Create new session with config
    await fetchApi('api/sessions', {
      method: 'POST',
      body: JSON.stringify(config)
    });

    // Start eye tracking
    startTracking(
      (data: GazeData) => {
        // Send gaze data to current session
        fetchApi('api/sessions/current/gaze', {
          method: 'POST',
          body: JSON.stringify(data),
        }).catch(console.error);
      },
      () => console.log('Calibration complete')
    );
    setIsTracking(true);
  }, [config]);

  const handleStopSession = useCallback(async () => {
    // Stop eye tracking
    stopTracking();
    setIsTracking(false);

    // End current session
    await fetchApi('api/sessions/current', {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' })
    });

    // Reset config
    setConfig({
      participantId: '',
      isPilot: false
    });
  }, []);

  return (
    <div className="session-control">
      <h2>Session Control</h2>
      
      <div className="config-form">
        <div className="form-group">
          <label htmlFor="participantId">Participant ID:</label>
          <input
            type="text"
            id="participantId"
            value={config.participantId}
            onChange={(e) => setConfig((prev: SessionConfig) => ({
              ...prev,
              participantId: e.target.value
            }))}
            disabled={isTracking}
          />
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={config.isPilot}
              onChange={(e) => setConfig((prev: SessionConfig) => ({
                ...prev,
                isPilot: e.target.checked
              }))}
              disabled={isTracking}
            />
            Pilot Session
          </label>
        </div>
      </div>

      <div className="button-group">
        <button 
          type="button"
          onClick={handleStartSession}
          disabled={isTracking || !config.participantId}
        >
          Start Session
        </button>
        <button 
          type="button"
          onClick={handleStopSession}
          disabled={!isTracking}
        >
          End Session
        </button>
      </div>

      <div id="gaze" className="gaze-point" style={{ display: 'none' }} />
    </div>
  );
}