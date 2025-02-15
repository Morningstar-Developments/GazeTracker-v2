import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Heatmap from './components/Heatmap';
import GazeTracker from './components/GazeTracker';
import { initGazeCloud } from './lib/gazecloud';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    initGazeCloud().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <GazeTracker />
        <Heatmap />
      </div>
    </QueryClientProvider>
  );
}

export default App; 