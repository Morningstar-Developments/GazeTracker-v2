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

      // Write headers to both files
      const headers = 'timestamp,time_24h,x,y,confidence,pupilD,docX,docY,HeadX,HeadY,HeadZ,HeadYaw,HeadPitch,HeadRoll\n';
      
      fs.writeFileSync(this.recordingPath, headers);
      fs.writeFileSync(this.backupPath, headers);

      // Open write streams in append mode
      this.csvStream = fs.createWriteStream(this.recordingPath, { flags: 'a' });
      this.backupStream = fs.createWriteStream(this.backupPath, { flags: 'a' });

      this.csvStream.on('error', (error) => this.handleError('CSV stream error', error));
      this.backupStream.on('error', (error) => this.handleError('Backup stream error', error));
      
      this.log('Recording session initialized successfully');
    } catch (error) {
      this.handleError('Initialization failed', error);
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
      Last Write: ${new Date(this.stats.lastWriteTime).toISOString()}
    `);
  }

  public async recordDataPoint(data: GazeData): Promise<void> {
    try {
      this.stats.totalPoints++;
      
      // Format the data point exactly like the template
      const time24h = format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm:ss');
      const row = [
        data.timestamp,
        time24h,
        data.x?.toFixed(3) || '',
        data.y?.toFixed(3) || '',
        data.confidence?.toFixed(2) || '',
        data.pupilD?.toFixed(1) || '',
        data.docX?.toFixed(3) || '',
        data.docY?.toFixed(3) || '',
        data.HeadX?.toFixed(1) || '',
        data.HeadY?.toFixed(1) || '',
        data.HeadZ?.toFixed(1) || '',
        data.HeadYaw?.toFixed(1) || '',
        data.HeadPitch?.toFixed(1) || '',
        data.HeadRoll?.toFixed(1) || ''
      ].join(',') + '\n';

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

        if (this.debugMode) {
          this.log(`Recorded data point: ${row.trim()}`);
        }
      }
    } catch (error) {
      this.handleError('Error recording data point', error);
      throw error; // Re-throw to notify caller
    }
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
      `);

      return this.recordingPath;
    } catch (error) {
      this.handleError('Error ending recording', error);
      return this.recordingPath;
    }
  }
} 