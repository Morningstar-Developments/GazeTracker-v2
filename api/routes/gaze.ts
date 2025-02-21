import { Router, Request, Response } from 'express';
import { DataStorageService, SessionConfig } from '../services/dataStorage';
import { LiveDataRecorder } from '../services/LiveDataRecorder';
import { GazeData } from '../types/gazeData';
import { PythonShell } from 'python-shell';
import { format } from 'date-fns';
import path from 'path';

const router = Router();
const dataStorage = new DataStorageService();
let liveRecorder: LiveDataRecorder | null = null;

// Initialize a new session
router.post('/sessions', (req: Request, res: Response) => {
  const config: SessionConfig = {
    participantId: req.body.participantId,
    isPilot: req.body.isPilot
  };
  
  dataStorage.initializeSession(config);
  
  // Initialize live recorder for non-pilot sessions
  if (!config.isPilot) {
    liveRecorder = new LiveDataRecorder(config.participantId);
  }
  
  res.status(201).json({ message: 'Session initialized' });
});

// Get all gaze data for current session
router.get('/sessions/current/gaze', (req: Request, res: Response) => {
  res.json(dataStorage.getCurrentSession());
});

// Add new gaze data point
router.post('/sessions/current/gaze', (req: Request, res: Response) => {
  const gazeData: GazeData = {
    x: req.body.x,
    y: req.body.y,
    timestamp: Date.now(),
    confidence: req.body.confidence,
    pupilD: req.body.pupilD,
    docX: req.body.docX,
    docY: req.body.docY,
    HeadX: req.body.HeadX,
    HeadY: req.body.HeadY,
    HeadZ: req.body.HeadZ,
    HeadYaw: req.body.HeadYaw,
    HeadPitch: req.body.HeadPitch,
    HeadRoll: req.body.HeadRoll
  };
  
  dataStorage.addGazeData(gazeData);
  
  // Record data point in CSV if live recording is active
  if (liveRecorder) {
    liveRecorder.recordDataPoint(gazeData);
  }
  
  res.status(201).json(gazeData);
});

// End session and get CSV file path
router.post('/sessions/current/end', (req: Request, res: Response) => {
  try {
    let csvPath = '';
    if (liveRecorder) {
      // End recording and get the CSV path
      csvPath = liveRecorder.endRecording();
      liveRecorder = null;

      // Get the current session data
      const sessionData = dataStorage.getCurrentSession();
      
      // Clear the session
      dataStorage.clearSession();

      // Return both the CSV path and the session data
      res.json({ 
        message: 'Session ended',
        csvPath: csvPath,
        sessionData: sessionData
      });
    } else {
      res.status(400).json({ error: 'No active recording session found' });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Clear current session
router.delete('/sessions/current', (req: Request, res: Response) => {
  if (liveRecorder) {
    liveRecorder.endRecording();
    liveRecorder = null;
  }
  dataStorage.clearSession();
  res.status(204).send();
});

// Generate test data for pilot mode
router.post('/pilot/generate-test-data', (req: Request, res: Response) => {
  try {
    const { participantId, duration } = req.body;
    
    const options = {
      mode: 'text' as const,
      pythonPath: 'python3',
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../../core'),
      args: [duration.toString()]
    };

    PythonShell.run('csv_exporter.py', options).then(messages => {
      // Parse CSV data into JSON
      const csvData = messages.join('\n');
      const rows = csvData.split('\n');
      const headers = rows[0].split(',');
      const gazeData = rows.slice(1).map(row => {
        const values = row.split(',');
        const dataPoint: any = {};
        headers.forEach((header, index) => {
          const value = values[index];
          if (value === '') {
            dataPoint[header] = null;
          } else if (header === 'timestamp' || header === 'time_24h') {
            dataPoint[header] = value;
          } else {
            dataPoint[header] = parseFloat(value);
          }
        });
        return dataPoint;
      });

      res.json({ gazeData });
    }).catch(error => {
      console.error('Error generating test data:', error);
      res.status(500).json({ error: 'Failed to generate test data' });
    });
  } catch (error) {
    console.error('Error in generate-test-data route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 