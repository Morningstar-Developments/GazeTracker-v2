import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { GazeData } from '../types/gazeData';

export interface SessionConfig {
  participantId: string;
  isPilot: boolean;
}

export class DataStorageService {
  private currentSession: GazeData[] = [];
  private sessionConfig: SessionConfig | null = null;
  private outputDir: string;
  private lastFixationStart: number = 0;
  private lastGazePoint: GazeData | null = null;
  private blinkCount: number = 0;
  private lastBlinkTime: number = 0;
  private sessionStartTime: number = 0;

  constructor() {
    this.outputDir = path.join(__dirname, '../../data');
    // Create main data directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    // Create pilot and live subdirectories
    fs.mkdirSync(path.join(this.outputDir, 'pilot'), { recursive: true });
    fs.mkdirSync(path.join(this.outputDir, 'live'), { recursive: true });
  }

  initializeSession(config: SessionConfig) {
    this.sessionConfig = config;
    this.currentSession = [];
    this.lastFixationStart = 0;
    this.lastGazePoint = null;
    this.blinkCount = 0;
    this.lastBlinkTime = Date.now();
    this.sessionStartTime = Date.now();
  }

  private formatTime(timestamp: number): { formattedTime: string, formattedDate: string } {
    const date = new Date(timestamp);
    return {
      formattedTime: format(date, 'HH:mm:ss'),
      formattedDate: format(date, 'MM/dd/yyyy')
    };
  }

  private formatSessionTime(sessionTime: number): string {
    const minutes = Math.floor(sessionTime / 60000);
    const seconds = Math.floor((sessionTime % 60000) / 1000);
    const milliseconds = sessionTime % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  }

  private calculateMetrics(data: GazeData): GazeData {
    const now = Date.now();
    const enrichedData = { ...data };
    const sessionTime = now - this.sessionStartTime;
    const { formattedTime, formattedDate } = this.formatTime(now);

    // Add timestamps
    enrichedData.timestamp = now;
    (enrichedData as any).sessionTime = sessionTime;
    (enrichedData as any).formattedTime = formattedTime;
    (enrichedData as any).formattedDate = formattedDate;
    (enrichedData as any).sessionTimeFormatted = this.formatSessionTime(sessionTime);

    // Calculate fixation duration
    if (this.lastGazePoint) {
      const distance = Math.sqrt(
        Math.pow((data.x - this.lastGazePoint.x), 2) + 
        Math.pow((data.y - this.lastGazePoint.y), 2)
      );
      if (distance < 30) {
        (enrichedData as any).fixationDuration = now - this.lastFixationStart;
      } else {
        this.lastFixationStart = now;
        (enrichedData as any).saccadeLength = distance;
      }

      enrichedData.gazeDistance = distance;
    } else {
      this.lastFixationStart = now;
    }

    // Detect blinks
    if (data.confidence && data.confidence < 0.1) {
      if (now - this.lastBlinkTime > 300) {
        this.blinkCount++;
        this.lastBlinkTime = now;
      }
    }

    // Calculate blink rate
    const sessionDuration = (now - this.sessionStartTime) / 1000 / 60;
    enrichedData.blinkRate = this.blinkCount / Math.max(sessionDuration, 1/60);

    this.lastGazePoint = data;
    return enrichedData;
  }

  addGazeData(data: GazeData) {
    const enrichedData = this.calculateMetrics(data);
    this.currentSession.push(enrichedData);
  }

  getCurrentSession() {
    return this.currentSession;
  }

  saveSession() {
    if (!this.sessionConfig) {
      throw new Error('Session not initialized');
    }

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const sessionType = this.sessionConfig.isPilot ? 'pilot' : 'live';
    const paddedId = this.sessionConfig.participantId.padStart(3, '0');
    const filename = `P${paddedId}_${sessionType}_${timestamp}.csv`;
    const subDir = path.join(this.outputDir, sessionType);
    const filepath = path.join(subDir, filename);

    const headers = [
      'timestamp',
      'sessionTime',
      'formattedTime',
      'formattedDate',
      'sessionTimeFormatted',
      'x', 'y',
      'confidence',
      'state',
      'pupilD', 'pupilX', 'pupilY',
      'docX', 'docY',
      'screenX', 'screenY',
      'HeadX', 'HeadY', 'HeadZ',
      'HeadYaw', 'HeadPitch', 'HeadRoll',
      'fixationDuration',
      'saccadeLength',
      'blinkRate',
      'gazeDistance'
    ].join(',');

    const rows = this.currentSession.map(data => [
      data.timestamp,
      data.sessionTime,
      data.formattedTime,
      data.formattedDate,
      data.sessionTimeFormatted,
      data.x, data.y,
      data.confidence || '',
      data.state || '',
      data.pupilD || '', data.pupilX || '', data.pupilY || '',
      data.docX || '', data.docY || '',
      data.screenX || '', data.screenY || '',
      data.HeadX || '', data.HeadY || '', data.HeadZ || '',
      data.HeadYaw || '', data.HeadPitch || '', data.HeadRoll || '',
      data.fixationDuration || '',
      data.saccadeLength || '',
      data.blinkRate || '',
      data.gazeDistance || ''
    ].join(','));

    const csvContent = [headers, ...rows].join('\n');
    fs.writeFileSync(filepath, csvContent);

    return filename;
  }

  clearSession() {
    this.currentSession = [];
    this.sessionConfig = null;
    this.lastFixationStart = 0;
    this.lastGazePoint = null;
    this.blinkCount = 0;
    this.lastBlinkTime = 0;
    this.sessionStartTime = 0;
  }
} 