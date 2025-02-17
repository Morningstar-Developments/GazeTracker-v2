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
}

const RecordingSession: React.FC<RecordingSessionProps> = ({
  isRecording,
  startTime,
  gazeData,
  onExport
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00:00');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

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

  const handleExport = (format: string) => {
    const sessionData = {
      sessionInfo: {
        startTime,
        endTime: Date.now(),
        duration: startTime ? Date.now() - startTime : 0,
        totalDataPoints: gazeData.length
      },
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

  if (!isRecording) return null;

  return (
    <div
      className="recording-session"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
        padding: isMinimized ? '10px' : '20px',
        width: isMinimized ? 'auto' : '300px',
        transition: 'all 0.3s ease',
        zIndex: 9999,
        border: '1px solid #ddd'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMinimized ? '0' : '15px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ff4444',
              animation: 'pulse 1.5s infinite'
            }}
          />
          <span style={{ fontWeight: 'bold' }}>Recording</span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '5px'
          }}
        >
          {isMinimized ? '□' : '−'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div
            style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{elapsed}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Duration</div>
          </div>

          <div
            style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px'
            }}
          >
            <div style={{ marginBottom: '5px', fontSize: '12px', color: '#666' }}>
              Data Points: {gazeData.length}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Last Position: {gazeData.length > 0
                ? `(${Math.round(gazeData[gazeData.length - 1].x)}, ${Math.round(gazeData[gazeData.length - 1].y)})`
                : 'N/A'}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportOptions(!showExportOptions)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
            >
              Export Session Data
            </button>

            {showExportOptions && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
                  marginBottom: '5px',
                  padding: '10px'
                }}
              >
                {['JSON', 'CSV', 'XLSX', 'DOCX', 'Markdown'].map((format) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format.toLowerCase())}
                    className="export-format-button"
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '5px',
                      backgroundColor: '#f5f5f5',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s'
                    }}
                  >
                    Export as {format}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>
        {`
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.2);
              opacity: 0.7;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .export-format-button:hover {
            background-color: #e0e0e0 !important;
          }
        `}
      </style>
    </div>
  );
};

export default RecordingSession; 