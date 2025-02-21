import React, { useEffect, useRef } from 'react';
import { Card, CardContent, Typography, Box, Tab, Tabs } from '@mui/material';
import { GazeData } from '../../types/gazeData';
import {
  Chart,
  ChartConfiguration,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  ScatterDataPoint
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  x: number;  // timestamp in milliseconds
  y: number;
}

interface HeadMovementProps {
  data: GazeData[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

type ChartPoint = {
  x: number;
  y: number;
};

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const HeadMovement: React.FC<HeadMovementProps> = ({ data }) => {
  const [tabValue, setTabValue] = React.useState(0);
  const positionChartRef = useRef<HTMLCanvasElement>(null);
  const rotationChartRef = useRef<HTMLCanvasElement>(null);
  const positionChartInstance = useRef<Chart | null>(null);
  const rotationChartInstance = useRef<Chart | null>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useEffect(() => {
    const createPositionChart = () => {
      if (!positionChartRef.current) return;

      if (positionChartInstance.current) {
        positionChartInstance.current.destroy();
      }

      const validData = data.filter(d => 
        d.HeadX !== undefined && d.HeadY !== undefined && d.HeadZ !== undefined &&
        d.HeadX !== null && d.HeadY !== null && d.HeadZ !== null &&
        typeof d.HeadX === 'number' && typeof d.HeadY === 'number' && typeof d.HeadZ === 'number'
      );

      if (validData.length === 0) return;

      const ctx = positionChartRef.current.getContext('2d');
      if (!ctx) return;

      const chartConfig: ChartConfiguration = {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'X Position',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadX)
              } as ScatterDataPoint)),
              borderColor: 'rgba(255, 99, 132, 1)',
              tension: 0.4
            },
            {
              label: 'Y Position',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadY)
              } as ScatterDataPoint)),
              borderColor: 'rgba(54, 162, 235, 1)',
              tension: 0.4
            },
            {
              label: 'Z Position',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadZ)
              } as ScatterDataPoint)),
              borderColor: 'rgba(75, 192, 192, 1)',
              tension: 0.4
            }
          ]
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
                text: 'Position (cm)'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Head Position Over Time'
            }
          }
        }
      };

      positionChartInstance.current = new Chart(ctx, chartConfig);
    };

    const createRotationChart = () => {
      if (!rotationChartRef.current) return;

      if (rotationChartInstance.current) {
        rotationChartInstance.current.destroy();
      }

      const validData = data.filter(d => 
        d.HeadYaw !== undefined && d.HeadPitch !== undefined && d.HeadRoll !== undefined &&
        d.HeadYaw !== null && d.HeadPitch !== null && d.HeadRoll !== null
      );

      if (validData.length === 0) return;

      const ctx = rotationChartRef.current.getContext('2d');
      if (!ctx) return;

      rotationChartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Yaw',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadYaw || 0)
              })),
              borderColor: 'rgba(255, 99, 132, 1)',
              tension: 0.4
            },
            {
              label: 'Pitch',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadPitch || 0)
              })),
              borderColor: 'rgba(54, 162, 235, 1)',
              tension: 0.4
            },
            {
              label: 'Roll',
              data: validData.map(d => ({
                x: Number(d.timestamp),
                y: Number(d.HeadRoll || 0)
              })),
              borderColor: 'rgba(75, 192, 192, 1)',
              tension: 0.4
            }
          ]
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
                text: 'Rotation (degrees)'
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: 'Head Rotation Over Time'
            }
          }
        }
      });
    };

    createPositionChart();
    createRotationChart();

    return () => {
      if (positionChartInstance.current) {
        positionChartInstance.current.destroy();
      }
      if (rotationChartInstance.current) {
        rotationChartInstance.current.destroy();
      }
    };
  }, [data]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Head Movement Analysis
        </Typography>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Position" />
            <Tab label="Rotation" />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={0}>
          <div style={{ height: '400px', position: 'relative' }}>
            <canvas ref={positionChartRef} />
          </div>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <div style={{ height: '400px', position: 'relative' }}>
            <canvas ref={rotationChartRef} />
          </div>
        </TabPanel>
      </CardContent>
    </Card>
  );
};

export default HeadMovement; 