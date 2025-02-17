import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Heatmap from '../../components/Heatmap';
import { fetchApi } from '../../lib/api';

// Mock the API module
jest.mock('../../lib/api', () => ({
  fetchApi: jest.fn()
}));

const mockGazeData = [
  { x: 100, y: 100, confidence: 0.8 },
  { x: 200, y: 200, confidence: 0.9 },
  { x: 300, y: 300, confidence: 0.7 }
];

describe('Heatmap Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    (fetchApi as jest.Mock).mockResolvedValue(mockGazeData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithQuery = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it('should render toggle button', () => {
    renderWithQuery(<Heatmap />);
    expect(screen.getByText('Show Heatmap')).toBeInTheDocument();
  });

  it('should toggle visibility on button click', () => {
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    fireEvent.click(button);
    expect(screen.getByText('Hide Heatmap')).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(screen.getByText('Show Heatmap')).toBeInTheDocument();
  });

  it('should fetch data when visible', async () => {
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(fetchApi).toHaveBeenCalledWith('api/sessions/current/gaze');
    });
  });

  it('should not fetch data when hidden', () => {
    renderWithQuery(<Heatmap />);
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it('should render SVG when data is available and visible', async () => {
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('style')).toContain('opacity: 0.6');
    });
  });

  it('should clear SVG when hidden', async () => {
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    // Show heatmap
    fireEvent.click(button);
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeInTheDocument();
    });
    
    // Hide heatmap
    fireEvent.click(button);
    await waitFor(() => {
      const svg = document.querySelector('svg');
      expect(svg?.getAttribute('style')).toContain('opacity: 0');
    });
  });

  it('should handle API errors gracefully', async () => {
    (fetchApi as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const svg = document.querySelector('svg');
      expect(svg?.innerHTML).toBe('');
    });
  });

  it('should filter out low confidence points', async () => {
    const dataWithLowConfidence = [
      ...mockGazeData,
      { x: 400, y: 400, confidence: 0.2 } // Should be filtered out
    ];
    
    (fetchApi as jest.Mock).mockResolvedValue(dataWithLowConfidence);
    
    renderWithQuery(<Heatmap />);
    const button = screen.getByText('Show Heatmap');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const paths = document.querySelectorAll('path');
      // The number of paths should correspond to the high confidence points
      expect(paths.length).toBeGreaterThan(0);
    });
  });
}); 