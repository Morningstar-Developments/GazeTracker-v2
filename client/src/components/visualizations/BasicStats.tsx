import React from 'react';
import { Card, Grid, Typography, Box } from '@mui/material';
import { GazeData } from '../../types/gazeData';

interface BasicStatsProps {
  data: GazeData[];
}

interface StatsData {
  [key: string]: number | string | { [key: string]: string | number };
}

const BasicStats: React.FC<BasicStatsProps> = ({ data }) => {
  const computeBasicStats = (data: GazeData[]): StatsData => {
    const validData = data.filter(d => d.confidence !== undefined);
    const validPupilData = data.filter(d => d.pupilD !== undefined && d.pupilD !== null);
    const validHeadData = data.filter(d => d.HeadX !== undefined && d.HeadY !== undefined && d.HeadZ !== undefined);
    
    const mean = (arr: number[]): number => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    return {
      "Session Overview": {
        "Total Points": data.length,
        "Valid Points": validData.length,
        "Duration": `${((data[data.length - 1]?.timestamp || 0) - (data[0]?.timestamp || 0) / 1000).toFixed(1)}s`
      },
      "Gaze Quality": {
        "Average Confidence": `${(mean(validData.map(d => d.confidence || 0)) * 100).toFixed(1)}%`,
        "Valid Samples": `${((validData.length / data.length) * 100).toFixed(1)}%`
      },
      "Pupil Metrics": {
        "Mean Diameter": `${mean(validPupilData.map(d => d.pupilD || 0)).toFixed(2)}mm`,
        "Min": `${Math.min(...validPupilData.map(d => d.pupilD || 0)).toFixed(2)}mm`,
        "Max": `${Math.max(...validPupilData.map(d => d.pupilD || 0)).toFixed(2)}mm`
      },
      "Head Position": {
        "X Mean": `${mean(validHeadData.map(d => d.HeadX || 0)).toFixed(1)}°`,
        "Y Mean": `${mean(validHeadData.map(d => d.HeadY || 0)).toFixed(1)}°`,
        "Z Mean": `${mean(validHeadData.map(d => d.HeadZ || 0)).toFixed(1)}cm`
      },
      "Head Rotation": {
        "Yaw": `${mean(validHeadData.map(d => d.HeadYaw || 0)).toFixed(1)}°`,
        "Pitch": `${mean(validHeadData.map(d => d.HeadPitch || 0)).toFixed(1)}°`,
        "Roll": `${mean(validHeadData.map(d => d.HeadRoll || 0)).toFixed(1)}°`
      }
    };
  };

  const stats = computeBasicStats(data);

  return (
    <Grid container spacing={2}>
      {Object.entries(stats).map(([category, values]) => (
        <Grid item xs={12} sm={6} md={4} key={category}>
          <Card sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {category}
            </Typography>
            <Box>
              {Object.entries(values as { [key: string]: string | number }).map(([key, value]) => (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {key}:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default BasicStats; 