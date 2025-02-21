import React, { useEffect, useRef } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { GazeData } from '../../types/gazeData';
import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip
);

interface PupilDilationProps {
  data: GazeData[];
}

const PupilDilation: React.FC<PupilDilationProps> = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Cleanup previous chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Filter valid pupil data
    const validData = data.filter(d => 
      d.pupilD !== undefined && 
      d.pupilD !== null && 
      d.timestamp
    );

    if (validData.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Pupil Diameter (mm)',
          data: validData.map(d => ({
            x: Number(d.timestamp),
            y: Number(d.pupilD || 0)
          })),
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'second',
              displayFormats: {
                second: 'HH:mm:ss'
              }
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Pupil Diameter (mm)'
            },
            min: 2,  // Typical minimum pupil size
            max: 8   // Typical maximum pupil size
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const point = context.raw;
                return `Diameter: ${point.y.toFixed(2)}mm`;
              }
            }
          },
          title: {
            display: true,
            text: 'Pupil Dilation Over Time'
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
          Pupil Dilation
        </Typography>
        <div style={{ height: '400px', position: 'relative' }}>
          <canvas ref={chartRef} />
        </div>
      </CardContent>
    </Card>
  );
};

export default PupilDilation; 