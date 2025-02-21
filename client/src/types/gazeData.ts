export interface GazeData {
  timestamp: number;
  x: number;
  y: number;
  confidence?: number;
  pupilD?: number;
  docX?: number;
  docY?: number;
  HeadX?: number;
  HeadY?: number;
  HeadZ?: number;
  HeadYaw?: number;
  HeadPitch?: number;
  HeadRoll?: number;
  state?: number; // 0: valid gaze data; -1: face tracking lost; 1: gaze data uncalibrated
}