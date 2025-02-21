import React, { useState, useEffect } from 'react';
import type { GazeData } from '../types/gazeData';
import { format as formatDate } from 'date-fns';
import {
  exportToJSON,
  exportToCSV,
  exportToXLSX,
  exportToDocx,
  exportToMarkdown
} from '../utils/exportUtils';

interface RecordingSessionProps {
  isRecording: boolean;
  startTime: number | null;
  gazeData: GazeData[];
  onExport: () => void;
  isPilot: boolean;
  participantId: string;
  onDiscard?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onKillswitch?: () => void;
  isPaused?: boolean;
}

const RecordingSession: React.FC<RecordingSessionProps> = ({
  isRecording,
  startTime,
  gazeData,
  onExport,
  isPilot,
  participantId,
  onDiscard,
  onPause,
  onResume,
  onKillswitch,
  isPaused = false
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [lastGazePoint, setLastGazePoint] = useState<GazeData | null>(null);
  const [showKillswitchConfirm, setShowKillswitchConfirm] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isRecording && startTime && !isPaused) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const duration = now - startTime;
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        const hours = Math.floor(duration / (1000 * 60 * 60));

        setElapsed(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRecording, startTime, isPaused]);

  useEffect(() => {
    if (gazeData.length > 0) {
      setLastGazePoint(gazeData[gazeData.length - 1]);
    }
  }, [gazeData]);

  const handleExport = (format: string) => {
    const endTime = Date.now();
    const sessionData = {
      participantId,
      sessionType: isPilot ? 'pilot' : 'live',
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: new Date(endTime).toISOString(),
      duration: startTime ? endTime - startTime : 0,
      totalDataPoints: gazeData.length,
      gazeData: isPilot ? [] : gazeData.map(point => {
        const timestamp = typeof point.timestamp === 'number' ? point.timestamp : Date.now();
        const date = new Date(timestamp);
        
        return {
          ...point,
          timestamp,
          time_24h: date.toISOString().slice(0, 19).replace('T', ' ')
        };
      })
    };

    try {
      switch (format) {
        case 'json':
          exportToJSON(sessionData);
          break;
        case 'csv':
          if (isPilot) {
            fetch('/api/pilot/generate-test-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                participantId,
                duration: 5
              })
            })
            .then(response => response.blob())
            .then(blob => {
              const filename = `P${participantId.padStart(3, '0')}_pilot_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
              const link = document.createElement('a');
              link.href = window.URL.createObjectURL(blob);
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(link.href);
            })
            .catch(error => {
              console.error('Failed to generate test data:', error);
              alert('Failed to generate test data. Please try again.');
            });
          } else {
            exportToCSV(sessionData);
          }
          break;
        case 'xlsx':
          exportToXLSX(sessionData);
          break;
        case 'docx':
          exportToDocx(sessionData);
          break;
        case 'md':
          exportToMarkdown(sessionData);
          break;
      }
      setShowExportOptions(false);
      onExport();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleDiscard = () => {
    setShowDiscardPrompt(false);
    if (onDiscard) {
      onDiscard();
    }
  };

  const handleKillswitch = () => {
    if (onKillswitch) {
      setShowKillswitchConfirm(false);
      onKillswitch();
    }
  };

  if (!isRecording && gazeData.length > 0) {
    return (
      <div className="session-end-prompt" style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <h3>Session Complete</h3>
        <p>Would you like to export or discard the recorded data?</p>
        <p>Total data points: {gazeData.length}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={() => setShowExportOptions(true)} style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>Export Data</button>
          <button onClick={() => setShowDiscardPrompt(true)} style={{
            padding: '8px 16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>Discard Data</button>
        </div>

        {showExportOptions && (
          <div style={{ marginTop: '20px' }}>
            <h4>Select Export Format:</h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => handleExport('json')} style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>JSON</button>
              <button onClick={() => handleExport('csv')} style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>CSV</button>
              <button onClick={() => handleExport('xlsx')} style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Excel</button>
              <button onClick={() => handleExport('docx')} style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Word</button>
              <button onClick={() => handleExport('md')} style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Markdown</button>
            </div>
          </div>
        )}

        {showDiscardPrompt && (
          <div style={{ marginTop: '20px' }}>
            <p>Are you sure you want to discard this session's data?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDiscard} style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Yes, Discard</button>
              <button onClick={() => setShowDiscardPrompt(false)} style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const sessionWindow = (
    <div className={`recording-session ${isMinimized ? 'minimized' : ''}`} style={{
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      width: isMinimized ? '200px' : '300px',
      transition: 'all 0.3s ease',
      zIndex: 1000,
      border: '1px solid #ddd'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '10px',
        borderBottom: '1px solid #eee',
        paddingBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isPaused ? '#ff9800' : '#f44336',
            animation: isPaused ? 'none' : 'pulse 1.5s infinite'
          }} />
          <span style={{ fontWeight: 'bold', color: '#333' }}>
            {isPaused ? 'Recording Paused' : 'Recording Session'}
          </span>
        </div>
        <button 
          onClick={() => setIsMinimized(!isMinimized)} 
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            color: '#666',
            fontSize: '16px',
            lineHeight: 1
          }}
        >
          {isMinimized ? '□' : '−'}
        </button>
      </div>

      <div style={{ 
        fontSize: isMinimized ? '12px' : '14px',
        color: '#333'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '8px',
          padding: '4px 8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <span>Time:</span>
          <span style={{ fontWeight: 'bold' }}>{elapsed}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '8px',
          padding: '4px 8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <span>Data Points:</span>
          <span style={{ fontWeight: 'bold' }}>{gazeData.length}</span>
        </div>
        {lastGazePoint && (
          <div style={{ 
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            fontSize: isMinimized ? '11px' : '13px'
          }}>
            <div style={{ marginBottom: '4px' }}>
              <span>Gaze: </span>
              <span style={{ fontWeight: 'bold' }}>
                ({lastGazePoint.x.toFixed(3)}, {lastGazePoint.y.toFixed(3)})
              </span>
            </div>
            {lastGazePoint.confidence !== undefined && (
              <div style={{ marginBottom: '4px' }}>
                <span>Confidence: </span>
                <span style={{ 
                  fontWeight: 'bold',
                  color: lastGazePoint.confidence > 0.8 ? '#4caf50' : 
                         lastGazePoint.confidence > 0.5 ? '#ff9800' : '#f44336'
                }}>
                  {(lastGazePoint.confidence * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {lastGazePoint.pupilD !== undefined && (
              <div style={{ marginBottom: '4px' }}>
                <span>Pupil Diameter: </span>
                <span style={{ fontWeight: 'bold' }}>
                  {lastGazePoint.pupilD.toFixed(1)}mm
                </span>
              </div>
            )}
            {(lastGazePoint.HeadX !== undefined || lastGazePoint.HeadY !== undefined || lastGazePoint.HeadZ !== undefined) && (
              <div style={{ marginBottom: '4px' }}>
                <span>Head Position: </span>
                <span style={{ fontWeight: 'bold' }}>
                  ({lastGazePoint.HeadX?.toFixed(1) || '0.0'}, 
                   {lastGazePoint.HeadY?.toFixed(1) || '0.0'}, 
                   {lastGazePoint.HeadZ?.toFixed(1) || '0.0'})
                </span>
              </div>
            )}
            {(lastGazePoint.HeadYaw !== undefined || lastGazePoint.HeadPitch !== undefined || lastGazePoint.HeadRoll !== undefined) && (
              <div>
                <span>Head Rotation: </span>
                <span style={{ fontWeight: 'bold' }}>
                  ({lastGazePoint.HeadYaw?.toFixed(1) || '0.0'}°, 
                   {lastGazePoint.HeadPitch?.toFixed(1) || '0.0'}°, 
                   {lastGazePoint.HeadRoll?.toFixed(1) || '0.0'}°)
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginTop: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={isPaused ? onResume : onPause}
            style={{
              padding: '6px 12px',
              backgroundColor: isPaused ? '#4CAF50' : '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              flex: '1'
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => setShowExportOptions(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              flex: '1'
            }}
          >
            Export
          </button>
          {onKillswitch && (
            <button
              onClick={() => setShowKillswitchConfirm(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                flex: '1'
              }}
            >
              Killswitch
            </button>
          )}
        </div>
      </div>

      {showKillswitchConfirm && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          zIndex: 1001,
          width: '250px'
        }}>
          <p style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#f44336' }}>
            Are you sure you want to terminate the session immediately?
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleKillswitch}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Terminate
            </button>
            <button
              onClick={() => setShowKillswitchConfirm(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
          .recording-session {
            max-height: ${isMinimized ? '200px' : '400px'};
            overflow: hidden;
          }
          .recording-session.minimized {
            max-height: 200px;
          }
        `}
      </style>
    </div>
  );

  return sessionWindow;
};

export default RecordingSession; 