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
import { saveAs } from 'file-saver';
import Heatmap from './Heatmap';
import { getClickAccuracyStats } from '../lib/gazecloud';
import { GazeAnalytics } from '../lib/analyticsService';

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
  const [dataPoints, setDataPoints] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [lastGazePoint, setLastGazePoint] = useState<GazeData | null>(null);
  const [showKillswitchConfirm, setShowKillswitchConfirm] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [accuracyStats, setAccuracyStats] = useState<{
    totalClicks: number;
    accurateClicks: number;
    accuracy: number;
    averageDistance: number;
  } | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState<ReturnType<typeof GazeAnalytics.computeMetrics> | null>(null);

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
      setDataPoints(gazeData.length);
    }
  }, [gazeData]);

  useEffect(() => {
    if (!isRecording || isPaused) return;

    const intervalId = setInterval(() => {
      const stats = getClickAccuracyStats();
      if (stats) {
        setAccuracyStats({
          totalClicks: stats.totalClicks,
          accurateClicks: stats.accurateClicks,
          accuracy: stats.accuracy,
          averageDistance: stats.averageDistance
        });
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (!isRecording || isPaused || gazeData.length === 0) return;

    const intervalId = setInterval(() => {
      try {
        const newMetrics = GazeAnalytics.computeMetrics(gazeData);
        setMetrics(newMetrics);
      } catch (error) {
        console.error('Error computing metrics:', error);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isRecording, isPaused, gazeData]);

  const handleExport = async () => {
    try {
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

      // Create session data object
      const sessionData = {
        participantId,
        sessionType: isPilot ? 'pilot' : 'live',
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: new Date().toISOString(),
        duration: startTime ? Date.now() - startTime : 0,
        totalDataPoints: result.sessionData.length,
        gazeData: result.sessionData
      };

      // Export based on selected format
      if (showExportOptions) {
        setShowExportOptions(false);
        return;
      }

      // Default to CSV export
      await exportToCSV(sessionData);
      
      // Download the raw CSV file as well
      const csvResponse = await fetch(`/recordings/live/P${participantId.padStart(3, '0')}/${result.files.raw}`);
      if (!csvResponse.ok) {
        throw new Error('Failed to download CSV file');
      }
      
      const csvBlob = await csvResponse.blob();
      saveAs(csvBlob, result.files.raw);

      onExport();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export data: ${error instanceof Error ? error.message : String(error)}`);
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
              <button onClick={async () => {
                try {
                  const response = await fetch('/api/sessions/current/end', {
                    method: 'POST'
                  });
                  const result = await response.json();
                  
                  if (result.error) {
                    throw new Error(result.error);
                  }

                  if (result.sessionData) {
                    const sessionData = {
                      participantId,
                      sessionType: isPilot ? 'pilot' : 'live',
                      startTime: startTime ? new Date(startTime).toISOString() : null,
                      endTime: new Date().toISOString(),
                      duration: startTime ? Date.now() - startTime : 0,
                      totalDataPoints: result.sessionData.length,
                      gazeData: result.sessionData
                    };

                    await exportToCSV(sessionData);
                  }
                  setShowExportOptions(false);
                  onExport();
                } catch (error) {
                  console.error('Export failed:', error);
                  alert('Failed to export data. Please try again.');
                }
              }} style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>CSV</button>
              
              <button onClick={async () => {
                try {
                  const response = await fetch('/api/sessions/current/end', {
                    method: 'POST'
                  });
                  const result = await response.json();
                  
                  if (result.error) {
                    throw new Error(result.error);
                  }

                  if (result.sessionData) {
                    const sessionData = {
                      participantId,
                      sessionType: isPilot ? 'pilot' : 'live',
                      startTime: startTime ? new Date(startTime).toISOString() : null,
                      endTime: new Date().toISOString(),
                      duration: startTime ? Date.now() - startTime : 0,
                      totalDataPoints: result.sessionData.length,
                      gazeData: result.sessionData
                    };

                    await exportToJSON(sessionData);
                  }
                  setShowExportOptions(false);
                  onExport();
                } catch (error) {
                  console.error('Export failed:', error);
                  alert('Failed to export data. Please try again.');
                }
              }} style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>JSON</button>

              <button onClick={async () => {
                try {
                  const response = await fetch('/api/sessions/current/end', {
                    method: 'POST'
                  });
                  const result = await response.json();
                  
                  if (result.error) {
                    throw new Error(result.error);
                  }

                  if (result.sessionData) {
                    const sessionData = {
                      participantId,
                      sessionType: isPilot ? 'pilot' : 'live',
                      startTime: startTime ? new Date(startTime).toISOString() : null,
                      endTime: new Date().toISOString(),
                      duration: startTime ? Date.now() - startTime : 0,
                      totalDataPoints: result.sessionData.length,
                      gazeData: result.sessionData
                    };

                    await exportToXLSX(sessionData);
                  }
                  setShowExportOptions(false);
                  onExport();
                } catch (error) {
                  console.error('Export failed:', error);
                  alert('Failed to export data. Please try again.');
                }
              }} style={{
                padding: '8px 16px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Excel</button>

              <button onClick={async () => {
                try {
                  const response = await fetch('/api/sessions/current/end', {
                    method: 'POST'
                  });
                  const result = await response.json();
                  
                  if (result.error) {
                    throw new Error(result.error);
                  }

                  if (result.sessionData) {
                    const sessionData = {
                      participantId,
                      sessionType: isPilot ? 'pilot' : 'live',
                      startTime: startTime ? new Date(startTime).toISOString() : null,
                      endTime: new Date().toISOString(),
                      duration: startTime ? Date.now() - startTime : 0,
                      totalDataPoints: result.sessionData.length,
                      gazeData: result.sessionData
                    };

                    await exportToDocx(sessionData);
                  }
                  setShowExportOptions(false);
                  onExport();
                } catch (error) {
                  console.error('Export failed:', error);
                  alert('Failed to export data. Please try again.');
                }
              }} style={{
                padding: '8px 16px',
                backgroundColor: '#673AB7',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>Word</button>

              <button onClick={async () => {
                try {
                  const response = await fetch('/api/sessions/current/end', {
                    method: 'POST'
                  });
                  const result = await response.json();
                  
                  if (result.error) {
                    throw new Error(result.error);
                  }

                  if (result.sessionData) {
                    const sessionData = {
                      participantId,
                      sessionType: isPilot ? 'pilot' : 'live',
                      startTime: startTime ? new Date(startTime).toISOString() : null,
                      endTime: new Date().toISOString(),
                      duration: startTime ? Date.now() - startTime : 0,
                      totalDataPoints: result.sessionData.length,
                      gazeData: result.sessionData
                    };

                    await exportToMarkdown(sessionData);
                  }
                  setShowExportOptions(false);
                  onExport();
                } catch (error) {
                  console.error('Export failed:', error);
                  alert('Failed to export data. Please try again.');
                }
              }} style={{
                padding: '8px 16px',
                backgroundColor: '#607D8B',
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

  const metricsPanel = metrics && showMetrics ? (
    <div style={{
      position: 'fixed',
      left: '20px',
      top: '20px',
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '300px',
      maxHeight: '80vh',
      overflowY: 'auto',
      zIndex: 1000
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '15px',
        borderBottom: '1px solid #eee',
        paddingBottom: '8px'
      }}>
        <h3 style={{ margin: 0 }}>Gaze Metrics</h3>
        <button
          onClick={() => setShowMetrics(false)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: '#666'
          }}
        >×</button>
      </div>

      <div style={{ fontSize: '14px' }}>
        {/* Basic Stats */}
        <div className="metric-section">
          <h4 style={{ color: '#2196F3', marginBottom: '8px' }}>Basic Statistics</h4>
          <div className="metric-row">
            <span>Sampling Rate:</span>
            <span>{metrics.samplingRate.toFixed(1)} Hz</span>
          </div>
          <div className="metric-row">
            <span>Data Quality:</span>
            <span style={{
              color: metrics.dataQuality > 80 ? '#4caf50' : 
                     metrics.dataQuality > 60 ? '#ff9800' : '#f44336'
            }}>
              {metrics.dataQuality.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Fixation Metrics */}
        <div className="metric-section">
          <h4 style={{ color: '#4CAF50', marginBottom: '8px' }}>Fixations</h4>
          <div className="metric-row">
            <span>Count:</span>
            <span>{metrics.fixationCount}</span>
          </div>
          <div className="metric-row">
            <span>Average Duration:</span>
            <span>{metrics.averageFixationDuration.toFixed(1)} ms</span>
          </div>
          <div className="metric-row">
            <span>Frequency:</span>
            <span>{metrics.fixationFrequency.toFixed(2)}/s</span>
          </div>
        </div>

        {/* Saccade Metrics */}
        <div className="metric-section">
          <h4 style={{ color: '#FF9800', marginBottom: '8px' }}>Saccades</h4>
          <div className="metric-row">
            <span>Count:</span>
            <span>{metrics.saccadeCount}</span>
          </div>
          <div className="metric-row">
            <span>Average Amplitude:</span>
            <span>{metrics.averageSaccadeAmplitude.toFixed(1)} px</span>
          </div>
          <div className="metric-row">
            <span>Average Velocity:</span>
            <span>{metrics.averageSaccadeVelocity.toFixed(1)}°/s</span>
          </div>
        </div>

        {/* Spatial Metrics */}
        <div className="metric-section">
          <h4 style={{ color: '#9C27B0', marginBottom: '8px' }}>Spatial Metrics</h4>
          <div className="metric-row">
            <span>Scanpath Length:</span>
            <span>{metrics.scanpathLength.toFixed(1)} px</span>
          </div>
          <div className="metric-row">
            <span>Coverage Area:</span>
            <span>{metrics.convexHullArea.toFixed(0)} px²</span>
          </div>
        </div>

        {/* Head Stability */}
        <div className="metric-section">
          <h4 style={{ color: '#607D8B', marginBottom: '8px' }}>Head Stability</h4>
          <div className="metric-row">
            <span>Position (RMS):</span>
            <span>
              {metrics.headStability.x.toFixed(1)}, 
              {metrics.headStability.y.toFixed(1)}, 
              {metrics.headStability.z.toFixed(1)}
            </span>
          </div>
          <div className="metric-row">
            <span>Rotation (RMS):</span>
            <span>
              {metrics.headStability.yaw.toFixed(1)}°, 
              {metrics.headStability.pitch.toFixed(1)}°, 
              {metrics.headStability.roll.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Pupil Metrics */}
        <div className="metric-section">
          <h4 style={{ color: '#795548', marginBottom: '8px' }}>Pupil Metrics</h4>
          <div className="metric-row">
            <span>Average Diameter:</span>
            <span>{metrics.averagePupilDiameter.toFixed(2)} mm</span>
          </div>
          <div className="metric-row">
            <span>Variability:</span>
            <span>{metrics.pupilDiameterVariability.toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      <style>
        {`
          .metric-section {
            margin-bottom: 15px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
          }
          .metric-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .metric-row span:first-child {
            color: #666;
          }
          .metric-row span:last-child {
            font-weight: bold;
          }
        `}
      </style>
    </div>
  ) : null;

  const sessionWindow = (
    <>
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
            <span style={{ fontWeight: 'bold' }}>Recording Session</span>
            {isRecording && !isPaused && (
              <div className="recording-indicator" />
            )}
          </div>
          <div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {isMinimized ? '□' : '−'}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div style={{ marginBottom: '12px' }}>
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
                <span style={{ fontWeight: 'bold' }}>{dataPoints}</span>
              </div>
              {lastGazePoint && (
                <div style={{ 
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  <div style={{ marginBottom: '4px' }}>
                    <span>Gaze: </span>
                    <span style={{ fontWeight: 'bold' }}>
                      ({lastGazePoint.x?.toFixed(3) || '0.000'}, {lastGazePoint.y?.toFixed(3) || '0.000'})
                    </span>
                  </div>
                  {lastGazePoint.confidence !== undefined && (
                    <div style={{ marginBottom: '4px' }}>
                      <span>Confidence: </span>
                      <span style={{ 
                        fontWeight: 'bold',
                        color: (lastGazePoint.confidence || 0) > 0.8 ? '#4caf50' : 
                               (lastGazePoint.confidence || 0) > 0.5 ? '#ff9800' : '#f44336'
                      }}>
                        {((lastGazePoint.confidence || 0) * 100).toFixed(1)}%
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
                </div>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginTop: '12px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={onExport}
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
                Export Data
              </button>
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: showMetrics ? '#f44336' : '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  flex: '1'
                }}
              >
                {showMetrics ? 'Hide Metrics' : 'Show Metrics'}
              </button>
            </div>
          </>
        )}
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
    </>
  );

  return sessionWindow;
};

export default RecordingSession; 