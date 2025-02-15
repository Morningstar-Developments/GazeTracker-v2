declare global {
  interface Window {
    GazeCloudAPI: {
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnResult: (data: { x: number; y: number; confidence: number; PupilD: number }) => void;
    };
  }
}

export function initGazeCloud() {
  try {
    const script = document.createElement("script");
    script.src = "https://api.gazerecorder.com/GazeCloudAPI.js";
    script.async = true;
    document.body.appendChild(script);
    console.log("✅ GazeCloudAPI Loaded Successfully");
  } catch (error) {
    console.error("❌ GazeCloudAPI Load Error:", error);
  }
}

export function startTracking(
  onGazeData: (data: { x: number; y: number; confidence: number; PupilD: number }) => void
) {
  try {
    if (!window.GazeCloudAPI) throw new Error("GazeCloudAPI is not initialized.");
    window.GazeCloudAPI.OnResult = onGazeData;
    window.GazeCloudAPI.StartEyeTracking();
    console.log("✅ Gaze Tracking Started");
  } catch (error) {
    console.error("❌ Gaze Tracking Error:", error);
  }
}

export function stopTracking() {
  try {
    if (!window.GazeCloudAPI) throw new Error("GazeCloudAPI is not initialized.");
    window.GazeCloudAPI.StopEyeTracking();
    console.log("✅ Gaze Tracking Stopped");
  } catch (error) {
    console.error("❌ Gaze Stopping Error:", error);
  }
}