import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { GazeData } from '../types/gazeData';

export class LiveDataRecorder {
  private csvStream: fs.WriteStream | null = null;
  private sessionStartTime: number;
  private participantId: string;
  private recordingPath: string;
  private totalPoints: number = 0;
  private validPoints: number = 0;
  private lastTimestamp: number = 0;

  constructor(participantId: string, outputDir: string = 'recordings') {
    this.participantId = participantId;
    this.sessionStartTime = Date.now();
    
    // Ensure recordings directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create filename with participant ID and timestamp
    const filename = `P${participantId.padStart(3, '0')}_${format(this.sessionStartTime, 'yyyyMMdd_HHmmss')}.csv`;
    this.recordingPath = path.join(outputDir, filename);

    // Initialize CSV file with headers
    this.initializeCSV();
    console.log(`Started recording session for participant ${participantId}`);
  }

  private validateDataPoint(data: GazeData): boolean {
    // Check for required fields
    if (data.x === undefined || data.y === undefined || !data.timestamp) {
      console.warn('Missing required gaze coordinates or timestamp');
      return false;
    }

    // Validate timestamp sequence
    if (this.lastTimestamp && data.timestamp < this.lastTimestamp) {
      console.warn(`Out of sequence timestamp detected: ${data.timestamp} < ${this.lastTimestamp}`);
      return false;
    }
    this.lastTimestamp = data.timestamp;

    // Validate gaze coordinates
    if (isNaN(Number(data.x)) || isNaN(Number(data.y))) {
      console.warn('Invalid gaze coordinates detected');
      return false;
    }

    // Validate confidence
    if (data.confidence !== undefined && (data.confidence < 0 || data.confidence > 1)) {
      console.warn(`Invalid confidence value: ${data.confidence}`);
      return false;
    }

    // Validate pupil diameter (typical range 2-8mm)
    if (data.pupilD !== undefined && (data.pupilD < 2 || data.pupilD > 8)) {
      console.warn(`Unusual pupil diameter: ${data.pupilD}mm`);
    }

    return true;
  }

  private initializeCSV() {
    const headers = [
      'timestamp',
      'time_24h',
      'x',
      'y',
      'confidence',
      'pupilD',
      'docX',
      'docY',
      'HeadX',
      'HeadY',
      'HeadZ',
      'HeadYaw',
      'HeadPitch',
      'HeadRoll'
    ].join(',') + '\n';

    fs.writeFileSync(this.recordingPath, headers);
    this.csvStream = fs.createWriteStream(this.recordingPath, { flags: 'a' });
    console.log(`Initialized CSV file at: ${this.recordingPath}`);
  }

  public recordDataPoint(data: GazeData) {
    if (!this.csvStream) return;

    this.totalPoints++;
    if (!this.validateDataPoint(data)) {
      return;
    }
    this.validPoints++;

    const time24h = new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ');
    
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

    this.csvStream.write(row);

    // Log every 1000 points
    if (this.totalPoints % 1000 === 0) {
      console.log(`Recording progress: ${this.validPoints}/${this.totalPoints} points recorded`);
      console.log(`Data quality: ${((this.validPoints/this.totalPoints) * 100).toFixed(1)}%`);
    }
  }

  public endRecording(): string {
    if (this.csvStream) {
      this.csvStream.end();
      this.csvStream = null;
      console.log(`Recording ended. Final stats:
        Total points: ${this.totalPoints}
        Valid points: ${this.validPoints}
        Data quality: ${((this.validPoints/this.totalPoints) * 100).toFixed(1)}%
        File: ${this.recordingPath}
      `);
    }
    return this.recordingPath;
  }
} 