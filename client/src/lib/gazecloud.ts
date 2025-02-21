import { GazeData } from '../types/gazeData';

declare global {
  interface Window {
    GazeCloudAPI?: {
      OnResult: (data: GazeData) => void;
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnCalibrationComplete: () => void;
      OnError: (error: any) => void;
    };
  }
}

let onGazeData: ((data: GazeData) => void) | null = null;

export const initGazeCloud = async (): Promise<void> => {
  if (!window.GazeCloudAPI) {
    throw new Error('GazeCloudAPI not found. Make sure the script is loaded properly.');
  }
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
  window.GazeCloudAPI.OnCalibrationComplete = onCalibrationComplete || (() => {});
  window.GazeCloudAPI.StartEyeTracking();
};

export const stopTracking = () => {
  if (!window.GazeCloudAPI) {
    console.error('GazeCloudAPI not found');
    return;
  }

  onGazeData = null;
  window.GazeCloudAPI.StopEyeTracking();
};

const handleGazeData = (gazeResponse: any) => {
  if (onGazeData) {
    const gazeData: GazeData = {
      x: gazeResponse.x,
      y: gazeResponse.y,
      docX: gazeResponse.docX,
      docY: gazeResponse.docY,
      timestamp: Date.now(),
      confidence: gazeResponse.confidence || gazeResponse.state,
      pupilD: gazeResponse.pupilD || gazeResponse.diameter,
      HeadX: gazeResponse.HeadX,
      HeadY: gazeResponse.HeadY,
      HeadZ: gazeResponse.HeadZ,
      HeadYaw: gazeResponse.HeadYaw,
      HeadPitch: gazeResponse.HeadPitch,
      HeadRoll: gazeResponse.HeadRoll
    };
    onGazeData(gazeData);

    // Send data to server
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
};

// Attach the handler to GazeCloudAPI
if (window.GazeCloudAPI) {
  window.GazeCloudAPI.OnResult = handleGazeData;
}
