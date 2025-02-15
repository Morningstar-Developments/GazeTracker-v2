declare global {
  interface Window {
    GazeCloudAPI: {
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnResult: (data: { x: number; y: number; confidence: number, PupilD: number }) => void;
    };
  }
}

export function initGazeCloud() {
  const script = document.createElement("script");
  script.src = "https://api.gazerecorder.com/GazeCloudAPI.js";
  script.async = true;
  document.body.appendChild(script);
}

export function startTracking(onGazeData: (data: { x: number; y: number; confidence: number, PupilD: number }) => void) {
  window.GazeCloudAPI.OnResult = onGazeData;
  window.GazeCloudAPI.StartEyeTracking();
}

export function stopTracking() {
  window.GazeCloudAPI.StopEyeTracking();
}