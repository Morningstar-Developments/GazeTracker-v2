import React, { useState, useEffect } from 'react';
import type { GazeData } from '../types/gazeData';
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
}

const RecordingSession: React.FC<RecordingSessionProps> = ({
  isRecording,
  startTime,
  gazeData,
  onExport,
  isPilot,
  participantId,
  onDiscard
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [lastGazePoint, setLastGazePoint] = useState<GazeData | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isRecording && startTime) {
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
  }, [isRecording, startTime]);

  useEffect(() => {
    if (gazeData.length > 0) {
      setLastGazePoint(gazeData[gazeData.length - 1]);
    }
  }, [gazeData]);

  const handleExport = (format: string) => {
    const sessionData = {
      participantId,
      sessionType: isPilot ? 'pilot' : 'live',
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: Date.now() ? new Date(Date.now()).toISOString() : null,
      duration: startTime ? Date.now() - startTime : 0,
      totalDataPoints: gazeData.length,
      gazeData
    };

    switch (format) {
      case 'json':
        exportToJSON(sessionData);
        break;
      case 'csv':
        exportToCSV(sessionData);
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
  };

  const handleDiscard = () => {
    setShowDiscardPrompt(false);
    if (onDiscard) {
      onDiscard();
    }
  };

  if (!isRecording) {
    if (gazeData.length > 0) {
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
                <button onClick={() => handleExport('json')}>JSON</button>
                <button onClick={() => handleExport('csv')}>CSV</button>
                <button onClick={() => handleExport('xlsx')}>Excel</button>
                <button onClick={() => handleExport('docx')}>Word</button>
                <button onClick={() => handleExport('md')}>Markdown</button>
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
    return null;
  }

  const sessionWindow = (
    <div className={`recording-session ${isMinimized ? 'minimized' : ''}`} style={{
      position: 'fixed',
      right: '20px',
      bottom: isMinimized ? '20px' : '50%',
      transform: isMinimized ? 'none' : 'translateY(50%)',
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      width: isMinimized ? '200px' : '300px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 'bold' }}>Recording Session</span>
        <button onClick={() => setIsMinimized(!isMinimized)} style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: '4px'
        }}>
          {isMinimized ? '□' : '−'}
        </button>
      </div>

      <div style={{ fontSize: isMinimized ? '12px' : '14px' }}>
        <div>Time: {elapsed}</div>
        <div>Data Points: {gazeData.length}</div>
        {lastGazePoint && (
          <div style={{ fontSize: '11px', marginTop: '5px' }}>
            <div>Last Position: ({Math.round(lastGazePoint.x)}, {Math.round(lastGazePoint.y)})</div>
            {lastGazePoint.confidence !== undefined && (
              <div>Confidence: {(lastGazePoint.confidence * 100).toFixed(1)}%</div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return sessionWindow;
};

export default RecordingSession; 