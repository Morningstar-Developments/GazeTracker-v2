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
        
        if (sessionConfig.isPilot && newData.length % 100 === 0) {
          setDebugLog(prevLog => [
            ...prevLog,
            `[${enhancedData.formattedTime}] Collected ${newData.length} data points`
          ].slice(-100));
        } else if (!sessionConfig.isPilot && newData.length % 100 === 0) {
          setDebugLog(prevLog => [
            ...prevLog,
            `[${enhancedData.formattedTime}] Recorded ${newData.length} data points to CSV file`
          ].slice(-100));
        }
        
        return newData;
      });

      if (sessionConfig.isPilot) {
        setDebugLog(prev => [
          ...prev,
          `[${enhancedData.formattedTime}] Gaze: (${data.x.toFixed(3)}, ${data.y.toFixed(3)}) | ` +
          `Conf: ${(data.confidence || 0).toFixed(2)} | ` +
          `Pupil: ${(data.pupilD || 0).toFixed(1)}mm | ` +
          `Head Pos: (${(data.HeadX || 0).toFixed(1)}, ${(data.HeadY || 0).toFixed(1)}, ${(data.HeadZ || 0).toFixed(1)}) | ` +
          `Head Rot: (${(data.HeadYaw || 0).toFixed(1)}°, ${(data.HeadPitch || 0).toFixed(1)}°, ${(data.HeadRoll || 0).toFixed(1)}°)`
        ].slice(-100));
      }
    } catch (error) {
      console.error('Error processing gaze data:', error);
      if (sessionConfig.isPilot) {
        setDebugLog(prev => [
          ...prev,
          `[${format(new Date(), 'HH:mm:ss.SSS')}] Error processing gaze data: ${error}`
        ].slice(-100));
      }
    }
  }, [startTime, sessionConfig, isPaused]);

  const handleStartTracking = async () => {
    if (!sessionConfig) return;
    
    try {
      // Initialize session first
      await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantId: sessionConfig.participantId,
          isPilot: sessionConfig.isPilot
        })
      });

      setGazeData([]);
      setDebugLog([]);
      setLastLoggedCount(0);
      setStartTime(Date.now());
      setIsPaused(false);

      // Add initialization log
      if (!sessionConfig.isPilot) {
        setDebugLog(prev => [
          ...prev,
          `[${format(new Date(), 'HH:mm:ss.SSS')}] Initializing live recording session...`,
          `[${format(new Date(), 'HH:mm:ss.SSS')}] Starting eye tracking calibration...`
        ]);
      }

      startTracking(
        handleGazeData,
        () => {
          setCalibrationComplete(true);
          // Set start time here to begin recording immediately after calibration
          setStartTime(Date.now());
          if (sessionConfig.isPilot) {
            setDebugLog(prev => [...prev, `[${format(new Date(), 'HH:mm:ss.SSS')}] Calibration complete`]);
          } else {
            setDebugLog(prev => [
              ...prev,
              `[${format(new Date(), 'HH:mm:ss.SSS')}] Calibration complete - Starting live data recording...`,
              `[${format(new Date(), 'HH:mm:ss.SSS')}] CSV file created and ready for data collection`
            ]);
          }
        }
      );
      setIsTracking(true);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      alert('Failed to initialize recording session. Please try again.');
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

  const handleExport = () => {
    // This function is now just a placeholder as the actual export
    // is handled by RecordingSession.tsx
    console.log('Export completed');
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

      {sessionConfig.isPilot && debugLog.length > 0 && (
        <div
          className="debug-log"
          style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Debug Log:</div>
          {debugLog.map((log, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
          ))}
        </div>
      )}

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