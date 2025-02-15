import express from 'express';
import { Router } from 'express';

const router = Router();

interface GazeData {
  x: number;
  y: number;
  timestamp: number;
  confidence?: number;
  pupilD?: number;
}

let currentSession: GazeData[] = [];

// Get all gaze data for current session
router.get('/sessions/current/gaze', (req, res) => {
  res.json(currentSession);
});

// Add new gaze data point
router.post('/sessions/current/gaze', (req, res) => {
  const gazeData: GazeData = {
    x: req.body.x,
    y: req.body.y,
    timestamp: Date.now(),
    confidence: req.body.confidence,
    pupilD: req.body.PupilD
  };
  
  currentSession.push(gazeData);
  res.status(201).json(gazeData);
});

// Clear current session
router.delete('/sessions/current/gaze', (req, res) => {
  currentSession = [];
  res.status(204).send();
});

export default router; 