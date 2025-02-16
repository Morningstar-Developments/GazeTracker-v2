export interface GazeData {
  x: number;
  y: number;
  timestamp: number;
  sessionTime?: number;
  formattedTime?: string;
  formattedDate?: string;
  sessionTimeFormatted?: string;
  confidence?: number;
  state?: number;
  pupilD?: number;
  pupilX?: number;
  pupilY?: number;
  docX?: number;
  docY?: number;
  screenX?: number;
  screenY?: number;
  HeadX?: number;
  HeadY?: number;
  HeadZ?: number;
  HeadYaw?: number;
  HeadPitch?: number;
  HeadRoll?: number;
  fixationDuration?: number;
  saccadeLength?: number;
  blinkRate?: number;
  gazeDistance?: number;
} 