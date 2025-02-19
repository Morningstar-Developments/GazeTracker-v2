import type { GazeData } from '../types/gazeData';

export interface FixationData {
  x: number;
  y: number;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface SaccadeData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
  duration: number;
  velocity: number;
  acceleration: number;
  startTime: number;
  endTime: number;
}

export interface AnalyticsResult {
  // Basic Statistics
  totalDuration: number;
  totalDataPoints: number;
  averageConfidence: number;
  samplingRate: number;

  // Fixations
  fixations: FixationData[];
  averageFixationDuration: number;
  fixationsPerMinute: number;
  totalFixationTime: number;
  fixationPercentage: number;

  // Saccades
  saccades: SaccadeData[];
  averageSaccadeLength: number;
  averageSaccadeVelocity: number;
  saccadesPerMinute: number;

  // Head Movement
  headMovementRange: {
    x: { min: number; max: number; range: number };
    y: { min: number; max: number; range: number };
    z: { min: number; max: number; range: number };
  };
  averageHeadDistance: number;

  // Pupil Data
  averagePupilDiameter: number;
  pupilDiameterRange: { min: number; max: number; range: number };

  // Spatial Distribution
  spatialDensity: {
    xRange: { min: number; max: number; range: number };
    yRange: { min: number; max: number; range: number };
    heatmapData: { x: number; y: number; weight: number }[];
  };
}

// Constants for scientifically validated thresholds
const FIXATION_DISPERSION_THRESHOLD = 1.0; // degrees of visual angle
const FIXATION_DURATION_THRESHOLD = 100; // milliseconds
const SACCADE_VELOCITY_THRESHOLD = 30; // degrees per second
const SACCADE_ACCELERATION_THRESHOLD = 8000; // degrees per second²
const PUPIL_BASELINE_WINDOW = 1000; // milliseconds for baseline calculation
const HEAD_MOVEMENT_SMOOTHING_WINDOW = 5; // samples for moving average

function calculateVisualAngle(x1: number, y1: number, x2: number, y2: number, distanceToScreen: number = 600): number {
  const pixelSize = 0.25; // mm per pixel (assuming standard 96 DPI)
  const dx = (x2 - x1) * pixelSize;
  const dy = (y2 - y1) * pixelSize;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.atan2(distance, distanceToScreen) * (180 / Math.PI);
}

function calculateDispersion(points: GazeData[]): number {
  if (points.length < 2) return 0;
  
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const dispersion = ((Math.max(...xs) - Math.min(...xs)) + 
                     (Math.max(...ys) - Math.min(...ys)));
                     
  return dispersion;
}

function isValidTimestamp(timestamp: number): boolean {
  return !isNaN(timestamp) && timestamp > 0 && timestamp < Date.now() + 86400000; // within 24h future
}

function calculateSessionDuration(gazeData: GazeData[]): number {
  if (!gazeData.length) return 0;
  
  const validTimestamps = gazeData
    .map(d => d.timestamp)
    .filter(isValidTimestamp)
    .sort((a, b) => a - b);

  if (!validTimestamps.length) return 0;
  
  return validTimestamps[validTimestamps.length - 1] - validTimestamps[0];
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '0ms';
  return `${ms.toFixed(0)}ms`;
}

function formatRate(count: number, durationMs: number): number {
  if (!isFinite(count) || !isFinite(durationMs) || durationMs <= 0) return 0;
  return (count / durationMs) * 60000; // Convert to per minute
}

function formatPercentage(part: number, whole: number): number {
  if (!isFinite(part) || !isFinite(whole) || whole <= 0) return 0;
  return (part / whole) * 100;
}

function detectFixationsIDT(gazeData: GazeData[]): FixationData[] {
  const fixations: FixationData[] = [];
  let currentWindow: GazeData[] = [];
  
  for (let i = 0; i < gazeData.length; i++) {
    if (!isValidTimestamp(gazeData[i].timestamp)) continue;
    
    currentWindow.push(gazeData[i]);
    
    // Calculate window duration
    const windowDuration = currentWindow[currentWindow.length - 1].timestamp - currentWindow[0].timestamp;
    
    // Calculate dispersion in visual angles
    const dispersion = calculateDispersion(currentWindow);
    const dispersionInDegrees = calculateVisualAngle(0, 0, dispersion, 0);
    
    if (dispersionInDegrees > FIXATION_DISPERSION_THRESHOLD) {
      // Window exceeds dispersion threshold
      if (windowDuration >= FIXATION_DURATION_THRESHOLD) {
        // Valid fixation
        const centerX = currentWindow.reduce((sum, p) => sum + p.x, 0) / currentWindow.length;
        const centerY = currentWindow.reduce((sum, p) => sum + p.y, 0) / currentWindow.length;
        
        fixations.push({
          x: centerX,
          y: centerY,
          duration: windowDuration,
          startTime: currentWindow[0].timestamp,
          endTime: currentWindow[currentWindow.length - 1].timestamp
        });
      }
      // Reset window to last point
      currentWindow = [gazeData[i]];
    }
  }
  
  // Handle the last window if it's a valid fixation
  const lastWindowDuration = currentWindow[currentWindow.length - 1]?.timestamp - currentWindow[0]?.timestamp;
  if (lastWindowDuration >= FIXATION_DURATION_THRESHOLD) {
    const centerX = currentWindow.reduce((sum, p) => sum + p.x, 0) / currentWindow.length;
    const centerY = currentWindow.reduce((sum, p) => sum + p.y, 0) / currentWindow.length;
    
    fixations.push({
      x: centerX,
      y: centerY,
      duration: lastWindowDuration,
      startTime: currentWindow[0].timestamp,
      endTime: currentWindow[currentWindow.length - 1].timestamp
    });
  }
  
  return fixations;
}

function detectSaccadesIVT(gazeData: GazeData[]): SaccadeData[] {
  const saccades: SaccadeData[] = [];
  let inSaccade = false;
  let saccadeStart: GazeData | null = null;
  
  for (let i = 1; i < gazeData.length; i++) {
    const current = gazeData[i];
    const previous = gazeData[i - 1];
    const timeInterval = (current.timestamp - previous.timestamp) / 1000; // Convert to seconds
    
    // Calculate point-to-point velocity in degrees/second
    const distance = Math.sqrt(
      Math.pow(current.x - previous.x, 2) + 
      Math.pow(current.y - previous.y, 2)
    );
    const velocity = calculateVisualAngle(previous.x, previous.y, current.x, current.y) / timeInterval;
    
    // Calculate acceleration
    const acceleration = velocity / timeInterval; // degrees/second²
    
    if (!inSaccade && velocity >= SACCADE_VELOCITY_THRESHOLD) {
      // Start of saccade
      inSaccade = true;
      saccadeStart = previous;
    } else if (inSaccade && velocity < SACCADE_VELOCITY_THRESHOLD) {
      // End of saccade
      if (saccadeStart) {
        saccades.push({
          startX: saccadeStart.x,
          startY: saccadeStart.y,
          endX: current.x,
          endY: current.y,
          length: Math.sqrt(
            Math.pow(current.x - saccadeStart.x, 2) + 
            Math.pow(current.y - saccadeStart.y, 2)
          ),
          duration: current.timestamp - saccadeStart.timestamp,
          velocity: velocity,
          acceleration: acceleration,
          startTime: saccadeStart.timestamp,
          endTime: current.timestamp
        });
      }
      inSaccade = false;
      saccadeStart = null;
    }
  }
  
  return saccades;
}

function processPupilData(gazeData: GazeData[]): number[] {
  const processedPupilData: number[] = [];
  
  // Calculate baseline using first PUPIL_BASELINE_WINDOW ms of data
  const baselineData = gazeData
    .filter(d => d.timestamp <= gazeData[0].timestamp + PUPIL_BASELINE_WINDOW)
    .map(d => d.pupilD)
    .filter((d): d is number => d !== undefined);
    
  const baseline = baselineData.reduce((sum, d) => sum + d, 0) / baselineData.length;
  
  // Apply baseline correction and filtering
  for (let i = 0; i < gazeData.length; i++) {
    const pupilD = gazeData[i].pupilD;
    if (pupilD === undefined) {
      processedPupilData.push(NaN);
      continue;
    }
    
    // Baseline correction
    const correctedPupil = pupilD - baseline;
    
    // Apply median filter (3-point window)
    const medianWindow = [
      i > 0 ? gazeData[i-1].pupilD : pupilD,
      pupilD,
      i < gazeData.length - 1 ? gazeData[i+1].pupilD : pupilD
    ].filter((d): d is number => d !== undefined);
    
    medianWindow.sort((a, b) => a - b);
    const filteredPupil = medianWindow[Math.floor(medianWindow.length / 2)];
    
    processedPupilData.push(filteredPupil - baseline);
  }
  
  return processedPupilData;
}

function processHeadMovement(gazeData: GazeData[]): { 
  smoothedPositions: { x: number; y: number; z: number }[];
  rotations: { yaw: number; pitch: number; roll: number }[] 
} {
  const smoothedPositions: { x: number; y: number; z: number }[] = [];
  const rotations: { yaw: number; pitch: number; roll: number }[] = [];
  
  // Apply moving average smoothing to positions
  for (let i = 0; i < gazeData.length; i++) {
    const windowStart = Math.max(0, i - Math.floor(HEAD_MOVEMENT_SMOOTHING_WINDOW / 2));
    const windowEnd = Math.min(gazeData.length, i + Math.floor(HEAD_MOVEMENT_SMOOTHING_WINDOW / 2));
    const window = gazeData.slice(windowStart, windowEnd);
    
    const smoothedX = window.reduce((sum, p) => sum + (p.HeadX || 0), 0) / window.length;
    const smoothedY = window.reduce((sum, p) => sum + (p.HeadY || 0), 0) / window.length;
    const smoothedZ = window.reduce((sum, p) => sum + (p.HeadZ || 0), 0) / window.length;
    
    smoothedPositions.push({ x: smoothedX, y: smoothedY, z: smoothedZ });
    
    // Convert Euler angles to quaternion for proper interpolation
    const yaw = gazeData[i].HeadYaw || 0;
    const pitch = gazeData[i].HeadPitch || 0;
    const roll = gazeData[i].HeadRoll || 0;
    
    rotations.push({ yaw, pitch, roll });
  }
  
  return { smoothedPositions, rotations };
}

function generateHeatmapData(gazeData: GazeData[]) {
  const gridSize = 50; // pixels
  const heatmapGrid: Map<string, number> = new Map();

  // Calculate grid cell weights
  gazeData.forEach(point => {
    const cellX = Math.floor(point.x / gridSize);
    const cellY = Math.floor(point.y / gridSize);
    const key = `${cellX},${cellY}`;
    heatmapGrid.set(key, (heatmapGrid.get(key) || 0) + 1);
  });

  // Convert to array format for visualization
  return Array.from(heatmapGrid.entries()).map(([key, weight]) => {
    const [x, y] = key.split(',').map(Number);
    return {
      x: x * gridSize + gridSize / 2,
      y: y * gridSize + gridSize / 2,
      weight: weight / gazeData.length // Normalize weights
    };
  });
}

function calculateAverageHeadDistance(positions: { x: number; y: number; z: number }[]): number {
  const range = {
    x: {
      min: Math.min(...positions.map(p => p.x)),
      max: Math.max(...positions.map(p => p.x)),
      range: Math.max(...positions.map(p => p.x)) - Math.min(...positions.map(p => p.x))
    },
    y: {
      min: Math.min(...positions.map(p => p.y)),
      max: Math.max(...positions.map(p => p.y)),
      range: Math.max(...positions.map(p => p.y)) - Math.min(...positions.map(p => p.y))
    },
    z: {
      min: Math.min(...positions.map(p => p.z)),
      max: Math.max(...positions.map(p => p.z)),
      range: Math.max(...positions.map(p => p.z)) - Math.min(...positions.map(p => p.z))
    }
  };
  
  return Math.sqrt(
    Math.pow(range.x.range, 2) +
    Math.pow(range.y.range, 2) +
    Math.pow(range.z.range, 2)
  ) / 2;
}

export function analyzeGazeData(gazeData: GazeData[]): AnalyticsResult {
  if (!gazeData.length) {
    throw new Error('No gaze data provided for analysis');
  }

  // Sort and validate data
  const sortedData = [...gazeData]
    .filter(d => isValidTimestamp(d.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!sortedData.length) {
    throw new Error('No valid gaze data points found');
  }

  const sessionDuration = calculateSessionDuration(sortedData);
  if (sessionDuration <= 0) {
    throw new Error('Invalid session duration');
  }

  // Basic Statistics
  const confidenceValues = sortedData
    .map(d => d.confidence)
    .filter((c): c is number => typeof c === 'number' && !isNaN(c));
    
  const averageConfidence = confidenceValues.length ? 
    confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length : 0;
  const samplingRate = (sortedData.length / sessionDuration) * 1000; // Convert to Hz

  // Detect fixations using I-DT algorithm
  const fixations = detectFixationsIDT(sortedData);
  const totalFixationTime = fixations.reduce((sum, f) => sum + f.duration, 0);
  const averageFixationDuration = fixations.length ? totalFixationTime / fixations.length : 0;
  const fixationsPerMinute = formatRate(fixations.length, sessionDuration);
  const fixationPercentage = formatPercentage(totalFixationTime, sessionDuration);

  // Detect saccades using I-VT algorithm
  const saccades = detectSaccadesIVT(sortedData);
  
  // Process pupil data
  const processedPupilData = processPupilData(sortedData);
  
  // Process head movement
  const headMovement = processHeadMovement(sortedData);

  // Calculate spatial distribution
  const heatmapData = generateHeatmapData(sortedData);

  return {
    totalDuration: sessionDuration,
    totalDataPoints: sortedData.length,
    averageConfidence,
    samplingRate,

    fixations,
    averageFixationDuration,
    fixationsPerMinute,
    totalFixationTime,
    fixationPercentage,

    saccades,
    averageSaccadeLength: saccades.reduce((sum, s) => sum + s.length, 0) / saccades.length,
    averageSaccadeVelocity: saccades.reduce((sum, s) => sum + s.velocity, 0) / saccades.length,
    saccadesPerMinute: formatRate(saccades.length, sessionDuration),

    headMovementRange: {
      x: { 
        min: Math.min(...headMovement.smoothedPositions.map(p => p.x)),
        max: Math.max(...headMovement.smoothedPositions.map(p => p.x)),
        range: Math.max(...headMovement.smoothedPositions.map(p => p.x)) - Math.min(...headMovement.smoothedPositions.map(p => p.x))
      },
      y: {
        min: Math.min(...headMovement.smoothedPositions.map(p => p.y)),
        max: Math.max(...headMovement.smoothedPositions.map(p => p.y)),
        range: Math.max(...headMovement.smoothedPositions.map(p => p.y)) - Math.min(...headMovement.smoothedPositions.map(p => p.y))
      },
      z: {
        min: Math.min(...headMovement.smoothedPositions.map(p => p.z)),
        max: Math.max(...headMovement.smoothedPositions.map(p => p.z)),
        range: Math.max(...headMovement.smoothedPositions.map(p => p.z)) - Math.min(...headMovement.smoothedPositions.map(p => p.z))
      }
    },
    averageHeadDistance: calculateAverageHeadDistance(headMovement.smoothedPositions),

    averagePupilDiameter: processedPupilData.reduce((sum, d) => sum + (isNaN(d) ? 0 : d), 0) / processedPupilData.filter(d => !isNaN(d)).length,
    pupilDiameterRange: {
      min: Math.min(...processedPupilData.filter(d => !isNaN(d))),
      max: Math.max(...processedPupilData.filter(d => !isNaN(d))),
      range: Math.max(...processedPupilData.filter(d => !isNaN(d))) - Math.min(...processedPupilData.filter(d => !isNaN(d)))
    },

    spatialDensity: {
      xRange: {
        min: Math.min(...sortedData.map(d => d.x)),
        max: Math.max(...sortedData.map(d => d.x)),
        range: Math.max(...sortedData.map(d => d.x)) - Math.min(...sortedData.map(d => d.x))
      },
      yRange: {
        min: Math.min(...sortedData.map(d => d.y)),
        max: Math.max(...sortedData.map(d => d.y)),
        range: Math.max(...sortedData.map(d => d.y)) - Math.min(...sortedData.map(d => d.y))
      },
      heatmapData
    }
  };
} 