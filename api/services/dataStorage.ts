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

  constructor() {
    this.outputDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  initializeSession(config: SessionConfig) {
    this.sessionConfig = config;
    this.currentSession = [];
  }

  addGazeData(data: GazeData) {
    this.currentSession.push(data);
  }

  getCurrentSession() {
    return this.currentSession;
  }

  saveSession() {
    if (!this.sessionConfig) {
      throw new Error('Session not initialized');
    }

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const sessionType = this.sessionConfig.isPilot ? 'pilot' : 'test';
    const filename = `P${this.sessionConfig.participantId}_${sessionType}_${timestamp}.csv`;
    const filepath = path.join(this.outputDir, filename);

    const headers = [
      'timestamp',
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
    ].join(',');

    const rows = this.currentSession.map(data => [
      data.timestamp,
      data.x,
      data.y,
      data.confidence || '',
      data.pupilD || '',
      data.docX || '',
      data.docY || '',
      data.HeadX || '',
      data.HeadY || '',
      data.HeadZ || '',
      data.HeadYaw || '',
      data.HeadPitch || '',
      data.HeadRoll || ''
    ].join(','));

    const csvContent = [headers, ...rows].join('\n');
    fs.writeFileSync(filepath, csvContent);

    return filename;
  }

  clearSession() {
    this.currentSession = [];
    this.sessionConfig = null;
  }
} 