import React, { useEffect, useRef } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { GazeData } from '../../types/gazeData';
import { Chart, ScatterController, LineController, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  ScatterController,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip
);

interface GazePathProps {
  data: GazeData[];
}

const GazePath: React.FC<GazePathProps> = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Cleanup previous chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Filter valid gaze points
    const validData = data.filter(d => 
      d.x !== undefined && d.y !== undefined && 
      d.x !== null && d.y !== null
    );

    if (validData.length === 0) return;

    // Create color gradient based on timestamp
    const startTime = validData[0].timestamp;
    const endTime = validData[validData.length - 1].timestamp;
    
    const points = validData.map(d => ({
      x: d.x,
      y: d.y,
      timestamp: d.timestamp
    }));

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Gaze Path',
          data: points,
          backgroundColor: points.map(p => {
            const progress = (p.timestamp - startTime) / (endTime - startTime);
            return `hsl(${200 + progress * 160}, 70%, 50%)`;
          }),
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            reverse: true,
            title: {
              display: true,
              text: 'Y Position (pixels)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'X Position (pixels)'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const point = context.raw;
                return [
                  `Position: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`,
                  `Time: ${new Date(point.timestamp).toLocaleTimeString()}`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'Gaze Movement Path'
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Eye Movement Trajectory
        </Typography>
        <div style={{ height: '400px', position: 'relative' }}>
          <canvas ref={chartRef} />
        </div>
      </CardContent>
    </Card>
  );
};

export default GazePath; 