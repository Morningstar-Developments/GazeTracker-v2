import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { GazeData } from '../types/gazeData';

interface RecordingStats {
  startTime: number;
  totalPoints: number;
  validPoints: number;
  errorCount: number;
  lastTimestamp: number | null;
  lastWriteTime: number | null;
  dataRate: number;
}

export class LiveDataRecorder extends EventEmitter {
  private outputDir: string;
  private recordingPath: string = '';
  private backupPath: string = '';
  private csvStream: fs.WriteStream | null;
  private backupStream: fs.WriteStream | null;
  private participantId: string;
  private startTime: number;
  private buffer: GazeData[] = [];
  private bufferSize = 100; // Reduced buffer size for more frequent writes
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
  private stats: RecordingStats = {
    startTime: Date.now(),
    totalPoints: 0,
    validPoints: 0,
    errorCount: 0,
    lastTimestamp: null,
    lastWriteTime: null,
    dataRate: 0
  };

  constructor(participantId: string) {
    super();
    this.participantId = participantId;
    this.outputDir = path.join(process.cwd(), 'public', 'recordings');
    this.csvStream = null;
    this.backupStream = null;
    this.startTime = Date.now();
    this.initializeRecording();
  }

  private initializeRecording() {
    try {
      // Ensure base directories exist
      this.outputDir = path.join(process.cwd(), 'public', 'recordings');
      const liveDir = path.join(this.outputDir, 'live');
      const participantDir = path.join(liveDir, `P${this.participantId.padStart(3, '0')}`);
      
      [this.outputDir, liveDir, participantDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      const timestamp = format(Date.now(), 'yyyyMMdd_HHmmss');
      const sessionDir = path.join(participantDir, timestamp);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir);
      }

      // Set up file paths in the session directory
      const filename = `P${this.participantId.padStart(3, '0')}_live_${timestamp}.csv`;
      this.recordingPath = path.join(sessionDir, filename);
      this.backupPath = path.join(sessionDir, `${filename.replace('.csv', '_backup.csv')}`);

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

      if (this.csvStream) {
        this.csvStream.on('error', (error) => {
          this.handleError('CSV stream error', error);
          this.emit('error', { message: 'CSV stream error', error: error.message });
        });
        this.csvStream.on('open', () => {
          this.emit('recording_started', {
            path: this.recordingPath,
            timestamp: format(new Date(), 'HH:mm:ss.SSS')
          });
        });
      }
      if (this.backupStream) {
        this.backupStream.on('error', (error) => {
          this.handleError('Backup stream error', error);
          this.emit('error', { message: 'Backup stream error', error: error.message });
        });
      }

      // Start monitoring
      this.startMonitoring();
      
      this.log(`Recording session initialized successfully in ${sessionDir}`);
      return this.recordingPath;
    } catch (error) {
      this.handleError('Initialization failed', error);
      throw error;
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
    try {
      // Format timestamp and time_24h exactly like CSVExporter
      const timestamp = data.timestamp || Date.now();
      const time_24h = format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');

      // Format numeric values with proper precision
      const formatValue = (value: number | undefined | null, precision: number): string => {
        if (value === undefined || value === null || isNaN(value)) return '';
        return value.toFixed(precision);
      };

      // Match exact CSV format from template
      return [
        timestamp,
        time_24h,
        formatValue(data.x, 3),
        formatValue(data.y, 3),
        formatValue(data.confidence, 2),
        formatValue(data.pupilD, 1),
        formatValue(data.docX, 3),
        formatValue(data.docY, 3),
        formatValue(data.HeadX, 1),
        formatValue(data.HeadY, 1),
        formatValue(data.HeadZ, 1),
        formatValue(data.HeadYaw, 1),
        formatValue(data.HeadPitch, 1),
        formatValue(data.HeadRoll, 1)
      ].join(',') + '\n';
    } catch (error) {
      this.handleError('Error formatting data point', error);
      return '';
    }
  }

  public recordDataPoint(data: GazeData): void {
    try {
      if (!this.csvStream || !this.backupStream) {
        throw new Error('Recording streams not initialized');
      }

      this.stats.totalPoints++;
      this.buffer.push(data);

      // Update stats with safe timestamp handling
      const timestamp = data.timestamp || Date.now();
      this.stats.lastTimestamp = timestamp;
      this.stats.lastWriteTime = Date.now();
      this.stats.dataRate = this.stats.totalPoints / ((Date.now() - this.stats.startTime) / 1000);

      // Emit data received event
      this.emit('data_received', {
        timestamp: format(new Date(), 'HH:mm:ss.SSS'),
        point: {
          x: data.x.toFixed(3),
          y: data.y.toFixed(3),
          confidence: (data.confidence || 0).toFixed(2)
        },
        total: this.stats.totalPoints
      });

      // Flush buffer when it reaches the size limit
      if (this.buffer.length >= this.bufferSize) {
        this.flushBuffer();
      }
    } catch (error) {
      this.handleError('Error recording data point', error);
    }
  }

  private flushBuffer(): void {
    try {
      if (!this.csvStream || !this.backupStream) {
        throw new Error('Recording streams not initialized');
      }

      const formattedData = this.buffer.map(point => {
        if (!this.validateDataPoint(point)) {
          this.stats.errorCount++;
          return null;
        }
        return this.formatDataPoint(point);
      })
      .filter(line => line !== null)
      .join('');
      
      if (formattedData) {
        this.csvStream.write(formattedData);
        this.backupStream.write(formattedData);
        
        const validPoints = this.buffer.length;
        this.stats.validPoints += validPoints;
        
        // Emit data written event
        this.emit('data_written', {
          points: validPoints,
          total: this.stats.validPoints,
          timestamp: format(new Date(), 'HH:mm:ss.SSS')
        });
        
        // Log progress
        this.log(`Wrote ${validPoints} points to file. Total: ${this.stats.validPoints}`);
      }
      
      // Clear buffer
      this.buffer = [];
    } catch (error) {
      this.handleError('Error flushing buffer', error);
    }
  }

  public endRecording(): string {
    try {
      // Flush any remaining data in buffer
      if (this.buffer.length > 0) {
        this.flushBuffer();
      }

      // Close streams
      if (this.csvStream) {
        this.csvStream.end();
        this.csvStream = null;
      }
      if (this.backupStream) {
        this.backupStream.end();
        this.backupStream = null;
      }

      // Log final stats
      const duration = (Date.now() - this.stats.startTime) / 1000;
      this.log(`Recording ended:
        Total Duration: ${duration.toFixed(1)}s
        Total Points: ${this.stats.totalPoints}
        Valid Points: ${this.stats.validPoints}
        Average Rate: ${this.stats.dataRate.toFixed(1)} Hz
        Data Quality: ${((this.stats.validPoints / this.stats.totalPoints) * 100).toFixed(1)}%
        Error Count: ${this.stats.errorCount}
      `);

      return this.recordingPath;
    } catch (error) {
      this.handleError('Error ending recording', error);
      return '';
    }
  }

  private startMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private performHealthCheck() {
    const now = Date.now();
    const timeSinceLastWrite = this.stats.lastWriteTime ? now - this.stats.lastWriteTime : 0;
    const duration = (now - this.stats.startTime) / 1000; // duration in seconds
    
    this.stats.dataRate = this.stats.totalPoints / duration;

    const healthStatus = {
      timestamp: format(new Date(), 'HH:mm:ss.SSS'),
      totalPoints: this.stats.totalPoints,
      validPoints: this.stats.validPoints,
      dataRate: this.stats.dataRate.toFixed(1),
      dataQuality: ((this.stats.validPoints / this.stats.totalPoints) * 100).toFixed(1),
      timeSinceLastWrite: (timeSinceLastWrite / 1000).toFixed(1),
      bufferSize: this.buffer.length
    };

    if (timeSinceLastWrite > this.HEALTH_CHECK_INTERVAL) {
      this.emit('warning', {
        type: 'data_gap',
        message: `No data received for ${(timeSinceLastWrite / 1000).toFixed(1)}s`,
        timestamp: format(new Date(), 'HH:mm:ss.SSS')
      });
    }

    // Emit health status event
    this.emit('health_status', healthStatus);

    // Log health status
    this.log(`Health Check:
      Total Points: ${healthStatus.totalPoints}
      Valid Points: ${healthStatus.validPoints}
      Data Rate: ${healthStatus.dataRate} Hz
      Data Quality: ${healthStatus.dataQuality}%
      Buffer Size: ${healthStatus.bufferSize}
      Time Since Last Write: ${healthStatus.timeSinceLastWrite}s
    `);
  }

  private handleError(message: string, error: unknown): void {
    this.stats.errorCount++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log(`${message}: ${errorMessage}`, 'error');
    this.emit('error', { message, error: errorMessage });
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = format(new Date(), 'HH:mm:ss.SSS');
    const formattedMessage = `[${timestamp}] ${message}`;
    
    // Log to console
    console[level](formattedMessage);
    
    // Log to file
    const logPath = path.join(this.outputDir, 'gaze_tracker.log');
    fs.appendFileSync(logPath, `${formattedMessage}\n`);
    
    // Emit log event
    this.emit('log', { level, message: formattedMessage });
  }
} 