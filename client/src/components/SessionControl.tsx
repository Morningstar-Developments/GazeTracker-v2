import React, { useState, useCallback, useEffect } from 'react';
import { startTracking, stopTracking } from '../lib/gazecloud';
import type { GazeData } from '../types/gazeData';
import RecordingSession from './RecordingSession';
import SessionConfig, { SessionConfigData } from './SessionConfig';
import { format } from 'date-fns';
import { exportToCSV } from '../utils/exportUtils';

interface EnhancedGazeData extends GazeData {
  participantId: string;
  sessionType: 'pilot' | 'live';
  formattedTime: string;
  formattedDate: string;
  sessionTime: number;
  sessionTimeFormatted: string;
}

const SessionControl: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [gazeData, setGazeData] = useState<EnhancedGazeData[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfigData | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [lastLoggedCount, setLastLoggedCount] = useState<number>(0);

  // Add periodic logging effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isTracking && !isPaused && sessionConfig?.isPilot) {
      intervalId = setInterval(() => {
        const currentCount = gazeData.length;
        if (currentCount > lastLoggedCount) {
          const now = new Date();
          const rate = ((currentCount - lastLoggedCount) / 5).toFixed(1); // points per second
          setDebugLog(prev => [
            ...prev,
            `[${format(now, 'HH:mm:ss.SSS')}] Collection Status: ${currentCount} total points (${rate} pts/sec)`
          ].slice(-100));
          setLastLoggedCount(currentCount);
        }
      }, 5000); // Log every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTracking, isPaused, sessionConfig, gazeData.length, lastLoggedCount]);

  const handleGazeData = useCallback((data: GazeData) => {
    if (!startTime || !sessionConfig || isPaused) return;

    try {
      const now = new Date();
      const sessionDuration = Date.now() - startTime;
      
      const enhancedData: EnhancedGazeData = {
        ...data,
        participantId: sessionConfig.participantId,
        sessionType: sessionConfig.isPilot ? 'pilot' : 'live',
        formattedTime: format(now, 'HH:mm:ss.SSS'),
        formattedDate: format(now, 'yyyy-MM-dd'),
        sessionTime: sessionDuration,
        sessionTimeFormatted: format(sessionDuration, 'mm:ss.SSS')
      };

      setGazeData(prev => {
        const newData = [...prev, enhancedData];
        
        // Log every 100 points for both pilot and live sessions
        if (newData.length % 100 === 0) {
          const rate = (100 / (Date.now() - (prev[prev.length - 100]?.timestamp || Date.now())) * 1000).toFixed(1);
          setDebugLog(prevLog => [
            ...prevLog,
            `[${enhancedData.formattedTime}] ${newData.length} points collected (${rate} pts/sec)`
          ].slice(-500)); // Increased log size
        }

        // Log detailed data point info for pilot mode
        if (sessionConfig.isPilot && data.state !== undefined) {
          const stateMsg = data.state === 0 ? 'valid' : data.state === -1 ? 'face lost' : 'uncalibrated';
          setDebugLog(prev => [
            ...prev,
            `[${enhancedData.formattedTime}] Gaze: (${data.x.toFixed(3)}, ${data.y.toFixed(3)}) | ` +
            `State: ${stateMsg} | Conf: ${(data.confidence || 0).toFixed(2)} | ` +
            `Pupil: ${(data.pupilD || 0).toFixed(1)}mm | ` +
            `Head Pos: (${(data.HeadX || 0).toFixed(1)}, ${(data.HeadY || 0).toFixed(1)}, ${(data.HeadZ || 0).toFixed(1)}) | ` +
            `Head Rot: (${(data.HeadYaw || 0).toFixed(1)}°, ${(data.HeadPitch || 0).toFixed(1)}°, ${(data.HeadRoll || 0).toFixed(1)}°)`
          ].slice(-500));
        }
        
        return newData;
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ⚠️ Error processing gaze data: ${errorMsg}`
      ].slice(-500));
      console.error('Error processing gaze data:', error);
    }
  }, [startTime, sessionConfig, isPaused]);

  // Add server response logging
  const logServerResponse = useCallback((action: string, response: any) => {
    const timestamp = format(new Date(), 'HH:mm:ss.SSS');
    if (response.error) {
      setDebugLog(prev => [
        ...prev,
        `[${timestamp}] ❌ Server Error (${action}): ${response.error}`
      ].slice(-500));
    } else {
      setDebugLog(prev => [
        ...prev,
        `[${timestamp}] ✓ ${action} successful`
      ].slice(-500));
    }
  }, []);

  const handleStartTracking = async () => {
    if (!sessionConfig) return;
    
    try {
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Initializing session...`
      ]);

      // Initialize session first
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: sessionConfig.participantId,
          isPilot: sessionConfig.isPilot
        })
      });

      const result = await response.json();
      logServerResponse('Session initialization', result);

      setGazeData([]);
      setLastLoggedCount(0);
      setStartTime(Date.now());
      setIsPaused(false);

      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Starting eye tracking calibration...`,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Please follow the calibration points with your eyes...`
      ]);

      startTracking(
        handleGazeData,
        () => {
          setCalibrationComplete(true);
          setStartTime(Date.now());
          setDebugLog(prev => [
            ...prev,
            `[${format(new Date(), 'HH:mm:ss.SSS')}] ✓ Calibration complete`,
            `[${format(new Date(), 'HH:mm:ss.SSS')}] Starting data collection...`
          ]);
        }
      );
      setIsTracking(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ❌ Failed to initialize session: ${errorMsg}`
      ]);
      console.error('Failed to initialize session:', error);
      alert('Failed to initialize recording session. Please check the debug log for details.');
    }
  };

  const handleStopTracking = () => {
    stopTracking();
    setIsTracking(false);
    setIsPaused(false);
    setCalibrationComplete(false);
    if (sessionConfig?.isPilot) {
      setDebugLog(prev => [...prev, `[${format(new Date(), 'HH:mm:ss.SSS')}] Session stopped`]);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    if (sessionConfig?.isPilot) {
      setDebugLog(prev => [...prev, `[${format(new Date(), 'HH:mm:ss.SSS')}] Session paused`]);
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    if (sessionConfig?.isPilot) {
      setDebugLog(prev => [...prev, `[${format(new Date(), 'HH:mm:ss.SSS')}] Session resumed`]);
    }
  };

  const handleKillswitch = () => {
    stopTracking();
    setIsTracking(false);
    setIsPaused(false);
    setCalibrationComplete(false);
    setGazeData([]);
    if (sessionConfig?.isPilot) {
      setDebugLog(prev => [
        ...prev, 
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Session terminated by killswitch`
      ]);
    }
  };

  const handleDiscardSession = () => {
    setGazeData([]);
    setStartTime(null);
    setDebugLog([]);
    if (sessionConfig?.isPilot) {
      setDebugLog(prev => [...prev, `[${format(new Date(), 'HH:mm:ss.SSS')}] Session data discarded`]);
    }
  };

  const handleExport = async () => {
    if (!sessionConfig) {
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ❌ Export failed: No session configuration found`
      ]);
      return;
    }

    try {
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Starting data export...`
      ]);

      // End the session and get data
      const response = await fetch('/api/sessions/current/end', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to end session: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.files || !result.sessionData) {
        throw new Error('No session data or files received from server');
      }

      // Log export progress
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ✓ Session data retrieved`,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Raw data file: ${result.files.raw}`,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Processing data for export...`
      ]);

      // Create session data object
      const sessionData = {
        participantId: sessionConfig.participantId,
        sessionType: sessionConfig.isPilot ? 'pilot' : 'live',
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: new Date().toISOString(),
        duration: startTime ? Date.now() - startTime : 0,
        totalDataPoints: result.sessionData.length,
        gazeData: result.sessionData
      };

      // Export to CSV
      await exportToCSV(sessionData);
      
      // Download the raw CSV file
      const csvResponse = await fetch(`/recordings/live/P${sessionConfig.participantId.padStart(3, '0')}/${result.files.raw}`);
      if (!csvResponse.ok) {
        throw new Error('Failed to download raw CSV file');
      }
      
      const csvBlob = await csvResponse.blob();
      const csvUrl = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = csvUrl;
      link.download = result.files.raw;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(csvUrl);

      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ✓ Exported processed data to CSV`,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ✓ Downloaded raw data file`,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] Export complete - ${sessionData.totalDataPoints} points saved`
      ]);

      // Clear the session data
      setGazeData([]);
      setStartTime(null);
      setCalibrationComplete(false);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setDebugLog(prev => [
        ...prev,
        `[${format(new Date(), 'HH:mm:ss.SSS')}] ❌ Export failed: ${errorMsg}`
      ]);
      console.error('Export failed:', error);
      alert('Failed to export data. Please check the debug log for details.');
    }
  };

  if (!sessionConfig) {
    return <SessionConfig onConfigSubmit={setSessionConfig} />;
  }

  return (
    <div className="session-control" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>Session Control</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            onClick={isTracking ? handleStopTracking : handleStartTracking}
            style={{
              padding: '10px 20px',
              backgroundColor: isTracking ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isTracking ? 'Stop Recording' : 'Start Recording'}
          </button>
          {!isTracking && gazeData.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>Export Session Data</span>
              <span style={{ fontSize: '12px' }}>({gazeData.length} points)</span>
            </button>
          )}
          {sessionConfig.isPilot && !isTracking && (
            <button
              onClick={() => {
                fetch('/api/pilot/generate-test-data', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    participantId: sessionConfig.participantId,
                    duration: 5
                  })
                })
                .then(response => response.json())
                .then(data => {
                  if (data.error) {
                    throw new Error(data.error);
                  }

                  const sessionData = {
                    participantId: sessionConfig.participantId,
                    sessionType: 'pilot',
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + (5 * 60 * 1000)).toISOString(),
                    duration: 5 * 60 * 1000,
                    totalDataPoints: data.gazeData.length,
                    gazeData: data.gazeData
                  };

                  exportToCSV(sessionData);
                })
                .catch(error => {
                  console.error('Failed to generate test data:', error);
                  alert('Failed to generate test data. Please try again.');
                });
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Generate Test Data
            </button>
          )}
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          <div>Participant ID: {sessionConfig.participantId}</div>
          <div>Mode: {sessionConfig.isPilot ? 'Pilot' : 'Live'}</div>
          {calibrationComplete && <div style={{ color: '#4CAF50' }}>✓ Calibration Complete</div>}
          {gazeData.length > 0 && (
            <div style={{ color: '#2196F3' }}>
              Data Points: {gazeData.length} | 
              Rate: {((gazeData.length / ((Date.now() - (startTime || Date.now())) / 1000)) || 0).toFixed(1)} Hz
            </div>
          )}
        </div>
      </div>

      <div
        className="debug-log"
        style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#1a1a1a',
          color: '#00ff00',
          borderRadius: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontSize: '13px',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ 
          marginBottom: '10px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid #333',
          paddingBottom: '5px'
        }}>
          <span style={{ fontWeight: 'bold', color: '#fff' }}>Debug Log</span>
          <div>
            <span style={{ fontSize: '12px', color: '#888' }}>
              Session: {sessionConfig.participantId} | 
              Mode: {sessionConfig.isPilot ? 'Pilot' : 'Live'} | 
              Points: {gazeData.length}
            </span>
          </div>
        </div>
        {debugLog.map((log, index) => {
          const isError = log.includes('❌') || log.includes('⚠️');
          const isSuccess = log.includes('✓');
          return (
            <div 
              key={index} 
              style={{ 
                marginBottom: '4px',
                color: isError ? '#ff4444' : isSuccess ? '#00ff00' : '#fff',
                paddingLeft: '5px',
                borderLeft: isError ? '2px solid #ff4444' : 
                           isSuccess ? '2px solid #00ff00' : 
                           '2px solid transparent'
              }}
            >
              {log}
            </div>
          );
        })}
      </div>

      <RecordingSession
        isRecording={isTracking}
        isPaused={isPaused}
        startTime={startTime}
        gazeData={gazeData}
        onExport={handleExport}
        isPilot={sessionConfig.isPilot}
        participantId={sessionConfig.participantId}
        onDiscard={handleDiscardSession}
        onPause={handlePause}
        onResume={handleResume}
        onKillswitch={sessionConfig.isPilot ? handleKillswitch : undefined}
      />
    </div>
  );
};

export default SessionControl;