import type { GazeData } from '../types/gazeData';

declare global {
  interface Window {
    GazeCloudAPI: {
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnResult: (data: GazeData) => void;
      OnCalibrationComplete: () => void;
      OnCamDenied: () => void;
      OnError: (msg: string) => void;
      UseClickRecalibration: boolean;
    };
  }
}

export function initGazeCloud() {
  return new Promise<void>((resolve, reject) => {
    try {
      const script = document.createElement("script");
      script.src = "https://api.gazerecorder.com/GazeCloudAPI.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load GazeCloudAPI"));
      document.body.appendChild(script);
      console.log("✅ GazeCloudAPI Loaded Successfully");
    } catch (error) {
      console.error("❌ GazeCloudAPI Load Error:", error);
      reject(error);
    }
  });
}

export function startTracking(
  onGazeData: (data: GazeData) => void,
  options = {
    useClickRecalibration: true
  }
) {
  try {
    if (!window.GazeCloudAPI) throw new Error("GazeCloudAPI is not initialized.");
    
    window.GazeCloudAPI.OnResult = (data: any) => {
      const gazeData: GazeData = {
        x: data.docX || data.x,
        y: data.docY || data.y,
        timestamp: Date.now(),
        confidence: data.confidence,
        pupilD: data.pupilD || data.PupilD,
        docX: data.docX,
        docY: data.docY,
        HeadX: data.HeadX,
        HeadY: data.HeadY,
        HeadZ: data.HeadZ,
        HeadYaw: data.HeadYaw,
        HeadPitch: data.HeadPitch,
        HeadRoll: data.HeadRoll
      };
      onGazeData(gazeData);
    };

    window.GazeCloudAPI.UseClickRecalibration = options.useClickRecalibration;
    
    window.GazeCloudAPI.OnCalibrationComplete = () => {
      console.log("✅ Calibration Complete");
    };
    
    window.GazeCloudAPI.OnCamDenied = () => {
      console.error("❌ Camera Access Denied");
    };
    
    window.GazeCloudAPI.OnError = (msg) => {
      console.error("❌ GazeCloud Error:", msg);
    };
    
    window.GazeCloudAPI.StartEyeTracking();
    console.log("✅ Gaze Tracking Started");
  } catch (error) {
    console.error("❌ Gaze Tracking Error:", error);
    throw error;
  }
}

export function stopTracking() {
  try {
    if (!window.GazeCloudAPI) throw new Error("GazeCloudAPI is not initialized.");
    window.GazeCloudAPI.StopEyeTracking();
    console.log("✅ Gaze Tracking Stopped");
  } catch (error) {
    console.error("❌ Gaze Stopping Error:", error);
    throw error;
  }
} 