import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Heatmap from './components/Heatmap';
import GazeTracker from './components/GazeTracker';
import SessionControl from './components/SessionControl';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { initGazeCloud } from './lib/gazecloud';
import './index.css';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    initGazeCloud().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <SessionControl />
        <div className="visualization-container">
          <div className="gaze-container">
            <GazeTracker />
            <Heatmap />
          </div>
          <AnalyticsDashboard />
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;