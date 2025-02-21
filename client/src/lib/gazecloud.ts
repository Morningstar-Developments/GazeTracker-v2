import { GazeData } from '../types/gazeData';

interface ClickAccuracyData {
  clickX: number;
  clickY: number;
  nearestGazeX: number;
  nearestGazeY: number;
  distance: number;
  timestamp: number;
}

declare global {
  interface Window {
    GazeCloudAPI?: {
      OnResult: (data: any) => void;
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnCalibrationComplete: () => void;
      OnCamDenied: () => void;
      OnError: (error: any) => void;
      UseClickRecalibration: boolean;
      OnClick?: (x: number, y: number) => void;
    };
  }
}

let onGazeData: ((data: GazeData) => void) | null = null;
let recentGazePoints: GazeData[] = [];
const GAZE_HISTORY_DURATION = 500; // Look at gaze points within 500ms of click
const ACCURACY_THRESHOLD = 100; // pixels
let clickAccuracyData: ClickAccuracyData[] = [];

const calculateClickAccuracy = (clickX: number, clickY: number, timestamp: number): ClickAccuracyData | null => {
  // Filter gaze points within the time window
  const relevantPoints = recentGazePoints.filter(point => 
    Math.abs(point.timestamp - timestamp) <= GAZE_HISTORY_DURATION
  );

  if (relevantPoints.length === 0) return null;

  // Find the nearest gaze point to the click
  let nearestPoint = relevantPoints[0];
  let minDistance = Number.MAX_VALUE;

  relevantPoints.forEach(point => {
    const distance = Math.sqrt(
      Math.pow((point.x - clickX), 2) + 
      Math.pow((point.y - clickY), 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  });

  return {
    clickX,
    clickY,
    nearestGazeX: nearestPoint.x,
    nearestGazeY: nearestPoint.y,
    distance: minDistance,
    timestamp
  };
};

export const getClickAccuracyStats = () => {
  if (clickAccuracyData.length === 0) return null;

  const accurateClicks = clickAccuracyData.filter(data => data.distance <= ACCURACY_THRESHOLD);
  
  return {
    totalClicks: clickAccuracyData.length,
    accurateClicks: accurateClicks.length,
    accuracy: (accurateClicks.length / clickAccuracyData.length) * 100,
    averageDistance: clickAccuracyData.reduce((sum, data) => sum + data.distance, 0) / clickAccuracyData.length,
    clickData: clickAccuracyData
  };
};

export const clearClickAccuracyData = () => {
  clickAccuracyData = [];
  recentGazePoints = [];
};

export const initGazeCloud = async (): Promise<void> => {
  if (!window.GazeCloudAPI) {
    // Load GazeCloud API script
    const script = document.createElement('script');
    script.src = 'https://api.gazerecorder.com/GazeCloudAPI.js';
    script.async = true;
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Initialize handlers
  setupGazeCloudHandlers();
};

const setupGazeCloudHandlers = () => {
  if (!window.GazeCloudAPI) return;

  // Disable click recalibration by default
  window.GazeCloudAPI.UseClickRecalibration = false;

  // Set up click handler
  window.GazeCloudAPI.OnClick = (x: number, y: number) => {
    const accuracyData = calculateClickAccuracy(x, y, Date.now());
    if (accuracyData) {
      clickAccuracyData.push(accuracyData);
      console.log('Click accuracy:', accuracyData);
    }
  };

  // Set up error handler
  window.GazeCloudAPI.OnError = (error) => {
    console.error('GazeCloud Error:', error);
    // Reset tracking state
    onGazeData = null;
    clearClickAccuracyData();
  };

  // Set up camera denied handler
  window.GazeCloudAPI.OnCamDenied = () => {
    console.error('Camera access denied');
    onGazeData = null;
    clearClickAccuracyData();
  };

  // Add click event listener to document
  document.addEventListener('click', (event) => {
    const accuracyData = calculateClickAccuracy(event.clientX, event.clientY, Date.now());
    if (accuracyData) {
      clickAccuracyData.push(accuracyData);
      console.log('Click accuracy:', accuracyData);
    }
  });
};

export const startTracking = (
  gazeCallback: (data: GazeData) => void,
  onCalibrationComplete?: () => void
) => {
  if (!window.GazeCloudAPI) {
    console.error('GazeCloudAPI not found');
    return;
  }

  onGazeData = gazeCallback;
  clearClickAccuracyData();

  // Set up result handler according to documentation
  window.GazeCloudAPI.OnResult = (gazeResponse) => {
    if (onGazeData) {
      const gazeData: GazeData = {
        x: gazeResponse.docX,
        y: gazeResponse.docY,
        docX: gazeResponse.docX,
        docY: gazeResponse.docY,
        timestamp: gazeResponse.time || Date.now(),
        confidence: gazeResponse.state === 0 ? 1 : 0,
        pupilD: gazeResponse.diameter,
        HeadX: gazeResponse.HeadX,
        HeadY: gazeResponse.HeadY,
        HeadZ: gazeResponse.HeadZ,
        HeadYaw: gazeResponse.HeadYaw,
        HeadPitch: gazeResponse.HeadPitch,
        HeadRoll: gazeResponse.HeadRoll,
        state: gazeResponse.state
      };

      // Only process valid gaze data (state === 0)
      if (gazeData.state === 0) {
        // Add to recent gaze points and maintain window
        recentGazePoints.push(gazeData);
        const cutoffTime = Date.now() - GAZE_HISTORY_DURATION;
        recentGazePoints = recentGazePoints.filter(point => point.timestamp >= cutoffTime);

        onGazeData(gazeData);

        // Send data to server immediately
        fetch('/api/sessions/current/gaze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gazeData)
        }).catch(error => {
          console.error('Error sending gaze data to server:', error);
        });
      }
    }
  };

  // Set up calibration complete handler
  window.GazeCloudAPI.OnCalibrationComplete = () => {
    console.log('Gaze Calibration Complete');
    clearClickAccuracyData();
    if (onCalibrationComplete) {
      onCalibrationComplete();
    }
  };

  // Start eye tracking
  window.GazeCloudAPI.StartEyeTracking();
};

export const stopTracking = () => {
  if (!window.GazeCloudAPI) {
    console.error('GazeCloudAPI not found');
    return;
  }

  // Stop eye tracking
  window.GazeCloudAPI.StopEyeTracking();
  onGazeData = null;
  clearClickAccuracyData();
};
