import express from 'express';
import { Router } from 'express';
import { DataStorageService, SessionConfig } from '../services/dataStorage';
import { GazeData } from '../types/gazeData';

const router = Router();
const dataStorage = new DataStorageService();

// Initialize a new session
router.post('/sessions', (req, res) => {
  const config: SessionConfig = {
    participantId: req.body.participantId,
    isPilot: req.body.isPilot
  };
  
  dataStorage.initializeSession(config);
  res.status(201).json({ message: 'Session initialized' });
});

// Get all gaze data for current session
router.get('/sessions/current/gaze', (req, res) => {
  res.json(dataStorage.getCurrentSession());
});

// Add new gaze data point
router.post('/sessions/current/gaze', (req, res) => {
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
  res.status(201).json(gazeData);
});

// Save current session to CSV
router.post('/sessions/current/save', (req, res) => {
  try {
    const filename = dataStorage.saveSession();
    res.json({ filename });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Clear current session
router.delete('/sessions/current', (req, res) => {
  dataStorage.clearSession();
  res.status(204).send();
});

export default router; 