import { GazeData } from '../types/gazeData';

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
    };
  }
}

let onGazeData: ((data: GazeData) => void) | null = null;

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

  // Set up error handler
  window.GazeCloudAPI.OnError = (error) => {
    console.error('GazeCloud Error:', error);
    // Reset tracking state
    onGazeData = null;
  };

  // Set up camera denied handler
  window.GazeCloudAPI.OnCamDenied = () => {
    console.error('Camera access denied');
    onGazeData = null;
  };
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

  // Set up result handler according to documentation
  window.GazeCloudAPI.OnResult = (gazeResponse) => {
    if (onGazeData) {
      const gazeData: GazeData = {
        x: gazeResponse.docX, // Use docX/docY as they're in document coordinates
        y: gazeResponse.docY,
        docX: gazeResponse.docX,
        docY: gazeResponse.docY,
        timestamp: gazeResponse.time || Date.now(), // Use GazeCloud's timestamp if available
        confidence: gazeResponse.state === 0 ? 1 : 0, // Convert state to confidence
        pupilD: gazeResponse.diameter,
        HeadX: gazeResponse.HeadX,
        HeadY: gazeResponse.HeadY,
        HeadZ: gazeResponse.HeadZ,
        HeadYaw: gazeResponse.HeadYaw,
        HeadPitch: gazeResponse.HeadPitch,
        HeadRoll: gazeResponse.HeadRoll,
        state: gazeResponse.state // Add state for validation
      };

      // Only process valid gaze data (state === 0)
      if (gazeData.state === 0) {
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
};
