import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GazeData } from '../types/gazeData';
import { computeGazeMetrics } from '../lib/analytics';

const AnalyticsDashboard: React.FC = () => {
  const { data: gazeData } = useQuery<GazeData[]>({
    queryKey: ['gaze-data'],
    queryFn: async () => {
      // Mock data for now
      return [];
    }
  });

  const metrics = gazeData ? computeGazeMetrics(gazeData) : null;

  return (
    <div className="analytics-dashboard">
      <h2>Analytics Dashboard</h2>
      {metrics ? (
        <div className="metrics-grid">
          <div className="metric-group">
            <h3>Confidence</h3>
            <p>{(metrics.averageConfidence * 100).toFixed(1)}%</p>
          </div>
          <div className="metric-group">
            <h3>Fixations</h3>
            <p>{metrics.fixationCount}</p>
            <p>Avg Duration: {metrics.averageFixationDuration.toFixed(0)}ms</p>
          </div>
          <div className="metric-group">
            <h3>Saccades</h3>
            <p>{metrics.saccadeCount}</p>
            <p>Avg Length: {metrics.averageSaccadeLength.toFixed(1)}px</p>
          </div>
          <div className="metric-group">
            <h3>Session Duration</h3>
            <p>{(metrics.totalDuration / 1000).toFixed(1)}s</p>
          </div>
        </div>
      ) : (
        <p>No data available</p>
      )}
    </div>
  );
};

export default AnalyticsDashboard; 