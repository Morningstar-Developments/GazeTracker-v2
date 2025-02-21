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
      csvPath = liveRecorder.endRecording();
      liveRecorder = null;
    }
    
    dataStorage.clearSession();
    res.json({ 
      message: 'Session ended',
      csvPath: csvPath 
    });
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
      const csvData = messages.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=P${participantId.padStart(3, '0')}_pilot_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      res.send(csvData);
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