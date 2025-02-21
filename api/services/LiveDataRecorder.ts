import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { GazeData } from '../types/gazeData';
import { EventEmitter } from 'events';

interface RecordingStats {
  totalPoints: number;
  validPoints: number;
  errorCount: number;
  lastTimestamp: number;
  dataRate: number;
  startTime: number;
  lastWriteTime: number;
}

export class LiveDataRecorder extends EventEmitter {
  private csvStream: fs.WriteStream | null = null;
  private backupStream: fs.WriteStream | null = null;
  private recordingPath: string = '';
  private backupPath: string = '';
  private readonly EXPECTED_FRAME_INTERVAL = 16.67; // ~60Hz
  private readonly HEALTH_CHECK_INTERVAL = 5000; // Check health every 5 seconds
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private stats: RecordingStats = {
    totalPoints: 0,
    validPoints: 0,
    errorCount: 0,
    lastTimestamp: 0,
    dataRate: 0,
    startTime: Date.now(),
    lastWriteTime: Date.now()
  };

  constructor(
    private participantId: string,
    private outputDir: string = 'recordings',
    private debugMode: boolean = false
  ) {
    super();
    this.initializeRecording();
    this.startMonitoring();
  }

  private initializeRecording() {
    try {
      // Ensure directories exist
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      const timestamp = format(Date.now(), 'yyyyMMdd_HHmmss');
      this.recordingPath = path.join(this.outputDir, `P${this.participantId.padStart(3, '0')}_${timestamp}.csv`);
      this.backupPath = path.join(this.outputDir, `P${this.participantId.padStart(3, '0')}_${timestamp}_backup.csv`);

      // Write headers exactly matching template format
      const headers = 'timestamp,time_24h,x,y,confidence,pupilD,docX,docY,HeadX,HeadY,HeadZ,HeadYaw,HeadPitch,HeadRoll\n';
      
      fs.writeFileSync(this.recordingPath, headers);
      fs.writeFileSync(this.backupPath, headers);

      // Open write streams in append mode with high water mark for performance
      this.csvStream = fs.createWriteStream(this.recordingPath, { 
        flags: 'a',
        highWaterMark: 64 * 1024 // 64KB buffer
      });
      this.backupStream = fs.createWriteStream(this.backupPath, { 
        flags: 'a',
        highWaterMark: 64 * 1024 // 64KB buffer
      });

      this.csvStream.on('error', (error) => this.handleError('CSV stream error', error));
      this.backupStream.on('error', (error) => this.handleError('Backup stream error', error));
      
      this.log('Recording session initialized successfully');
    } catch (error) {
      this.handleError('Initialization failed', error);
    }
  }

  private validateDataPoint(data: GazeData): boolean {
    // Required fields must be present and numeric
    if (typeof data.timestamp !== 'number' || 
        typeof data.x !== 'number' || 
        typeof data.y !== 'number') {
      return false;
    }

    // Validate confidence (0-1)
    if (data.confidence !== undefined && 
        (typeof data.confidence !== 'number' || 
         data.confidence < 0 || 
         data.confidence > 1)) {
      return false;
    }

    // Validate pupil diameter (2-8mm typical range)
    if (data.pupilD !== undefined && 
        (typeof data.pupilD !== 'number' || 
         data.pupilD < 2 || 
         data.pupilD > 8)) {
      return false;
    }

    // Check timestamp sequence
    if (this.stats.lastTimestamp && data.timestamp < this.stats.lastTimestamp) {
      this.log(`Out of sequence timestamp detected: ${data.timestamp} < ${this.stats.lastTimestamp}`, 'warn');
      return false;
    }

    return true;
  }

  private formatDataPoint(data: GazeData): string {
    const time24h = format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss');
    
    // Format each field with exact precision matching template
    return [
      data.timestamp,
      time24h,
      (data.x || 0).toFixed(3),           // 3 decimal places
      (data.y || 0).toFixed(3),           // 3 decimal places
      (data.confidence || 0).toFixed(2),   // 2 decimal places
      data.pupilD ? data.pupilD.toFixed(1) : '', // 1 decimal place
      (data.docX || 0).toFixed(3),        // 3 decimal places
      (data.docY || 0).toFixed(3),        // 3 decimal places
      data.HeadX ? data.HeadX.toFixed(1) : '',   // 1 decimal place
      data.HeadY ? data.HeadY.toFixed(1) : '',   // 1 decimal place
      data.HeadZ ? data.HeadZ.toFixed(1) : '',   // 1 decimal place
      data.HeadYaw ? data.HeadYaw.toFixed(1) : '',     // 1 decimal place
      data.HeadPitch ? data.HeadPitch.toFixed(1) : '', // 1 decimal place
      data.HeadRoll ? data.HeadRoll.toFixed(1) : ''    // 1 decimal place
    ].join(',') + '\n';
  }

  public async recordDataPoint(data: GazeData): Promise<void> {
    try {
      this.stats.totalPoints++;
      
      // Validate data point
      if (!this.validateDataPoint(data)) {
        this.log(`Invalid data point: ${JSON.stringify(data)}`, 'warn');
        return;
      }

      // Format data point
      const row = this.formatDataPoint(data);

      // Write immediately to both streams
      if (this.csvStream && this.backupStream) {
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            this.csvStream!.write(row, (error) => {
              if (error) reject(error);
              else resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            this.backupStream!.write(row, (error) => {
              if (error) reject(error);
              else resolve();
            });
          })
        ]);

        this.stats.validPoints++;
        this.stats.lastTimestamp = data.timestamp;
        this.stats.lastWriteTime = Date.now();

        // Calculate frame interval
        const frameInterval = this.stats.lastTimestamp ? 
          data.timestamp - this.stats.lastTimestamp : 
          this.EXPECTED_FRAME_INTERVAL;

        // Emit warning if frame interval is too large
        if (frameInterval > this.EXPECTED_FRAME_INTERVAL * 2) {
          this.emit('warning', {
            type: 'frame_drop',
            message: `Large frame interval detected: ${frameInterval.toFixed(2)}ms`,
            timestamp: Date.now()
          });
        }

        if (this.debugMode) {
          this.log(`Recorded data point: ${row.trim()}`);
        }
      }
    } catch (error) {
      this.handleError('Error recording data point', error);
      throw error; // Re-throw to notify caller
    }
  }

  private startMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private performHealthCheck() {
    const now = Date.now();
    const timeSinceLastWrite = now - this.stats.lastWriteTime;
    const duration = (now - this.stats.startTime) / 1000; // duration in seconds
    
    this.stats.dataRate = this.stats.totalPoints / duration;

    if (timeSinceLastWrite > this.HEALTH_CHECK_INTERVAL) {
      this.emit('warning', {
        type: 'data_gap',
        message: `No data received for ${(timeSinceLastWrite / 1000).toFixed(1)}s`,
        timestamp: now
      });
    }

    // Log health status
    this.log(`Health Check:
      Total Points: ${this.stats.totalPoints}
      Valid Points: ${this.stats.validPoints}
      Data Rate: ${this.stats.dataRate.toFixed(1)} Hz
      Data Quality: ${((this.stats.validPoints / this.stats.totalPoints) * 100).toFixed(1)}%
      Last Write: ${new Date(this.stats.lastWriteTime).toISOString()}
    `);
  }

  private handleError(context: string, error: any) {
    this.stats.errorCount++;
    const errorMessage = `${context}: ${error.message || error}`;
    this.log(errorMessage, 'error');
    this.emit('error', {
      context,
      error: error.message || error,
      timestamp: Date.now(),
      stats: { ...this.stats }
    });
  }

  private log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console[level](logMessage);

    if (this.debugMode) {
      const logPath = path.join(this.outputDir, `P${this.participantId.padStart(3, '0')}_recording.log`);
      fs.appendFileSync(logPath, logMessage + '\n');
    }
  }

  public endRecording(): string {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Ensure all data is written before closing
      if (this.csvStream) {
        this.csvStream.end();
        this.csvStream = null;
      }

      if (this.backupStream) {
        this.backupStream.end();
        this.backupStream = null;
      }

      const duration = (Date.now() - this.stats.startTime) / 1000;
      this.log(`Recording ended:
        Total Duration: ${duration.toFixed(1)}s
        Total Points: ${this.stats.totalPoints}
        Valid Points: ${this.stats.validPoints}
        Average Rate: ${(this.stats.totalPoints / duration).toFixed(1)} Hz
        Data Quality: ${((this.stats.validPoints / this.stats.totalPoints) * 100).toFixed(1)}%
        Error Count: ${this.stats.errorCount}
      `);

      return this.recordingPath;
    } catch (error) {
      this.handleError('Error ending recording', error);
      return this.recordingPath;
    }
  }
} 