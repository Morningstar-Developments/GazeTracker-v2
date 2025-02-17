import '@testing-library/jest-dom';

// Mock GazeCloudAPI
global.window.GazeCloudAPI = {
  StartEyeTracking: jest.fn(),
  StopEyeTracking: jest.fn(),
  OnResult: jest.fn(),
  OnCalibrationComplete: jest.fn(),
  OnError: jest.fn(),
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock canvas context
const createMockContext = () => ({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  putImageData: jest.fn(),
});

// @ts-ignore - Ignore type checking for canvas mock
HTMLCanvasElement.prototype.getContext = jest.fn((contextId: string) => {
  if (contextId === '2d') return createMockContext();
  return null;
}); 