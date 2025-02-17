import React, { useEffect, useRef } from 'react';
import type { GazeData } from '../types/gazeData';

interface GazeTrackerProps {
  onGazeData?: (data: GazeData) => void;
}

const GazeTracker: React.FC<GazeTrackerProps> = ({ onGazeData }) => {
  const gazePointRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGazeData = (data: GazeData) => {
      if (gazePointRef.current) {
        gazePointRef.current.style.display = 'block';
        gazePointRef.current.style.transform = `translate(${data.x}px, ${data.y}px)`;
      }
      onGazeData?.(data);
    };

    // Add event listener for gaze data
    window.GazeCloudAPI.OnResult = handleGazeData;

    return () => {
      // Cleanup
      window.GazeCloudAPI.OnResult = () => {};
    };
  }, [onGazeData]);

  return (
    <div className="gaze-tracker">
      <div 
        ref={gazePointRef}
        className="gaze-point"
        style={{
          display: 'none',
          position: 'fixed',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 0, 0, 0.5)',
          pointerEvents: 'none',
          zIndex: 9999,
          transform: 'translate(-50%, -50%)'
        }}
      />
    </div>
  );
};

export default GazeTracker;