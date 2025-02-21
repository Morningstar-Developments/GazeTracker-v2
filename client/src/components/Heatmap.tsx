import React, { useEffect, useRef } from 'react';
import { GazeData } from '../types/gazeData';

interface HeatmapProps {
  gazeData: GazeData[];
  width: number;
  height: number;
}

const Heatmap: React.FC<HeatmapProps> = ({ gazeData, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || gazeData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Create heatmap data
    const heatmapData = new Uint8ClampedArray(width * height * 4);

    // Process gaze points with improved visualization
    gazeData.forEach(point => {
      if (typeof point.x !== 'number' || typeof point.y !== 'number') return;

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);

      if (x >= 0 && x < width && y >= 0 && y < height) {
        // Customize these parameters for better visualization
        const radius = 40; // Increased radius for better visibility
        const baseIntensity = 0.7; // Base intensity
        const confidenceBoost = (point.confidence || 0.5) * 0.3; // Confidence affects intensity
        const intensity = (baseIntensity + confidenceBoost) * 255;

        // Add gaussian blur with improved color gradient
        for (let i = -radius; i <= radius; i++) {
          for (let j = -radius; j <= radius; j++) {
            const currentX = x + i;
            const currentY = y + j;

            if (currentX >= 0 && currentX < width && currentY >= 0 && currentY < height) {
              const distance = Math.sqrt(i * i + j * j);
              const gaussianFactor = Math.exp(-(distance * distance) / (2 * (radius / 3) * (radius / 3)));
              const index = (currentY * width + currentX) * 4;

              // Create a color gradient based on intensity
              const gradientFactor = gaussianFactor * intensity;
              heatmapData[index] = Math.min(255, heatmapData[index] + gradientFactor); // Red
              heatmapData[index + 1] = Math.min(255, heatmapData[index + 1] + gradientFactor * 0.5); // Green
              heatmapData[index + 2] = Math.min(255, heatmapData[index + 2] + gradientFactor * 0.2); // Blue
              heatmapData[index + 3] = Math.min(200, heatmapData[index + 3] + gradientFactor * 0.8); // Alpha
            }
          }
        }
      }
    });

    // Create ImageData and apply it to canvas
    const imageData = new ImageData(heatmapData, width, height);
    ctx.putImageData(imageData, 0, 0);

    // Apply post-processing effects
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

  }, [gazeData, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        opacity: 0.7,
        zIndex: 9998,
        mixBlendMode: 'multiply'
      }}
    />
  );
};

export default Heatmap; 