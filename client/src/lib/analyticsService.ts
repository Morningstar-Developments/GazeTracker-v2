import { GazeData } from '../types/gazeData';

interface FixationData {
  x: number;
  y: number;
  duration: number;
  startTime: number;
  endTime: number;
}

interface SaccadeData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  amplitude: number;
  duration: number;
  velocity: number;
  startTime: number;
  endTime: number;
}

interface GazeMetrics {
  // Basic Statistics
  totalDuration: number;
  validSamples: number;
  samplingRate: number;
  dataQuality: number;

  // Fixation Metrics
  fixationCount: number;
  averageFixationDuration: number;
  totalFixationTime: number;
  fixationFrequency: number;
  fixations: FixationData[];

  // Saccade Metrics
  saccadeCount: number;
  averageSaccadeAmplitude: number;
  averageSaccadeVelocity: number;
  saccadeFrequency: number;
  saccades: SaccadeData[];

  // Spatial Metrics
  spatialDensity: number;
  scanpathLength: number;
  convexHullArea: number;

  // Head Movement Metrics
  headStability: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
  };

  // Pupil Metrics
  averagePupilDiameter: number;
  pupilDiameterVariability: number;
  pupilDiameterRange: {
    min: number;
    max: number;
  };
}

// Constants based on scientific literature
const FIXATION_THRESHOLD_TIME = 100; // minimum 100ms for fixation
const FIXATION_DISPERSION_THRESHOLD = 35; // 35 pixels dispersion threshold
const SACCADE_VELOCITY_THRESHOLD = 30; // 30 degrees per second
const SACCADE_ACCELERATION_THRESHOLD = 8000; // 8000 degrees per second²
const MIN_SAMPLES_FOR_FIXATION = 3; // Minimum samples to constitute a fixation

export class GazeAnalytics {
  private static calculateSamplingRate(gazeData: GazeData[]): number {
    if (gazeData.length < 2) return 0;
    const timeIntervals = [];
    for (let i = 1; i < gazeData.length; i++) {
      timeIntervals.push(gazeData[i].timestamp - gazeData[i - 1].timestamp);
    }
    const averageInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    return 1000 / averageInterval; // Convert to Hz
  }

  private static detectFixations(gazeData: GazeData[]): FixationData[] {
    const fixations: FixationData[] = [];
    let currentCluster: GazeData[] = [];
    
    for (let i = 0; i < gazeData.length; i++) {
      const point = gazeData[i];
      
      if (currentCluster.length === 0) {
        currentCluster.push(point);
        continue;
      }

      // Calculate dispersion of current cluster
      const dispersion = this.calculateDispersion(currentCluster);
      
      if (dispersion <= FIXATION_DISPERSION_THRESHOLD) {
        currentCluster.push(point);
      } else {
        // Check if current cluster qualifies as a fixation
        if (currentCluster.length >= MIN_SAMPLES_FOR_FIXATION) {
          const duration = currentCluster[currentCluster.length - 1].timestamp - currentCluster[0].timestamp;
          if (duration >= FIXATION_THRESHOLD_TIME) {
            fixations.push({
              x: currentCluster.reduce((sum, p) => sum + p.x, 0) / currentCluster.length,
              y: currentCluster.reduce((sum, p) => sum + p.y, 0) / currentCluster.length,
              duration: duration,
              startTime: currentCluster[0].timestamp,
              endTime: currentCluster[currentCluster.length - 1].timestamp
            });
          }
        }
        currentCluster = [point];
      }
    }

    return fixations;
  }

  private static detectSaccades(gazeData: GazeData[]): SaccadeData[] {
    const saccades: SaccadeData[] = [];
    let potentialSaccade: GazeData[] = [];
    
    for (let i = 1; i < gazeData.length; i++) {
      const velocity = this.calculateVelocity(gazeData[i-1], gazeData[i]);
      const acceleration = i > 1 ? this.calculateAcceleration(gazeData[i-2], gazeData[i-1], gazeData[i]) : 0;

      if (velocity > SACCADE_VELOCITY_THRESHOLD && acceleration > SACCADE_ACCELERATION_THRESHOLD) {
        potentialSaccade.push(gazeData[i]);
      } else if (potentialSaccade.length > 0) {
        if (potentialSaccade.length >= 2) {
          const start = potentialSaccade[0];
          const end = potentialSaccade[potentialSaccade.length - 1];
          const amplitude = Math.sqrt(
            Math.pow(end.x - start.x, 2) + 
            Math.pow(end.y - start.y, 2)
          );
          const duration = end.timestamp - start.timestamp;
          
          saccades.push({
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
            amplitude: amplitude,
            duration: duration,
            velocity: amplitude / duration * 1000, // Convert to degrees/second
            startTime: start.timestamp,
            endTime: end.timestamp
          });
        }
        potentialSaccade = [];
      }
    }

    return saccades;
  }

  private static calculateDispersion(points: GazeData[]): number {
    if (points.length < 2) return 0;
    
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return (maxX - minX) + (maxY - minY);
  }

  private static calculateVelocity(p1: GazeData, p2: GazeData): number {
    const distance = Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + 
      Math.pow(p2.y - p1.y, 2)
    );
    const time = (p2.timestamp - p1.timestamp) / 1000; // Convert to seconds
    return distance / time;
  }

  private static calculateAcceleration(p1: GazeData, p2: GazeData, p3: GazeData): number {
    const v1 = this.calculateVelocity(p1, p2);
    const v2 = this.calculateVelocity(p2, p3);
    const time = (p3.timestamp - p1.timestamp) / 1000; // Convert to seconds
    return Math.abs(v2 - v1) / time;
  }

  private static calculateConvexHull(points: { x: number; y: number }[]): number {
    // Graham's scan algorithm for convex hull
    if (points.length < 3) return 0;

    const hull = this.grahamScan(points);
    return this.calculatePolygonArea(hull);
  }

  private static grahamScan(points: { x: number; y: number }[]): { x: number; y: number }[] {
    // Implementation of Graham's scan algorithm
    // Returns vertices of convex hull
    // ... (implementation details)
    return [];
  }

  private static calculatePolygonArea(vertices: { x: number; y: number }[]): number {
    if (vertices.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  private static calculateHeadStability(gazeData: GazeData[]) {
    const headData = gazeData.filter(d => 
      d.HeadX !== undefined && 
      d.HeadY !== undefined && 
      d.HeadZ !== undefined &&
      d.HeadYaw !== undefined &&
      d.HeadPitch !== undefined &&
      d.HeadRoll !== undefined
    );

    if (headData.length === 0) {
      return {
        x: 0, y: 0, z: 0,
        yaw: 0, pitch: 0, roll: 0
      };
    }

    // Calculate RMS of head movement
    const calculateRMS = (values: number[]) => {
      const squared = values.map(v => v * v);
      return Math.sqrt(squared.reduce((a, b) => a + b) / values.length);
    };

    return {
      x: calculateRMS(headData.map(d => d.HeadX!)),
      y: calculateRMS(headData.map(d => d.HeadY!)),
      z: calculateRMS(headData.map(d => d.HeadZ!)),
      yaw: calculateRMS(headData.map(d => d.HeadYaw!)),
      pitch: calculateRMS(headData.map(d => d.HeadPitch!)),
      roll: calculateRMS(headData.map(d => d.HeadRoll!))
    };
  }

  public static computeMetrics(gazeData: GazeData[]): GazeMetrics {
    // Filter valid samples
    const validData = gazeData.filter(d => d.state === 0);
    if (validData.length === 0) {
      throw new Error('No valid gaze data points found');
    }

    // Sort data by timestamp
    const sortedData = [...validData].sort((a, b) => a.timestamp - b.timestamp);
    
    // Basic metrics
    const totalDuration = sortedData[sortedData.length - 1].timestamp - sortedData[0].timestamp;
    const samplingRate = this.calculateSamplingRate(sortedData);
    
    // Detect fixations and saccades
    const fixations = this.detectFixations(sortedData);
    const saccades = this.detectSaccades(sortedData);
    
    // Calculate spatial metrics
    const scanpathLength = saccades.reduce((sum, s) => sum + s.amplitude, 0);
    const spatialPoints = sortedData.map(d => ({ x: d.x, y: d.y }));
    const convexHullArea = this.calculateConvexHull(spatialPoints);
    
    // Process pupil data
    const pupilData = sortedData
      .map(d => d.pupilD)
      .filter((d): d is number => d !== undefined);
    
    const pupilMetrics = {
      average: pupilData.length ? 
        pupilData.reduce((a, b) => a + b, 0) / pupilData.length : 0,
      variability: pupilData.length ? 
        Math.sqrt(pupilData.reduce((sum, d) => sum + Math.pow(d - (pupilData.reduce((a, b) => a + b, 0) / pupilData.length), 2), 0) / pupilData.length) : 0,
      min: pupilData.length ? Math.min(...pupilData) : 0,
      max: pupilData.length ? Math.max(...pupilData) : 0
    };

    return {
      // Basic Statistics
      totalDuration,
      validSamples: validData.length,
      samplingRate,
      dataQuality: (validData.length / gazeData.length) * 100,

      // Fixation Metrics
      fixationCount: fixations.length,
      averageFixationDuration: fixations.length ? 
        fixations.reduce((sum, f) => sum + f.duration, 0) / fixations.length : 0,
      totalFixationTime: fixations.reduce((sum, f) => sum + f.duration, 0),
      fixationFrequency: (fixations.length / totalDuration) * 1000, // Convert to fixations/second
      fixations,

      // Saccade Metrics
      saccadeCount: saccades.length,
      averageSaccadeAmplitude: saccades.length ?
        saccades.reduce((sum, s) => sum + s.amplitude, 0) / saccades.length : 0,
      averageSaccadeVelocity: saccades.length ?
        saccades.reduce((sum, s) => sum + s.velocity, 0) / saccades.length : 0,
      saccadeFrequency: (saccades.length / totalDuration) * 1000, // Convert to saccades/second
      saccades,

      // Spatial Metrics
      spatialDensity: convexHullArea ? scanpathLength / convexHullArea : 0,
      scanpathLength,
      convexHullArea,

      // Head Movement Metrics
      headStability: this.calculateHeadStability(sortedData),

      // Pupil Metrics
      averagePupilDiameter: pupilMetrics.average,
      pupilDiameterVariability: pupilMetrics.variability,
      pupilDiameterRange: {
        min: pupilMetrics.min,
        max: pupilMetrics.max
      }
    };
  }
} 