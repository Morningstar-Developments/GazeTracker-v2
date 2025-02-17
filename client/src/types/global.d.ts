import type { GazeData } from './gazeData';

export interface GazeCloudAPIType {
  StartEyeTracking: () => void;
  StopEyeTracking: () => void;
  OnResult: (data: GazeData) => void;
  OnCalibrationComplete: () => void;
  OnError: (error: any) => void;
}

declare global {
  interface Window {
    GazeCloudAPI?: GazeCloudAPIType;
  }
}

export {}; 