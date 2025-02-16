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
  private fixationCount: number = 0;
  private totalFixationDuration: number = 0;
  private saccadeCount: number = 0;
  private totalSaccadeLength: number = 0;

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
    this.fixationCount = 0;
    this.totalFixationDuration = 0;
    this.saccadeCount = 0;
    this.totalSaccadeLength = 0;
  }

  private formatTime(timestamp: number): { formattedTime: string, formattedDate: string } {
    const date = new Date(timestamp);
    return {
      formattedTime: format(date, 'HH:mm:ss.SSS'),
      formattedDate: format(date, 'yyyy-MM-dd')
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
    enrichedData.sessionTime = sessionTime;
    enrichedData.formattedTime = formattedTime;
    enrichedData.formattedDate = formattedDate;
    enrichedData.sessionTimeFormatted = this.formatSessionTime(sessionTime);

    // Calculate fixation and saccade metrics
    if (this.lastGazePoint) {
      const distance = Math.sqrt(
        Math.pow((data.x - this.lastGazePoint.x), 2) + 
        Math.pow((data.y - this.lastGazePoint.y), 2)
      );

      const FIXATION_THRESHOLD = 30;
      if (distance < FIXATION_THRESHOLD) {
        const fixationDuration = now - this.lastFixationStart;
        enrichedData.fixationDuration = fixationDuration;
        this.totalFixationDuration += fixationDuration;
        
        if (!this.lastGazePoint.fixationDuration) {
          this.fixationCount++;
        }
      } else {
        this.lastFixationStart = now;
        enrichedData.saccadeLength = distance;
        this.saccadeCount++;
        this.totalSaccadeLength += distance;
      }

      enrichedData.gazeDistance = distance;
      
      // Calculate velocities
      const timeElapsed = now - this.lastGazePoint.timestamp;
      enrichedData.gazeVelocity = distance / (timeElapsed / 1000); // pixels per second
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

    // Calculate aggregate metrics
    const sessionDuration = Math.max((now - this.sessionStartTime) / 1000 / 60, 1/60);
    enrichedData.blinkRate = this.blinkCount / sessionDuration;
    enrichedData.avgFixationDuration = this.totalFixationDuration / Math.max(this.fixationCount, 1);
    enrichedData.fixationsPerMinute = this.fixationCount / sessionDuration;
    enrichedData.avgSaccadeLength = this.totalSaccadeLength / Math.max(this.saccadeCount, 1);
    enrichedData.saccadesPerMinute = this.saccadeCount / sessionDuration;

    this.lastGazePoint = enrichedData;
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
      // Time-related columns
      'timestamp',
      'sessionTime',
      'formattedTime',
      'formattedDate',
      'sessionTimeFormatted',
      
      // Basic gaze data
      'x',
      'y',
      'confidence',
      'state',
      
      // Pupil data
      'pupilD',
      'pupilX',
      'pupilY',
      
      // Document/Screen coordinates
      'docX',
      'docY',
      'screenX',
      'screenY',
      
      // Head pose data
      'HeadX',
      'HeadY',
      'HeadZ',
      'HeadYaw',
      'HeadPitch',
      'HeadRoll',
      
      // Fixation metrics
      'fixationDuration',
      'avgFixationDuration',
      'fixationsPerMinute',
      
      // Saccade metrics
      'saccadeLength',
      'avgSaccadeLength',
      'saccadesPerMinute',
      
      // Movement metrics
      'gazeDistance',
      'gazeVelocity',
      
      // Blink metrics
      'blinkRate'
    ].join(',');

    const rows = this.currentSession.map(data => [
      // Time-related data
      data.timestamp,
      data.sessionTime,
      data.formattedTime,
      data.formattedDate,
      data.sessionTimeFormatted,
      
      // Basic gaze data
      data.x.toFixed(2),
      data.y.toFixed(2),
      (data.confidence || 0).toFixed(3),
      data.state || '',
      
      // Pupil data
      (data.pupilD || '').toString(),
      (data.pupilX || '').toString(),
      (data.pupilY || '').toString(),
      
      // Document/Screen coordinates
      (data.docX || '').toString(),
      (data.docY || '').toString(),
      (data.screenX || '').toString(),
      (data.screenY || '').toString(),
      
      // Head pose data
      (data.HeadX || '').toString(),
      (data.HeadY || '').toString(),
      (data.HeadZ || '').toString(),
      (data.HeadYaw || '').toString(),
      (data.HeadPitch || '').toString(),
      (data.HeadRoll || '').toString(),
      
      // Fixation metrics
      (data.fixationDuration || '').toString(),
      (data.avgFixationDuration || '').toString(),
      (data.fixationsPerMinute || '').toString(),
      
      // Saccade metrics
      (data.saccadeLength || '').toString(),
      (data.avgSaccadeLength || '').toString(),
      (data.saccadesPerMinute || '').toString(),
      
      // Movement metrics
      (data.gazeDistance || '').toString(),
      (data.gazeVelocity || '').toString(),
      
      // Blink metrics
      (data.blinkRate || '').toString()
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
    this.fixationCount = 0;
    this.totalFixationDuration = 0;
    this.saccadeCount = 0;
    this.totalSaccadeLength = 0;
  }
} 