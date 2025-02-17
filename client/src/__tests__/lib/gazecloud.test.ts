import { initGazeCloud, startTracking, stopTracking } from '../../lib/gazecloud';
import type { GazeData } from '../../types/gazeData';

describe('GazeCloud API Integration', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('initGazeCloud', () => {
    it('should initialize GazeCloud API successfully', async () => {
      const scriptAppendSpy = jest.spyOn(document.head, 'appendChild');
      
      await initGazeCloud();

      expect(scriptAppendSpy).toHaveBeenCalledWith(expect.any(HTMLScriptElement));
      expect(window.GazeCloudAPI.OnResult).toBeDefined();
      expect(window.GazeCloudAPI.OnCalibrationComplete).toBeDefined();
      expect(window.GazeCloudAPI.OnError).toBeDefined();
    });

    it('should handle script load error', async () => {
      const mockScript = {
        src: '',
        async: false,
        onload: null as any,
        onerror: null as any,
      };

      jest.spyOn(document, 'createElement').mockReturnValue(mockScript as any);
      
      const initPromise = initGazeCloud();
      mockScript.onerror(new Error('Script load failed'));

      await expect(initPromise).rejects.toThrow();
    });
  });

  describe('startTracking', () => {
    const mockGazeCallback = jest.fn();
    const mockCalibrationCallback = jest.fn();

    it('should start tracking when not already tracking', () => {
      startTracking(mockGazeCallback, mockCalibrationCallback);

      expect(window.GazeCloudAPI.StartEyeTracking).toHaveBeenCalled();
    });

    it('should not start tracking when already tracking', () => {
      startTracking(mockGazeCallback, mockCalibrationCallback);
      startTracking(mockGazeCallback, mockCalibrationCallback);

      expect(window.GazeCloudAPI.StartEyeTracking).toHaveBeenCalledTimes(1);
    });

    it('should handle gaze data correctly', () => {
      startTracking(mockGazeCallback, mockCalibrationCallback);

      const mockGazeResponse = {
        docX: 100,
        docY: 200,
        state: 0,
        diameter: 3.5,
        HeadX: 0.1,
        HeadY: 0.2,
        HeadZ: 0.3,
        HeadYaw: 10,
        HeadPitch: 20,
        HeadRoll: 30
      };

      window.GazeCloudAPI.OnResult(mockGazeResponse);

      expect(mockGazeCallback).toHaveBeenCalledWith(expect.objectContaining({
        x: 100,
        y: 200,
        confidence: 0,
        pupilD: 3.5,
        HeadX: 0.1,
        HeadY: 0.2,
        HeadZ: 0.3,
        HeadYaw: 10,
        HeadPitch: 20,
        HeadRoll: 30
      }));
    });
  });

  describe('stopTracking', () => {
    it('should stop tracking when currently tracking', () => {
      startTracking(jest.fn(), jest.fn());
      stopTracking();

      expect(window.GazeCloudAPI.StopEyeTracking).toHaveBeenCalled();
    });

    it('should not stop tracking when not tracking', () => {
      stopTracking();

      expect(window.GazeCloudAPI.StopEyeTracking).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors and reset tracking state', () => {
      const mockGazeCallback = jest.fn();
      const mockCalibrationCallback = jest.fn();
      
      startTracking(mockGazeCallback, mockCalibrationCallback);
      window.GazeCloudAPI.OnError(new Error('Test error'));

      // Try to send gaze data after error
      window.GazeCloudAPI.OnResult({ docX: 100, docY: 200 });
      
      expect(mockGazeCallback).not.toHaveBeenCalled();
    });
  });
}); 