import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { GazeData } from '../types/gazeData';

export interface SessionConfig {
  participantId: string;
  isPilot: boolean;
}

export class DataStorageService {
  private currentSession: {
    config: SessionConfig | null;
    gazeData: GazeData[];
  };
  private sessionStartTime: number = 0;
  private lastFixationStart: number = 0;
  private lastGazePoint: GazeData | null = null;
  private fixationCount: number = 0;
  private totalFixationDuration: number = 0;
  private saccadeCount: number = 0;
  private totalSaccadeLength: number = 0;
  private blinkCount: number = 0;
  private lastBlinkTime: number = 0;
  private outputDir: string;

  constructor() {
    this.currentSession = {
      config: null,
      gazeData: []
    };
    this.outputDir = path.join(process.cwd(), 'data');
    this.ensureDirectoryStructure();
  }

  private ensureDirectoryStructure() {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'pilot'),
      path.join(this.outputDir, 'live'),
      path.join(this.outputDir, 'pilot/raw'),
      path.join(this.outputDir, 'pilot/processed'),
      path.join(this.outputDir, 'live/raw'),
      path.join(this.outputDir, 'live/processed')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  public initializeSession(config: SessionConfig): void {
    this.currentSession = {
      config,
      gazeData: []
    };
    this.sessionStartTime = Date.now();
    this.lastFixationStart = 0;
    this.lastGazePoint = null;
    this.fixationCount = 0;
    this.totalFixationDuration = 0;
    this.saccadeCount = 0;
    this.totalSaccadeLength = 0;
    this.blinkCount = 0;
    this.lastBlinkTime = Date.now();
  }

  public addGazeData(data: GazeData): void {
    if (!this.currentSession.config) {
      throw new Error('No active session');
    }
    this.currentSession.gazeData.push(data);
    this.lastGazePoint = data;
  }

  public getCurrentSession() {
    return this.currentSession;
  }

  public clearSession(): void {
    this.currentSession = {
      config: null,
      gazeData: []
    };
    this.sessionStartTime = 0;
    this.lastFixationStart = 0;
    this.lastGazePoint = null;
    this.fixationCount = 0;
    this.totalFixationDuration = 0;
    this.saccadeCount = 0;
    this.totalSaccadeLength = 0;
    this.blinkCount = 0;
    this.lastBlinkTime = 0;
  }

  public getGazeDataCount(): number {
    return this.currentSession.gazeData.length;
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

  saveSession(): { rawFile: string, processedFile: string, analyticsFile: string } {
    if (!this.currentSession.config) {
      throw new Error('Session not initialized');
    }

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const sessionType = this.currentSession.config.isPilot ? 'pilot' : 'live';
    const paddedId = this.currentSession.config.participantId.padStart(3, '0');
    
    // Create participant directory if it doesn't exist
    const participantDir = path.join(this.outputDir, sessionType, `P${paddedId}`);
    if (!fs.existsSync(participantDir)) {
      fs.mkdirSync(participantDir, { recursive: true });
    }

    // Create session directory with timestamp
    const sessionDir = path.join(participantDir, timestamp);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Save raw data
    const rawFilename = `P${paddedId}_${sessionType}_${timestamp}_raw.csv`;
    const rawFilepath = path.join(sessionDir, rawFilename);
    this.saveRawData(rawFilepath);

    // Save processed data
    const processedFilename = `P${paddedId}_${sessionType}_${timestamp}_processed.csv`;
    const processedFilepath = path.join(sessionDir, processedFilename);
    this.saveProcessedData(processedFilepath);

    // Save analytics data
    const analyticsFilename = `P${paddedId}_${sessionType}_${timestamp}_analytics.json`;
    const analyticsFilepath = path.join(sessionDir, analyticsFilename);
    this.saveAnalyticsData(analyticsFilepath);

    // Create session summary
    const summaryFilename = `P${paddedId}_${sessionType}_${timestamp}_summary.md`;
    const summaryFilepath = path.join(sessionDir, summaryFilename);
    this.saveSessionSummary(summaryFilepath);

    return {
      rawFile: rawFilename,
      processedFile: processedFilename,
      analyticsFile: analyticsFilename
    };
  }

  private saveRawData(filepath: string) {
    const headers = [
      'timestamp',
      'sessionTime',
      'formattedTime',
      'formattedDate',
      'x',
      'y',
      'confidence',
      'state',
      'pupilD',
      'docX',
      'docY',
      'HeadX',
      'HeadY',
      'HeadZ',
      'HeadYaw',
      'HeadPitch',
      'HeadRoll'
    ].join(',');

    const rows = this.currentSession.gazeData.map(data => [
      data.timestamp,
      data.sessionTime,
      data.formattedTime,
      data.formattedDate,
      data.x,
      data.y,
      data.confidence || 0,
      data.state || 0,
      data.pupilD || 0,
      data.docX || 0,
      data.docY || 0,
      data.HeadX || 0,
      data.HeadY || 0,
      data.HeadZ || 0,
      data.HeadYaw || 0,
      data.HeadPitch || 0,
      data.HeadRoll || 0
    ].join(','));

    fs.writeFileSync(filepath, [headers, ...rows].join('\n'));
  }

  private saveProcessedData(filepath: string) {
    const headers = [
      'timestamp',
      'sessionTime',
      'fixationDuration',
      'avgFixationDuration',
      'fixationsPerMinute',
      'saccadeLength',
      'avgSaccadeLength',
      'saccadesPerMinute',
      'gazeVelocity',
      'blinkRate'
    ].join(',');

    const rows = this.currentSession.gazeData.map(data => [
      data.timestamp,
      data.sessionTime,
      data.fixationDuration || 0,
      data.avgFixationDuration || 0,
      data.fixationsPerMinute || 0,
      data.saccadeLength || 0,
      data.avgSaccadeLength || 0,
      data.saccadesPerMinute || 0,
      data.gazeVelocity || 0,
      data.blinkRate || 0
    ].join(','));

    fs.writeFileSync(filepath, [headers, ...rows].join('\n'));
  }

  private saveAnalyticsData(filepath: string) {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const analyticsData = {
      participantId: this.currentSession.config?.participantId,
      sessionType: this.currentSession.config?.isPilot ? 'pilot' : 'live',
      startTime: format(this.sessionStartTime, 'yyyy-MM-dd HH:mm:ss'),
      endTime: format(Date.now(), 'yyyy-MM-dd HH:mm:ss'),
      duration: sessionDuration,
      totalDataPoints: this.currentSession.gazeData.length,
      validDataPoints: this.currentSession.gazeData.filter(d => d.confidence && d.confidence > 0.5).length,
      metrics: {
        fixations: {
          count: this.fixationCount,
          totalDuration: this.totalFixationDuration,
          avgDuration: this.fixationCount > 0 ? this.totalFixationDuration / this.fixationCount : 0
        },
        saccades: {
          count: this.saccadeCount,
          totalLength: this.totalSaccadeLength,
          avgLength: this.saccadeCount > 0 ? this.totalSaccadeLength / this.saccadeCount : 0
        },
        blinks: {
          count: this.blinkCount,
          rate: (this.blinkCount / sessionDuration) * 60000 // blinks per minute
        }
      }
    };

    fs.writeFileSync(filepath, JSON.stringify(analyticsData, null, 2));
  }

  private saveSessionSummary(filepath: string) {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const validDataPoints = this.currentSession.gazeData.filter(d => d.confidence && d.confidence > 0.5).length;
    const dataQuality = (validDataPoints / this.currentSession.gazeData.length) * 100;

    const summary = `# Gaze Tracking Session Summary

## Session Information
- Participant ID: ${this.currentSession.config?.participantId}
- Session Type: ${this.currentSession.config?.isPilot ? 'Pilot' : 'Live'}
- Start Time: ${format(this.sessionStartTime, 'yyyy-MM-dd HH:mm:ss')}
- End Time: ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}
- Duration: ${format(sessionDuration, 'mm:ss')}

## Data Quality
- Total Data Points: ${this.currentSession.gazeData.length}
- Valid Data Points: ${validDataPoints}
- Data Quality: ${dataQuality.toFixed(1)}%

## Eye Movement Metrics
- Fixations: ${this.fixationCount}
- Average Fixation Duration: ${this.fixationCount > 0 ? (this.totalFixationDuration / this.fixationCount).toFixed(2) : 0}ms
- Saccades: ${this.saccadeCount}
- Average Saccade Length: ${this.saccadeCount > 0 ? (this.totalSaccadeLength / this.saccadeCount).toFixed(2) : 0}
- Blink Rate: ${((this.blinkCount / sessionDuration) * 60000).toFixed(1)} blinks/min

## Files Generated
- Raw Data: ${path.basename(filepath).replace('_summary.md', '_raw.csv')}
- Processed Data: ${path.basename(filepath).replace('_summary.md', '_processed.csv')}
- Analytics Data: ${path.basename(filepath).replace('_summary.md', '_analytics.json')}
`;

    fs.writeFileSync(filepath, summary);
  }
} 